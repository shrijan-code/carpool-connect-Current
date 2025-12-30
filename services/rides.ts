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
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { Ride, Booking, User, AuditLogData, getErrorMessage } from '@/types';
import { NotificationService } from './notifications';
import { logger } from '@/utils/logger';
import { createRideGeohashes } from '@/utils/geohash';

// Audit log service
class AuditService {
  static async logAction(action: string, entityType: string, entityId: string, userId: string, data?: AuditLogData) {
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
      logger.error('Audit log error', error);
      // Don't throw error to avoid breaking main functionality
    }
  }
}

export class RidesService {
  // Create a new ride
  static async createRide(rideData: Partial<Ride>): Promise<string> {
    try {
      logger.debug('Creating ride with data:', rideData);

      // Validate required fields
      if (!rideData.driverId || !rideData.from || !rideData.to || !rideData.departureTime) {
        throw new Error('Missing required ride data');
      }

      // Ensure pricePerSeat is always stored in cents (integer)
      // The price should already be in cents from the UI
      if (rideData.pricePerSeat !== undefined) {
        rideData.pricePerSeat = Math.round(rideData.pricePerSeat);
        logger.debug('Price stored', { cents: rideData.pricePerSeat, dollars: (rideData.pricePerSeat / 100).toFixed(2) });
      }

      // Ensure availableSeats is set (use totalSeats or seatsAvailable if not provided)
      const availableSeats = rideData.availableSeats ?? rideData.seatsAvailable ?? rideData.totalSeats ?? 4;

      // Generate geohash for efficient spatial queries
      const geohashes = createRideGeohashes(
        rideData.from!.latitude,
        rideData.from!.longitude,
        rideData.to!.latitude,
        rideData.to!.longitude
      );

      const rideRef = await addDoc(collection(db, 'rides'), {
        ...rideData,
        availableSeats, // Ensure this is always set
        seatsAvailable: availableSeats, // Maintain both fields for compatibility
        status: 'upcoming',
        passengers: [],
        // Geohash fields for efficient spatial queries
        ...geohashes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      logger.info('Ride created successfully', { rideId: rideRef.id });

      // Log audit trail
      await AuditService.logAction('CREATE_RIDE', 'ride', rideRef.id, rideData.driverId!, {
        from: rideData.from?.name,
        to: rideData.to?.name,
        departureTime: rideData.departureTime,
        availableSeats: rideData.availableSeats,
        pricePerSeat: rideData.pricePerSeat
      });

      return rideRef.id;
    } catch (error) {
      logger.error('Create ride error', error);
      throw new Error(getErrorMessage(error) || 'Failed to create ride');
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
    } catch (error) {
      logger.error('Search rides error', error);
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
      logger.error('Get ride error', error);
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

      logger.debug('Loaded available rides (future only)', { count: rides.length, deliveryOnly });
      return rides;
    } catch (error) {
      logger.error('Get all available rides error', error);
      throw new Error('Failed to get available rides');
    }
  }

  /**
   * Get rides near a location using geohash-based query
   * This is much more efficient than loading all rides and filtering client-side
   * 
   * @param latitude User's latitude
   * @param longitude User's longitude
   * @param radiusKm Search radius in kilometers (default: 10km)
   * @param maxResults Maximum results to return (default: 50)
   * @returns Array of rides within the search area
   */
  static async getNearbyRides(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    maxResults: number = 50
  ): Promise<Ride[]> {
    try {
      // Import dynamically to avoid circular dependency issues
      const { encodeGeohash, getGeohashRange, getPrecisionForRadius } = await import('@/utils/geohash');
      const { calculateLocationDistance } = await import('@/utils/haversine');

      // Get appropriate precision for search radius
      const precision = getPrecisionForRadius(radiusKm);
      const centerHash = encodeGeohash(latitude, longitude, precision);
      const { start, end } = getGeohashRange(centerHash);

      logger.debug('Searching nearby rides', {
        latitude,
        longitude,
        radiusKm,
        geohash: centerHash,
        precision
      });

      // Query using geohash range - much more efficient than loading all rides
      const ridesQuery = query(
        collection(db, 'rides'),
        where('originGeohash' + (precision === 4 ? '4' : ''), '>=', start),
        where('originGeohash' + (precision === 4 ? '4' : ''), '<', end),
        where('status', '==', 'upcoming'),
        limit(maxResults * 2) // Get extra to filter by exact distance
      );

      const querySnapshot = await getDocs(ridesQuery);
      const now = new Date();

      // Use distanceFromUser to avoid conflict with existing Ride.distance string property
      const rides: Array<Ride & { distanceFromUser?: number }> = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const departureTime = data.departureTime || data.departureAt;

        // Only include future rides with available seats
        if (departureTime && new Date(departureTime) > now) {
          const availableSeats = Math.max(
            data.seatsAvailable || 0,
            data.availableSeats || 0
          );

          if (availableSeats > 0) {
            const ride = {
              id: doc.id,
              ...data,
              departureTime,
              availableSeats,
              seatsAvailable: availableSeats,
            } as Ride & { distanceFromUser?: number };

            // Calculate exact distance for final filtering
            const origin = data.from || data.origin;
            if (origin?.latitude && origin?.longitude) {
              const distance = calculateLocationDistance(
                { latitude, longitude },
                { latitude: origin.latitude, longitude: origin.longitude }
              );

              // Only include if within actual radius (geohash is approximate)
              if (distance <= radiusKm * 1000) {
                ride.distanceFromUser = distance;
                rides.push(ride);
              }
            }
          }
        }
      });

      // Sort by distance and limit results
      rides.sort((a, b) => (a.distanceFromUser || 0) - (b.distanceFromUser || 0));

      logger.info('Found nearby rides', {
        count: rides.length,
        searched: querySnapshot.size,
        radiusKm
      });

      return rides.slice(0, maxResults);
    } catch (error) {
      logger.error('Get nearby rides error', error);
      // Fallback to regular search if geohash query fails
      logger.warn('Falling back to getAllAvailableRides');
      return this.getAllAvailableRides(maxResults);
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
        logger.debug('Using simple query for user rides due to missing index');
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

      logger.debug('Loaded user rides for driver', { userId, count: rides.length, includesPastRides: true });
      return rides;
    } catch (error) {
      logger.error('Get user rides error', error);
      throw new Error('Failed to get user rides');
    }
  }

