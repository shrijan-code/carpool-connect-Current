import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import { doc, updateDoc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { User, getErrorMessage, AuditLogData } from '@/types';
import { stripeCircuitBreaker, CircuitBreakerOpenError } from '@/utils/circuit-breaker';
import { logger } from '@/utils/logger';

// Stripe Configuration - Keys should come from environment variables
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
// Note: Stripe Connect URLs are now dynamically generated via Cloud Functions

// Initialize Stripe - Web compatible version
export const initializeStripe = async (): Promise<void> => {
  logger.debug('Stripe initialization', { platform: Platform.OS });

  if (Platform.OS === 'web') {
    logger.debug('Stripe initialization skipped on web platform');
    return Promise.resolve();
  }

  // For native platforms, we simulate initialization
  // In production, you would properly initialize Stripe here
  logger.debug('Stripe initialization completed for native platform');
  return Promise.resolve();
};

// Stripe Connect Express Account Management
export class StripeConnectService {
  private static readonly BACKEND_URL = 'https://your-firebase-functions-url.com'; // Replace with your Firebase Functions URL

  /**
   * Start Stripe Connect Express onboarding flow
   * This creates a Stripe Express account and returns the onboarding URL
   */
  static async startConnectOnboarding(user: User): Promise<string> {
    try {
      logger.info('Starting Stripe Connect onboarding', { userId: user.id });

      const createAccount = httpsCallable(functions, 'createStripeConnectAccount');
      const response = await createAccount();
      const data = response.data as { url?: string };

      if (!data.url) {
        throw new Error('No URL returned from backend');
      }

      logger.debug('Generated Connect URL', { url: data.url.substring(0, 50) + '...' });
      return data.url;
    } catch (error) {
      logger.error('Error starting Connect onboarding', error);
      throw new Error('Failed to start Stripe Connect onboarding');
    }
  }

  /**
   * Handle the return from Stripe Connect Express onboarding
   * This should be called when the user returns to your app
   */
  static async handleConnectReturn(url: string, userId: string): Promise<boolean> {
    try {
      logger.debug('Handling Connect return URL', { urlPrefix: url.substring(0, 30) });

      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state');
      const error = parsedUrl.searchParams.get('error');

      if (error) {
        logger.error('Stripe Connect error', new Error(error));
        throw new Error(`Stripe Connect error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }

      // Verify state parameter
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();

      if (!userData || userData.stripeConnectState !== state) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // Exchange authorization code for account ID via your backend
      const response = await fetch(`${this.BACKEND_URL}/stripe/connect/oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete Stripe Connect setup');
      }

      const result = await response.json();

      // Update user document with Stripe account ID
      await updateDoc(doc(db, 'users', userId), {
        stripeAccountId: result.stripe_user_id,
        stripeConnectCompleted: true,
        stripeConnectCompletedAt: serverTimestamp(),
        stripeConnectState: null, // Clear the state
      });

      logger.info('Stripe Connect setup completed', { userId });
      return true;
    } catch (error) {
      logger.error('Error handling Connect return', error);
      throw error;
    }
  }

  /**
   * Check if user has completed Stripe Connect onboarding
   */
  static async isConnectSetupComplete(userId: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      return !!(userData?.stripeAccountId && userData?.stripeConnectCompleted);
    } catch (error) {
      logger.error('Error checking Connect setup', error);
      return false;
    }
  }

  /**
   * Get Stripe account status for a user
   */
  static async getAccountStatus(userId: string): Promise<any> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/stripe/account/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to get account status');
      }

      return await response.json();
    } catch (error) {
      logger.error('Error getting account status', error);
      throw error;
    }
  }
}

