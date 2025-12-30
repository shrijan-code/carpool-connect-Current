import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { logger } from '@/utils/logger';

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

// Type-safe response interfaces
interface CloudFunctionResponse {
  success: boolean;
  message?: string;
}

interface BookingCreatedResponse extends CloudFunctionResponse {
  bookingId: string;
  clientSecret: string;
}

interface DriverResponseResult extends CloudFunctionResponse {
  action: string;
}

interface StartRideResponse extends CloudFunctionResponse {
  passengerCount: number;
}

interface CompleteRideResponse extends CloudFunctionResponse {
  summary: {
    passengerCount: number;
    totalRevenue: number;
    platformFees: number;
    driverPayout: number;
    payoutId: string;
  };
}

interface DriverBookingRequestsResponse extends CloudFunctionResponse {
  bookingRequests: Array<{
    id: string;
    rideId: string;
    riderId: string;
    seats: number;
    amountTotal: number;
    status: string;
    createdAt: string;
    ride: Record<string, unknown>;
    rider: Record<string, unknown>;
    payment: Record<string, unknown>;
  }>;
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
      logger.debug('Creating pending booking', { rideId: request.rideId, seats: request.seats });

      const createPendingBooking = httpsCallable(functions, 'createPendingBooking');
      const result = await createPendingBooking(request);

      const data = result.data as BookingCreatedResponse;

      if (!data.success) {
        throw new Error(data.message || 'Failed to create booking');
      }

      logger.booking.created(data.bookingId, request.rideId);
      return data as BookingResponse;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create booking request';
      logger.error('Create pending booking error', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Step 1b: Update booking with payment method after SetupIntent confirmation
   */
  static async updateBookingPaymentMethod(request: PaymentMethodUpdate): Promise<{ success: boolean; message: string }> {
    try {
      logger.booking.paymentUpdated(request.bookingId);

      const updatePaymentMethod = httpsCallable(functions, 'updateBookingPaymentMethod');
      const result = await updatePaymentMethod(request);

      const data = result.data as CloudFunctionResponse;

      if (!data.success) {
        throw new Error(data.message || 'Failed to update payment method');
      }

      logger.debug('Payment method saved successfully', { bookingId: request.bookingId });
      return { success: data.success, message: data.message || 'Payment method updated' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update payment method';
      logger.error('Update payment method error', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Step 2: Driver responds to booking (Driver action)
   * Driver accepts or declines a booking request
   */
  static async driverRespondBooking(response: DriverResponse): Promise<{ success: boolean; message: string; action: string }> {
    try {
      logger.debug('Driver responding to booking', { bookingId: response.bookingId, action: response.action });

      const driverRespondBooking = httpsCallable(functions, 'driverRespondBooking');
      const result = await driverRespondBooking(response);

      const data = result.data as DriverResponseResult;

      if (!data.success) {
        throw new Error(data.message || `Failed to ${response.action} booking`);
      }

      logger.booking.updated(response.bookingId, response.action === 'accept' ? 'confirmed' : 'declined');
      return { success: data.success, message: data.message || '', action: data.action };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `Failed to ${response.action} booking`;
      logger.error('Driver respond booking error', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Step 3: Start ride (Driver action)
   * Driver starts the ride when ready
   */
  static async startRide(request: RideAction): Promise<{ success: boolean; message: string; passengerCount: number }> {
    try {
      logger.debug('Starting ride', { rideId: request.rideId });

      const startRide = httpsCallable(functions, 'startRide');
      const result = await startRide(request);

      const data = result.data as StartRideResponse;

      if (!data.success) {
        throw new Error(data.message || 'Failed to start ride');
      }

      logger.info('Ride started successfully', { rideId: request.rideId, passengerCount: data.passengerCount });
      return { success: data.success, message: data.message || '', passengerCount: data.passengerCount };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start ride';
      logger.error('Start ride error', error);
      throw new Error(errorMessage);
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
      logger.debug('Completing ride and processing charges', { rideId: request.rideId });

      const completeRideAndCharge = httpsCallable(functions, 'completeRideAndCharge');
      const result = await completeRideAndCharge(request);

      const data = result.data as CompleteRideResponse;

      if (!data.success) {
        throw new Error(data.message || 'Failed to complete ride');
      }

      logger.info('Ride completed and payments processed', { rideId: request.rideId, ...data.summary });
      return { success: data.success, message: data.message || '', summary: data.summary };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete ride';
      logger.error('Complete ride and charge error', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Cancel booking (Rider action)
   * Rider cancels their booking before ride completion
   */
  static async cancelBooking(request: BookingCancellation): Promise<{ success: boolean; message: string }> {
    try {
      logger.debug('Cancelling booking', { bookingId: request.bookingId, reason: request.reason });

      const cancelBooking = httpsCallable(functions, 'cancelBooking');
      const result = await cancelBooking(request);

      const data = result.data as CloudFunctionResponse;

      if (!data.success) {
        throw new Error(data.message || 'Failed to cancel booking');
      }

      logger.booking.cancelled(request.bookingId, request.reason);
      return { success: data.success, message: data.message || 'Booking cancelled' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel booking';
      logger.error('Cancel booking error', error);
      throw new Error(errorMessage);
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
      ride: Record<string, unknown>;
      rider: Record<string, unknown>;
      payment: Record<string, unknown>;
    }>;
  }> {
    try {
      logger.debug('Loading booking requests for driver');

      const getDriverBookingRequests = httpsCallable(functions, 'getDriverBookingRequests');
      const result = await getDriverBookingRequests({});

      const data = result.data as DriverBookingRequestsResponse;

      if (!data.success) {
        throw new Error(data.message || 'Failed to load booking requests');
      }

      logger.debug('Loaded booking requests', { count: data.bookingRequests?.length || 0 });
      return { success: data.success, bookingRequests: data.bookingRequests };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load booking requests';
      logger.error('Get driver booking requests error', error);
      throw new Error(errorMessage);
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
   * @deprecated Use PLATFORM_FEE from '@/utils/price' instead
   */
  static calculatePlatformFee(): number {
    return 500; // $5 AUD flat fee in cents
  }

  /**
   * Utility method to calculate driver payout
   * @deprecated Use calculateDriverPayout from '@/utils/price' instead
   */
  static calculateDriverPayout(totalRevenue: number, platformFee: number = 500): number {
    return totalRevenue - platformFee;
  }
}