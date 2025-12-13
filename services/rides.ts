import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  runTransaction,
  Query
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Ride, Booking, User } from '@/types';
import { NotificationService } from './notifications';

// Audit log service
class AuditService {
  static async logAction(action: string, entityType: string, entityId: string, userId: string, data?: any) {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action,
        entityType,
        entityId,
        userId,
        data: data || null,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Audit log error:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }
}

export class RidesService {
  // Create a new ride
  static async createRide(rideData: Partial<Ride>): Promise<string> {
    try {
      console.log('Creating ride with data:', rideData);

      // Validate required fields
      if (!rideData.driverId || !rideData.from || !rideData.to || !rideData.departureTime) {
        throw new Error('Missing required ride data');
      }

      // Ensure pricePerSeat is always stored in cents (integer)
      // The price should already be in cents from the UI
      if (rideData.pricePerSeat !== undefined) {
        rideData.pricePerSeat = Math.round(rideData.pricePerSeat);
        console.log(`Price stored as ${rideData.pricePerSeat} cents (${(rideData.pricePerSeat / 100).toFixed(2)})`);
      }

      // Ensure availableSeats is set (use totalSeats or seatsAvailable if not provided)
      const availableSeats = rideData.availableSeats ?? rideData.seatsAvailable ?? rideData.totalSeats ?? 4;

      const rideRef = await addDoc(collection(db, 'rides'), {
        ...rideData,
        availableSeats, // Ensure this is always set
        seatsAvailable: availableSeats, // Maintain both fields for compatibility
        status: 'upcoming',
        passengers: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log('Ride created successfully with ID:', rideRef.id);

      // Log audit trail
      await AuditService.logAction('CREATE_RIDE', 'ride', rideRef.id, rideData.driverId!, {
        from: rideData.from?.name,
        to: rideData.to?.name,
        departureTime: rideData.departureTime,
        availableSeats: rideData.availableSeats,
        pricePerSeat: rideData.pricePerSeat
      });

      return rideRef.id;
    } catch (error: any) {
      console.error('Create ride error:', error);
      throw new Error(error.message || 'Failed to create ride');
    }
  }

  // Search rides
  static async searchRides(
    fromLocationId: string,
    toLocationId: string,
    date?: string,
    pageSize: number = 50
  ): Promise<Ride[]> {
    try {
      let q = query(
        collection(db, 'rides'),
        where('from.id', '==', fromLocationId),
        where('to.id', '==', toLocationId),
        where('status', '==', 'upcoming'),
        orderBy('departureTime', 'asc'),
        limit(Math.max(1, Math.min(200, pageSize)))
      );

      const querySnapshot = await getDocs(q);
      const rides: Ride[] = [];

      querySnapshot.forEach((doc) => {
        rides.push({ id: doc.id, ...doc.data() } as Ride);
      });

      return rides;
    } catch (error: any) {
      console.error('Search rides error:', error);
      throw new Error('Failed to search rides');
    }
  }

  // Get ride by ID
  static async getRideById(rideId: string): Promise<Ride | null> {
    try {
      const rideDoc = await getDoc(doc(db, 'rides', rideId));
      if (rideDoc.exists()) {
        return { id: rideDoc.id, ...rideDoc.data() } as Ride;
      }
      return null;
    } catch (error) {
      console.error('Get ride error:', error);
      return null;
    }
  }

  // Get rides available for delivery
  static async getDeliveryAvailableRides(pageSize: number = 50): Promise<Ride[]> {
    return this.getAllAvailableRides(pageSize, true);
  }

  // Get all available rides with optional delivery filter
  static async getAllAvailableRides(pageSize: number = 50, deliveryOnly: boolean = false): Promise<Ride[]> {
    try {
      // Use simple query to avoid complex index requirements
      // We'll filter and sort manually instead
      const q = query(
        collection(db, 'rides'),
        where('status', '==', 'upcoming'),
        limit(Math.max(1, Math.min(200, pageSize)))
      );

      const querySnapshot = await getDocs(q);
      const rides: Ride[] = [];
      const now = new Date();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter available seats manually
        const hasAvailableSeats = ((data.availableSeats ?? data.seatsAvailable ?? 0) as number) > 0;
        const isAvailableForDelivery = data.availableForDelivery === true;

        // Apply delivery filter if requested
        if (deliveryOnly && !isAvailableForDelivery) {
          return; // Skip this ride if delivery filter is on but ride doesn't accept deliveries
        }

        // Filter out past rides - only show future rides for available rides
        const departureTime = data.departureTime?.toDate?.() ?? new Date(data.departureTime || data.departureAt || now);
        const isPastRide = departureTime.getTime() < now.getTime();

        if (hasAvailableSeats && !isPastRide) {
          rides.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            departureTime: data.departureTime?.toDate?.()?.toISOString() || data.departureTime
          } as Ride);
        }
      });

