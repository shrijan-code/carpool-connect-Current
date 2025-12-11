/**
 * In-App Notifications Utility
 * Creates notification documents in Firestore for in-app display
 */

import * as admin from "firebase-admin";

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
    return docRef.id;
  } catch (error) {
    console.error("Failed to create notification:", error);
    throw error;
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
