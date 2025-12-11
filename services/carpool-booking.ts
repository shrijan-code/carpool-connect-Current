import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

export interface BookingRequest {
  rideId: string;
  seats: number;
}

export interface BookingResponse {
  success: boolean;
  bookingId: string;
  clientSecret: string; // SetupIntent client secret for payment method confirmation
  message: string;
}

export interface PaymentMethodUpdate {
  bookingId: string;
  paymentMethodId: string;
}

export interface DriverResponse {
  bookingId: string;
  action: 'accept' | 'decline';
}

export interface RideAction {
  rideId: string;
}

export interface BookingCancellation {
  bookingId: string;
  reason?: string;
}

/**
 * Carpool Booking Service
 * Handles all Firebase Cloud Function calls for the carpool booking flow
 */
export class CarpoolBookingService {

  /**
   * Step 1: Create a pending booking (Rider action)
   * Creates a booking request and returns SetupIntent for payment method
   */
  static async createPendingBooking(request: BookingRequest): Promise<BookingResponse> {
    try {
      console.log('🚗 Creating pending booking:', request);

      const createPendingBooking = httpsCallable(functions, 'createPendingBooking');
      const result = await createPendingBooking(request);

      const data = result.data as any;

      if (!data.success) {
        throw new Error(data.message || 'Failed to create booking');
      }

      console.log('✅ Booking created successfully:', data.bookingId);
      return data;
    } catch (error: any) {
      console.error('❌ Create pending booking error:', error);
      throw new Error(error.message || 'Failed to create booking request');
    }
  }

  /**
   * Step 1b: Update booking with payment method after SetupIntent confirmation
   */
  static async updateBookingPaymentMethod(request: PaymentMethodUpdate): Promise<{ success: boolean; message: string }> {
    try {
      console.log('💳 Updating booking payment method:', request.bookingId);

      const updatePaymentMethod = httpsCallable(functions, 'updateBookingPaymentMethod');
      const result = await updatePaymentMethod(request);

      const data = result.data as any;

      if (!data.success) {
        throw new Error(data.message || 'Failed to update payment method');
      }

      console.log('✅ Payment method saved successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Update payment method error:', error);
      throw new Error(error.message || 'Failed to update payment method');
    }
  }

  /**
   * Step 2: Driver responds to booking (Driver action)
   * Driver accepts or declines a booking request
   */
  static async driverRespondBooking(response: DriverResponse): Promise<{ success: boolean; message: string; action: string }> {
    try {
      console.log(`🚗 Driver ${response.action}ing booking:`, response.bookingId);

      const driverRespondBooking = httpsCallable(functions, 'driverRespondBooking');
      const result = await driverRespondBooking(response);

      const data = result.data as any;

      if (!data.success) {
        throw new Error(data.message || `Failed to ${response.action} booking`);
      }

      console.log(`✅ Booking ${response.action}ed successfully`);
      return data;
    } catch (error: any) {
      console.error(`❌ Driver respond booking error:`, error);
      throw new Error(error.message || `Failed to ${response.action} booking`);
    }
  }

  /**
   * Step 3: Start ride (Driver action)
   * Driver starts the ride when ready
   */
  static async startRide(request: RideAction): Promise<{ success: boolean; message: string; passengerCount: number }> {
    try {
      console.log('🚗 Starting ride:', request.rideId);

      const startRide = httpsCallable(functions, 'startRide');
      const result = await startRide(request);

      const data = result.data as any;

      if (!data.success) {
        throw new Error(data.message || 'Failed to start ride');
      }

      console.log('✅ Ride started successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Start ride error:', error);
      throw new Error(error.message || 'Failed to start ride');
    }
  }

  /**
   * Step 4: Complete ride and charge (Driver action)
   * Driver completes the ride, charges payments, and processes payouts
   */
  static async completeRideAndCharge(request: RideAction): Promise<{
    success: boolean;
    message: string;
    summary: {
      passengerCount: number;
      totalRevenue: number;
      platformFees: number;
      driverPayout: number;
      payoutId: string;
    };
  }> {
    try {
      console.log('🚗 Completing ride and processing charges:', request.rideId);

      const completeRideAndCharge = httpsCallable(functions, 'completeRideAndCharge');
      const result = await completeRideAndCharge(request);

      const data = result.data as any;

      if (!data.success) {
        throw new Error(data.message || 'Failed to complete ride');
      }

      console.log('✅ Ride completed and payments processed');
      return data;
    } catch (error: any) {
      console.error('❌ Complete ride and charge error:', error);
      throw new Error(error.message || 'Failed to complete ride');
    }
  }

  /**
   * Cancel booking (Rider action)
   * Rider cancels their booking before ride completion
   */
  static async cancelBooking(request: BookingCancellation): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🚗 Cancelling booking:', request.bookingId);

      const cancelBooking = httpsCallable(functions, 'cancelBooking');
      const result = await cancelBooking(request);

      const data = result.data as any;

      if (!data.success) {
        throw new Error(data.message || 'Failed to cancel booking');
      }

      console.log('✅ Booking cancelled successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Cancel booking error:', error);
      throw new Error(error.message || 'Failed to cancel booking');
    }
  }

  /**
   * Get driver booking requests
   * Get all pending booking requests for a driver
   */
  static async getDriverBookingRequests(): Promise<{
    success: boolean;
    bookingRequests: Array<{
      id: string;
      rideId: string;
      riderId: string;
      seats: number;
      amountTotal: number;
      status: string;
      createdAt: string;
      ride: any;
      rider: any;
      payment: any;
    }>;
  }> {
    try {
      console.log('📱 Loading booking requests for driver');

      const getDriverBookingRequests = httpsCallable(functions, 'getDriverBookingRequests');
      const result = await getDriverBookingRequests({});

      const data = result.data as any;

      if (!data.success) {
        throw new Error(data.message || 'Failed to load booking requests');
      }

      console.log('✅ Loaded', data.bookingRequests?.length || 0, 'booking requests');
      return data;
    } catch (error: any) {
      console.error('❌ Get driver booking requests error:', error);
      throw new Error(error.message || 'Failed to load booking requests');
    }
  }

  /**
   * Utility method to format currency (AUD)
   */
  static formatCurrency(amountInCents: number): string {
    return `A$${(amountInCents / 100).toFixed(2)}`;
  }

  /**
   * Utility method to get platform fee ($5 AUD flat)
   */
  static calculatePlatformFee(): number {
    return 500; // $5 AUD flat fee in cents
  }

  /**
   * Utility method to calculate driver payout
   */
  static calculateDriverPayout(totalRevenue: number, platformFee: number = 500): number {
    return totalRevenue - platformFee;
  }
}