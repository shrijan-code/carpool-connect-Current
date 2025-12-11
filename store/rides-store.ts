import { create } from 'zustand';
import { Ride, Booking, Location, User } from '@/types';
import { RidesService } from '@/services/rides';
import { NotificationService } from '@/services/notifications';
import { ChatService } from '@/services/chat';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import SecurityManager from '@/security/SecurityManager';
import { debounce } from 'lodash';

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
  // New methods for Real Payment Flow
  prepareBookingRequest: (rideId: string, seats: number, passenger: User) => Promise<{
    bookingId: string;
    clientSecret: string;
    paymentIntentId: string;
  }>;
  confirmBookingPayment: (bookingId: string) => Promise<void>;
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
      console.log('Searching rides with Haversine filtering:', {
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

      console.log(`Found ${locationFiltered.length} rides matching location criteria`);
      set({ searchResults: locationFiltered });
    } catch (error: any) {
      console.error('Search rides error:', error);
      set({ error: error.message || 'Failed to search rides', searchResults: [] });
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
    } catch (error: any) {
      set({ error: error.message || 'Failed to create ride' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Prepare booking request (Real Payment Step 1)
  prepareBookingRequest: async (rideId: string, seats: number, passenger: User) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`💳 Preparing booking for ride ${rideId} by passenger ${passenger.id}`);

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

      console.log('✅ Created pending_payment booking:', bookingId);

      // 3. Create Payment Intent via Backend
      const { clientSecret, paymentIntentId } = await StripePaymentService.createPaymentIntent({
        amount: totalAmount, // Pass cents, service converts if needed
        bookingId: bookingId
      });

      return { bookingId, clientSecret, paymentIntentId };
    } catch (error: any) {
      console.error('❌ Prepare booking failed:', error);
      set({ error: error.message || 'Failed to prepare booking' });
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

    } catch (error: any) {
      console.error('❌ Confirm booking payment failed:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
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
      payment: undefined
    } as any;

    const currentBookings = get().bookings;
    set({ bookings: [optimisticBooking, ...currentBookings] });

    try {
      console.log(`🚗 Starting booking request for ride ${rideId} by passenger ${passenger.id}`);

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

      console.log('✅ Booking request prepared with PaymentIntent:', paymentIntentId);

      // We attach clientSecret to the booking in the store so UI can access it? 
      // Or better, return it.
      // Since I'm editing the file, I'll update the interface return type too.
      return { bookingId, clientSecret, paymentIntentId } as any;

    } catch (error: any) {
      console.error('❌ Booking request failed:', error);

      // Revert optimistic update on error
      const revertedBookings = get().bookings.filter(b => b.id !== optimisticBooking.id);
      set({ bookings: revertedBookings });

      // Enhanced error handling with retry mechanism
      if (error.message?.includes('already have a') || error.message?.includes('pending approval')) {
        console.log('🔄 Force refreshing bookings due to duplicate booking error');
        try {
          await get().loadUserBookings(passenger.id);
          set({ error: null });
        } catch (refreshError) {
          console.error('Failed to refresh bookings after duplicate error:', refreshError);
        }
      }

      set({ error: error.message || 'Failed to create booking request' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Accept booking (Driver action)
  acceptBooking: async (bookingId: string, driverId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('🚗 Driver accepting booking:', bookingId);

      // Accept the booking and capture payment if applicable
      await RidesService.acceptBooking(bookingId, driverId);

      // Refresh driver's rides and bookings
      await get().loadUserRides(driverId);

      console.log('✅ Booking accepted successfully');
    } catch (error: any) {
      console.error('❌ Accept booking failed:', error);
      set({ error: error.message || 'Failed to accept booking' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Decline booking (Driver action)
  declineBooking: async (bookingId: string, rideId: string, seats: number, driverId: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('🚗 Driver declining booking:', bookingId);

      // Decline the booking and cancel payment if applicable
      await RidesService.rejectBooking(bookingId, rideId, seats, driverId, reason);

      // Refresh driver's rides
      await get().loadUserRides(driverId);

      console.log('✅ Booking declined successfully');
    } catch (error: any) {
      console.error('❌ Decline booking failed:', error);
      set({ error: error.message || 'Failed to decline booking' });
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
    } catch (error: any) {
      console.error('Get pending booking requests error:', error);
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

        // Send system message
        await ChatService.sendSystemMessage(
          rideId,
          `This ride has been cancelled by the driver. Reason: ${reason}. All passengers will receive full refunds.`
        );
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

      // For now, use the existing service method
      // In a real implementation, this would call the new cancellation service
      await RidesService.cancelBooking(bookingId, rideId, seats);

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

        // Send system message
        await ChatService.sendSystemMessage(
          rideId,
          `Booking cancelled (${cancellationType}). ${seats} seat(s) affected. Reason: ${reason}`
        );
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
    try {
      let unsubscribe: (() => void) | null = null;

      const startSubscription = (useOrdered: boolean) => {
        const q = useOrdered
          ? query(
            collection(db, 'rides'),
            where('driverId', '==', userId),
            orderBy('createdAt', 'desc')
          )
          : query(
            collection(db, 'rides'),
            where('driverId', '==', userId)
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
            } else {
              set({ error: 'Failed to sync rides' });
            }
          }
        );
      };

      unsubscribe = startSubscription(true);
      return () => {
        try { if (unsubscribe) unsubscribe(); } catch { }
      };
    } catch (error) {
      console.error('Failed to create rides subscription:', error);
      return () => { }; // Return empty unsubscribe function
    }
  },

  subscribeToUserBookings: (userId: string) => {
    try {
      let unsubscribe: (() => void) | null = null;

      const startSubscription = (useOrdered: boolean) => {
        const q = useOrdered
          ? query(
            collection(db, 'bookings'),
            where('riderId', '==', userId),
            orderBy('createdAt', 'desc')
          )
          : query(
            collection(db, 'bookings'),
            where('riderId', '==', userId)
          );

        return onSnapshot(
          q,
          async (snapshot) => {
            try {
              const bookings: Booking[] = [];

              for (const docSnapshot of snapshot.docs) {
                try {
                  const bookingData = docSnapshot.data();
                  const ride = await RidesService.getRideById(bookingData.rideId);

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
            } else {
              console.warn('Bookings subscription failed even without orderBy');
            }
          }
        );
      };

      unsubscribe = startSubscription(true);
      return () => {
        try { if (unsubscribe) unsubscribe(); } catch { }
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
    // Try compound query first, fallback to simple query if it fails
    let unsubscribe: (() => void) | null = null;

    try {
      const q = query(
        collection(db, 'rides'),
        where('status', '==', 'upcoming'),
        where('availableSeats', '>', 0),
        orderBy('departureTime', 'asc')
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
        set({ searchResults: rides });
      }, (error) => {
        console.error('Available rides subscription error:', error);
        // Don't set error state for subscription failures, just log it
      });

      return unsubscribe;
    } catch (error) {
      console.error('Failed to create available rides subscription:', error);

      // Fallback to simple query without compound index
      try {
        const simpleQ = query(
          collection(db, 'rides'),
          where('status', '==', 'upcoming')
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
          set({ searchResults: rides });
        }, (error) => {
          console.error('Fallback available rides subscription error:', error);
        });

        return unsubscribe || (() => { });
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

        // Send system message
        await ChatService.sendSystemMessage(
          rideId,
          'This ride has been completed. Thank you for using CarpoolConnect!'
        );
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
  }, 1000),

  refreshBookings: debounce(async () => {
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
  }, 1000),

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