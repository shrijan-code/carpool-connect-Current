import { create } from 'zustand';
import { Ride, Booking, Location, User, getBookingRiderId, getErrorMessage } from '@/types';
import { RidesService } from '@/services/rides';
import { NotificationService } from '@/services/notifications';
import { ChatService } from '@/services/chat';
import { onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import SecurityManager from '@/security/SecurityManager';
import { CarpoolBookingService } from '@/services/carpool-booking';
import { debounce } from 'lodash';
import { dataCache, CACHE_TTL, CACHE_KEYS } from '@/utils/cache';
import { listenerManager } from '@/utils/listener-manager';
import { logger } from '@/utils/logger';

interface RidesState {
  rides: Ride[];
  bookings: Booking[];
  searchResults: Ride[];
  isLoading: boolean;
  error: string | null;
  searchRides: (from: Location, to: Location, date: string, walkingTolerance?: number) => Promise<void>;
  createRide: (rideData: Partial<Ride>) => Promise<string>;
  requestBooking: (rideId: string, seats: number, passenger: User) => Promise<{ bookingId: string; clientSecret: string; paymentIntentId: string }>;
  acceptBooking: (bookingId: string, driverId: string) => Promise<void>;
  declineBooking: (bookingId: string, rideId: string, seats: number, driverId: string, reason?: string) => Promise<void>;
  getPendingBookingRequests: (driverId: string) => Promise<Booking[]>;
  cancelRide: (rideId: string, reason: string) => Promise<void>;
  deleteRide: (rideId: string, driverId: string) => Promise<void>;
  cancelBooking: (bookingId: string, rideId: string, seats: number, reason: string, cancellationType?: 'passenger_cancel' | 'driver_cancel' | 'no_show') => Promise<void>;
  markNoShow: (bookingId: string, driverId: string, reason?: string) => Promise<void>;
  cancelRideByDriver: (rideId: string, driverId: string, reason: string) => Promise<void>;
  completeRide: (rideId: string, userId: string) => Promise<void>;
  loadUserRides: (userId: string) => Promise<void>;
  loadUserBookings: (userId: string) => Promise<void>;
  getUserRides: (userId: string, role: 'driver' | 'rider') => Ride[];
  getUserBookings: (userId: string) => Booking[];
  getRideById: (rideId: string) => Ride | undefined;
  initializeRides: () => Promise<void>;
  loadAvailableRides: () => Promise<void>;
  getAllAvailableRides: (pageSize?: number) => Promise<Ride[]>;
  subscribeToUserRides: (userId: string) => () => void;
  subscribeToUserBookings: (userId: string) => () => void;
  subscribeToAvailableRides: () => () => void;
  refreshRides: () => Promise<void>;
  refreshBookings: () => Promise<void>;
  checkDriverStripeRequirement: (driverId: string) => Promise<{ required: boolean; completedRides: number; message: string }>;
  getDriverCompletedRidesCount: (driverId: string) => number;
  prepareBookingRequest: (rideId: string, seats: number, passenger: User) => Promise<{
    bookingId: string;
    clientSecret: string;
    paymentIntentId: string;
  }>;
  confirmBookingPayment: (bookingId: string) => Promise<void>;
  cancelAbandonedBooking: (bookingId: string, paymentIntentId?: string) => Promise<void>;
  // Legacy method for backward compatibility
  bookRide: (rideId: string, seats: number, passenger: User) => Promise<string>;
  // New method to fetch ride from server
  fetchRideById: (rideId: string) => Promise<Ride | null>;
}

export const useRidesStore = create<RidesState>((set, get) => ({
  rides: [],
  bookings: [],
  searchResults: [],
  isLoading: false,
  error: null,

  searchRides: async (from: Location, to: Location, date: string, walkingTolerance: number = 800) => {
    set({ isLoading: true, error: null });
    try {
      logger.info('Searching rides with Haversine filtering', {
        from: from.name,
        to: to.name,
        walkingTolerance,
        date
      });

      const allRides = await RidesService.getAllAvailableRides();

      if (!Array.isArray(allRides)) {
        set({ searchResults: [] });
        return;
      }

      // Apply location-based filtering (simplified for demo)
      const locationFiltered = allRides.filter((ride: Ride) => {
        const rideFrom = ride.from || ride.origin;
        const rideTo = ride.to || ride.destination;

        if (!rideFrom || !rideTo) return false;

        const fromMatch = rideFrom.name.toLowerCase().includes(from.name.toLowerCase()) ||
          from.name.toLowerCase().includes(rideFrom.name.toLowerCase());
        const toMatch = rideTo.name.toLowerCase().includes(to.name.toLowerCase()) ||
          to.name.toLowerCase().includes(rideTo.name.toLowerCase());
        return fromMatch && toMatch;
      });

      logger.info(`Found ${locationFiltered.length} rides matching location criteria`);
      set({ searchResults: locationFiltered });
    } catch (error: unknown) {
      logger.error('Search rides error', error);
      set({ error: getErrorMessage(error), searchResults: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  createRide: async (rideData: Partial<Ride>) => {
    set({ isLoading: true, error: null });
    try {
      const rideId = await RidesService.createRide(rideData);

      // Refresh user rides and available rides
      if (rideData.driverId) {
        await get().loadUserRides(rideData.driverId);
      }
      await get().loadAvailableRides();

      return rideId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create ride';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Prepare booking request (Real Payment Step 1)
  prepareBookingRequest: async (rideId: string, seats: number, passenger: User) => {
    set({ isLoading: true, error: null });
    try {
      logger.info('Preparing booking for ride', { rideId, passengerId: passenger.id });

      // 1. Basic Validations
      const ride = await RidesService.getRideById(rideId);
      if (!ride) throw new Error('Ride not found');
      if (ride.driverId === passenger.id) throw new Error('You cannot book your own ride');

      const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
      if (availableSeats < seats) throw new Error(`Only ${availableSeats} seats available`);

      // 2. Create Booking (Pending Payment)
      // This reserves the 'intent' but status is pending_payment
      const ridePrice = ride.pricePerSeat * seats;
      const platformFee = 500; // $5.00 flat fee
      const totalAmount = ridePrice + platformFee; // In cents

      // Use imported StripePaymentService (lazy import to access static method?)
      const { StripePaymentService } = require('@/services/stripe');

      // Create initial booking
      const bookingId = await RidesService.createBookingRequest(
        rideId,
        passenger.id,
        seats,
        passenger,
        null,
        'pending_payment'
      );

      logger.info('Created pending_payment booking', { bookingId });

      // 3. Create Payment Intent via Backend
      const { clientSecret, paymentIntentId } = await StripePaymentService.createPaymentIntent({
        amount: totalAmount, // Pass cents, service converts if needed
        bookingId: bookingId
      });

      return { bookingId, clientSecret, paymentIntentId };
    } catch (error: unknown) {
      logger.error('Prepare booking failed', error);
      set({ error: getErrorMessage(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Confirm booking payment (Real Payment Step 2 - after successful client sheet)
  confirmBookingPayment: async (bookingId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('✅ Payment confirmed on client, updating booking status:', bookingId);

      // Update booking status from pending_payment to pending_driver
      const { doc, updateDoc, serverTimestamp } = require('firebase/firestore');
      // Use the already imported db instance
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'pending_driver',
        'payment.status': 'authorized',
        updatedAt: serverTimestamp()
      });

      // Refresh bookings
      await get().loadUserBookings(get().bookings.find(b => b.id === bookingId)?.riderId || '');

    } catch (error: unknown) {
      logger.error('Confirm booking payment failed', error);
      set({ error: error instanceof Error ? error.message : 'Failed to confirm payment' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Cancel an abandoned booking (user cancelled payment before completing)
  cancelAbandonedBooking: async (bookingId: string, paymentIntentId?: string) => {
    try {
      logger.info('Cancelling abandoned booking', { bookingId, paymentIntentId });

      const { doc, deleteDoc, getDoc } = require('firebase/firestore');

      // Get the booking to find the rideId and restore seats
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);

      if (bookingSnap.exists()) {
        const bookingData = bookingSnap.data();

        // Only cancel if status is still pending_payment
        if (bookingData.status === 'pending_payment') {
          // Restore seats to the ride
          if (bookingData.rideId && bookingData.seats) {
            const { updateDoc, increment } = require('firebase/firestore');
            const rideRef = doc(db, 'rides', bookingData.rideId);
            await updateDoc(rideRef, {
              availableSeats: increment(bookingData.seats),
              seatsAvailable: increment(bookingData.seats),
            }).catch((err: Error) => logger.warn('Failed to restore seats', err));
          }

          // Delete the abandoned booking
          await deleteDoc(bookingRef);
          logger.info('Abandoned booking deleted', { bookingId });

          // Update local state
          const updatedBookings = get().bookings.filter(b => b.id !== bookingId);
          set({ bookings: updatedBookings });
        }
      }

      // Cancel the payment intent if provided
      if (paymentIntentId) {
        try {
          const { StripePaymentService } = require('@/services/stripe');
          await StripePaymentService.cancelPaymentIntent(paymentIntentId);
        } catch (stripeError) {
          // Payment intent may already be cancelled or expired, that's ok
          logger.warn('Could not cancel payment intent', stripeError);
        }
      }

    } catch (error) {
      // Don't throw - cleanup failures shouldn't break the UI flow
      logger.error('Failed to cancel abandoned booking', error);
    }
  },

  // Request booking (Rider action) - creates pending booking request with optimizations
  requestBooking: async (rideId: string, seats: number, passenger: User) => {
    set({ isLoading: true, error: null });

    // Optimistic UI update - immediately show booking as pending
    const existingRide = get().getRideById(rideId);

    const optimisticBooking = {
      id: `temp_${Date.now()}`,
      rideId,
      riderId: passenger.id,
      passenger,
      seats,
      status: 'pending_driver' as const,
      amountTotal: existingRide ? (existingRide.pricePerSeat * seats) : 0,
      createdAt: new Date().toISOString(),
      ride: existingRide || null, // Use cached ride if available
      driverId: existingRide?.driverId || '',
      payment: {
        intentId: '',
        status: 'authorized' as const
      }
    } as Booking; // Use full Booking type for optimistic update

    const currentBookings = get().bookings;
    set({ bookings: [optimisticBooking, ...currentBookings] });

    try {
      logger.info('Starting booking request for ride', { rideId, passengerId: passenger.id });

      // Security check: Rate limiting for booking requests
      const rateLimitCheck = await SecurityManager.checkRateLimit(passenger.id, 'booking');
      if (!rateLimitCheck.allowed) {
        const retryAfter = rateLimitCheck.retryAfter || 60;
        throw new Error(`Too many booking requests. Please wait ${retryAfter} seconds before trying again.`);
      }

      // Check for anomalous activity
      const isAnomalous = await SecurityManager.detectAnomalousActivity(passenger.id, {
        type: 'booking_request',
        rideId,
        seats
      });

      if (isAnomalous) {
        throw new Error('Suspicious activity detected. Please try again later.');
      }

      // Parallel data fetching for better performance
      const [ride, currentServerBookings] = await Promise.all([
        RidesService.getRideById(rideId),
        RidesService.getUserBookings(passenger.id)
      ]);

      if (!ride) throw new Error('Ride not found');

      if (ride.driverId === passenger.id) {
        throw new Error('You cannot book your own ride');
      }

      // Enhanced duplicate check with server data - check both active and recent bookings
      const existingActiveBooking = currentServerBookings.find(booking => {
        const isMatchingRide = booking.rideId === rideId;
        const isActiveBooking = booking.status === 'pending_driver' || booking.status === 'confirmed';

        // Also check for very recent declined/cancelled bookings (within 5 minutes) to prevent rapid re-booking
        const bookingAge = Date.now() - new Date(booking.createdAt).getTime();
        const isVeryRecentDeclined = (booking.status === 'declined' || booking.status === 'cancelled_by_rider') && bookingAge < 5 * 60 * 1000;

        return isMatchingRide && (isActiveBooking || isVeryRecentDeclined);
      });

      if (existingActiveBooking) {
        if (existingActiveBooking.status === 'declined' || existingActiveBooking.status === 'cancelled_by_rider') {
          throw new Error('You recently cancelled or were declined for this ride. Please wait a few minutes before booking again.');
        }
        const statusText = existingActiveBooking.status === 'pending_driver' ? 'pending approval' : 'confirmed';
        throw new Error(`You already have a ${statusText} booking for this ride`);
      }

      const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
      if (availableSeats < seats) {
        throw new Error(`Only ${availableSeats} seats available`);
      }

      // 3. Create Payment Intent via Backend (Real Flow)
      // We don't verify payment here, we just prepare it. The UI must present the PaymentSheet.

      const { bookingId, clientSecret, paymentIntentId } = await get().prepareBookingRequest(rideId, seats, passenger);

      // Update optimistic booking with real data
      const realBooking = {
        ...optimisticBooking,
        id: bookingId,
        amountTotal: ride.pricePerSeat * seats,
        ride,
        clientSecret, // Attach to booking object in store?
        paymentIntentId
      };

      const updatedBookings = get().bookings.map(b =>
        b.id === optimisticBooking.id ? realBooking : b
      );
      set({ bookings: updatedBookings });

      logger.info('Booking request prepared with PaymentIntent', { paymentIntentId, bookingId });

      return { bookingId, clientSecret, paymentIntentId };

    } catch (error: unknown) {
      logger.error('Booking request failed', error);

      // Revert optimistic update on error
      const revertedBookings = get().bookings.filter(b => b.id !== optimisticBooking.id);
      set({ bookings: revertedBookings });

      // Enhanced error handling with retry mechanism
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('already have a') || errorMessage.includes('pending approval')) {
        logger.info('Force refreshing bookings due to duplicate booking error');
        try {
          await get().loadUserBookings(passenger.id);
          set({ error: null });
        } catch (refreshError: unknown) {
          logger.error('Failed to refresh bookings after duplicate error', refreshError);
        }
      }

      set({ error: error instanceof Error ? error.message : 'Failed to create booking request' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Accept booking (Driver action)
  acceptBooking: async (bookingId: string, driverId: string) => {
    set({ isLoading: true, error: null });
    try {
      logger.info('Driver accepting booking', { bookingId, driverId });

      // Accept the booking and capture payment if applicable
      await RidesService.acceptBooking(bookingId, driverId);

      // Refresh driver's rides and bookings
      await get().loadUserRides(driverId);

      logger.info('Booking accepted successfully', { bookingId });
    } catch (error: unknown) {
      logger.error('Accept booking failed', error, { bookingId });
      set({ error: getErrorMessage(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Decline booking (Driver action)
  declineBooking: async (bookingId: string, rideId: string, seats: number, driverId: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      logger.info('Driver declining booking', { bookingId, driverId });

      // Decline the booking and cancel payment if applicable
      await RidesService.rejectBooking(bookingId, rideId, seats, driverId, reason);

      // Refresh driver's rides
      await get().loadUserRides(driverId);

      logger.info('Booking declined successfully', { bookingId });
    } catch (error: unknown) {
      logger.error('Decline booking failed', error, { bookingId });
      set({ error: getErrorMessage(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Get pending booking requests for driver
  getPendingBookingRequests: async (driverId: string) => {
    try {
      const bookings = await RidesService.getDriverBookingRequests(driverId);
      return bookings.filter((booking: Booking) => booking.status === 'pending_driver');
    } catch (error: unknown) {
      logger.error('Get pending booking requests error', error, { driverId });
      return [];
    }
  },

  // Legacy method for backward compatibility - now creates booking request
  bookRide: async (rideId: string, seats: number, passenger: User) => {
    const result = await get().requestBooking(rideId, seats, passenger);
    return result.bookingId;
  },

  cancelRide: async (rideId: string, reason: string) => {
    set({ isLoading: true, error: null });
    try {
      await RidesService.updateRideStatus(rideId, 'cancelled');

      const ride = await RidesService.getRideById(rideId);
      if (ride) {
        // Notify all passengers
        for (const passenger of ride.passengers) {
          const rideFrom = ride.from || ride.origin;
          const rideTo = ride.to || ride.destination;
          await NotificationService.sendInAppNotification(
            passenger.id,
            'Ride Cancelled by Driver',
            `Your ride from ${rideFrom?.name || 'Unknown'} to ${rideTo?.name || 'Unknown'} has been cancelled. Reason: ${reason}`,
            'ride_cancelled',
            { rideId, refundAmount: ride.pricePerSeat * passenger.seats }
          );
        }

        // Send system message (fire-and-forget, don't block cancellation)
        try {
          await ChatService.sendSystemMessage(
            rideId,
            `This ride has been cancelled by the driver. Reason: ${reason}. All passengers will receive full refunds.`
          );
        } catch (msgError) {
          console.warn('System message failed, but cancellation succeeded:', msgError);
        }
      }

      // Refresh rides
      const state = get();
      const updatedRides = state.rides.map(r =>
        r.id === rideId ? { ...r, status: 'cancelled' as const } : r
      );
      set({ rides: updatedRides });
    } catch (error: any) {
      set({ error: error.message || 'Failed to cancel ride' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteRide: async (rideId: string, driverId: string) => {
    set({ isLoading: true, error: null });
    try {
      await RidesService.deleteRide(rideId, driverId);

      // Refresh driver's rides
      await get().loadUserRides(driverId);
      await get().loadAvailableRides();

      console.log('✅ Ride deleted successfully');
    } catch (error: any) {
      console.error('❌ Delete ride failed:', error);
      set({ error: error.message || 'Failed to delete ride' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  cancelBooking: async (bookingId: string, rideId: string, seats: number, reason: string, cancellationType: 'passenger_cancel' | 'driver_cancel' | 'no_show' = 'passenger_cancel') => {
    set({ isLoading: true, error: null });
    try {
      console.log(`🚫 Cancelling booking ${bookingId} with type: ${cancellationType}`);

      // Use Firebase callable function for proper transactional cancellation with refund processing
      const result = await CarpoolBookingService.cancelBooking({ bookingId, reason });
      logger.info('🎫 Cancellation result:', result);

      const ride = await RidesService.getRideById(rideId);
      if (ride) {
        let notificationTitle = 'Booking Cancelled';
        let notificationBody = `A passenger cancelled their booking. Reason: ${reason}. ${seats} seat(s) are now available.`;

        if (cancellationType === 'driver_cancel') {
          notificationTitle = 'Ride Cancelled by Driver';
          notificationBody = `Your ride has been cancelled by the driver. You'll receive a full refund. Reason: ${reason}`;
        } else if (cancellationType === 'no_show') {
          notificationTitle = 'Passenger No-Show';
          notificationBody = `Passenger marked as no-show. You'll receive full compensation. Reason: ${reason}`;
        }

        // Notify appropriate party
        const targetUserId = cancellationType === 'passenger_cancel' ? ride.driverId :
          (get().bookings.find(b => b.id === bookingId)?.riderId || '');

        if (targetUserId) {
          await NotificationService.sendInAppNotification(
            targetUserId,
            notificationTitle,
            notificationBody,
            'ride_cancelled',
            { rideId, seats, bookingId, cancellationType }
          );
        }

        // Send system message (fire-and-forget, don't block cancellation)
        try {
          await ChatService.sendSystemMessage(
            rideId,
            `Booking cancelled (${cancellationType}). ${seats} seat(s) affected. Reason: ${reason}`
          );
        } catch (msgError) {
          console.warn('System message failed, but cancellation succeeded:', msgError);
        }
      }

      // Refresh bookings and rides
      const state = get();
      const updatedBookings = state.bookings.map(b =>
        b.id === bookingId ? {
          ...b,
          status: (cancellationType === 'driver_cancel' ? 'cancelled_by_driver' : 'cancelled_by_rider') as Booking['status'],
          cancellationReason: reason
        } : b
      );
      set({ bookings: updatedBookings });

      // Refresh available rides to update seat counts
      await get().loadAvailableRides();

      console.log(`✅ Booking cancelled successfully: ${bookingId}`);
    } catch (error: any) {
      console.error(`❌ Cancel booking failed:`, error);
      set({ error: error.message || 'Failed to cancel booking' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Mark passenger as no-show
  markNoShow: async (bookingId: string, driverId: string, reason: string = 'Passenger did not show up at meeting point') => {
    return get().cancelBooking(bookingId, '', 0, reason, 'no_show');
  },

  // Driver cancels entire ride (affects all bookings)
  cancelRideByDriver: async (rideId: string, driverId: string, reason: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`🚫 Driver cancelling entire ride: ${rideId}`);

      // Update ride status
      await RidesService.updateRideStatus(rideId, 'cancelled');

      const ride = await RidesService.getRideById(rideId);
      if (ride && ride.driverId === driverId) {
        // Get all active bookings for this ride
        const state = get();
        const affectedBookings = state.bookings.filter(booking =>
          booking.rideId === rideId &&
          ['requested', 'pending_driver', 'accepted'].includes(booking.status)
        );

        // Cancel each booking with full refund
        for (const booking of affectedBookings) {
          await get().cancelBooking(booking.id, rideId, booking.seats, reason, 'driver_cancel');
        }

        // Update local ride state
        const updatedRides = state.rides.map(r =>
          r.id === rideId ? { ...r, status: 'cancelled' as const, cancellationReason: reason } : r
        );
        set({ rides: updatedRides });

        console.log(`✅ Ride cancelled by driver: ${rideId}, affected ${affectedBookings.length} bookings`);
      } else {
        throw new Error('Only the driver can cancel this ride');
      }
    } catch (error: any) {
      console.error(`❌ Cancel ride by driver failed:`, error);
      set({ error: error.message || 'Failed to cancel ride' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadUserRides: async (userId: string) => {
    const currentState = get();

    // Avoid redundant loading if already loading for same user
    if (currentState.isLoading && currentState.rides.some(r => r.driverId === userId)) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const userRides = await RidesService.getUserRides(userId);
      console.log('Loaded user rides:', userRides.length, 'rides for driver', userId);

      // Merge with existing rides to avoid data loss
      const existingRides = currentState.rides.filter(r => r.driverId !== userId);
      set({ rides: [...userRides, ...existingRides] });
    } catch (error: any) {
      console.error('Load user rides error:', error);
      set({ error: error.message || 'Failed to load rides' });

      // Retry mechanism for critical failures
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        console.log('Retrying ride load in 3 seconds...');
        setTimeout(() => get().loadUserRides(userId), 3000);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  loadUserBookings: (() => {
    // Track ongoing requests to prevent race conditions
    const ongoingRequests = new Map<string, Promise<void>>();

    return async (userId: string) => {
      // Check if there's already an ongoing request for this user
      const existingRequest = ongoingRequests.get(userId);
      if (existingRequest) {
        console.log(`⏳ Waiting for existing booking load request for user ${userId}`);
        return existingRequest;
      }

      const currentState = get();

      // Create a new request promise
      const requestPromise = (async () => {
        set({ isLoading: true, error: null });
        try {
          const userBookings = await RidesService.getUserBookings(userId);
          console.log('Loaded user bookings:', userBookings.length, 'bookings for rider', userId);

          // Merge with existing bookings to avoid data loss
          const existingBookings = currentState.bookings.filter(b => (b.riderId || (b as any).passengerId) !== userId);
          set({ bookings: [...userBookings, ...existingBookings] });
        } catch (error: any) {
          console.error('Load user bookings error:', error);
          set({ error: error.message || 'Failed to load bookings' });

          // Retry mechanism for critical failures
          if (error.message?.includes('network') || error.message?.includes('timeout')) {
            console.log('Retrying bookings load in 3 seconds...');
            setTimeout(() => get().loadUserBookings(userId), 3000);
          }
        } finally {
          set({ isLoading: false });
          // Remove from ongoing requests
          ongoingRequests.delete(userId);
        }
      })();

      // Store the request
      ongoingRequests.set(userId, requestPromise);

      return requestPromise;
    };
  })(),

  getUserRides: (userId: string, role: 'driver' | 'rider') => {
    const state = get();
    if (role === 'driver') {
      return state.rides.filter(ride => ride.driverId === userId);
    } else {
      // For riders, return unique rides from bookings to avoid duplicates
      const rideMap = new Map<string, Ride>();
      state.bookings.forEach(booking => {
        if (booking.ride && booking.ride.id) {
          rideMap.set(booking.ride.id, booking.ride);
        }
      });
      return Array.from(rideMap.values());
    }
  },

  getUserBookings: (userId: string) => {
    const bookings = get().bookings.filter(booking => (booking.riderId || (booking as any).passengerId) === userId);
    // Sort by creation date, most recent first
    return bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getRideById: (rideId: string) => {
    const state = get();
    // First check local state
    const localRide = state.rides.find(ride => ride.id === rideId) ||
      state.searchResults.find(ride => ride.id === rideId);

    if (localRide) {
      return localRide;
    }

    // If not found locally, check if we have it in bookings' ride data
    for (const booking of state.bookings) {
      if (booking.ride && booking.ride.id === rideId) {
        return booking.ride;
      }
    }

    return undefined;
  },

  // New method to fetch ride from server if not found locally
  fetchRideById: async (rideId: string) => {
    try {
      console.log('🔍 Fetching ride from server:', rideId);
      const ride = await RidesService.getRideById(rideId);
      if (ride) {
        // Add to local state for future access
        const state = get();
        const existingRideIndex = state.rides.findIndex(r => r.id === rideId);
        if (existingRideIndex >= 0) {
          // Update existing ride
          const updatedRides = [...state.rides];
          updatedRides[existingRideIndex] = ride;
          set({ rides: updatedRides });
        } else {
          // Add new ride to state
          set({ rides: [...state.rides, ride] });
        }
        console.log('✅ Ride fetched and cached:', ride.id);
        return ride;
      }
      return null;
    } catch (error: any) {
      console.error('❌ Failed to fetch ride:', error);
      return null;
    }
  },

  subscribeToUserRides: (userId: string) => {
    // Prevent duplicate listeners using ListenerManager
    const listenerKey = `user-${userId}-rides`;
    if (listenerManager.has(listenerKey)) {
      console.log(`[Optimization] Reusing existing rides listener for user ${userId}`);
      return () => listenerManager.unregister(listenerKey);
    }

    // Stale-while-revalidate: Show cached data immediately if available
    const cachedRides = dataCache.get<Ride[]>(CACHE_KEYS.userRides(userId));
    if (cachedRides && cachedRides.length > 0) {
      console.log('[Optimization] Showing cached rides while loading fresh data');
      set({ rides: cachedRides });
    }

    try {
      let unsubscribe: (() => void) | null = null;

      const startSubscription = (useOrdered: boolean) => {
        const q = useOrdered
          ? query(
            collection(db, 'rides'),
            where('driverId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(50) // Limit to 50 most recent rides
          )
          : query(
            collection(db, 'rides'),
            where('driverId', '==', userId),
            limit(50)
          );

        return onSnapshot(
          q,
          (snapshot) => {
            const rides: Ride[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              rides.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                departureTime: data.departureTime?.toDate?.()?.toISOString() || data.departureTime
              } as Ride);
            });

            // Manual sort when using fallback without orderBy
            rides.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            console.log(`Real-time rides update: ${rides.length} rides for driver ${userId} (ordered=${useOrdered})`);

            // Cache the result
            dataCache.set(CACHE_KEYS.userRides(userId), rides, CACHE_TTL.RIDES_LIST);
            set({ rides });
          },
          (error) => {
            console.error('Rides subscription error:', error);
            // If ordered query fails (likely missing index), retry without orderBy
            if (useOrdered) {
              console.warn('Retrying rides subscription without orderBy (fallback)');
              try {
                if (unsubscribe) unsubscribe();
              } catch { }
              unsubscribe = startSubscription(false);
              listenerManager.register(listenerKey, unsubscribe);
            } else {
              set({ error: 'Failed to sync rides' });
            }
          }
        );
      };

      unsubscribe = startSubscription(true);
      listenerManager.register(listenerKey, unsubscribe);

      return () => {
        listenerManager.unregister(listenerKey);
      };
    } catch (error) {
      console.error('Failed to create rides subscription:', error);
      return () => { }; // Return empty unsubscribe function
    }
  },

  subscribeToUserBookings: (userId: string) => {
    // Prevent duplicate listeners using ListenerManager
    const listenerKey = `user-${userId}-bookings`;
    if (listenerManager.has(listenerKey)) {
      console.log(`[Optimization] Reusing existing bookings listener for user ${userId}`);
      return () => listenerManager.unregister(listenerKey);
    }

    // Stale-while-revalidate: Show cached data immediately if available
    const cachedBookings = dataCache.get<Booking[]>(CACHE_KEYS.userBookings(userId));
    if (cachedBookings && cachedBookings.length > 0) {
      console.log('[Optimization] Showing cached bookings while loading fresh data');
      set({ bookings: cachedBookings });
    }

    try {
      let unsubscribe: (() => void) | null = null;

      const startSubscription = (useOrdered: boolean) => {
        const q = useOrdered
          ? query(
            collection(db, 'bookings'),
            where('riderId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(30) // Limit to 30 most recent bookings
          )
          : query(
            collection(db, 'bookings'),
            where('riderId', '==', userId),
            limit(30)
          );

        return onSnapshot(
          q,
          async (snapshot) => {
            try {
              const bookings: Booking[] = [];

              // Collect all unique rideIds for bundled lookup
              const rideIds = new Set<string>();
              snapshot.docs.forEach(docSnapshot => {
                const bookingData = docSnapshot.data();
                if (bookingData.rideId) {
                  rideIds.add(bookingData.rideId);
                }
              });

              // Bundled ride lookup: Check cache first, then fetch missing
              const ridesMap = new Map<string, any>();
              const ridesToFetch: string[] = [];

              for (const rideId of rideIds) {
                const cachedRide = dataCache.get(CACHE_KEYS.rideDetail(rideId));
                if (cachedRide) {
                  ridesMap.set(rideId, cachedRide);
                } else {
                  ridesToFetch.push(rideId);
                }
              }

              // Fetch missing rides in parallel (bundled)
              if (ridesToFetch.length > 0) {
                console.log(`[Optimization] Fetching ${ridesToFetch.length} rides (${ridesMap.size} cached)`);
                const fetchedRides = await Promise.all(
                  ridesToFetch.map(id => RidesService.getRideById(id))
                );
                fetchedRides.forEach((ride, index) => {
                  if (ride) {
                    ridesMap.set(ridesToFetch[index], ride);
                    // Cache for future use
                    dataCache.set(CACHE_KEYS.rideDetail(ridesToFetch[index]), ride, CACHE_TTL.RIDE_DETAIL);
                  }
                });
              }

              // Process bookings with cached rides
              for (const docSnapshot of snapshot.docs) {
                try {
                  const bookingData = docSnapshot.data();
                  const ride = ridesMap.get(bookingData.rideId);

                  if (ride) {
                    bookings.push({
                      id: docSnapshot.id,
                      rideId: bookingData.rideId,
                      driverId: bookingData.driverId,
                      riderId: bookingData.riderId,
                      passenger: bookingData.passenger,
                      seats: bookingData.seats,
                      amountTotal: bookingData.amountTotal,
                      status: bookingData.status,
                      payment: bookingData.payment,
                      createdAt: bookingData.createdAt?.toDate?.()?.toISOString() || bookingData.createdAt,
                      ride,
                    } as Booking);
                  }
                } catch (docError) {
                  console.warn('Error processing booking document:', docSnapshot.id, docError);
                }
              }

              // Manual sort when using fallback without orderBy
              bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              console.log(
                'Real-time bookings update:',
                bookings.length,
                'bookings for rider',
                userId,
                `(ordered=${useOrdered})`
              );

              // Cache the result
              dataCache.set(CACHE_KEYS.userBookings(userId), bookings, CACHE_TTL.USER_BOOKINGS);
              set({ bookings });
            } catch (snapshotError) {
              console.error('Error processing bookings snapshot:', snapshotError);
            }
          },
          (error) => {
            console.error('Bookings subscription error:', error);
            // If ordered query fails (likely missing index on mobile), retry without orderBy
            if (useOrdered) {
              console.warn('Retrying bookings subscription without orderBy (fallback)');
              try {
                if (unsubscribe) unsubscribe();
              } catch { }
              unsubscribe = startSubscription(false);
              listenerManager.register(listenerKey, unsubscribe);
            } else {
              console.warn('Bookings subscription failed even without orderBy');
            }
          }
        );
      };

      unsubscribe = startSubscription(true);
      listenerManager.register(listenerKey, unsubscribe);

      return () => {
        listenerManager.unregister(listenerKey);
      };
    } catch (error) {
      console.error('Failed to create bookings subscription:', error);
      return () => { }; // Return empty unsubscribe function
    }
  },

  initializeRides: async () => {
    set({ rides: [], bookings: [], searchResults: [], isLoading: false, error: null });
  },

  loadAvailableRides: async () => {
    set({ isLoading: true, error: null });
    try {
      const availableRides = await RidesService.getAllAvailableRides();
      console.log('Loaded available rides:', availableRides.length, 'rides');
      set({ searchResults: availableRides });
    } catch (error: any) {
      console.error('Load available rides error:', error);
      set({ error: error.message || 'Failed to load available rides' });
    } finally {
      set({ isLoading: false });
    }
  },

  getAllAvailableRides: async (pageSize: number = 100) => {
    try {
      const availableRides = await RidesService.getAllAvailableRides(pageSize);
      console.log('Retrieved all available rides:', availableRides.length, 'rides');
      return availableRides;
    } catch (error: any) {
      console.error('Get all available rides error:', error);
      throw new Error(error.message || 'Failed to get available rides');
    }
  },

  // Real-time subscription to all available rides
  subscribeToAvailableRides: () => {
    // Prevent duplicate listeners
    const listenerKey = 'available-rides';
    if (listenerManager.has(listenerKey)) {
      console.log('[Optimization] Reusing existing available rides listener');
      return () => listenerManager.unregister(listenerKey);
    }

    // Try compound query first, fallback to simple query if it fails
    let unsubscribe: (() => void) | null = null;

    try {
      const q = query(
        collection(db, 'rides'),
        where('status', '==', 'upcoming'),
        where('availableSeats', '>', 0),
        orderBy('departureTime', 'asc'),
        limit(50) // Limit to 50 rides to reduce reads
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const rides: Ride[] = [];
        const now = new Date();

        snapshot.forEach((doc) => {
          try {
            const data = doc.data();
            const departureTime = data.departureTime?.toDate?.() || new Date(data.departureTime || data.departureAt || now);
            const isPastRide = departureTime.getTime() < now.getTime();

            // Only include future rides for available rides subscription
            if (!isPastRide) {
              rides.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                departureTime: data.departureTime?.toDate?.()?.toISOString() || data.departureTime
              } as Ride);
            }
          } catch (docError) {
            console.warn('Error processing ride document:', doc.id, docError);
          }
        });
        console.log('Real-time available rides update (future only):', rides.length, 'rides');

        // Cache the results
        dataCache.set(CACHE_KEYS.availableRides(), rides, CACHE_TTL.RIDES_LIST);
        set({ searchResults: rides });
      }, (error) => {
        console.error('Available rides subscription error:', error);
        // Don't set error state for subscription failures, just log it
      });

      listenerManager.register(listenerKey, unsubscribe);
      return () => listenerManager.unregister(listenerKey);
    } catch (error) {
      console.error('Failed to create available rides subscription:', error);

      // Fallback to simple query without compound index
      try {
        const simpleQ = query(
          collection(db, 'rides'),
          where('status', '==', 'upcoming'),
          limit(50) // Also limit fallback query
        );

        unsubscribe = onSnapshot(simpleQ, (snapshot) => {
          const rides: Ride[] = [];
          const now = new Date();

          snapshot.forEach((doc) => {
            try {
              const data = doc.data();
              const departureTime = data.departureTime?.toDate?.() || new Date(data.departureTime || data.departureAt || now);
              const isPastRide = departureTime.getTime() < now.getTime();

              // Only include future rides with available seats
              if (data.availableSeats > 0 && !isPastRide) {
                rides.push({
                  id: doc.id,
                  ...data,
                  createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                  departureTime: data.departureTime?.toDate?.()?.toISOString() || data.departureTime
                } as Ride);
              }
            } catch (docError) {
              console.warn('Error processing fallback ride document:', doc.id, docError);
            }
          });
          // Sort manually
          rides.sort((a, b) => {
            const aTime = a.departureTime || a.departureAt || new Date().toISOString();
            const bTime = b.departureTime || b.departureAt || new Date().toISOString();
            return new Date(aTime).getTime() - new Date(bTime).getTime();
          });
          console.log('Real-time available rides update (fallback, future only):', rides.length, 'rides');

          // Cache the results
          dataCache.set(CACHE_KEYS.availableRides(), rides, CACHE_TTL.RIDES_LIST);
          set({ searchResults: rides });
        }, (error) => {
          console.error('Fallback available rides subscription error:', error);
        });

        listenerManager.register(listenerKey, unsubscribe);
        return () => listenerManager.unregister(listenerKey);
      } catch (fallbackError) {
        console.error('Fallback subscription also failed:', fallbackError);
        return () => { };
      }
    }
  },

  // Complete ride
  completeRide: async (rideId: string, userId: string) => {
    set({ isLoading: true, error: null });
    try {
      await RidesService.updateRideStatus(rideId, 'completed', userId);

      const ride = await RidesService.getRideById(rideId);
      if (ride) {
        // Notify all passengers
        for (const passenger of ride.passengers) {
          const rideFrom = ride.from || ride.origin;
          const rideTo = ride.to || ride.destination;
          await NotificationService.sendInAppNotification(
            passenger.id,
            'Ride Completed',
            `Your ride from ${rideFrom?.name || 'Unknown'} to ${rideTo?.name || 'Unknown'} has been completed. Thank you for riding with us!`,
            'ride_completed',
            { rideId }
          );
        }

        // Notify driver if completed by passenger
        if (userId !== ride.driverId) {
          const rideFrom = ride.from || ride.origin;
          const rideTo = ride.to || ride.destination;
          await NotificationService.sendInAppNotification(
            ride.driverId,
            'Ride Completed',
            `Your ride from ${rideFrom?.name || 'Unknown'} to ${rideTo?.name || 'Unknown'} has been marked as completed.`,
            'ride_completed',
            { rideId }
          );
        }

        // Send system message (fire-and-forget, don't block completion)
        try {
          await ChatService.sendSystemMessage(
            rideId,
            'This ride has been completed. Thank you for using CarpoolConnect!'
          );
        } catch (msgError) {
          console.warn('System message failed, but ride completion succeeded:', msgError);
        }
      }

      // Refresh rides
      const state = get();
      const updatedRides = state.rides.map(r =>
        r.id === rideId ? { ...r, status: 'completed' as const } : r
      );
      set({ rides: updatedRides });
    } catch (error: any) {
      set({ error: error.message || 'Failed to complete ride' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Debounced refresh functions for better performance
  refreshRides: debounce(async () => {
    // Check cache cooldown to prevent excessive refreshes
    if (dataCache.has(CACHE_KEYS.refreshCooldown('rides'))) {
      console.log('[Optimization] Skipping rides refresh - cooldown active');
      return;
    }
    dataCache.set(CACHE_KEYS.refreshCooldown('rides'), true, CACHE_TTL.REFRESH_COOLDOWN);

    const state = get();
    try {
      // If we have rides, refresh them
      if (state.rides.length > 0) {
        const firstRide = state.rides[0];
        if (firstRide.driverId) {
          await get().loadUserRides(firstRide.driverId);
        }
      }
      // Always refresh available rides
      await get().loadAvailableRides();
    } catch (error) {
      console.error('Failed to refresh rides:', error);
      set({ error: 'Failed to refresh rides data' });
    }
  }, 3000), // Increased debounce to 3 seconds

  refreshBookings: debounce(async () => {
    // Check cache cooldown to prevent excessive refreshes
    if (dataCache.has(CACHE_KEYS.refreshCooldown('bookings'))) {
      console.log('[Optimization] Skipping bookings refresh - cooldown active');
      return;
    }
    dataCache.set(CACHE_KEYS.refreshCooldown('bookings'), true, CACHE_TTL.REFRESH_COOLDOWN);

    const state = get();
    try {
      // If we have bookings, refresh them
      if (state.bookings.length > 0) {
        const firstBooking = state.bookings[0];
        const userId = firstBooking.riderId || (firstBooking as any).passengerId;
        if (userId) {
          await get().loadUserBookings(userId);
        }
      }
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
      set({ error: 'Failed to refresh bookings data' });
    }
  }, 3000), // Increased debounce to 3 seconds

  // Check if driver needs Stripe setup (after 10 completed rides)
  checkDriverStripeRequirement: async (driverId: string) => {
    try {
      const userRides = get().getUserRides(driverId, 'driver');
      const completedRides = userRides.filter(ride => ride.status === 'completed').length;

      // For demo purposes, always return not required
      return {
        required: false,
        completedRides,
        message: `Complete ${Math.max(0, 10 - completedRides)} more rides before Stripe setup becomes mandatory.`
      };
    } catch (error) {
      console.error('Error checking driver Stripe requirement:', error);
      return { required: false, completedRides: 0, message: 'Unable to check requirements.' };
    }
  },

  // Get driver's completed rides count
  getDriverCompletedRidesCount: (driverId: string) => {
    const userRides = get().getUserRides(driverId, 'driver');
    return userRides.filter(ride => ride.status === 'completed').length;
  },
}));