  // Create booking request (Rider action) - creates pending booking request
  static async createBookingRequest(
    rideId: string,
    passengerId: string,
    seats: number,
    passengerData: Partial<User>,
    paymentIntentId?: string | null,
    initialStatus: 'pending_driver' | 'pending_payment' = 'pending_driver'
  ): Promise<string> {
    try {
      logger.debug('Creating booking request', { rideId, passengerId, seats });

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

      // CRITICAL: Decrement available seats immediately to prevent overbooking
      const { increment } = await import('firebase/firestore');
      await updateDoc(rideRef, {
        availableSeats: increment(-seats),
        seatsAvailable: increment(-seats),
        updatedAt: serverTimestamp()
      });
      console.log(`🪑 Decremented ${seats} seats from ride ${rideId}`);

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
        logger.debug('Using simple query for user bookings due to missing index');
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

        // Get all passengers for notifications - include driverId for security rules
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('rideId', '==', rideId),
          where('status', '==', 'confirmed'),
          where('driverId', '==', rideData.driverId)
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

  // Accept booking (Driver action) - Calls Cloud Function for immediate payment authorization
  static async acceptBooking(bookingId: string, driverId: string): Promise<void> {
    try {
      logger.debug('Accepting booking via Cloud Function', { bookingId, driverId });

      // Call the new Cloud Function that handles booking acceptance WITH payment authorization
      const acceptBookingWithPayment = httpsCallable(functions, 'acceptBookingWithPayment');
      const result = await acceptBookingWithPayment({ bookingId });

      const data = result.data as {
        success: boolean;
        message: string;
        paymentAuthorized: boolean;
        paymentDeferred?: boolean;
        paymentError: string | null;
        daysUntilRide?: number;
      };

      if (!data.success) {
        throw new Error(data.message || 'Failed to accept booking');
      }

      // Log payment authorization status
      if (data.paymentAuthorized) {
        console.log('✅ Booking accepted with immediate payment authorization');
      } else if (data.paymentDeferred) {
        console.log(`📋 Booking accepted - payment will be authorized 24h before ride (in ~${data.daysUntilRide} days)`);
      } else if (data.paymentError) {
        console.warn('⚠️ Booking accepted but payment authorization failed:', data.paymentError);
        // Optionally show this warning to driver
      } else {
        console.log('✅ Booking accepted (no payment required)');
      }

      // Log audit trail client-side
      await AuditService.logAction('ACCEPT_BOOKING', 'booking', bookingId, driverId, {
        paymentAuthorized: data.paymentAuthorized,
      });

      console.log('Booking accepted successfully');
    } catch (error: any) {
      console.error('Accept booking error:', error);
      throw new Error(error.message || 'Failed to accept booking');
    }
  }

  // Reject booking (Driver action) - NOW USES CLOUD FUNCTION FOR SECURITY
  // Server-side validation prevents spoofing and ensures atomic seat restoration
  static async rejectBooking(
    bookingId: string,
    rideId: string,
    seats: number,
    driverId: string,
    reason?: string
  ): Promise<void> {
    try {
      logger.debug('Rejecting booking via Cloud Function', { bookingId, driverId });

      // Import CarpoolBookingService dynamically to avoid circular dependency
      const { CarpoolBookingService } = await import('./carpool-booking');

      // Use the secure Cloud Function which:
      // 1. Validates driverId matches the booking's driver
      // 2. Restores seats atomically in a transaction
      // 3. Updates booking status server-side
      await CarpoolBookingService.driverRespondBooking({
        bookingId,
        action: 'decline'
      });

      console.log('✅ Booking rejected via Cloud Function - seats restored server-side');

      // Log audit trail (still client-side for now, could be moved to CF)
      await AuditService.logAction('REJECT_BOOKING', 'booking', bookingId, driverId, {
        reason,
        rideId,
        seats
      });

    } catch (error: any) {
      console.error('Reject booking error:', error);
      throw new Error(error.message || 'Failed to reject booking');
    }
  }

  // Cancel booking by passenger - NOW USES CLOUD FUNCTION FOR SECURITY
  // Server-side validation ensures proper refund handling and atomic seat restoration
  /**
   * @deprecated Use CarpoolBookingService.cancelBooking() directly for new code.
   * This wrapper exists for backward compatibility.
   */
  static async cancelBookingByPassenger(
    bookingId: string,
    rideId: string,
    seats: number,
    passengerId: string,
    reason?: string
  ): Promise<void> {
    try {
      logger.debug('Cancelling booking via Cloud Function', { bookingId, passengerId });

      // Import CarpoolBookingService dynamically to avoid circular dependency
      const { CarpoolBookingService } = await import('./carpool-booking');

      // Use the secure Cloud Function which:
      // 1. Validates passengerId matches the booking's rider
      // 2. Calculates cancellation fees based on timing
      // 3. Processes refunds via Stripe server-side
      // 4. Restores seats atomically in a transaction
      await CarpoolBookingService.cancelBooking({
        bookingId,
        reason: reason || 'Cancelled by passenger'
      });

      console.log('✅ Booking cancelled via Cloud Function - refund and seats handled server-side');

      // Log audit trail (still client-side for now)
      await AuditService.logAction('CANCEL_BOOKING', 'booking', bookingId, passengerId, {
        reason,
        rideId,
        seats
      });

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

  // Update ride details (Driver action - before bookings are confirmed)
  static async updateRide(
    rideId: string,
    driverId: string,
    updates: {
      origin?: { id: string; name: string; address: string; latitude: number; longitude: number };
      destination?: { id: string; name: string; address: string; latitude: number; longitude: number };
      departureTime?: string;
      pricePerSeat?: number;
      seatsTotal?: number;
      notes?: string;
    }
  ): Promise<void> {
    try {
      logger.debug('Updating ride', { rideId, driverId, updates });

      // 1. Verify the ride exists and belongs to this driver
      const ride = await this.getRideById(rideId);
      if (!ride) {
        throw new Error('Ride not found');
      }

      if (ride.driverId !== driverId) {
        throw new Error('You can only edit your own rides');
      }

      // 2. Verify ride status is 'upcoming' (not active, completed, or cancelled)
      if (ride.status !== 'upcoming') {
        throw new Error(`Cannot edit a ride that is ${ride.status}. Only upcoming rides can be edited.`);
      }

      // 3. SECURITY CHECK: Cannot edit if ANY active bookings exist (including pending ones with payments)
      // This is critical because riders pay when they book (pending_driver status), not when confirmed
      const bookings = await this.getRideBookings(rideId, driverId);

      // Block editing if there are ANY bookings in pending_driver or confirmed status
      // These bookings have already had payment authorized/captured
      const activeBookings = bookings.filter(b =>
        b.status === 'pending_driver' ||
        b.status === 'confirmed'
      );

      if (activeBookings.length > 0) {
        const hasPayments = activeBookings.some(b => b.payment?.intentId);
        if (hasPayments) {
          throw new Error('Cannot edit ride after riders have booked and paid. Please cancel existing bookings first (riders will be refunded).');
        } else {
          throw new Error('Cannot edit ride with pending or confirmed bookings. Please wait for bookings to be resolved first.');
        }
      }

      // 4. Validate update fields
      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (updates.origin) {
        if (!updates.origin.name || !updates.origin.address ||
          typeof updates.origin.latitude !== 'number' || typeof updates.origin.longitude !== 'number') {
          throw new Error('Invalid origin location data');
        }
        updateData.from = updates.origin;
        updateData.origin = updates.origin;
      }

      if (updates.destination) {
        if (!updates.destination.name || !updates.destination.address ||
          typeof updates.destination.latitude !== 'number' || typeof updates.destination.longitude !== 'number') {
          throw new Error('Invalid destination location data');
        }
        updateData.to = updates.destination;
        updateData.destination = updates.destination;
      }

      if (updates.departureTime !== undefined) {
        const departureDate = new Date(updates.departureTime);
        if (isNaN(departureDate.getTime())) {
          throw new Error('Invalid departure time');
        }

        const minDepartureTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
        if (departureDate < minDepartureTime) {
          throw new Error('Departure time must be at least 5 minutes in the future');
        }

        updateData.departureTime = updates.departureTime;
        updateData.departureAt = updates.departureTime;
      }

      if (updates.pricePerSeat !== undefined) {
        const price = Math.round(updates.pricePerSeat);
        if (price <= 0) {
          throw new Error('Price must be greater than zero');
        }
        if (price > 100000) { // $1000 max
          throw new Error('Price cannot exceed $1,000');
        }
        updateData.pricePerSeat = price;
      }

      if (updates.seatsTotal !== undefined) {
        const seats = Math.round(updates.seatsTotal);
        if (seats < 1 || seats > 8) {
          throw new Error('Available seats must be between 1 and 8');
        }
        updateData.seatsTotal = seats;
        updateData.availableSeats = seats;
        updateData.seatsAvailable = seats;
      }

      if (updates.notes !== undefined) {
        updateData.note = updates.notes.trim().substring(0, 500); // Max 500 chars
      }

      // 5. Apply the update
      await updateDoc(doc(db, 'rides', rideId), updateData);

      // 6. Log audit trail
      await AuditService.logAction('UPDATE_RIDE', 'ride', rideId, driverId, {
        updatedFields: Object.keys(updates),
        ...updates
      });

      console.log('Ride updated successfully:', rideId);
    } catch (error: any) {
      console.error('Update ride error:', error);
      throw new Error(error.message || 'Failed to update ride');
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

      // Check if ride has any active bookings - pass driverId for security rules compliance
      const bookings = await this.getRideBookings(rideId, driverId);
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