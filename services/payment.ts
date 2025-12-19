import { Platform } from 'react-native';
import { PaymentMethod } from '@/types';
import { auth, db } from '@/config/firebase';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';

// Note: Stripe integration would require backend Cloud Functions for security
// This service handles the frontend payment flow

export interface DirectDebitDetails {
  accountNumber: string;
  sortCode: string;
  accountHolderName: string;
}

export interface PaymentTransaction {
  id: string;
  rideId: string;
  riderId: string;
  driverId: string;
  amount: number;
  platformFee: number;
  driverPayout: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentMethodId?: string;
  stripePaymentIntentId?: string;
  createdAt: string;
  completedAt?: string;
  refundedAt?: string;
  refundAmount?: number;
}

/**
 * @deprecated Most methods in this class are stubs or return mock data.
 * 
 * For actual payment processing, use:
 * - `CarpoolBookingService` (services/carpool-booking.ts) for booking with payment
 * - `StripeService` (services/stripe.ts) for Stripe Connect setup
 * 
 * The following utility methods are still valid:
 * - `calculatePlatformFee()`
 * - `calculateTotalAmount()`
 * - `calculateDriverPayout()`
 * - `recordPaymentTransaction()` for audit logging
 */
export class PaymentService {
  private static stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  private static apiUrl = process.env.EXPO_PUBLIC_API_URL || '';

