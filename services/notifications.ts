import { Platform, Alert } from 'react-native';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, Timestamp, limit, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/config/firebase';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configure Expo notification handler (only on native platforms)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// In-app notification interface
export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: Timestamp;
  type: 'ride_booked' | 'ride_confirmed' | 'ride_cancelled' | 'ride_completed' | 'ride_request' | 'ride_status_update' | 'booking_rejected' | 'booking_accepted' | 'booking_confirmed' | 'booking_declined' | 'passenger_status_update' | 'message' | 'payment' | 'general' | 'booking' | 'ride' | 'reminder' | 'system';
}

// Notification listeners
type NotificationListener = (notification: InAppNotification) => void;
const notificationListeners: NotificationListener[] = [];

// Cache for notifications to reduce reads
const notificationCache = new Map<string, InAppNotification[]>();
const unreadCountCache = new Map<string, number>();
// Track if the first realtime snapshot has been processed per user to avoid alert storms
const firstSnapshotProcessed = new Set<string>();
// Track session start to optionally filter very old notifications
const sessionStartByUser = new Map<string, number>();

// Store current push token for cleanup on logout
let currentPushToken: string | null = null;

export class NotificationService {
  // Send in-app notification (stored in Firestore) and update cache
  static async sendInAppNotification(
    userId: string,
    title: string,
    body: string,
    type: InAppNotification['type'] = 'general',
    data?: any
  ): Promise<void> {
    try {
      const notificationData = {
        userId,
        title,
        body,
        data: data || {},
        read: false,
        type,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'notifications'), notificationData);

      // Update cache with new notification
      const newNotification: InAppNotification = {
        id: docRef.id,
        ...notificationData
      };

      if (notificationCache.has(userId)) {
        const cached = notificationCache.get(userId)!;
        const updated = [newNotification, ...cached].slice(0, 50); // Keep only latest 50
        notificationCache.set(userId, updated);
      }

      // Update unread count cache
      const currentCount = unreadCountCache.get(userId) || 0;
      unreadCountCache.set(userId, currentCount + 1);


    } catch (error) {
      console.error('Send in-app notification error:', error);
    }
  }

  // Show immediate alert (fallback for push notifications)
  static showImmediateAlert(title: string, body: string): void {
    if (Platform.OS !== 'web') {
      Alert.alert(title, body, [{ text: 'OK' }]);
    } else {
      // Web notification API fallback
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      } else {
        console.log(`Notification: ${title} - ${body}`);
      }
    }
  }

  // Request web notification permissions
  static async requestWebNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'web' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // Get user notifications with caching and better error handling
  static getUserNotifications(
    userId: string,
    callback: (notifications: InAppNotification[]) => void,
    useCache: boolean = true
  ) {
    // Return cached data if available and requested
    if (useCache && notificationCache.has(userId)) {
      const cached = notificationCache.get(userId)!;
      callback(cached);
    }

    try {
      // First try a simple query without orderBy to avoid index issues
      const simpleQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        limit(50)
      );

      // Record session start if not present
      if (!sessionStartByUser.has(userId)) {
        sessionStartByUser.set(userId, Date.now());
      }

      // Use the simple query first, then sort in memory
      return onSnapshot(simpleQuery, (snapshot) => {
        try {
          const notifications: InAppNotification[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data && data.userId === userId) { // Extra validation
              notifications.push({ id: doc.id, ...data } as InAppNotification);
            }
          });

          // Sort notifications by createdAt in memory
          notifications.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
            const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
            return bTime - aTime; // Descending order
          });

          const prev = notificationCache.get(userId) || [];

          // On the very first snapshot for this user in this session, seed cache and skip triggering alerts
          if (!firstSnapshotProcessed.has(userId)) {
            notificationCache.set(userId, notifications);
            firstSnapshotProcessed.add(userId);
            callback(notifications);
            return;
          }

          // Determine newly added notifications compared to cache
          const prevIds = new Set(prev.map(n => n.id));
          const added = notifications.filter(n => !prevIds.has(n.id));

          // Cache the notifications
          notificationCache.set(userId, notifications);

          // Only trigger listeners for notifications created AFTER session start
          // This prevents old notifications from showing alerts when user logs in
          const sessionStart = sessionStartByUser.get(userId) || Date.now();
          const recentThresholdMs = 1000 * 60 * 2; // 2 minutes (reduced from 5)
          added.forEach(n => {
            try {
              const createdMs = n.createdAt?.toMillis?.() || n.createdAt?.seconds * 1000 || Date.now();
              // Only show alerts for notifications created AFTER the user's session started
              // AND within the recent threshold
              if (createdMs > sessionStart && Date.now() - createdMs <= recentThresholdMs) {
                NotificationService.triggerListeners(n);
              }
            } catch (e) {
              console.error('Error triggering notification listener:', e);
            }
          });

          callback(notifications);
        } catch (error) {
          console.error('Error processing notifications:', error);
          // Return cached data or empty array on error
          const cached = notificationCache.get(userId) || [];
          callback(cached);
        }
      }, (error) => {
        console.error('Notifications listener error:', error);

        // Always fallback to one-time fetch or cache
        this.getUserNotificationsOnce(userId, 50)
          .then(notifications => {
            callback(notifications);
          })
          .catch(() => {
            // Final fallback to cached data
            const cached = notificationCache.get(userId) || [];
            callback(cached);
          });
      });
    } catch (error) {
      console.error('Error setting up notifications listener:', error);
      // Fallback to cached data
      const cached = notificationCache.get(userId) || [];
      callback(cached);
      return () => { }; // Return empty unsubscribe function
    }
  }

  // Mark notification as read and update cache
  static async markAsRead(notificationId: string, userId?: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });

      // Update cache if userId provided
      if (userId && notificationCache.has(userId)) {
        const cached = notificationCache.get(userId)!;
        const updated = cached.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        );
        notificationCache.set(userId, updated);

        // Update unread count cache
        const currentCount = unreadCountCache.get(userId) || 0;
        unreadCountCache.set(userId, Math.max(0, currentCount - 1));
      }
    } catch (error) {
      console.error('Mark notification as read error:', error);
    }
  }

  // Get unread count with caching and better error handling
  static getUnreadCount(
    userId: string,
    callback: (count: number) => void,
    useCache: boolean = true
  ) {
    // Return cached count if available and requested
    if (useCache && unreadCountCache.has(userId)) {
      callback(unreadCountCache.get(userId)!);
    }

    try {
      // Use simple query to avoid compound index issues
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        limit(200)
      );

      return onSnapshot(q, (snapshot) => {
        try {
          // Count unread notifications manually
          let count = 0;
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data && data.userId === userId && !data.read) {
              count++;
            }
          });

          unreadCountCache.set(userId, count);
          callback(count);
        } catch (error) {
          console.error('Error processing unread count:', error);
          const cached = unreadCountCache.get(userId) || 0;
          callback(cached);
        }
      }, (error) => {
        console.error('Unread count listener error:', error);

        // Always calculate from cached notifications
        const cached = notificationCache.get(userId) || [];
        const unreadCount = cached.filter(n => !n.read).length;
        unreadCountCache.set(userId, unreadCount);
        callback(unreadCount);
      });
    } catch (error) {
      console.error('Error setting up unread count listener:', error);
      // Fallback to cached count
      const cached = unreadCountCache.get(userId) || 0;
      callback(cached);
      return () => { }; // Return empty unsubscribe function
    }
  }

  // Initialize notifications for user
  static async initializeForUser(userId: string): Promise<void> {
    try {
      // Request web notification permission if on web
      if (Platform.OS === 'web') {
        await this.requestWebNotificationPermission();
      }

      // Pre-load notifications to cache
      await this.getUserNotificationsOnce(userId, 20);

      console.log('Notifications initialized for user:', userId);
    } catch (error) {
      console.error('Initialize notifications error:', error);
    }
  }

  // Add notification listener
  static addNotificationListener(callback: NotificationListener) {
    notificationListeners.push(callback);
    return () => {
      const index = notificationListeners.indexOf(callback);
      if (index > -1) {
        notificationListeners.splice(index, 1);
      }
    };
  }

  // Trigger notification listeners
  static triggerListeners(notification: InAppNotification) {
    notificationListeners.forEach(listener => listener(notification));
  }

  // Clear cache for user (useful on logout)
  static clearCache(userId?: string) {
    if (userId) {
      notificationCache.delete(userId);
      unreadCountCache.delete(userId);
      firstSnapshotProcessed.delete(userId);
      sessionStartByUser.delete(userId);
    } else {
      notificationCache.clear();
      unreadCountCache.clear();
      firstSnapshotProcessed.clear();
      sessionStartByUser.clear();
    }
  }

  // Get notifications once (no listener) for better performance
  static async getUserNotificationsOnce(
    userId: string,
    limitCount: number = 50
  ): Promise<InAppNotification[]> {
    try {
      // Check cache first
      if (notificationCache.has(userId)) {
        const cached = notificationCache.get(userId)!;
        if (cached.length > 0) {
          return cached;
        }
      }

      // Always use simple query to avoid index issues
      const simpleQ = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        limit(limitCount)
      );

      const snapshot = await getDocs(simpleQ);
      const notifications: InAppNotification[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.userId === userId) {
          notifications.push({ id: doc.id, ...data } as InAppNotification);
        }
      });

      // Sort manually by createdAt
      notifications.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });

      // Cache the result
      notificationCache.set(userId, notifications);

      return notifications;
    } catch (error) {
      console.error('Get notifications once error:', error);
      return notificationCache.get(userId) || [];
    }
  }

  // Send ride booking notification
  static async sendRideBookingNotification(
    driverId: string,
    riderName: string,
    pickup: string,
    dropoff: string,
    rideId?: string,
    bookingId?: string
  ): Promise<void> {
    await this.sendInAppNotification(
      driverId,
      'New Ride Request',
      `${riderName} wants to book your ride from ${pickup} to ${dropoff}`,
      'ride_booked',
      { rideId, bookingId, riderName }
    );
  }

  // Send ride confirmation notification
  static async sendRideConfirmationNotification(
    riderId: string,
    driverName: string,
    pickup: string,
    rideId?: string,
    bookingId?: string
  ): Promise<void> {
    await this.sendInAppNotification(
      riderId,
      'Ride Confirmed',
      `${driverName} confirmed your ride. Pickup at ${pickup}`,
      'ride_confirmed',
      { rideId, bookingId, driverName }
    );
  }

  // Send ride cancellation notification
  static async sendRideCancellationNotification(
    userId: string,
    reason: string,
    rideId?: string,
    bookingId?: string
  ): Promise<void> {
    await this.sendInAppNotification(
      userId,
      'Ride Cancelled',
      `Your ride has been cancelled. Reason: ${reason}`,
      'ride_cancelled',
      { rideId, bookingId, reason }
    );
  }

  // Send new message notification
  static async sendNewMessageNotification(
    userId: string,
    senderName: string,
    message: string,
    rideId?: string
  ): Promise<void> {
    await this.sendInAppNotification(
      userId,
      `New message from ${senderName}`,
      message.length > 50 ? message.substring(0, 50) + '...' : message,
      'message',
      { rideId, senderName }
    );
  }

  // ============================================================================
  // EXPO PUSH NOTIFICATIONS
  // ============================================================================

  /**
   * Register for Expo push notifications and get push token
   * @returns The Expo push token or null if registration fails
   */
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    // Push notifications don't work on web
    if (Platform.OS === 'web') {
      console.log('Push notifications not supported on web');
      return null;
    }

    try {
      // Check existing permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;

      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      currentPushToken = tokenResponse.data;
      console.log('Expo push token:', currentPushToken);

      // Configure Android notification channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('bookings', {
          name: 'Bookings',
          description: 'Notifications for booking requests and updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2196F3',
        });

        await Notifications.setNotificationChannelAsync('rides', {
          name: 'Rides',
          description: 'Notifications for ride updates and reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4CAF50',
        });

        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          description: 'Notifications for new chat messages',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#9C27B0',
        });
      }

      return currentPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Save push token to user's Firestore document
   * @param userId - Firebase user ID
   * @param pushToken - Expo push token
   */
  static async savePushTokenToFirestore(userId: string, pushToken: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pushTokens: arrayUnion(pushToken),
        lastTokenUpdate: new Date().toISOString(),
      });
      console.log('Push token saved to Firestore for user:', userId);
    } catch (error) {
      console.error('Error saving push token to Firestore:', error);
      throw error;
    }
  }

  /**
   * Remove push token from user's Firestore document
   * @param userId - Firebase user ID
   * @param pushToken - Expo push token to remove
   */
  static async removePushTokenFromFirestore(userId: string, pushToken: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pushTokens: arrayRemove(pushToken),
      });
      console.log('Push token removed from Firestore');
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }

  /**
   * Initialize push notifications for a user (call on login)
   * @param userId - Firebase user ID
   * @returns Push token if successful
   */
  static async initializePushNotifications(userId: string): Promise<string | null> {
    try {
      const token = await this.registerForPushNotificationsAsync();

      if (token && userId) {
        await this.savePushTokenToFirestore(userId, token);
      }

      return token;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return null;
    }
  }

  /**
   * Cleanup push notifications on logout
   * @param userId - Firebase user ID
   */
  static async cleanupPushNotifications(userId: string): Promise<void> {
    try {
      if (currentPushToken && userId) {
        await this.removePushTokenFromFirestore(userId, currentPushToken);
      }

      // Clear all notifications
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);

      currentPushToken = null;
      console.log('Push notifications cleaned up');
    } catch (error) {
      console.error('Error cleaning up push notifications:', error);
    }
  }

  /**
   * Get the current push token
   */
  static getCurrentPushToken(): string | null {
    return currentPushToken;
  }

  /**
   * Add listener for received notifications (app in foreground)
   */
  static addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add listener for notification responses (user tapped notification)
   */
  static addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Get last notification response (if app was opened from notification)
   */
  static async getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    return await Notifications.getLastNotificationResponseAsync();
  }
}