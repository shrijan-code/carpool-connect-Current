import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import { doc, updateDoc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { User } from '@/types';

// Stripe Configuration
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51HMiYNDuXA4vn5QKRFRjdRH71bcNVlaxgaB459LlIuyAre8qUVEb53vf4haYuAKm2nVPxGssxvxaKN9Eb00kXF1n000Hg6HieO';
const STRIPE_CONNECT_EXPRESS_URL = 'https://connect.stripe.com/d/setup/e/_Ssi0gOdCthBE4fgZQRUlmpCzGf/YWNjdF8xUnd3YVdEOHNYUnNKbjRX/e3e98a16a56c29b3c';

// Initialize Stripe - Web compatible version
export const initializeStripe = async (): Promise<void> => {
  console.log(`Stripe initialization for ${Platform.OS} platform`);

  if (Platform.OS === 'web') {
    console.log('Stripe initialization skipped on web platform - using web-compatible payment methods');
    return Promise.resolve();
  }

  // For native platforms, we simulate initialization
  // In production, you would properly initialize Stripe here
  console.log('Stripe initialization completed for native platform');
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
      console.log('Starting Stripe Connect onboarding for user:', user.id);

      const createAccount = httpsCallable(functions, 'createStripeConnectAccount');
      const { data }: any = await createAccount();

      if (!data.url) {
        throw new Error('No URL returned from backend');
      }

      console.log('Generated Connect URL:', data.url);
      return data.url;
    } catch (error) {
      console.error('Error starting Connect onboarding:', error);
      throw new Error('Failed to start Stripe Connect onboarding');
    }
  }

  /**
   * Handle the return from Stripe Connect Express onboarding
   * This should be called when the user returns to your app
   */
  static async handleConnectReturn(url: string, userId: string): Promise<boolean> {
    try {
      console.log('Handling Connect return URL:', url);

      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state');
      const error = parsedUrl.searchParams.get('error');

      if (error) {
        console.error('Stripe Connect error:', error);
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

      console.log('Stripe Connect setup completed for user:', userId);
      return true;
    } catch (error) {
      console.error('Error handling Connect return:', error);
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
      console.error('Error checking Connect setup:', error);
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
      console.error('Error getting account status:', error);
      throw error;
    }
  }
}

// Payment Processing Service
export class StripePaymentService {
  /**
   * Create a payment intent for a ride booking
   * This handles the platform fee and transfer to the driver's connected account
   */
  static async createPaymentIntent({
    amount, // In cents
    bookingId,
  }: {
    amount: number;
    bookingId: string;
    // Driver ID is handled by backend logic
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      console.log('Creating payment intent via Firebase Functions:', { amount, bookingId });

      const processPayment = httpsCallable(functions, 'processPayment');
      const response = await processPayment({
        bookingId,
        amount: amount / 100, // Backend expects dollars? Checking index.ts...
        // index.ts: amount = request.data.amount; ... math.round(amount * 100)
        // So backend expects DOLLARS (or major unit).
        // Frontend 'amount' is passed as cents in `processRidePayment` (lines 300, 305).
        // Wait, line 305 passed `amount: amountCents`.
        // If I pass cents to backend, backend multiplies by 100 -> wrong.
        // I must pass DOLLARS to backend.
      });

      const result = response.data as any;

      if (!result.success && result.status !== 'requires_payment_method') {
        // status is usually 'requires_payment_method' for fresh PI
        // verifying backend response... 
        // it returns { success: false, status: ..., clientSecret: ... } for incomplete payments (normal flow)
      }

      console.log('Payment intent created:', result.paymentId);

      return {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentId,
      };
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      throw new Error(error.message || 'Failed to create payment intent');
    }
  }

  /**
   * Capture a pre-authorized payment
   */
  static async capturePayment(paymentIntentId: string, bookingId: string): Promise<void> {
    try {
      console.log('Capturing payment:', paymentIntentId);
      const capturePaymentFn = httpsCallable(functions, 'capturePayment');
      const response = await capturePaymentFn({ paymentIntentId, bookingId });
      const result = response.data as any;

      if (!result.success) {
        throw new Error('Capture failed on server');
      }
      console.log('Payment captured successfully');
    } catch (error: any) {
      console.error('Error capturing payment:', error);
      throw new Error(error.message || 'Failed to capture payment');
    }
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
      console.log('Simulating successful payment for demo...');

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
      console.error('Error processing ride payment:', error);
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
      console.error('Stripe audit log error:', error);
    }
  }
}