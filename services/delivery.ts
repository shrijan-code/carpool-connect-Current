import { Delivery, DriverAvailability, Location } from '@/types';
import { db } from '@/config/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, serverTimestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { NotificationService } from '@/services/notifications';

export type CreateDeliveryV2Request = {
  pickup: { address: string; lat: number; lng: number; time?: string };
  dropoff: { address: string; lat: number; lng: number };
  items: { type: string; qty: number; fragile?: boolean }[];
  size: 'Small' | 'Medium' | 'Large' | 'ExtraLarge' | string;
  vehicleRequirement: 'Bike' | 'Car' | 'Van' | 'Truck' | string;
  fee: { presetOption?: number | null; customAmount?: number | null };
  specialInstructions?: string;
  requesterId: string;
  paymentRequired: boolean;
};

// Firebase Functions URL with multiple fallbacks
const getFirebaseFunctionsUrl = () => {
  // Environment variable override
  if (process.env.FIREBASE_FUNCTIONS_URL) {
    return process.env.FIREBASE_FUNCTIONS_URL;
  }

  // Use Firebase project URL for functions
  return 'https://us-central1-carpoolconnect1-0.cloudfunctions.net';
};

const FIREBASE_FUNCTIONS_URL = getFirebaseFunctionsUrl();