  // Initialize Stripe (would be done in app initialization)
  static async initializeStripe(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        // For mobile, we would initialize Stripe React Native
        // const { initStripe } = require('@stripe/stripe-react-native');
        // await initStripe({
        //   publishableKey: this.stripePublishableKey,
        //   merchantIdentifier: 'merchant.com.carpoolconnect',
        // });
      }
    } catch (error) {
      console.error('Stripe initialization error:', error);
    }
  }

  // Create payment intent (backend call)
  static async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      // This would call your backend Cloud Function
      const response = await fetch('https://your-cloud-function-url/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency,
          customerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      return {
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
      };
    } catch (error) {
      console.error('Create payment intent error:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  // Confirm payment
  static async confirmPayment(
    clientSecret: string,
    paymentMethodId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (Platform.OS === 'web') {
        // Web implementation would use Stripe.js
        return { success: true };
      } else {
        // Mobile implementation would use Stripe React Native
        // const { confirmPayment } = require('@stripe/stripe-react-native');
        // const result = await confirmPayment(clientSecret, {
        //   paymentMethodType: 'Card',
        //   paymentMethodData: paymentMethodId ? { paymentMethodId } : undefined,
        // });
        // return { success: !result.error, error: result.error?.message };
        return { success: true };
      }
    } catch (error) {
      console.error('Confirm payment error:', error);
      return { success: false, error: 'Payment confirmation failed' };
    }
  }

  // Add payment method
  static async addPaymentMethod(
    customerId: string
  ): Promise<PaymentMethod | null> {
    try {
      // This would integrate with Stripe's payment method collection
      // For now, return mock data
      return {
        id: 'pm_' + Date.now(),
        userId: customerId,
        stripePaymentMethodId: 'pm_stripe_' + Date.now(),
        type: 'card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
      };
    } catch (error) {
      console.error('Add payment method error:', error);
      return null;
    }
  }

  // Get payment methods for user
  static async getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      // This would call your backend to get payment methods from Stripe
      const response = await fetch(`https://your-cloud-function-url/payment-methods/${customerId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get payment methods');
      }

      return data.paymentMethods || [];
    } catch (error) {
      console.error('Get payment methods error:', error);
      return [];
    }
  }

  // Delete payment method
  static async deletePaymentMethod(paymentMethodId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://your-cloud-function-url/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (error) {
      console.error('Delete payment method error:', error);
      return false;
    }
  }

  // Process refund (backend call)
  static async processRefund(
    paymentIntentId: string,
    amount?: number
  ): Promise<boolean> {
    try {
      const response = await fetch('https://your-cloud-function-url/process-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
          amount: amount ? Math.round(amount * 100) : undefined,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Process refund error:', error);
      return false;
    }
  }

  // Platform fee: Flat $5 AUD
  private static readonly PLATFORM_FEE_CENTS = 500; // $5.00 AUD

  // Calculate platform fee (flat $5 AUD)
  static calculatePlatformFee(_amount: number): number {
    return 5.00; // Flat $5 fee
  }

  // Calculate total amount including fees
  static calculateTotalAmount(baseAmount: number): number {
    const platformFee = this.calculatePlatformFee(baseAmount);
    return Math.round((baseAmount + platformFee) * 100) / 100;
  }

  // Calculate driver payout after platform fee
  static calculateDriverPayout(amount: number): number {
    const platformFee = this.calculatePlatformFee(amount);
    return Math.round((amount - platformFee) * 100) / 100;
  }

  // Set up Direct Debit for recurring payments
  static async setupDirectDebit(details: DirectDebitDetails): Promise<PaymentMethod | null> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // In production, this would set up SEPA Direct Debit or ACH with Stripe
      const response = await fetch(`${this.apiUrl}/setup-direct-debit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify(details),
      });

      if (!response.ok) {
        throw new Error('Failed to set up Direct Debit');
      }

      const data = await response.json();

      // Save to Firestore
      const paymentMethod: PaymentMethod = {
        id: data.paymentMethodId,
        userId: user.uid,
        stripePaymentMethodId: data.stripePaymentMethodId,
        type: 'bank_account',
        last4: details.accountNumber.slice(-4),
        brand: 'bank',
        isDefault: false,
      };

      await setDoc(doc(db, 'users', user.uid, 'paymentMethods', paymentMethod.id), paymentMethod);

      return paymentMethod;
    } catch (error) {
      console.error('Setup Direct Debit error:', error);
      return null;
    }
  }

  // Process ride payment with selected method
  static async processRidePayment(
    rideId: string,
    amount: number,
    paymentMethodId: string,
    riderId: string,
    driverId: string
  ): Promise<PaymentTransaction | null> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const platformFee = this.calculatePlatformFee(amount);
      const driverPayout = this.calculateDriverPayout(amount);

      // Create payment transaction record
      const transaction: Omit<PaymentTransaction, 'id'> = {
        rideId,
        riderId,
        driverId,
        amount,
        platformFee,
        driverPayout,
        status: 'processing',
        paymentMethodId,
        createdAt: new Date().toISOString(),
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'payments'), {
        ...transaction,
        createdAt: serverTimestamp(),
      });

      // Process payment through Stripe (in production)
      const response = await fetch(`${this.apiUrl}/process-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          paymentMethodId,
          rideId,
          transactionId: docRef.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update transaction status
        await updateDoc(doc(db, 'payments', docRef.id), {
          status: 'completed',
          stripePaymentIntentId: data.paymentIntentId,
          completedAt: serverTimestamp(),
        });

        return {
          ...transaction,
          id: docRef.id,
          status: 'completed',
          stripePaymentIntentId: data.paymentIntentId,
          completedAt: new Date().toISOString(),
        };
      } else {
        // Update transaction status to failed
        await updateDoc(doc(db, 'payments', docRef.id), {
          status: 'failed',
        });
        return null;
      }
    } catch (error) {
      console.error('Process ride payment error:', error);
      return null;
    }
  }

  // Get payment history for user
  static async getPaymentHistory(userId: string): Promise<PaymentTransaction[]> {
    try {
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('riderId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(paymentsQuery);
      const payments: PaymentTransaction[] = [];

      snapshot.forEach((doc) => {
        payments.push({
          id: doc.id,
          ...doc.data(),
        } as PaymentTransaction);
      });

      return payments;
    } catch (error) {
      console.error('Get payment history error:', error);
      return [];
    }
  }

  // Get driver earnings
  static async getDriverEarnings(driverId: string): Promise<{ total: number; pending: number; available: number }> {
    try {
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('driverId', '==', driverId),
        where('status', '==', 'completed')
      );

      const snapshot = await getDocs(paymentsQuery);
      let total = 0;
      let pending = 0;
      let available = 0;

      snapshot.forEach((doc) => {
        const payment = doc.data() as PaymentTransaction;
        total += payment.driverPayout;

        // Payments become available after 7 days
        const paymentDate = new Date(payment.completedAt || payment.createdAt);
        const daysSincePayment = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSincePayment >= 7) {
          available += payment.driverPayout;
        } else {
          pending += payment.driverPayout;
        }
      });

      return {
        total: Math.round(total * 100) / 100,
        pending: Math.round(pending * 100) / 100,
        available: Math.round(available * 100) / 100,
      };
    } catch (error) {
      console.error('Get driver earnings error:', error);
      return { total: 0, pending: 0, available: 0 };
    }
  }
}