      // Sort by departure time manually
      rides.sort((a, b) => {
        const aTime = a.departureTime || a.departureAt || new Date().toISOString();
        const bTime = b.departureTime || b.departureAt || new Date().toISOString();
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });

      console.log('Loaded available rides (future only):', rides.length, deliveryOnly ? '(delivery-enabled only)' : '(all rides)');
      return rides;
    } catch (error: any) {
      console.error('Get all available rides error:', error);
      throw new Error('Failed to get available rides');
    }
  }

  // Get user rides (as driver) - includes all rides (past and future) for the owner
  static async getUserRides(userId: string, pageSize: number = 50): Promise<Ride[]> {
    try {
      let q;
      try {
        q = query(
          collection(db, 'rides'),
          where('driverId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(Math.max(1, Math.min(200, pageSize)))
        );
      } catch {
        console.log('Using simple query for user rides due to missing index');
        q = query(
          collection(db, 'rides'),
          where('driverId', '==', userId),
          limit(Math.max(1, Math.min(200, pageSize)))
        );
      }

      const querySnapshot = await getDocs(q);
      const rides: Ride[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        rides.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          departureTime: data.departureTime?.toDate?.()?.toISOString() || data.departureTime
        } as Ride);
      });

      // Sort manually if needed
      rides.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log('Loaded user rides for driver:', userId, '- Count:', rides.length, '(includes past and future)');
      return rides;
    } catch (error: any) {
      console.error('Get user rides error:', error);
      throw new Error('Failed to get user rides');
    }
  }

  // Create booking request (Rider action) - creates pending booking request
  static async createBookingRequest(
    rideId: string,
    passengerId: string,
    seats: number,
    passengerData: any,
    paymentIntentId?: string | null,
    initialStatus: 'pending_driver' | 'pending_payment' = 'pending_driver'
  ): Promise<string> {
    try {
      console.log('Creating booking request:', rideId, 'for passenger:', passengerId, 'seats:', seats);

      // Validate booking data
      if (!rideId || !passengerId || !seats || seats <= 0) {
        throw new Error('Invalid booking data');
      }

      // Check if ride exists and has available seats
      const rideRef = doc(db, 'rides', rideId);
      const rideDoc = await getDoc(rideRef);

      if (!rideDoc.exists()) {
        throw new Error('Ride not found');
      }

      const rideData = rideDoc.data() as Ride;

      // Check if passenger is trying to book their own ride
      if (rideData.driverId === passengerId) {
        throw new Error('You cannot book your own ride');
      }

      // Enhanced duplicate booking check with comprehensive approach
      console.log(`🔍 Checking for existing bookings for ride ${rideId} by passenger ${passengerId}`);

      let existingActiveBookings: any[] = [];

      // Method 1: Try compound query with riderId
      try {
        const riderBookingsQuery = query(
          collection(db, 'bookings'),
          where('rideId', '==', rideId),
          where('riderId', '==', passengerId)
        );

        const riderBookingsSnapshot = await getDocs(riderBookingsQuery);
        riderBookingsSnapshot.forEach(doc => {
          const bookingData = doc.data();
          const isActiveBooking = bookingData.status === 'pending_driver' || bookingData.status === 'confirmed';
          if (isActiveBooking) {
            existingActiveBookings.push({ id: doc.id, ...bookingData });
            console.log(`📋 Found active booking via riderId: ${doc.id} with status ${bookingData.status}`);
          }
        });
      } catch (indexError) {
        console.log('⚠️ Compound query with riderId failed, trying alternative approaches');
      }

      // Method 2: Try compound query with passengerId (legacy field)
      if (existingActiveBookings.length === 0) {
        try {
          const passengerBookingsQuery = query(
            collection(db, 'bookings'),
            where('rideId', '==', rideId),
            where('passengerId', '==', passengerId)
          );

          const passengerBookingsSnapshot = await getDocs(passengerBookingsQuery);
          passengerBookingsSnapshot.forEach(doc => {
            const bookingData = doc.data();
            const isActiveBooking = bookingData.status === 'pending_driver' || bookingData.status === 'confirmed';
            if (isActiveBooking) {
              existingActiveBookings.push({ id: doc.id, ...bookingData });
              console.log(`📋 Found active booking via passengerId: ${doc.id} with status ${bookingData.status}`);
            }
          });
        } catch (legacyError) {
          console.log('⚠️ Compound query with passengerId also failed');
        }
      }

      // Method 3: Secure Fallback - Query all bookings for this USER (not ride) and filter for ride
      // This works because users can always see their own bookings, and simple index on riderId exists by default.
      if (existingActiveBookings.length === 0) {
        console.log('🔄 Using secure fallback approach: querying all bookings for this rider');
        try {
          const userBookingsQuery = query(
            collection(db, 'bookings'),
            where('riderId', '==', passengerId)
            // No other filters to avoid composite index requirements
          );

          const userBookingsSnapshot = await getDocs(userBookingsQuery);
          console.log(`📊 Found ${userBookingsSnapshot.size} total bookings for rider ${passengerId}`);

          userBookingsSnapshot.forEach(doc => {
            const bookingData = doc.data();
            const isMatchingRide = bookingData.rideId === rideId;
            const isActiveBooking = bookingData.status === 'pending_driver' || bookingData.status === 'confirmed';

            if (isMatchingRide && isActiveBooking) {
              existingActiveBookings.push({ id: doc.id, ...bookingData });
              console.log(`📋 Found active booking via secure fallback: ${doc.id} with status ${bookingData.status}`);
            }
          });
        } catch (fallbackError) {
          console.error('❌ Secure booking check failed:', fallbackError);
          // If even this fails, we really can't proceed safely, but we'll try legacy passengerId check
        }

        // Also check legacy passengerId just in case
        if (existingActiveBookings.length === 0) {
          try {
            const legacyUserBookingsQuery = query(
              collection(db, 'bookings'),
              where('passengerId', '==', passengerId)
            );
            const legacySnapshot = await getDocs(legacyUserBookingsQuery);
            legacySnapshot.forEach(doc => {
              const bookingData = doc.data();
              const isMatchingRide = bookingData.rideId === rideId;
              const isActiveBooking = bookingData.status === 'pending_driver' || bookingData.status === 'confirmed';
              if (isMatchingRide && isActiveBooking) {
                existingActiveBookings.push({ id: doc.id, ...bookingData });
              }
            });
          } catch { /* ignore */ }
        }
      }

      // Check if any active bookings were found
      if (existingActiveBookings.length > 0) {
        const existingBooking: any = existingActiveBookings[0];
        const statusText = existingBooking.status === 'pending_driver' ? 'pending approval' : 'confirmed';
        console.log(`❌ Duplicate booking detected: Found existing ${statusText} booking (${existingBooking.id}) for ride ${rideId} by passenger ${passengerId}`);
        throw new Error(`You already have a ${statusText} booking for this ride`);
      }

      console.log(`✅ No active bookings found for ride ${rideId} by passenger ${passengerId} - proceeding with booking creation`);

      // Validate seat availability
      const availableSeats = ((rideData.availableSeats ?? rideData.seatsAvailable ?? 0) as number);
      if (availableSeats < seats) {
        throw new Error(`Only ${availableSeats} seats available`);
      }

      if (rideData.status !== 'upcoming') {
        throw new Error('This ride is no longer available for booking');
      }

      // Price is already in cents from the database
      const normalizedPrice = Math.round(rideData.pricePerSeat || 0);

      const amountTotal = normalizedPrice * seats;
      console.log(`Booking amount calculation: ${normalizedPrice} cents/seat × ${seats} seats = ${amountTotal} cents total`);

      // Create booking request with pending_driver status
      const bookingRef = await addDoc(collection(db, 'bookings'), {
        rideId,
        driverId: rideData.driverId,
        riderId: passengerId,
        passengerId, // Keep for backward compatibility
        passenger: passengerData,
        seats,
        amountTotal: amountTotal,
        status: initialStatus,
        payment: paymentIntentId ? {
          intentId: paymentIntentId,
          status: 'authorized'
        } : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log('✅ Booking request created successfully with ID:', bookingRef.id);

      // Log audit trail
      await AuditService.logAction('CREATE_BOOKING_REQUEST', 'booking', bookingRef.id, passengerId, {
        rideId,
        seats,
        amountTotal: (rideData.pricePerSeat || 0) * seats,
        paymentIntentId
      });

      return bookingRef.id;
    } catch (error: any) {
      console.error('❌ Create booking request error:', error);
      throw new Error(error.message || 'Failed to create booking request');
    }
  }

  // Legacy method for backward compatibility
  static async bookRide(
    rideId: string,
    passengerId: string,
    seats: number,
    passengerData: any
  ): Promise<string> {
    return this.createBookingRequest(rideId, passengerId, seats, passengerData);
  }

  // Get user bookings (as passenger)
  static async getUserBookings(userId: string, pageSize: number = 50): Promise<Booking[]> {
    try {
      let q;
      try {
        q = query(
          collection(db, 'bookings'),
          where('riderId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(Math.max(1, Math.min(200, pageSize)))
        );
      } catch {
        console.log('Using simple query for user bookings due to missing index');
        q = query(
          collection(db, 'bookings'),
          where('riderId', '==', userId),
          limit(Math.max(1, Math.min(200, pageSize)))
        );
      }

      const querySnapshot = await getDocs(q);
      const bookings: Booking[] = [];

      // Batch fetch rides to avoid N+1 reads
      const rideIdSet = new Set<string>();
      querySnapshot.docs.forEach(d => {
        const bid = d.data().rideId as string;
        if (bid) rideIdSet.add(bid);
      });

      const rideMap = new Map<string, Ride>();
      const rideIds = Array.from(rideIdSet);

      // Firestore 'in' supports up to 10 IDs; chunk if necessary
      const chunks: string[][] = [];
      for (let i = 0; i < rideIds.length; i += 10) {
        chunks.push(rideIds.slice(i, i + 10));
      }

      for (const ids of chunks) {
        const qRides: Query = query(collection(db, 'rides'), where('__name__', 'in', ids));
        const snap = await getDocs(qRides);
        snap.docs.forEach(r => {
          const data = r.data();
          rideMap.set(r.id, ({ id: r.id, ...data } as unknown) as Ride);
        });
      }

      for (const docSnapshot of querySnapshot.docs) {
        const bookingData = docSnapshot.data();
        const ride = rideMap.get(bookingData.rideId);
        if (!ride) continue;

        bookings.push({
          id: docSnapshot.id,
          rideId: bookingData.rideId,
          driverId: bookingData.driverId,
          riderId: bookingData.riderId || bookingData.passengerId,
          passenger: bookingData.passenger,
          seats: bookingData.seats,
          amountTotal: bookingData.amountTotal || ((ride as any).pricePerSeat * bookingData.seats),
          status: bookingData.status,
          payment: bookingData.payment || { intentId: '', status: 'authorized' },
          createdAt: bookingData.createdAt?.toDate?.()?.toISOString() || bookingData.createdAt,
          updatedAt: bookingData.updatedAt?.toDate?.()?.toISOString() || bookingData.updatedAt,
          ride,
          rejectionReason: bookingData.rejectionReason,
          cancellationReason: bookingData.cancellationReason,
          cancelledBy: bookingData.cancelledBy,
          rejectedBy: bookingData.rejectedBy
        } as Booking);
      }

      // Sort manually if needed
      bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log('Loaded user bookings for rider:', userId, '- Count:', bookings.length);
      return bookings;
    } catch (error: any) {
      console.error('Get user bookings error:', error);
      throw new Error('Failed to get user bookings');
    }
  }

  // Update ride status
  static async updateRideStatus(rideId: string, status: string, userId?: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status,
        updatedAt: serverTimestamp()
      });

      // Log audit trail
      if (userId) {
        await AuditService.logAction('UPDATE_RIDE_STATUS', 'ride', rideId, userId, { status });
      }
    } catch (error: any) {
      console.error('Update ride status error:', error);
      throw new Error('Failed to update ride status');
    }
  }

  // Update ride tracking status
  static async updateRideTrackingStatus(
    rideId: string,
    trackingStatus: 'waiting' | 'driver_assigned' | 'pickup_confirmed' | 'passengers_onboard' | 'in_transit' | 'arrived' | 'completed',
    userId: string
  ): Promise<void> {
    try {
      const updateData: any = {
        trackingStatus,
        updatedAt: serverTimestamp()
      };

      // Add timestamp for each status change
      switch (trackingStatus) {
        case 'driver_assigned':
          updateData.driverAssignedAt = serverTimestamp();
          break;
        case 'pickup_confirmed':
          updateData.pickupConfirmedAt = serverTimestamp();
          break;
        case 'passengers_onboard':
          updateData.passengersOnboardAt = serverTimestamp();
          updateData.status = 'active';
          break;
        case 'in_transit':
          updateData.inTransitAt = serverTimestamp();
          break;
        case 'arrived':
          updateData.arrivedAt = serverTimestamp();
          break;
        case 'completed':
          updateData.completedAt = serverTimestamp();
          updateData.status = 'completed';
          break;
      }

      await updateDoc(doc(db, 'rides', rideId), updateData);

      // Send notifications based on status
      const rideDoc = await getDoc(doc(db, 'rides', rideId));
      if (rideDoc.exists()) {
        const rideData = rideDoc.data() as Ride;

        // Get all passengers for notifications
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('rideId', '==', rideId),
          where('status', '==', 'confirmed')
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);

        for (const bookingDoc of bookingsSnapshot.docs) {
          const booking = bookingDoc.data();
          const passengerId = booking.riderId || booking.passenger?.id;

          if (passengerId) {
            let notificationTitle = '';
            let notificationBody = '';

            switch (trackingStatus) {
              case 'driver_assigned':
                notificationTitle = 'Driver Ready';
                notificationBody = 'Your driver is ready and heading to the pickup location';
                break;
              case 'pickup_confirmed':
                notificationTitle = 'Driver at Pickup';
                notificationBody = 'Your driver has arrived at the pickup location';
                break;
              case 'passengers_onboard':
                notificationTitle = 'Ride Started';
                notificationBody = 'All passengers are onboard. Your ride has started!';
                break;
              case 'in_transit':
                notificationTitle = 'On the Way';
                notificationBody = 'You are now in transit to your destination';
                break;
              case 'arrived':
                notificationTitle = 'Arrived at Destination';
                notificationBody = 'You have arrived at your destination. Please exit safely';
                break;
              case 'completed':
                notificationTitle = 'Ride Completed';
                notificationBody = 'Your ride has been completed. Thank you for riding with us!';
                break;
            }

            if (notificationTitle) {
              await NotificationService.sendInAppNotification(
                passengerId,
                notificationTitle,
                notificationBody,
                'ride_status_update',
                { rideId, trackingStatus }
              );
            }
          }
        }
      }

      // Log audit trail
      await AuditService.logAction('UPDATE_RIDE_TRACKING_STATUS', 'ride', rideId, userId, { trackingStatus });
    } catch (error: any) {
      console.error('Update ride tracking status error:', error);
      throw new Error('Failed to update ride tracking status');
    }
  }

  // Update passenger status in booking
  static async updatePassengerStatus(
    bookingId: string,
    passengerStatus: 'waiting' | 'ready' | 'onboard' | 'dropped_off',
    userId: string
  ): Promise<void> {
    try {
      const updateData: any = {
        passengerStatus,
        updatedAt: serverTimestamp()
      };

      // Add timestamp for each status change
      switch (passengerStatus) {
        case 'ready':
          updateData.passengerReadyAt = serverTimestamp();
          break;
        case 'onboard':
          updateData.passengerOnboardAt = serverTimestamp();
          break;
        case 'dropped_off':
          updateData.passengerDroppedOffAt = serverTimestamp();
          break;
      }

      await updateDoc(doc(db, 'bookings', bookingId), updateData);

      // Get booking details for notifications
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (bookingDoc.exists()) {
        const booking = bookingDoc.data();

        // Notify driver about passenger status
        let notificationTitle = '';
        let notificationBody = '';

        switch (passengerStatus) {
          case 'ready':
            notificationTitle = 'Passenger Ready';
            notificationBody = `${booking.passenger?.name || 'A passenger'} is ready for pickup`;
            break;
          case 'onboard':
            notificationTitle = 'Passenger Onboard';
            notificationBody = `${booking.passenger?.name || 'A passenger'} is now onboard`;
            break;
          case 'dropped_off':
            notificationTitle = 'Passenger Dropped Off';
            notificationBody = `${booking.passenger?.name || 'A passenger'} has been dropped off safely`;
            break;
        }

        if (notificationTitle && booking.driverId) {
          await NotificationService.sendInAppNotification(
            booking.driverId,
            notificationTitle,
            notificationBody,
            'passenger_status_update',
            { bookingId, passengerStatus }
          );
        }
      }

      // Log audit trail
      await AuditService.logAction('UPDATE_PASSENGER_STATUS', 'booking', bookingId, userId, { passengerStatus });
    } catch (error: any) {
      console.error('Update passenger status error:', error);
      throw new Error('Failed to update passenger status');
    }
  }

  // Accept booking (Driver action)
  static async acceptBooking(bookingId: string, driverId: string): Promise<void> {
    try {
      console.log('Accepting booking:', bookingId, 'by driver:', driverId);

      // Get booking data
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingDoc.exists()) {
        throw new Error('Booking not found');
      }

      const bookingData = bookingDoc.data() as Booking;

      if (bookingData.status !== 'pending_driver') {
        throw new Error('Booking is not in pending state');
      }

      // Get ride data to update seats
      const rideDoc = await getDoc(doc(db, 'rides', bookingData.rideId));
      if (!rideDoc.exists()) {
        throw new Error('Ride not found');
      }

      const rideData = rideDoc.data() as Ride;

      // Note: Seats were already reserved when the booking was created (pending_driver status)
      // So we don't need to check or decrement seats here again
      // We just need to update booking status and add passenger to the ride

      // Get passenger data if not present in booking
      let passengerData = bookingData.passenger;
      const passengerId = bookingData.riderId || bookingData.passenger?.id || bookingData.passengerId;

      if (!passengerData && passengerId) {
        console.log('⚠️ Booking missing passenger data, fetching user:', passengerId);
        const userDoc = await getDoc(doc(db, 'users', passengerId));
        if (userDoc.exists()) {
          passengerData = userDoc.data() as User;
        }
      }

      if (!passengerData) {
        throw new Error('Passenger data not found');
      }

      // Use a transaction to ensure atomic updates
      await runTransaction(db, async (transaction) => {
        // 1. Get current booking state
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingDoc = await transaction.get(bookingRef);

        if (!bookingDoc.exists()) {
          throw new Error('Booking not found');
        }

        const currentBookingData = bookingDoc.data();
        if (currentBookingData.status !== 'pending_driver') {
          throw new Error('Booking is no longer pending approval');
        }

        // 2. Get current ride state to ensure seat availability hasn't changed (though seats are already reserved)
        const rideRef = doc(db, 'rides', bookingData.rideId);
        const rideDoc = await transaction.get(rideRef);

        if (!rideDoc.exists()) {
          throw new Error('Ride not found');
        }

        const currentRideData = rideDoc.data() as Ride;

        // 3. Prepare updates
        // Restore passenger data logic
        let passengerData = currentBookingData.passenger;
        if (!passengerData) {
          // If we still don't have passenger data, we can't easily fetch inside transaction without potentially reading too many docs
          // So we rely on what we passed or fail. 
          // Ideally, we should have fetched this before the transaction if needed, but for now strict check:
          const pId = currentBookingData.riderId || currentBookingData.passengerId;
          // We can try to read the user doc within transaction if we have the ID
          if (pId) {
            const userRef = doc(db, 'users', pId);
            const userDoc = await transaction.get(userRef);
            if (userDoc.exists()) {
              passengerData = userDoc.data() as User;
            }
          }
        }

        if (!passengerData) {
          throw new Error('Passenger data missing and could not be retrieved');
        }

        // Update Booking
        transaction.update(bookingRef, {
          status: 'confirmed',
          passenger: passengerData,
          updatedAt: serverTimestamp()
        });

        // Update Ride Passengers
        const updatedPassengers = [...(currentRideData.passengers || []), {
          id: currentBookingData.riderId || currentBookingData.passengerId || '',
          seats: currentBookingData.seats,
          bookingId: bookingId,
          user: passengerData
        }];

        transaction.update(rideRef, {
          passengers: updatedPassengers,
          updatedAt: serverTimestamp()
        });
      });

      console.log('✅ Booking acceptance transaction committed successfully');

      // Capture payment if payment intent exists (outside transaction as it's an external API call usually)
      if (bookingData.payment?.intentId) {
        try {
          // Use lazy import to avoid circular dependencies if any
          const { StripePaymentService } = require('./stripe');
          console.log('Capturing payment:', bookingData.payment.intentId);
          await StripePaymentService.capturePayment(bookingData.payment.intentId, bookingId);

          await updateDoc(doc(db, 'bookings', bookingId), {
            'payment.status': 'captured',
            updatedAt: serverTimestamp()
          });
        } catch (paymentError) {
          console.error('Payment capture failed:', paymentError);
          // Don't fail the booking acceptance for payment issues, but log it
          // In production you might want to stop here or flag it
        }
      }

      // Send notification to passenger
      await NotificationService.sendInAppNotification(
        bookingData.riderId || bookingData.passenger?.id || '',
        'Booking Confirmed!',
        `Your booking has been accepted by the driver. You can now message them and prepare for your ride.`,
        'booking_accepted',
        { bookingId, rideId: bookingData.rideId }
      );

      // Log audit trail
      await AuditService.logAction('ACCEPT_BOOKING', 'booking', bookingId, driverId, {
        riderId: bookingData.riderId || bookingData.passenger?.id,
        rideId: bookingData.rideId,
        seats: bookingData.seats
      });

      console.log('Booking accepted successfully');
    } catch (error: any) {
      console.error('Accept booking error:', error);
      throw new Error(error.message || 'Failed to accept booking');
    }
  }

  // Reject booking (Driver action)
  static async rejectBooking(
    bookingId: string,
    rideId: string,
    seats: number,
    driverId: string,
    reason?: string
  ): Promise<void> {
    try {
      console.log('Rejecting booking:', bookingId, 'by driver:', driverId);

      // Get booking data
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingDoc.exists()) {
        throw new Error('Booking not found');
      }

      const bookingData = bookingDoc.data() as Booking;

      if (bookingData.status !== 'pending_driver') {
        throw new Error('Booking is not in pending state');
      }

      // Update booking status to declined
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'declined',
        rejectionReason: reason || 'No reason provided',
        rejectedBy: driverId,
        updatedAt: serverTimestamp()
      });

      // Cancel payment if payment intent exists
      if (bookingData.payment?.intentId) {
        try {
          // TODO: Implement Stripe payment cancellation
          console.log('Would cancel payment:', bookingData.payment.intentId);

          await updateDoc(doc(db, 'bookings', bookingId), {
            'payment.status': 'cancelled',
            updatedAt: serverTimestamp()
          });
        } catch (paymentError) {
          console.error('Payment cancellation failed:', paymentError);
          // Continue with booking rejection even if payment cancellation fails
        }
      }

      // Send notification to passenger
      await NotificationService.sendInAppNotification(
        bookingData.riderId || bookingData.passenger?.id || '',
        'Booking Declined',
        `Your booking request has been declined by the driver. ${reason ? `Reason: ${reason}` : 'No reason provided.'}`,
        'booking_rejected',
        { bookingId, rideId }
      );

      // Log audit trail
      await AuditService.logAction('REJECT_BOOKING', 'booking', bookingId, driverId, {
        reason,
        riderId: bookingData.riderId || bookingData.passenger?.id,
        rideId,
        seats
      });

      console.log('Booking rejected successfully');
    } catch (error: any) {
      console.error('Reject booking error:', error);
      throw new Error(error.message || 'Failed to reject booking');
    }
  }

  // Cancel booking by passenger
  static async cancelBookingByPassenger(
    bookingId: string,
    rideId: string,
    seats: number,
    passengerId: string,
    reason?: string
  ): Promise<void> {
    try {
      console.log('Cancelling booking:', bookingId, 'by passenger:', passengerId);

      // Get booking and ride data
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingDoc.exists()) {
        throw new Error('Booking not found');
      }

      const bookingData = bookingDoc.data() as Booking;
      const ride = await this.getRideById(rideId);

      if (!ride) {
        throw new Error('Ride not found');
      }

      // Determine cancellation type based on current status
      const cancellationType = bookingData.status === 'confirmed' ? 'CANCEL_AFTER_ACCEPTANCE' : 'CANCEL_BOOKING';

      // Update booking status to cancelled
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'cancelled_by_rider',
        cancellationReason: reason || 'Cancelled by passenger',
        cancelledBy: passengerId,
        updatedAt: serverTimestamp()
      });

      // Remove passenger from ride and restore seats if booking was confirmed
      if (bookingData.status === 'confirmed') {
        const rideRef = doc(db, 'rides', rideId);
        const rideDoc = await getDoc(rideRef);

        if (rideDoc.exists()) {
          const rideData = rideDoc.data() as Ride;
          const updatedPassengers = (rideData.passengers || []).filter(
            (p: any) => p.bookingId !== bookingId
          );

          await updateDoc(rideRef, {
            passengers: updatedPassengers,
            availableSeats: Math.max(0, ((rideData.availableSeats ?? rideData.seatsAvailable ?? 0) as number) + seats),
            seatsAvailable: Math.max(0, ((rideData.availableSeats ?? rideData.seatsAvailable ?? 0) as number) + seats),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Send notification to driver
      await NotificationService.sendInAppNotification(
        ride.driverId,
        'Booking Cancelled',
        `A passenger has cancelled their booking for your ride from ${ride.from?.name || ride.origin?.name || 'Unknown'} to ${ride.to?.name || ride.destination?.name || 'Unknown'}. ${reason ? `Reason: ${reason}` : ''}`,
        'ride_cancelled',
        { bookingId, rideId }
      );

      // Log audit trail
      await AuditService.logAction(cancellationType, 'booking', bookingId, passengerId, {
        reason,
        rideId,
        seats,
        driverId: ride.driverId
      });

      console.log('Booking cancelled successfully by passenger');
    } catch (error: any) {
      console.error('Cancel booking by passenger error:', error);
      throw new Error(error.message || 'Failed to cancel booking');
    }
  }

  // Get bookings for a ride (Driver view)
  static async getRideBookings(rideId: string, userId?: string): Promise<Booking[]> {
    try {
      // Build query - if userId is provided, add it for Firestore rules compliance
      let q;
      if (userId) {
        // First try as driver
        q = query(
          collection(db, 'bookings'),
          where('rideId', '==', rideId),
          where('driverId', '==', userId),
          limit(50)
        );

        let querySnapshot = await getDocs(q);

        // If no results as driver, try as rider
        if (querySnapshot.empty) {
          q = query(
            collection(db, 'bookings'),
            where('rideId', '==', rideId),
            where('riderId', '==', userId),
            limit(50)
          );
          querySnapshot = await getDocs(q);
        }

        const bookings: Booking[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          bookings.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
          } as Booking);
        });

        // Sort by creation date
        bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return bookings;
      } else {
        // Legacy: query without user filter (may fail with strict rules)
        q = query(
          collection(db, 'bookings'),
          where('rideId', '==', rideId),
          limit(50)
        );

        const querySnapshot = await getDocs(q);
        const bookings: Booking[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          bookings.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
          } as Booking);
        });

        // Sort by creation date
        bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return bookings;
      }
    } catch (error: any) {
      console.error('Get ride bookings error:', error, error.message);
      throw new Error('Failed to get ride bookings');
    }
  }

  // Get driver booking requests (pending bookings for driver)
  static async getDriverBookingRequests(driverId: string, pageSize: number = 50): Promise<Booking[]> {
    try {
      const q = query(
        collection(db, 'bookings'),
        where('driverId', '==', driverId),
        orderBy('createdAt', 'desc'),
        limit(Math.max(1, Math.min(200, pageSize)))
      );

      const querySnapshot = await getDocs(q);
      const bookings: Booking[] = [];

      for (const docSnapshot of querySnapshot.docs) {
        const bookingData = docSnapshot.data();
        const ride = await this.getRideById(bookingData.rideId);

        if (ride) {
          bookings.push({
            id: docSnapshot.id,
            rideId: bookingData.rideId,
            driverId: bookingData.driverId,
            riderId: bookingData.riderId || bookingData.passengerId,
            passenger: bookingData.passenger,
            seats: bookingData.seats,
            amountTotal: bookingData.amountTotal,
            status: bookingData.status,
            payment: bookingData.payment || { intentId: '', status: 'authorized' },
            createdAt: bookingData.createdAt?.toDate?.()?.toISOString() || bookingData.createdAt,
            ride
          } as Booking);
        }
      }

      // Sort by creation date
      bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return bookings;
    } catch (error: any) {
      console.error('Get driver booking requests error:', error);
      throw new Error('Failed to get driver booking requests');
    }
  }

  // Cancel booking (Legacy method - kept for compatibility)
  static async cancelBooking(bookingId: string, rideId: string, seats: number, userId?: string): Promise<void> {
    try {
      // Update booking status
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'cancelled_by_rider',
        updatedAt: serverTimestamp()
      });

      // Update ride available seats
      const rideRef = doc(db, 'rides', rideId);
      const rideDoc = await getDoc(rideRef);

      if (rideDoc.exists()) {
        const rideData = rideDoc.data() as Ride;
        const updatedPassengers = (rideData.passengers || []).filter(
          (p: any) => p.bookingId !== bookingId
        );

        await updateDoc(rideRef, {
          passengers: updatedPassengers,
          availableSeats: Math.max(0, ((rideData.availableSeats ?? rideData.seatsAvailable ?? 0) as number) + seats),
          seatsAvailable: Math.max(0, ((rideData.availableSeats ?? rideData.seatsAvailable ?? 0) as number) + seats),
          updatedAt: serverTimestamp()
        });
      }

      // Log audit trail
      if (userId) {
        await AuditService.logAction('CANCEL_BOOKING', 'booking', bookingId, userId, {
          rideId,
          seats
        });
      }
    } catch (error: any) {
      console.error('Cancel booking error:', error);
      throw new Error('Failed to cancel booking');
    }
  }

  // Delete ride (soft delete - only if no active bookings exist)
  static async deleteRide(rideId: string, driverId: string): Promise<void> {
    try {
      console.log('Attempting to delete ride:', rideId, 'by driver:', driverId);

      // Verify the user is the driver of this ride
      const ride = await this.getRideById(rideId);
      if (!ride) {
        throw new Error('Ride not found');
      }

      if (ride.driverId !== driverId) {
        throw new Error('You can only delete your own rides');
      }

      // Check if ride has any active bookings
      const bookings = await this.getRideBookings(rideId);
      console.log('Found bookings for ride:', bookings.length, 'bookings:', bookings.map(b => ({ id: b.id, status: b.status })));

      // Only allow deletion if there are no active bookings
      // Active bookings are: pending_driver, confirmed
      // Inactive bookings are: declined, cancelled_by_rider, cancelled_by_driver, refunded
      const activeBookings = bookings.filter(b =>
        b.status === 'pending_driver' || b.status === 'confirmed'
      );

      console.log('Active bookings found:', activeBookings.length);

      if (activeBookings.length > 0) {
        const statusList = activeBookings.map(b => b.status).join(', ');
        throw new Error(`Cannot delete ride with active bookings (${statusList}). Please wait for bookings to be completed or cancelled.`);
      }

      // Soft delete the ride by setting status to cancelled
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });

      // Log audit trail
      await AuditService.logAction('DELETE_RIDE', 'ride', rideId, driverId, {
        reason: 'Deleted by driver',
        totalBookings: bookings.length,
        activeBookings: activeBookings.length
      });

      console.log('Ride deleted successfully');
    } catch (error: any) {
      console.error('Delete ride error:', error);
      throw new Error(error.message || 'Failed to delete ride');
    }
  }
}