// Test function to check if Firebase Functions are accessible
export const testFirebaseFunctions = async (): Promise<boolean> => {
  try {
    console.log('Testing Firebase Functions connectivity at:', FIREBASE_FUNCTIONS_URL);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${FIREBASE_FUNCTIONS_URL}/healthCheck`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('Firebase Functions health check successful:', data);
      return true;
    } else {
      console.log('Firebase Functions health check failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Firebase Functions health check timed out');
    } else {
      console.log('Firebase Functions connectivity test failed:', error.message);
    }
    return false;
  }
};

export class DeliveryService {
  static async createDelivery(delivery: Omit<Delivery, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('📦 Creating delivery directly in Firestore:', delivery);

      // Validate required fields
      const errors = this.validateDeliveryRequest(delivery);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      // Use Firestore directly for better reliability
      const deliveryData = {
        ...delivery,
        deliveryType: 'riderPost' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'deliveries'), deliveryData);
      console.log('✅ Delivery created successfully with ID:', docRef.id);

      // Send notification to nearby drivers
      try {
        await NotificationService.sendNewDeliveryNotification(
          delivery.businessId,
          delivery.pickupLocation.address,
          delivery.dropoffLocation.address,
          delivery.priceCents / 100
        );
      } catch (notificationError) {
        console.warn('Failed to send new delivery notification:', notificationError);
      }

      return docRef.id;
    } catch (error: any) {
      console.error('❌ Create delivery error:', error.code, error.message);

      if (error.code === 'permission-denied') {
        throw new Error('Permission denied: Unable to create delivery');
      } else if (error.code === 'unavailable') {
        throw new Error('Service unavailable: Please try again later');
      } else {
        throw new Error(`Failed to create delivery: ${error.message || 'Unknown error'}`);
      }
    }
  }

  static async createDeliveryV2(payload: CreateDeliveryV2Request): Promise<{ id: string; status: string; paymentIntentId?: string }> {
    try {
      console.log('Creating delivery V2 directly in Firestore:', payload);

      // Calculate fee
      const fee = payload.fee.customAmount ?
        Math.round(payload.fee.customAmount * 100) :
        (payload.fee.presetOption ? Math.round(payload.fee.presetOption * 100) : 800);

      // Transform to Delivery format
      const deliveryData = {
        businessId: payload.requesterId,
        items: payload.items.map(item => ({
          itemId: Date.now().toString() + Math.random(),
          name: item.type,
          quantity: item.qty,
          fragile: item.fragile || false,
        })),
        pickupLocation: {
          id: `pickup_${Date.now()}`,
          name: payload.pickup.address.split(',')[0],
          address: payload.pickup.address,
          latitude: payload.pickup.lat,
          longitude: payload.pickup.lng,
        },
        dropoffLocation: {
          id: `dropoff_${Date.now()}`,
          name: payload.dropoff.address.split(',')[0],
          address: payload.dropoff.address,
          latitude: payload.dropoff.lat,
          longitude: payload.dropoff.lng,
        },
        packageSize: payload.size.toLowerCase(),
        specialInstructions: payload.specialInstructions || '',
        priceCents: fee,
        preferredTimeWindow: {
          start: payload.pickup.time || new Date().toISOString(),
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours window
        },
        status: 'pending',
        deliveryType: 'riderPost' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'deliveries'), deliveryData);
      console.log('Delivery V2 created successfully with ID:', docRef.id);

      return {
        id: docRef.id,
        status: 'pending',
        // For now, we'll handle payments when driver accepts
        paymentIntentId: undefined
      };
    } catch (error) {
      console.error('Create delivery V2 error:', error);
      throw new Error(`Failed to create delivery: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getDeliveries(
    userId: string,
    userRole: 'business' | 'driver' | 'rider' | 'both',
    pageSize: number = 20,
    cursor?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ deliveries: Delivery[]; nextCursor?: QueryDocumentSnapshot<DocumentData> }> {
    try {
      console.log('📦 Fetching deliveries from Firestore for user:', userId, 'role:', userRole);

      // Use Firestore with strict scoping and pagination
      const base = [orderBy('createdAt', 'desc') as any, limit(Math.max(1, Math.min(100, pageSize)))] as any[];

      let deliveries: Delivery[] = [];
      let lastCursor: QueryDocumentSnapshot<DocumentData> | undefined = undefined;

      if (userRole === 'business' || userRole === 'rider') {
        // Only this user's deliveries for history view (includes past and future for owner)
        const q = cursor
          ? query(collection(db, 'deliveries'), where('businessId', '==', userId), ...base, startAfter(cursor))
          : query(collection(db, 'deliveries'), where('businessId', '==', userId), ...base);

        const querySnapshot = await getDocs(q);
        deliveries = querySnapshot.docs.map(snap => this.mapFirestoreDocToDelivery(snap));
        lastCursor = querySnapshot.docs.length === pageSize ? querySnapshot.docs[querySnapshot.docs.length - 1] : undefined;
      } else if (userRole === 'driver') {
        // For drivers: show pending deliveries plus ones assigned to them
        const map = new Map<string, Delivery>();
        const now = new Date();

        // Get pending deliveries (available to accept) - filter out past deliveries
        const pendingQ = cursor
          ? query(collection(db, 'deliveries'), where('status', '==', 'pending'), ...base, startAfter(cursor))
          : query(collection(db, 'deliveries'), where('status', '==', 'pending'), ...base);

        // Get deliveries assigned to this driver (includes past and future for assigned driver)
        const assignedQ = query(collection(db, 'deliveries'), where('driverId', '==', userId), ...base);

        const [pendingSnap, assignedSnap] = await Promise.all([getDocs(pendingQ), getDocs(assignedQ)]);

        // Merge results without duplicates - filter out past pending deliveries
        pendingSnap.docs.forEach(snap => {
          const delivery = this.mapFirestoreDocToDelivery(snap);
          const deliveryTime = new Date(delivery.preferredTimeWindow.start);
          const isPastDelivery = deliveryTime.getTime() < now.getTime();

          // Only include future pending deliveries for drivers to accept
          if (!isPastDelivery) {
            map.set(snap.id, delivery);
          }
        });

        // Include all assigned deliveries (past and future) for the driver
        assignedSnap.docs.forEach(snap => {
          map.set(snap.id, this.mapFirestoreDocToDelivery(snap));
        });

        deliveries = Array.from(map.values()).sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        lastCursor = pendingSnap.docs.length > 0 ? pendingSnap.docs[pendingSnap.docs.length - 1] : undefined;
      } else if (userRole === 'both') {
        // For users with both roles: show their own deliveries + available ones to accept
        const map = new Map<string, Delivery>();
        const now = new Date();

        // Get user's own deliveries (includes past and future for owner)
        const ownQ = query(collection(db, 'deliveries'), where('businessId', '==', userId), ...base);

        // Get pending deliveries (available to accept as driver) - filter out past ones
        const pendingQ = query(collection(db, 'deliveries'), where('status', '==', 'pending'), ...base);

        // Get deliveries assigned to this user as driver (includes past and future)
        const assignedQ = query(collection(db, 'deliveries'), where('driverId', '==', userId), ...base);

        const [ownSnap, pendingSnap, assignedSnap] = await Promise.all([
          getDocs(ownQ),
          getDocs(pendingQ),
          getDocs(assignedQ)
        ]);

        // Merge results without duplicates
        ownSnap.docs.forEach(snap => {
          map.set(snap.id, this.mapFirestoreDocToDelivery(snap));
        });

        // Filter out past pending deliveries for driver role
        pendingSnap.docs.forEach(snap => {
          const delivery = this.mapFirestoreDocToDelivery(snap);
          const deliveryTime = new Date(delivery.preferredTimeWindow.start);
          const isPastDelivery = deliveryTime.getTime() < now.getTime();

          // Only include future pending deliveries for drivers to accept
          if (!isPastDelivery) {
            map.set(snap.id, delivery);
          }
        });

        // Include all assigned deliveries (past and future) for the driver
        assignedSnap.docs.forEach(snap => {
          map.set(snap.id, this.mapFirestoreDocToDelivery(snap));
        });

        deliveries = Array.from(map.values()).sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        lastCursor = ownSnap.docs.length > 0 ? ownSnap.docs[ownSnap.docs.length - 1] : undefined;
      }

      console.log('✅ Successfully fetched deliveries from Firestore:', deliveries.length);
      return { deliveries, nextCursor: lastCursor };
    } catch (error: any) {
      console.error('❌ Get deliveries error:', error.code, error.message);

      // Provide more specific error information
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied: Check Firestore security rules');
      } else if (error.code === 'failed-precondition') {
        throw new Error('Missing Firestore index: Check console for index creation link');
      } else if (error.code === 'unavailable') {
        throw new Error('Firestore service unavailable: Check internet connection');
      } else {
        throw error;
      }
    }
  }

  private static mapFirestoreDocToDelivery(snap: QueryDocumentSnapshot<DocumentData>): Delivery {
    const data = snap.data();
    return {
      id: snap.id,
      businessId: data.businessId,
      driverId: data.driverId,
      items: data.items || [],
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      packageSize: data.packageSize,
      specialInstructions: data.specialInstructions || '',
      priceCents: data.priceCents,
      preferredTimeWindow: data.preferredTimeWindow,
      status: data.status,
      deliveryType: data.deliveryType,
      availabilityId: data.availabilityId,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
    } as Delivery;
  }

  static async acceptDelivery(deliveryId: string, driverId: string, rideId?: string): Promise<void> {
    try {
      console.log('🚚 Accepting delivery:', { deliveryId, driverId, rideId });

      // Validate inputs
      if (!deliveryId || !driverId) {
        throw new Error('Delivery ID and Driver ID are required');
      }

      // Use Firestore transaction to prevent race conditions
      await db.runTransaction(async (transaction) => {
        const deliveryRef = doc(db, 'deliveries', deliveryId);
        const deliveryDoc = await transaction.get(deliveryRef);

        if (!deliveryDoc.exists()) {
          throw new Error('Delivery not found');
        }

        const deliveryData = deliveryDoc.data();

        // Check if delivery is still available for acceptance
        if (deliveryData.status !== 'pending') {
          throw new Error(`Delivery is no longer available (status: ${deliveryData.status})`);
        }

        // Check if delivery already has a driver assigned
        if (deliveryData.driverId && deliveryData.driverId !== driverId) {
          throw new Error('Delivery has already been accepted by another driver');
        }

        // Atomic update to assign driver and change status
        const updateData: any = {
          driverId,
          status: 'matched',
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (rideId) {
          updateData.rideId = rideId;
        }

        transaction.update(deliveryRef, updateData);

        console.log(`✅ Delivery ${deliveryId} accepted by driver ${driverId} atomically`);
      });

      // Send notification to business owner (outside transaction)
      try {
        const delivery = await this.getDeliveryById(deliveryId);
        if (delivery) {
          await NotificationService.sendDeliveryAcceptedNotification(
            delivery.businessId,
            driverId,
            delivery.pickupLocation.address,
            delivery.dropoffLocation.address
          );
        }
      } catch (notificationError) {
        console.warn('Failed to send delivery accepted notification:', notificationError);
      }
    } catch (error: any) {
      console.error('❌ Accept delivery error:', error.code || 'unknown', error.message);

      if (error.code === 'not-found') {
        throw new Error('Delivery not found');
      } else if (error.code === 'permission-denied') {
        throw new Error('Permission denied: Unable to accept delivery');
      } else if (error.message.includes('already been accepted')) {
        throw new Error('This delivery has already been accepted by another driver');
      } else if (error.message.includes('no longer available')) {
        throw new Error(error.message);
      } else {
        throw new Error(`Failed to accept delivery: ${error.message || 'Unknown error'}`);
      }
    }
  }

  static mapFirestoreDocToDriverAvailability(snap: QueryDocumentSnapshot<DocumentData>): DriverAvailability {
    const data = snap.data();
    return {
      id: snap.id,
      driverId: data.driverId,
      driver: data.driver,
      fromLocation: data.fromLocation as Location,
      toLocation: data.toLocation as Location | undefined,
      vehicleType: data.vehicleType,
      capacity: data.capacity,
      priceExpectationCents: data.priceExpectationCents,
      availabilityWindow: data.availabilityWindow,
      notes: data.notes,
      active: data.active ?? true,
      contactPhone: data.contactPhone,
      deliveryType: 'driverAvailability',
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
    };
  }

  static async postDriverAvailability(payload: Omit<DriverAvailability, 'id' | 'createdAt' | 'updatedAt' | 'deliveryType'>): Promise<string> {
    try {
      const data = {
        ...payload,
        active: payload.active ?? true,
        deliveryType: 'driverAvailability' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'driverAvailabilities'), data);
      return docRef.id;
    } catch (error) {
      console.error('Post driver availability error:', error);
      throw new Error('Failed to post availability');
    }
  }

  static async getDriverAvailabilities(options: { onlyActive?: boolean; driverId?: string } = {}): Promise<DriverAvailability[]> {
    try {
      const filters: any[] = [];
      if (options.onlyActive !== false) filters.push(where('active', '==', true));
      if (options.driverId) filters.push(where('driverId', '==', options.driverId));
      const q = filters.length > 0
        ? query(collection(db, 'driverAvailabilities'), ...filters, orderBy('createdAt', 'desc') as any)
        : query(collection(db, 'driverAvailabilities'), orderBy('createdAt', 'desc') as any);
      const snap = await getDocs(q);
      return snap.docs.map(d => this.mapFirestoreDocToDriverAvailability(d));
    } catch (error) {
      console.error('Get driver availabilities error:', error);
      return [];
    }
  }

  static async requestDeliveryFromAvailability(params: {
    availabilityId: string;
    riderId: string;
    pickup: Location;
    dropoff: Location;
    items: { name: string; quantity: number }[];
    packageSize: Delivery['packageSize'];
    priceCents: number;
    specialInstructions?: string;
  }): Promise<string> {
    try {
      const availabilityRefQ = query(collection(db, 'driverAvailabilities'), where('__name__', '==', params.availabilityId));
      const availSnap = await getDocs(availabilityRefQ);
      const availabilityDoc = availSnap.docs[0];
      const availability = availabilityDoc ? this.mapFirestoreDocToDriverAvailability(availabilityDoc) : undefined;

      const deliveryData: Omit<Delivery, 'id' | 'createdAt' | 'updatedAt'> = {
        businessId: params.riderId,
        items: params.items.map(it => ({ itemId: `${Date.now()}_${Math.random()}`, name: it.name, quantity: it.quantity })),
        pickupLocation: params.pickup,
        dropoffLocation: params.dropoff,
        packageSize: params.packageSize,
        specialInstructions: params.specialInstructions ?? '',
        priceCents: params.priceCents,
        preferredTimeWindow: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        },
        status: 'pending',
        driverId: availability?.driverId,
        deliveryType: 'riderPost',
        availabilityId: params.availabilityId,
      } as any;

      const id = await this.createDelivery(deliveryData as any);

      try {
        if (availability?.driverId) {
          await NotificationService.sendInAppNotification(
            availability.driverId,
            'Delivery Request',
            'A Rider has requested your delivery availability.',
            'delivery_new',
          );
        }
        await NotificationService.sendInAppNotification(
          params.riderId,
          'Request Sent',
          'You have requested this delivery.',
          'delivery_new',
        );
      } catch (e) {
        console.warn('Notifications failed for requestDeliveryFromAvailability', e);
      }

      return id;
    } catch (error) {
      console.error('Request delivery from availability error:', error);
      throw new Error('Failed to request delivery');
    }
  }

  static async updateDeliveryStatus(
    deliveryId: string,
    status: Delivery['status'],
    proof?: Delivery['deliveryProof']
  ): Promise<void> {
    try {
      console.log('🔄 Updating delivery status:', { deliveryId, status, hasProof: !!proof });

      // Validate status transition
      const currentDelivery = await this.getDeliveryById(deliveryId);
      if (!currentDelivery) {
        throw new Error('Delivery not found');
      }

      const validTransitions = this.getValidStatusTransitions(currentDelivery.status);
      if (!validTransitions.includes(status)) {
        throw new Error(`Invalid status transition from ${currentDelivery.status} to ${status}`);
      }

      // Use Firestore directly for better reliability
      const deliveryRef = doc(db, 'deliveries', deliveryId);
      const updateData: any = {
        status,
        updatedAt: serverTimestamp(),
      };

      // Add timestamp fields based on status
      const now = new Date().toISOString();
      switch (status) {
        case 'confirmed':
          updateData.confirmedAt = now;
          console.log('✅ Pickup confirmed by driver');
          break;
        case 'picked_up':
          updateData.actualPickupTime = now;
          console.log('📦 Items picked up from:', currentDelivery.pickupLocation.address);
          break;
        case 'in_transit':
          updateData.inTransitAt = now;
          // Calculate estimated delivery time (30 minutes from now)
          updateData.estimatedDeliveryTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          console.log('🚚 Delivery in transit to:', currentDelivery.dropoffLocation.address);
          break;
        case 'delivered':
          updateData.actualDeliveryTime = now;
          console.log('🎉 Delivery completed at:', currentDelivery.dropoffLocation.address);
          break;
        case 'cancelled':
          updateData.cancelledAt = now;
          console.log('❌ Delivery cancelled');
          break;
      }

      if (proof) {
        updateData.deliveryProof = {
          ...proof,
          uploadedAt: now,
        };
        console.log('📸 Delivery proof attached');
      }

      await updateDoc(deliveryRef, updateData);
      console.log('✅ Delivery status updated successfully in Firestore');

      // Send status update notifications
      try {
        await this.sendStatusNotifications(currentDelivery, status);
      } catch (notificationError) {
        console.warn('⚠️ Failed to send delivery status notification:', notificationError);
      }
    } catch (error) {
      console.error('❌ Update delivery status error:', error);
      throw new Error(`Failed to update delivery status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static getValidStatusTransitions(currentStatus: Delivery['status']): Delivery['status'][] {
    const transitions: Record<Delivery['status'], Delivery['status'][]> = {
      pending: ['matched', 'cancelled'],
      matched: ['confirmed', 'cancelled'],
      confirmed: ['picked_up', 'cancelled'],
      picked_up: ['in_transit', 'cancelled'],
      in_transit: ['delivered', 'cancelled'],
      delivered: [], // Final state
      cancelled: [], // Final state
    };

    return transitions[currentStatus] || [];
  }

  private static async sendStatusNotifications(delivery: Delivery, newStatus: Delivery['status']) {
    const statusMessages: Record<Delivery['status'], string> = {
      pending: 'Delivery request created',
      matched: 'Driver has been matched',
      confirmed: 'Driver has confirmed pickup',
      picked_up: 'Items have been picked up',
      in_transit: 'Delivery is in transit',
      delivered: 'Delivery has been completed',
      cancelled: 'Delivery has been cancelled',
    };

    const message = statusMessages[newStatus];
    if (!message) return;

    try {
      // Notify business owner
      await NotificationService.sendDeliveryStatusUpdateNotification(
        delivery.businessId,
        delivery.driverId || '',
        newStatus,
        delivery.pickupLocation.address,
        delivery.dropoffLocation.address
      );

      // If there's a driver, also notify them (for confirmations, etc.)
      if (delivery.driverId && newStatus !== 'cancelled') {
        await NotificationService.sendDeliveryStatusUpdateNotification(
          delivery.driverId,
          delivery.businessId,
          newStatus,
          delivery.pickupLocation.address,
          delivery.dropoffLocation.address
        );
      }

      console.log(`📱 Status notifications sent for: ${message}`);
    } catch (error) {
      console.warn('Failed to send notifications:', error);
    }
  }

  static calculateDeliveryFee(packageSize: Delivery['packageSize'], distance?: number): number {
    const baseFees = {
      small: 500, // $5.00
      medium: 800, // $8.00
      large: 1200, // $12.00
      extra_large: 1800, // $18.00
    };

    let fee = baseFees[packageSize];

    // Add distance-based fee (optional)
    if (distance && distance > 10) {
      fee += Math.ceil((distance - 10) / 5) * 200; // $2 per 5km over 10km
    }

    return fee;
  }

  static validateDeliveryRequest(delivery: Partial<Delivery>): string[] {
    const errors: string[] = [];

    if (!delivery.businessId) {
      errors.push('Business ID is required');
    }

    if (!delivery.items || delivery.items.length === 0) {
      errors.push('At least one item is required');
    }

    if (!delivery.pickupLocation?.address) {
      errors.push('Pickup location is required');
    }

    if (!delivery.dropoffLocation?.address) {
      errors.push('Dropoff location is required');
    }

    if (!delivery.packageSize) {
      errors.push('Package size is required');
    }

    if (!delivery.preferredTimeWindow?.start || !delivery.preferredTimeWindow?.end) {
      errors.push('Preferred time window is required');
    }

    return errors;
  }

  static async getDeliveryById(deliveryId: string): Promise<Delivery | null> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);
      const deliverySnap = await getDocs(query(collection(db, 'deliveries'), where('__name__', '==', deliveryId)));

      if (!deliverySnap.empty) {
        const deliveryDoc = deliverySnap.docs[0];
        return this.mapFirestoreDocToDelivery(deliveryDoc);
      }

      return null;
    } catch (error) {
      console.error('Get delivery by ID error:', error);
      return null;
    }
  }

  static formatDeliveryForDisplay(delivery: Delivery): {
    title: string;
    subtitle: string;
    statusColor: string;
    timeText: string;
  } {
    const itemCount = delivery.items.length;
    const title = `${itemCount} item${itemCount !== 1 ? 's' : ''} • ${delivery.packageSize}`;
    const subtitle = `${delivery.pickupLocation.name} → ${delivery.dropoffLocation.name}`;

    const statusColors = {
      pending: '#ffc107',
      matched: '#007bff',
      confirmed: '#17a2b8',
      picked_up: '#fd7e14',
      in_transit: '#fd7e14',
      delivered: '#28a745',
      cancelled: '#dc3545',
    };

    const statusColor = statusColors[delivery.status] || '#6c757d';

    let timeText = '';
    if (delivery.preferredTimeWindow) {
      const start = new Date(delivery.preferredTimeWindow.start);
      const end = new Date(delivery.preferredTimeWindow.end);
      timeText = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return { title, subtitle, statusColor, timeText };
  }
}