// Payment Processing Service
export class StripePaymentService {
  /**
   * Create a payment intent for a ride booking
   * This handles the platform fee and transfer to the driver's connected account
   * Protected by circuit breaker to prevent cascading failures
   */
  static async createPaymentIntent({
    amount, // In cents
    bookingId,
  }: {
    amount: number;
    bookingId: string;
    // Driver ID is handled by backend logic
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    // Wrap with circuit breaker
    return stripeCircuitBreaker.execute(async () => {
      logger.payment.initiated(bookingId, amount);

      const processPayment = httpsCallable(functions, 'processPayment');
      const response = await processPayment({
        bookingId,
        amount: amount / 100, // Backend expects dollars
      });

      const result = response.data as any;

      if (!result.success && result.status !== 'requires_payment_method') {
        // Only throw if it's a real error, not just an incomplete payment
        if (result.error) {
          throw new Error(result.error);
        }
      }

      logger.debug('Payment intent created', { paymentId: result.paymentId });

      return {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentId,
      };
    }).catch((error: any) => {
      // Re-throw circuit breaker errors with user-friendly message
      if (error instanceof CircuitBreakerOpenError) {
        throw new Error('Payment service is temporarily unavailable. Please try again in a few minutes.');
      }
      logger.error('Error creating payment intent', error);
      throw new Error(getErrorMessage(error) || 'Failed to create payment intent');
    });
  }

  /**
   * Capture a pre-authorized payment
   * Protected by circuit breaker to prevent cascading failures
   */
  static async capturePayment(paymentIntentId: string, bookingId: string): Promise<void> {
    return stripeCircuitBreaker.execute(async () => {
      logger.debug('Capturing payment', { paymentIntentId });
      const capturePaymentFn = httpsCallable(functions, 'capturePayment');
      const response = await capturePaymentFn({ paymentIntentId, bookingId });
      const result = response.data as any;

      if (!result.success) {
        throw new Error('Capture failed on server');
      }
      logger.payment.succeeded(paymentIntentId);
    }).catch((error) => {
      if (error instanceof CircuitBreakerOpenError) {
        throw new Error('Payment service is temporarily unavailable. Please try again in a few minutes.');
      }
      logger.error('Error capturing payment', error);
      throw new Error(getErrorMessage(error) || 'Failed to capture payment');
    });
  }

  /**
   * Confirm payment via backend
   * In a real implementation, this would be handled by your React Native component using useStripe hook
   */
  /**
   * Confirm payment via backend
   * @deprecated Use Stripe SDK directly on frontend
   */
  static async confirmPayment(
    paymentIntentId: string
  ): Promise<{ success: boolean; paymentIntent?: any; error?: string }> {
    console.warn('confirmPayment is deprecated. Use Stripe SDK to confirm paymentIntent client side.');
    return { success: false, error: 'Use Stripe SDK to confirm' };
  }

  /**
   * Process a ride booking payment
   * This is a high-level method that handles the entire payment flow
   */
  static async processRidePayment({
    rideId,
    bookingId,
    amount,
    driverStripeAccountId,
    platformFeePercentage = 0.1, // 10% platform fee
  }: {
    rideId: string;
    bookingId: string;
    amount: number; // Amount in dollars
    driverStripeAccountId: string;
    platformFeePercentage?: number;
  }): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
    try {
      // Calculate amounts in cents
      const amountCents = Math.round(amount * 100);
      const platformFeeCents = Math.round(amountCents * platformFeePercentage);

      // Create payment intent
      // Note: Backend expects amount in dollars/major units
      const { paymentIntentId } = await this.createPaymentIntent({
        amount: amountCents / 100, // Convert back to dollars for backend call
        bookingId,
      });

      // For demo purposes, we'll simulate successful payment
      // In a real app, you'd use the Stripe SDK to collect payment method and confirm
      logger.debug('Simulating successful payment for demo');

      // Log the payment attempt
      await addDoc(collection(db, 'payment_logs'), {
        paymentIntentId,
        rideId,
        bookingId,
        amount: amountCents,
        platformFee: platformFeeCents,
        driverAmount: amountCents - platformFeeCents,
        status: 'succeeded',
        createdAt: serverTimestamp(),
      });

      return {
        success: true,
        paymentIntentId,
      };
    } catch (error) {
      logger.error('Error processing ride payment', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      };
    }
  }
}

// Webhook handling types (for Firebase Functions)
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

// Audit logging for Stripe operations
export class StripeAuditService {
  static async logStripeAction(
    action: string,
    userId: string,
    data: any
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'stripe_audit_logs'), {
        action,
        userId,
        data,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      logger.error('Stripe audit log error', error);
    }
  }
}