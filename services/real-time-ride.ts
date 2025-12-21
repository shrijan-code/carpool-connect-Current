import { collection, doc, onSnapshot, updateDoc, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Platform } from 'react-native';

export type RideStatus =
  | 'pending'
  | 'confirmed'
  | 'driver_en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type NotificationType =
  | 'ride_confirmed'
  | 'driver_assigned'
  | 'driver_en_route'
  | 'driver_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'payment_processed'
  | 'rating_request';

export interface RideUpdate {
  id: string;
  rideId: string;
  status: RideStatus;
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  estimatedArrival?: Date;
  message?: string;
  driverInfo?: {
    name: string;
    phone: string;
    vehicleInfo: string;
    photo?: string;
  };
}

export interface NotificationData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: any;
  timestamp: Date;
  read: boolean;
  actionRequired?: boolean;
}

class RealTimeRideService {
  private listeners: Map<string, () => void> = new Map();
  private notificationCallbacks: ((notification: NotificationData) => void)[] = [];

  // Subscribe to real-time ride updates
  subscribeToRideUpdates(
    rideId: string,
    callback: (update: RideUpdate) => void
  ): () => void {
    const rideRef = doc(db, 'rides', rideId);

    const unsubscribe = onSnapshot(rideRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const update: RideUpdate = {
          id: doc.id,
          rideId: rideId,
          status: data.status,
          timestamp: data.updatedAt?.toDate() || new Date(),
          location: data.currentLocation,
          estimatedArrival: data.estimatedArrival?.toDate(),
          message: data.statusMessage,
          driverInfo: data.driverInfo
        };
        callback(update);
      }
    });

    this.listeners.set(rideId, unsubscribe);
    return unsubscribe;
  }

  // Subscribe to user notifications
  subscribeToNotifications(
    userId: string,
    callback: (notification: NotificationData) => void
  ): () => void {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const notification: NotificationData = {
            id: change.doc.id,
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            data: data.data || {},
            timestamp: data.timestamp?.toDate() || new Date(),
            read: data.read || false,
            actionRequired: data.actionRequired || false
          };
          callback(notification);
        }
      });
    });

    return unsubscribe;
  }

  // Update ride status (for drivers)
  async updateRideStatus(
    rideId: string,
    status: RideStatus,
    location?: { latitude: number; longitude: number },
    message?: string
  ): Promise<void> {
    try {
      const rideRef = doc(db, 'rides', rideId);
      const updateData: any = {
        status,
        updatedAt: new Date(),
        statusMessage: message || ''
      };

      if (location) {
        updateData.currentLocation = location;
      }

      // Calculate estimated arrival based on status and location
      if (status === 'driver_en_route' && location) {
        updateData.estimatedArrival = this.calculateEstimatedArrival(location);
      }

      await updateDoc(rideRef, updateData);

      // Send notifications to passengers
      await this.sendStatusNotification(rideId, status, message);

    } catch (error) {
      console.error('Error updating ride status:', error);
      throw error;
    }
  }

  // Send notification to users
  async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: any = {},
    actionRequired: boolean = false
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        type,
        title,
        message,
        data,
        timestamp: new Date(),
        read: false,
        actionRequired
      });

      // Send push notification if available
      if (Platform.OS !== 'web') {
        await this.sendPushNotification(userId, title, message, data);
      }

    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get ride timeline/history
  async getRideTimeline(rideId: string): Promise<RideUpdate[]> {
    try {
      const timelineQuery = query(
        collection(db, 'rideUpdates'),
        where('rideId', '==', rideId),
        orderBy('timestamp', 'asc')
      );

      // This would need to be implemented with proper Firestore query
      // For now, return mock data structure
      return [];
    } catch (error) {
      console.error('Error fetching ride timeline:', error);
      throw error;
    }
  }

  // Private helper methods
  private async sendStatusNotification(
    rideId: string,
    status: RideStatus,
    message?: string
  ): Promise<void> {
    // Get ride details and passengers
    // Send appropriate notifications based on status
    const notifications = this.getStatusNotificationConfig(status);

    // This would need to be implemented with proper ride data fetching
    console.log('Sending status notification:', { rideId, status, message, notifications });
  }

  private getStatusNotificationConfig(status: RideStatus) {
    const configs: Record<string, { title: string; message: string; type: NotificationType; actionRequired?: boolean } | null> = {
      pending: null, // No notification for pending status
      confirmed: {
        title: 'Ride Confirmed!',
        message: 'Your ride has been confirmed. Driver details will be shared soon.',
        type: 'ride_confirmed' as NotificationType
      },
      driver_en_route: {
        title: 'Driver is on the way',
        message: 'Your driver is heading to the pickup location.',
        type: 'driver_en_route' as NotificationType
      },
      arrived: {
        title: 'Driver has arrived',
        message: 'Your driver is at the pickup location.',
        type: 'driver_arrived' as NotificationType
      },
      in_progress: {
        title: 'Ride started',
        message: 'Your ride is now in progress. Have a safe journey!',
        type: 'ride_started' as NotificationType
      },
      completed: {
        title: 'Ride completed',
        message: 'Your ride has been completed. Please rate your experience.',
        type: 'ride_completed' as NotificationType,
        actionRequired: true
      },
      cancelled: {
        title: 'Ride cancelled',
        message: 'Your ride has been cancelled. You will receive a full refund.',
        type: 'ride_cancelled' as NotificationType
      }
    };

    return configs[status] || null;
  }

  private calculateEstimatedArrival(currentLocation: { latitude: number; longitude: number }): Date {
    // Simple estimation - in real app, use Google Maps API or similar
    const estimatedMinutes = Math.random() * 15 + 5; // 5-20 minutes
    return new Date(Date.now() + estimatedMinutes * 60 * 1000);
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    message: string,
    data: any
  ): Promise<void> {
    // Implementation would depend on your push notification service
    // (Firebase Cloud Messaging, Expo Notifications, etc.)
    console.log('Sending push notification:', { userId, title, message, data });
  }

  // Cleanup method
  cleanup(): void {
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
    this.notificationCallbacks = [];
  }

  // Batch status updates for multiple rides (useful for drivers with multiple passengers)
  async batchUpdateRideStatuses(
    updates: Array<{
      rideId: string;
      status: RideStatus;
      location?: { latitude: number; longitude: number };
      message?: string;
    }>
  ): Promise<void> {
    try {
      const promises = updates.map(update =>
        this.updateRideStatus(update.rideId, update.status, update.location, update.message)
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error batch updating ride statuses:', error);
      throw error;
    }
  }

  // Emergency notification system
  async sendEmergencyAlert(
    rideId: string,
    userId: string,
    location: { latitude: number; longitude: number },
    message?: string
  ): Promise<void> {
    try {
      // Send to emergency contacts and support team
      await this.sendNotification(
        userId,
        'ride_cancelled', // Using existing type, would need emergency type
        'Emergency Alert',
        message || 'Emergency assistance requested during ride',
        {
          rideId,
          location,
          emergency: true,
          timestamp: new Date().toISOString()
        },
        true
      );

      // Update ride status to emergency
      await this.updateRideStatus(rideId, 'cancelled', location, 'Emergency alert triggered');

    } catch (error) {
      console.error('Error sending emergency alert:', error);
      throw error;
    }
  }
}

export const realTimeRideService = new RealTimeRideService();