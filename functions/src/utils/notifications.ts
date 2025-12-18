import * as admin from "firebase-admin";
import { Expo, ExpoPushMessage } from "expo-server-sdk";

// Initialize Expo client
const expo = new Expo();

// Get Firestore instance lazily (after initializeApp is called)
const getDb = () => admin.firestore();

export interface NotificationData {
  userId: string;
  title: string;
  body: string;
  type: "booking" | "payment" | "ride" | "system" | "reminder";
  data?: Record<string, any>;
}

/**
 * Create an in-app notification for a user
 */
export const createNotification = async (notification: NotificationData): Promise<string> => {
  try {
    const db = getDb();
    const docRef = await db.collection("notifications").add({
      ...notification,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Notification created: ${notification.type} for user ${notification.userId}`);

    // Also trigger push notification
    await sendPushNotification(
      notification.userId,
      notification.title,
      notification.body,
      notification.data
    );

    return docRef.id;
  } catch (error) {
    console.error("Failed to create notification:", error);
    throw error;
  }
};

/**
 * Send a push notification to a user via Expo
 */
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> => {
  try {
    const db = getDb();
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      console.log(`User ${userId} not found, skipping push notification`);
      return;
    }

    const userData = userDoc.data();
    const pushTokens: string[] = userData?.pushTokens || [];

    if (pushTokens.length === 0) {
      console.log(`No push tokens found for user ${userId}`);
      return;
    }

    const messages: ExpoPushMessage[] = [];
    for (const pushToken of pushTokens) {
      // Check if the token is valid
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        continue;
      }

      messages.push({
        to: pushToken,
        sound: "default",
        title,
        body,
        data: data || {},
        priority: "high",
        channelId: data?.type === "booking" ? "bookings" : "default",
      });
    }

    if (messages.length === 0) return;

    // Send the notifications
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log(`Sent ${chunk.length} push notifications to user ${userId}`);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }

    // NOTE: In a production app, you should check tickets for errors
    // and remove invalid tokens from the database. 
    // Implementing basic cleanup for obvious errors:
    const invalidTokens: string[] = [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === "error") {
        if (ticket.details?.error === "DeviceNotRegistered") {
          // Find the original token from the messages array
          // Since chunking preserved order, we can map back
          const token = (messages[index] as any).to;
          if (token) invalidTokens.push(token);
        }
      }
    });

    if (invalidTokens.length > 0) {
      console.log(`Cleaning up ${invalidTokens.length} invalid tokens for user ${userId}`);
      await db.collection("users").doc(userId).update({
        pushTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
      });
    }

  } catch (error) {
    console.error("Failed to send push notification:", error);
  }
};

/**
 * Create notifications for multiple users
 */
export const createBulkNotifications = async (
  userIds: string[],
  title: string,
  body: string,
  type: NotificationData["type"],
  data?: Record<string, any>
): Promise<void> => {
  const db = getDb();
  const batch = db.batch();

  for (const userId of userIds) {
    const docRef = db.collection("notifications").doc();
    batch.set(docRef, {
      userId,
      title,
      body,
      type,
      data: data || {},
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(`Bulk notifications created for ${userIds.length} users`);
};

// Notification templates
export const notificationTemplates = {
  bookingAccepted: (driverName: string) => ({
    title: "Ride Confirmed! ✅",
    body: `${driverName} has accepted your ride request.`,
  }),

  bookingRejected: () => ({
    title: "Ride Request Update",
    body: "Your ride request was not accepted. Check for other rides!",
  }),

  bookingCancelled: (cancelledBy: string) => ({
    title: "Ride Cancelled",
    body: `The ride was cancelled by the ${cancelledBy}.`,
  }),

  newBookingRequest: (passengerName: string) => ({
    title: "New Ride Request! 🚗",
    body: `${passengerName} wants to join your ride.`,
  }),

  rideCompleted: () => ({
    title: "Ride Completed! 🎉",
    body: "Please rate your experience.",
  }),

  paymentSuccess: (amount: number) => ({
    title: "Payment Successful 💳",
    body: `Your payment of $${amount.toFixed(2)} was processed.`,
  }),

  paymentFailed: () => ({
    title: "Payment Failed ⚠️",
    body: "Please check your payment method and try again.",
  }),

  rideReminder: (minutesUntil: number) => ({
    title: `Ride starts in ${minutesUntil} minutes! ⏰`,
    body: "Get ready for your upcoming ride.",
  }),

  rideStarted: () => ({
    title: "Ride Started! 🚗",
    body: "Your ride has begun. Have a safe trip!",
  }),

  welcome: () => ({
    title: "Welcome to CarpoolConnect! 🚗",
    body: "Start exploring rides in your area.",
  }),
};
