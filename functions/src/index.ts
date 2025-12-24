/**
 * Firebase Cloud Functions for CarpoolConnect
 * Market-Ready Version with Email & In-App Notifications
 */

import * as admin from "firebase-admin";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { sendEmail } from "./utils/email";
import { createNotification, notificationTemplates } from "./utils/notifications";
import { logAuditEvent, logPaymentEvent, AuditEventTypes } from "./utils/audit";
import { logger, getErrorMessage } from "./utils/logger";
import { requireAuth, isHttpsError, isStripeError } from "./utils/errors";
import { recalculateSeatAvailability } from "./utils/shared";
import { checkRateLimit } from "./utils/rate-limiter";
import { sanitizeMessage, sanitizeNotes, sanitizeReview, sanitizeNumber } from "./utils/sanitize";
import * as functions from "firebase-functions";
import * as functionsV1 from "firebase-functions/v1";
import Stripe from "stripe";

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
// Lazy initialization of Stripe to prevent top-level crashes if secrets aren't available
let stripeInstance: Stripe | null = null;
const getStripe = () => {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new HttpsError("failed-precondition", "Stripe Secret Key not found");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
  }
  return stripeInstance;
};

// ============================================================================
// HEALTH CHECK & UTILITIES
// ============================================================================

export const healthCheck = onRequest((req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    message: "CarpoolConnect Functions are operational!",
    functions: [
      "healthCheck", "getServerTime", "createBooking", "updateBookingStatus",
      "getUserBookings", "processPayment", "onUserCreated", "onBookingStatusChanged",
      "sendRideReminders"
    ]
  });
});

export const getServerTime = onCall(() => {
  return {
    timestamp: new Date().toISOString(),
    serverTime: Date.now(),
  };
});

/**
 * Admin function to fix seat availability for all rides
 * Recalculates based on confirmed/pending bookings and ensures no negative values
 */
export const fixSeatAvailability = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  try {
    const result = await recalculateSeatAvailability();
    return {
      success: true,
      message: `Fixed ${result.fixedCount} out of ${result.totalRides} rides`,
      ...result,
    };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logger.error("Error fixing seat availability", error);
    throw new HttpsError("internal", message || "Failed to fix seat availability");
  }
});

/**
 * HTTP version of seat fix - can be triggered via direct URL call
 */
export const fixSeatAvailabilityHttp = onRequest(async (req, res) => {
  logger.info("Starting seat availability fix (HTTP)");

  // Authentication check - require admin token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    if (!decodedToken.uid) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    logger.info(`Authenticated user initiating seat fix`, { userId: decodedToken.uid });
  } catch (authError: unknown) {
    const message = getErrorMessage(authError);
    logger.error("Authentication failed", authError);
    res.status(401).json({ success: false, error: "Invalid or expired token" });
    return;
  }

  try {
    const result = await recalculateSeatAvailability();

    res.status(200).json({
      success: true,
      message: `Fixed ${result.fixedCount} out of ${result.totalRides} rides`,
      ...result,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logger.error("Error fixing seat availability", error);
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================================================
// USER ONBOARDING - Welcome Email
// ============================================================================

export const onUserCreated = onDocumentCreated(
  { document: "users/{userId}", secrets: ["EMAIL_USER", "EMAIL_PASSWORD"] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const userData = snapshot.data();
    const userId = event.params.userId;
    const email = userData.email;
    const name = userData.name || userData.displayName || "there";

    logger.user.created(userId, email);

    // Send welcome email
    if (email) {
      await sendEmail(email, "welcome", [name]);
    }

    // Create welcome in-app notification
    const welcomeNotif = notificationTemplates.welcome();
    await createNotification({
      userId,
      title: welcomeNotif.title,
      body: welcomeNotif.body,
      type: "system",
    });
  });

// ============================================================================
// DRIVER DOCUMENT SUBMISSION - Notify Admin for Review
// ============================================================================

export const onDriverDocumentSubmission = onDocumentUpdated(
  { document: "users/{userId}", secrets: ["EMAIL_USER", "EMAIL_PASSWORD"] },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    const userId = event.params.userId;

    if (!beforeData || !afterData) return;

    // Check if driverApproval status changed to 'pending'
    const wasNotPending = !beforeData.driverApproval || beforeData.driverApproval.status !== 'pending';
    const isNowPending = afterData.driverApproval?.status === 'pending';

    if (wasNotPending && isNowPending) {
      logger.user.documentSubmitted(userId, 'driver_approval');

      // Determine which documents were submitted
      const documentTypes: string[] = [];
      if (afterData.carDetails?.registrationDocument) {
        documentTypes.push('Vehicle Registration Document');
      }
      if (afterData.carDetails?.insuranceDocument) {
        documentTypes.push('Vehicle Insurance Document');
      }
      if (afterData.carDetails?.make && afterData.carDetails?.model) {
        documentTypes.push(`Vehicle Details: ${afterData.carDetails.make} ${afterData.carDetails.model}`);
      }

      // Get admin email from environment or use hardcoded default
      const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'shrijan.bhandari1318@gmail.com';

      if (adminEmail) {
        const driverInfo = {
          name: afterData.name || afterData.displayName || 'Unknown Driver',
          email: afterData.email || 'No email provided',
          userId: userId,
        };

        await sendEmail(adminEmail, "driverDocumentSubmission", [driverInfo, documentTypes]);
        logger.info('Admin notification sent for driver document submission', { userId });
      } else {
        logger.warn('No admin email configured. Set ADMIN_EMAIL or EMAIL_USER environment variable.');
      }

      // Also create in-app notification for admins (if admin notification system exists)
      try {
        // Get all admin users to notify them
        const adminsSnapshot = await db.collection('admins').get();
        for (const adminDoc of adminsSnapshot.docs) {
          await createNotification({
            userId: adminDoc.id,
            title: '🚗 Driver Document Review Required',
            body: `${afterData.name || 'A driver'} has submitted documents for approval. Please review in the Admin Dashboard.`,
            type: 'system',
            data: { driverId: userId },
          });
        }
      } catch (notifError) {
        logger.error('Failed to create admin notifications', notifError);
      }
    }
  }
);

// ============================================================================
// RIDE CREATION - Confirmation Email with T&C
// ============================================================================

export const onRideCreated = onDocumentCreated(
  { document: "rides/{rideId}", secrets: ["EMAIL_USER", "EMAIL_PASSWORD"] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const rideData = snapshot.data();
    const rideId = event.params.rideId;
    const driverId = rideData.driverId;

    logger.ride.created(rideId, driverId);

    try {
      // Get driver information
      const driverDoc = await db.collection("users").doc(driverId).get();
      if (!driverDoc.exists) {
        logger.warn('Driver not found', { driverId });
        return;
      }

      const driverData = driverDoc.data();
      const driverName = driverData?.name || "Driver";
      const driverEmail = driverData?.email;

      if (!driverEmail) {
        logger.warn('No email for driver', { driverId });
        return;
      }

      // Format ride details for email
      const rideDetails = {
        origin: rideData.origin || rideData.from?.name || "Not specified",
        destination: rideData.destination || rideData.to?.name || "Not specified",
        departureTime: rideData.departureTime
          ? new Date(rideData.departureTime).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
          : "Not specified",
        seatsAvailable: rideData.seatsAvailable ?? rideData.seats ?? 0,
        pricePerSeat: ((rideData.pricePerSeat || rideData.price || 0) / 100).toFixed(2),
      };

      // Send confirmation email with T&C
      await sendEmail(driverEmail, "rideConfirmation", [driverName, rideDetails]);

      logger.info('Ride confirmation email sent', { driverEmail });
    } catch (error) {
      logger.error('Error sending ride confirmation email', error);
      // Don't throw - we don't want to fail ride creation if email fails
    }
  });

// ============================================================================
// MESSAGE CREATION - Push Notification to Recipient
// ============================================================================

export const onMessageCreated = onDocumentCreated(
  { document: "messages/{messageId}" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const messageData = snapshot.data();
    const messageId = event.params.messageId;

    // Skip system messages
    if (messageData.type === 'system' || messageData.senderId === 'system') {
      logger.debug('Skipping push notification for system message', { messageId });
      return;
    }

    const senderId = messageData.senderId;
    const senderName = messageData.senderName || 'Someone';
    const messageText = messageData.message || '📷 Image';
    const rideId = messageData.rideId;
    const participants = messageData.participants || [];

    logger.info('New message created', { messageId, senderName, rideId });

    try {
      // Send push notification to all participants except sender
      for (const participantId of participants) {
        if (participantId === senderId) continue;

        // Get participant's push tokens
        const userDoc = await db.collection("users").doc(participantId).get();
        if (!userDoc.exists) continue;

        const userData = userDoc.data();
        const pushTokens: string[] = userData?.pushTokens || [];

        if (pushTokens.length === 0) {
          logger.debug('No push tokens for user', { participantId });
          continue;
        }

        // Import Expo SDK for push notifications
        const { Expo } = require("expo-server-sdk");
        const expo = new Expo();

        const messages = [];
        for (const pushToken of pushTokens) {
          if (!Expo.isExpoPushToken(pushToken)) {
            logger.warn('Invalid Expo push token', { pushToken });
            continue;
          }

          messages.push({
            to: pushToken,
            sound: "default",
            title: `💬 ${senderName}`,
            body: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
            data: {
              type: 'message',
              rideId,
              messageId,
              senderId
            },
            priority: "high",
            channelId: "messages",
          });
        }

        if (messages.length > 0) {
          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            try {
              await expo.sendPushNotificationsAsync(chunk);
              logger.info('Push notification sent', { participantId, messageId });
            } catch (error) {
              logger.error('Error sending push notification', error, { participantId });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error sending message push notifications', error);
      // Don't throw - we don't want to fail message creation if notification fails
    }
  }
);

// ============================================================================
// SAFETY REPORT CREATION - Critical Email Notification
// ============================================================================

export const onSafetyReportCreated = onDocumentCreated(
  { document: "safety_reports/{reportId}", secrets: ["EMAIL_USER", "EMAIL_PASSWORD"] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const reportData = snapshot.data();
    const reportId = event.params.reportId;
    const reporterId = reportData.reporterId;

    console.log(`🚨 New safety report created: ${reportId} by user ${reporterId} | Severity: ${reportData.severity}`);

    // Helper function to get type label
    const getTypeLabel = (type: string): string => {
      const labels: Record<string, string> = {
        unsafe_driving: 'Unsafe Driving',
        harassment: 'Harassment',
        vehicle_issue: 'Vehicle Safety Issue',
        route_deviation: 'Route Deviation',
        emergency: 'Emergency Situation',
        other: 'Other Safety Concern',
      };
      return labels[type] || type;
    };

    // Function to send email with retry logic
    const sendSafetyReportEmail = async (
      reportDetails: any,
      reporterInfo: any,
      emergencyContactInfo: any,
      attempt = 1
    ): Promise<boolean> => {
      const maxAttempts = 3;
      // Use environment variable for admin email, with fallback to hardcoded value
      const adminEmail = process.env.SAFETY_REPORT_EMAIL || "shrijan.bhandari1318@gmail.com";

      try {
        console.log(`📧 Attempt ${attempt}/${maxAttempts}: Sending safety report email to ${adminEmail}`);

        const emailSent = await sendEmail(adminEmail, "safetyReport", [
          reportDetails,
          reporterInfo,
          emergencyContactInfo,
        ]);

        if (emailSent) {
          console.log(`✅ Safety report email sent successfully on attempt ${attempt}`);
          return true;
        } else {
          throw new Error("Email service returned false");
        }
      } catch (error) {
        console.error(`❌ Email attempt ${attempt} failed:`, error);

        if (attempt < maxAttempts) {
          // Wait before retry (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

          return await sendSafetyReportEmail(reportDetails, reporterInfo, emergencyContactInfo, attempt + 1);
        } else {
          console.error(`❌ All ${maxAttempts} email attempts failed for safety report ${reportId}`);
          return false;
        }
      }
    };

    try {
      // Fetch reporter information
      let reporterInfo: any = {
        id: reporterId,
        name: null,
        email: null,
        phone: null,
      };

      try {
        const reporterDoc = await db.collection("users").doc(reporterId).get();
        if (reporterDoc.exists) {
          const reporterData = reporterDoc.data();
          reporterInfo = {
            id: reporterId,
            name: reporterData?.name || reporterData?.displayName || null,
            email: reporterData?.email || null,
            phone: reporterData?.phone || null,
          };
        } else {
          console.warn(`⚠️ Reporter user document not found: ${reporterId}`);
        }
      } catch (error) {
        console.error(`Failed to fetch reporter info for ${reporterId}:`, error);
      }

      // Fetch emergency contact information
      let emergencyContactInfo: any = null;

      try {
        console.log(`🔍 Fetching emergency contacts for reporter: ${reporterId}`);
        const emergencyContactsSnapshot = await db
          .collection("emergency_contacts")
          .where("userId", "==", reporterId)
          .where("isPrimary", "==", true)
          .limit(1)
          .get();

        if (!emergencyContactsSnapshot.empty) {
          const contactDoc = emergencyContactsSnapshot.docs[0];
          const contactData = contactDoc.data();
          emergencyContactInfo = {
            name: contactData.name,
            phone: contactData.phone,
            relationship: contactData.relationship,
          };
          console.log(`✅ Emergency contact found: ${contactData.name}`);
        } else {
          // Try to get any emergency contact if no primary
          const anyContactSnapshot = await db
            .collection("emergency_contacts")
            .where("userId", "==", reporterId)
            .limit(1)
            .get();

          if (!anyContactSnapshot.empty) {
            const contactDoc = anyContactSnapshot.docs[0];
            const contactData = contactDoc.data();
            emergencyContactInfo = {
              name: contactData.name,
              phone: contactData.phone,
              relationship: contactData.relationship,
            };
            console.log(`✅ Emergency contact found (non-primary): ${contactData.name}`);
          } else {
            console.log(`ℹ️ No emergency contact found for reporter ${reporterId}`);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch emergency contact for ${reporterId}:`, error);
      }

      // Format report details for email
      const reportDetails = {
        id: reportId,
        type: reportData.type,
        typeLabel: getTypeLabel(reportData.type),
        severity: reportData.severity,
        description: reportData.description,
        timestamp: reportData.createdAt
          ? new Date(reportData.createdAt.toDate()).toLocaleString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
          })
          : new Date().toLocaleString('en-AU'),
        rideId: reportData.rideId || null,
        deliveryId: reportData.deliveryId || null,
        evidencePhotos: reportData.evidence?.photos || [],
      };

      // Send email with retry logic
      const emailSuccess = await sendSafetyReportEmail(reportDetails, reporterInfo, emergencyContactInfo);

      if (!emailSuccess) {
        // Log comprehensive details for manual follow-up if all email attempts fail
        console.error(`
🚨 CRITICAL: SAFETY REPORT EMAIL FAILED - MANUAL ACTION REQUIRED

Report ID: ${reportId}
Severity: ${reportData.severity.toUpperCase()}
Type: ${getTypeLabel(reportData.type)}
Reporter: ${reporterInfo.name || reporterInfo.id}
Reporter Email: ${reporterInfo.email || 'N/A'}
Reporter Phone: ${reporterInfo.phone || 'N/A'}
Emergency Contact: ${emergencyContactInfo?.name || 'None'}
Emergency Contact Phone: ${emergencyContactInfo?.phone || 'N/A'}
Timestamp: ${reportDetails.timestamp}
Ride ID: ${reportData.rideId || 'N/A'}
Delivery ID: ${reportData.deliveryId || 'N/A'}

Description:
${reportData.description}

Firebase Console Link:
https://console.firebase.google.com/project/carpoolconnect1-0/firestore/data/~2Fsafety_reports~2F${reportId}

⚠️ EMAIL DELIVERY FAILED AFTER 3 ATTEMPTS - PLEASE INVESTIGATE MANUALLY ⚠️
        `);
      }

      // Always log the summary for monitoring
      console.log(`📊 Safety Report Summary:
- ID: ${reportId}
- Severity: ${reportData.severity}
- Type: ${getTypeLabel(reportData.type)}
- Reporter: ${reporterInfo.name || reporterId}
- Emergency Contact: ${emergencyContactInfo?.name || 'None'}
- Admin Email Sent: ${emailSuccess ? 'Yes' : 'NO - MANUAL FOLLOW-UP REQUIRED'}
      `);

      // Send confirmation email to reporter if they have an email
      if (reporterInfo.email) {
        try {
          console.log(`📧 Sending confirmation email to reporter: ${reporterInfo.email}`);

          const confirmationSent = await sendEmail(
            reporterInfo.email,
            "safetyReportConfirmation",
            [reporterInfo.name || "there", reportDetails]
          );

          if (confirmationSent) {
            console.log(`✅ Confirmation email sent to reporter ${reporterInfo.email}`);
          } else {
            console.warn(`⚠️ Failed to send confirmation email to reporter ${reporterInfo.email}`);
          }
        } catch (error) {
          console.error(`Failed to send confirmation email to reporter:`, error);
          // Don't fail the entire function if confirmation email fails
        }
      } else {
        console.log(`ℹ️ Reporter has no email address, skipping confirmation email`);
      }


    } catch (error) {
      console.error(`❌ Critical error processing safety report ${reportId}:`, error);
      // Log full details for emergency manual processing
      console.error(`
🚨 EMERGENCY: FAILED TO PROCESS SAFETY REPORT

Report ID: ${reportId}
Reporter ID: ${reporterId}
Severity: ${reportData.severity}
Type: ${reportData.type}
Error: ${error instanceof Error ? error.message : 'Unknown error'}

RAW REPORT DATA:
${JSON.stringify(reportData, null, 2)}

Firebase Console Link:
https://console.firebase.google.com/project/carpoolconnect1-0/firestore/data/~2Fsafety_reports~2F${reportId}
      `);
      // Don't throw - report is already saved in Firestore
    }
  });

/**
 * Cloud Function: onSafetyReportEvidenceAdded
 * Triggered when evidence photos are added to an existing safety report
 * Sends a follow-up email with clickable photo links
 */
export const onSafetyReportEvidenceAdded = onDocumentUpdated(
  { document: "safety_reports/{reportId}", secrets: ["EMAIL_USER", "EMAIL_PASSWORD"] },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    const reportId = event.params.reportId;

    if (!beforeData || !afterData) return;

    // Check if evidence photos were just added (didn't exist before, exists now)
    const hadPhotos = beforeData.evidence?.photos && beforeData.evidence.photos.length > 0;
    const hasPhotos = afterData.evidence?.photos && afterData.evidence.photos.length > 0;

    if (hadPhotos || !hasPhotos) {
      // Either already had photos or still doesn't have photos - ignore
      return;
    }

    console.log(`📸 Evidence photos added to safety report ${reportId}: ${afterData.evidence.photos.length} photo(s)`);

    try {
      // Get admin email
      const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'shrijan.bhandari1318@gmail.com';

      // Build photo links HTML
      const photoLinks = afterData.evidence.photos.map((url: string, index: number) =>
        `<li><a href="${url}" style="color: #4F46E5;">View Photo ${index + 1}</a></li>`
      ).join('');

      // Send follow-up email to admin with photo links
      const adminEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #4F46E5; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 20px;">📸 Evidence Photos Added to Safety Report</h1>
          </div>
          
          <p>Evidence photos have been uploaded for safety report:</p>
          
          <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 0;"><strong>Report ID:</strong> ${reportId}</p>
            <p style="margin: 8px 0 0 0;"><strong>Type:</strong> ${afterData.type || 'Unknown'}</p>
            <p style="margin: 8px 0 0 0;"><strong>Severity:</strong> ${afterData.severity || 'Unknown'}</p>
          </div>
          
          <div style="background: #EFF6FF; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4F46E5;">
            <h3 style="color: #1E40AF; margin: 0 0 10px 0;">📷 Evidence Photos (${afterData.evidence.photos.length})</h3>
            <ul style="color: #4F46E5; margin: 0; padding-left: 20px;">
              ${photoLinks}
            </ul>
          </div>
          
          <p style="color: #6B7280; font-size: 12px; margin-top: 20px;">
            This is an automated notification from CarpoolConnect.
          </p>
        </div>
      `;

      await sendEmail(adminEmail, "safetyReportEvidenceAdded", [{
        reportId,
        type: afterData.type,
        severity: afterData.severity,
        photos: afterData.evidence.photos,
        html: adminEmailHtml,
      }]);

      console.log(`✅ Evidence photo notification sent for report ${reportId}`);

      // Also send to the reporter if they have an email
      if (afterData.reporterId) {
        const reporterDoc = await db.collection("users").doc(afterData.reporterId).get();
        const reporterEmail = reporterDoc.data()?.email;

        if (reporterEmail) {
          console.log(`📧 Sending photo confirmation to reporter: ${reporterEmail}`);
          // The reporter confirmation already includes photos in the safetyReportConfirmation template
          // Just log for now - the initial email would have been sent already
        }
      }
    } catch (error) {
      console.error(`❌ Error sending evidence photo notification for ${reportId}:`, error);
    }
  });

export const createBooking = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const data = request.data;
  const { rideId, seatsRequested, pickupLocation, dropoffLocation, totalPrice, notes } = data;

  if (!rideId) {
    throw new HttpsError("invalid-argument", "Missing rideId");
  }

  try {
    // Get ride details
    const rideDoc = await db.collection("rides").doc(rideId).get();
    if (!rideDoc.exists) {
      throw new HttpsError("not-found", "Ride not found");
    }

    const rideData = rideDoc.data()!;
    const passengerId = request.auth.uid;

    // Check seat availability
    if (rideData.seatsAvailable < (seatsRequested || 1)) {
      throw new HttpsError("failed-precondition", "Not enough seats available");
    }

    // Check if user already has a booking for this ride
    const existingBooking = await db.collection("bookings")
      .where("rideId", "==", rideId)
      .where("passengerId", "==", passengerId)
      .where("status", "in", ["pending", "accepted"])
      .get();

    if (!existingBooking.empty) {
      throw new HttpsError("already-exists", "You already have a booking for this ride");
    }

    // Create booking
    const booking = {
      rideId,
      passengerId,
      driverId: rideData.driverId,
      seatsRequested: seatsRequested || 1,
      pickupLocation: pickupLocation || rideData.origin,
      dropoffLocation: dropoffLocation || rideData.destination,
      totalPrice: totalPrice || rideData.pricePerSeat || 0,
      // Sanitize notes to prevent XSS and limit length
      notes: (notes || "")
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .slice(0, 500), // Limit to 500 chars
      status: "pending",
      paymentStatus: "unpaid",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("bookings").add(booking);

    // Notify driver of new booking request
    const passengerDoc = await db.collection("users").doc(passengerId).get();
    const passengerName = passengerDoc.data()?.name || "A passenger";

    const notif = notificationTemplates.newBookingRequest(passengerName);
    await createNotification({
      userId: rideData.driverId,
      title: notif.title,
      body: notif.body,
      type: "booking",
      data: { bookingId: docRef.id, rideId },
    });

    return {
      success: true,
      bookingId: docRef.id,
      message: "Booking request sent to driver",
    };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logger.error('Error creating booking', error);
    if (isHttpsError(error)) throw error;
    throw new HttpsError("internal", message || "Failed to create booking");
  }
});

export const updateBookingStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { bookingId, status, reason } = request.data;

  if (!bookingId || !status) {
    throw new HttpsError("invalid-argument", "Missing bookingId or status");
  }

  const validStatuses = ["pending", "accepted", "rejected", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid status value");
  }

  try {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      throw new HttpsError("not-found", "Booking not found");
    }

    const bookingData = bookingDoc.data()!;
    const userId = request.auth.uid;

    // Verify user is part of this booking
    if (bookingData.passengerId !== userId && bookingData.driverId !== userId) {
      throw new HttpsError("permission-denied", "You don't have permission to update this booking");
    }

    // Use transaction for atomic seat updates
    await db.runTransaction(async (transaction) => {
      const freshBookingDoc = await transaction.get(bookingRef);
      if (!freshBookingDoc.exists) throw new HttpsError("not-found", "Booking not found");

      const freshBookingData = freshBookingDoc.data()!;

      // If accepting, check and decrement seats
      if (status === "accepted" && freshBookingData.status !== "accepted") {
        const rideRef = db.collection("rides").doc(freshBookingData.rideId);
        const rideDoc = await transaction.get(rideRef);

        if (!rideDoc.exists) throw new HttpsError("not-found", "Ride not found");

        const rideData = rideDoc.data()!;
        if (rideData.seatsAvailable < freshBookingData.seatsRequested) {
          throw new HttpsError("failed-precondition", "Not enough seats available");
        }

        transaction.update(rideRef, {
          seatsAvailable: admin.firestore.FieldValue.increment(-freshBookingData.seatsRequested),
          availableSeats: admin.firestore.FieldValue.increment(-freshBookingData.seatsRequested)
        });
      }

      transaction.update(bookingRef, {
        status,
        reason: reason || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        [`${status}At`]: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return {
      success: true,
      message: `Booking status updated to ${status}`,
    };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logger.error('Error updating booking', error);
    if (isHttpsError(error)) throw error;
    throw new HttpsError("internal", message || "Failed to update booking");
  }
});

export const getUserBookings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const userId = request.auth.uid;
  const { role, status } = request.data;

  try {
    let query: admin.firestore.Query = db.collection("bookings");

    if (role === "driver") {
      query = query.where("driverId", "==", userId);
    } else {
      query = query.where("passengerId", "==", userId);
    }

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.orderBy("createdAt", "desc").limit(50).get();
    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, bookings };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logger.error('Error getting bookings', error);
    throw new HttpsError("internal", message || "Failed to get bookings");
  }
});

// ============================================================================
// CARPOOL BOOKING FLOW - Complete Implementation
// ============================================================================
//
// BOOKING STATE MACHINE:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ pending_driver ──┬──(accept)──> confirmed ──(complete)──> completed │
// │                  │                  │                               │
// │                  └──(decline)──> declined                           │
// │                  │                  │                               │
// │                  └──(cancel)──────>│<──(cancel)────────> cancelled  │
// └─────────────────────────────────────────────────────────────────────┘
//
// PAYMENT FLOW:
// 1. Rider creates booking -> SetupIntent created (no charge yet)
// 2. Rider adds payment method -> PaymentMethod saved
// 3. Driver accepts booking -> Status: confirmed
// 4. 24h before ride -> PaymentIntent with manual capture (holds funds)
// 5. Ride completes -> Capture payment, transfer to driver

/**
 * Step 1: Create a Pending Booking Request
 *
 * This function is called when a rider wants to book a seat on a ride.
 * It performs the following operations atomically:
 *
 * 1. Validates the ride exists and has available seats
 * 2. Validates the rider hasn't already booked this ride
 * 3. Validates the ride is in the future and accepting bookings
 * 4. Creates a booking document with status "pending_driver"
 * 5. Atomically decrements available seats on the ride
 * 6. Creates a Stripe SetupIntent to save payment method (no charge yet)
 * 7. Sends notification and email to the driver
 *
 * @requires auth - User must be authenticated
 * @param rideId - The ID of the ride to book
 * @param seats - Number of seats to book (1-10)
 * @returns { success, bookingId, clientSecret, message }
 * @throws unauthenticated - If user is not logged in
 * @throws invalid-argument - If rideId or seats are missing/invalid
 * @throws not-found - If ride doesn't exist
 * @throws permission-denied - If user tries to book their own ride
 * @throws failed-precondition - If ride is not accepting bookings or not enough seats
 * @throws already-exists - If user already has a pending/confirmed booking
 */
export const createPendingBooking = onCall({ secrets: ['STRIPE_SECRET_KEY', 'EMAIL_USER', 'EMAIL_PASSWORD'] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { rideId, seats } = request.data;
  const riderId = request.auth.uid;

  // Rate limiting - prevent booking spam
  await checkRateLimit(riderId, "createPendingBooking");

  // Input validation
  if (!rideId || !seats) {
    throw new HttpsError("invalid-argument", "Missing rideId or seats");
  }

  const sanitizedSeats = sanitizeNumber(seats, 1, 10, 1);
  if (sanitizedSeats < 1 || sanitizedSeats > 10) {
    throw new HttpsError("invalid-argument", "Invalid number of seats (must be 1-10)");
  }

  try {
    logger.booking.created('pending', rideId, riderId);

    // Use transaction for atomic seat checking and booking creation
    const result = await db.runTransaction(async (transaction) => {
      const rideRef = db.collection("rides").doc(rideId);
      const rideDoc = await transaction.get(rideRef);

      if (!rideDoc.exists) {
        throw new HttpsError("not-found", "Ride not found");
      }

      const rideData = rideDoc.data()!;

      // Validation: Can't book your own ride
      if (rideData.driverId === riderId) {
        throw new HttpsError("permission-denied", "You cannot book your own ride");
      }

      // Validation: Ride must be in future
      const departureTime = new Date(rideData.departureTime);
      if (departureTime < new Date()) {
        throw new HttpsError("failed-precondition", "Cannot book rides that have already departed");
      }

      // Validation: Ride must be active/upcoming
      if (rideData.status !== "upcoming" && rideData.status !== "active") {
        throw new HttpsError("failed-precondition", `Ride is ${rideData.status} and cannot accept bookings`);
      }

      // Check seat availability - use the maximum of both fields to handle legacy data inconsistency
      // Some rides may have seatsAvailable=0 but availableSeats=X or vice versa
      const seatsField1 = typeof rideData.seatsAvailable === 'number' ? rideData.seatsAvailable : 0;
      const seatsField2 = typeof rideData.availableSeats === 'number' ? rideData.availableSeats : 0;
      const seatsAvailable = Math.max(seatsField1, seatsField2);
      console.log(`📊 Ride ${rideId} seat check: seatsAvailable=${rideData.seatsAvailable}, availableSeats=${rideData.availableSeats}, using max=${seatsAvailable}, requested=${seats}`);

      if (seatsAvailable < seats) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough seats available. You requested ${seats} seat${seats > 1 ? 's' : ''}, but only ${seatsAvailable} seat${seatsAvailable !== 1 ? 's are' : ' is'} available.`
        );
      }

      // Check for existing bookings (inside transaction for consistency)
      const existingBookingsSnapshot = await db
        .collection("bookings")
        .where("rideId", "==", rideId)
        .where("riderId", "==", riderId)
        .where("status", "in", ["pending_driver", "confirmed"])
        .get();

      if (!existingBookingsSnapshot.empty) {
        throw new HttpsError(
          "already-exists",
          "You already have a pending or confirmed booking for this ride"
        );
      }

      // Calculate pricing with $5 flat platform fee
      const pricePerSeat = rideData.pricePerSeat || 0;
      const ridePrice = pricePerSeat * seats;
      const platformFee = 500; // $5 flat platform fee (in cents)
      const totalAmount = ridePrice + platformFee;

      // Create booking document
      const bookingRef = db.collection("bookings").doc();
      const bookingData = {
        rideId,
        riderId,
        driverId: rideData.driverId,
        seats,
        pricePerSeat,
        ridePrice,
        platformFee,
        amountTotal: totalAmount,
        status: "pending_driver",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        payment: {
          status: "payment_method_required",
          setupIntentId: null,
          clientSecret: null,
          customerId: null,
          paymentMethodId: null,
          paymentIntentId: null,
        },
      };

      transaction.set(bookingRef, bookingData);

      // CRITICAL: Atomically decrement available seats (reserve them immediately)
      // Update BOTH fields to maintain compatibility - app uses availableSeats, some code uses seatsAvailable
      transaction.update(rideRef, {
        seatsAvailable: admin.firestore.FieldValue.increment(-seats),
        availableSeats: admin.firestore.FieldValue.increment(-seats),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Booking created and ${seats} seats reserved for ride ${rideId}`);

      return {
        bookingId: bookingRef.id,
        totalAmount,
        seats,
        driverId: rideData.driverId,
      };
    });

    // Get or create Stripe customer and use SetupIntent to save payment method
    // (Authorization will happen 24h before ride via scheduled function)
    try {
      const stripe = getStripe();

      // Get rider's user data
      const riderDoc = await db.collection("users").doc(riderId).get();
      const riderData = riderDoc.data() || {};

      // Get or create Stripe customer
      let customerId = riderData.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: riderData.email,
          name: riderData.name,
          metadata: { userId: riderId },
        }, {
          idempotencyKey: `customer_${riderId}`, // Prevent duplicate customers on retry
        });
        customerId = customer.id;

        // Save customer ID to user document
        await db.collection("users").doc(riderId).update({
          stripeCustomerId: customerId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.stripe.accountCreated(customerId, riderId);
      }

      // Create SetupIntent to save payment method (not charge yet)
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          bookingId: result.bookingId,
          rideId,
          riderId,
        },
      });

      // Update booking with SetupIntent details
      await db.collection("bookings").doc(result.bookingId).update({
        "payment.setupIntentId": setupIntent.id,
        "payment.clientSecret": setupIntent.client_secret,
        "payment.customerId": customerId,
        "payment.status": "payment_method_required",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.payment.initiated(setupIntent.id, result.totalAmount, result.bookingId);

      // Send notification and email to driver (non-blocking)
      try {
        const riderName = riderData.name || "A rider";

        // Fetch driver data for email
        const driverDoc = await db.collection("users").doc(result.driverId).get();
        const driverData = driverDoc.data() || {};

        // Fetch ride data for email details
        const rideDoc = await db.collection("rides").doc(rideId).get();
        const rideData = rideDoc.data() || {};

        const rideDetails = {
          origin: rideData.from?.name || rideData.origin?.name || "Origin",
          destination: rideData.to?.name || rideData.destination?.name || "Destination",
          departureTime: rideData.departureTime ? new Date(rideData.departureTime).toLocaleString() : "As scheduled",
          seats: seats,
        };

        // 1. Notify Driver
        // In-app
        const notif = notificationTemplates.newBookingRequest(riderName);
        await createNotification({
          userId: result.driverId,
          title: notif.title,
          body: notif.body,
          type: "booking",
          data: { bookingId: result.bookingId, rideId },
        });
        logger.info('In-app notification sent to driver', { driverId: result.driverId });

        // Email to Driver
        if (driverData.email) {
          await sendEmail(driverData.email, "newBookingRequest", [
            driverData.name || "Driver",
            riderName,
            rideDetails,
          ]);
          logger.info('Email sent to driver', { email: driverData.email });
        }

        // 2. Notify Rider (Confirmation)
        if (riderData.email) {
          await sendEmail(riderData.email, "bookingRequestSent", [
            riderData.name || "Rider",
            rideDetails,
            driverData.name || "the driver"
          ]);
          logger.info('Confirmation email sent to rider', { email: riderData.email });
        }

      } catch (notifError) {
        logger.error('Failed to send notification/email to driver', notifError);
        // Don't fail booking if notification fails
      }

      return {
        success: true,
        bookingId: result.bookingId,
        clientSecret: setupIntent.client_secret,
        message: "Booking request sent to driver. You'll be notified when they respond.",
      };
    } catch (stripeError: any) {
      // If SetupIntent creation fails, delete the booking and restore seats
      console.error("❌ Failed to create SetupIntent:", stripeError);

      try {
        await db.runTransaction(async (transaction) => {
          const bookingRef = db.collection("bookings").doc(result.bookingId);
          const rideRef = db.collection("rides").doc(rideId);

          transaction.delete(bookingRef);
          transaction.update(rideRef, {
            seatsAvailable: admin.firestore.FieldValue.increment(seats),
            availableSeats: admin.firestore.FieldValue.increment(seats),
          });
        });
      } catch (rollbackError) {
        console.error("Failed to rollback booking:", rollbackError);
      }

      throw new HttpsError("internal", "Failed to setup payment method. Please try again.");
    }
  } catch (error: any) {
    console.error("❌ Create pending booking error:", error);
    if (error instanceof HttpsError) throw error;

    // Classify Stripe errors for better user feedback
    if (error.type === 'StripeCardError') {
      throw new HttpsError("invalid-argument", `Card error: ${error.message}`);
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new HttpsError("invalid-argument", "Invalid payment information provided");
    } else if (error.type === 'StripeAPIError' || error.type === 'StripeConnectionError') {
      throw new HttpsError("unavailable", "Payment service temporarily unavailable. Please try again.");
    }

    throw new HttpsError("internal", error.message || "Failed to create booking");
  }
});

/**
 * Helper: Update booking with payment method after SetupIntent confirmation
 */
export const updateBookingPaymentMethod = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { bookingId, paymentMethodId } = request.data;
  const userId = request.auth.uid;

  if (!bookingId || !paymentMethodId) {
    throw new HttpsError("invalid-argument", "Missing bookingId or paymentMethodId");
  }

  // Validate payment method ID format
  if (!paymentMethodId.startsWith('pm_')) {
    throw new HttpsError("invalid-argument", "Invalid payment method ID format");
  }

  try {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      throw new HttpsError("not-found", "Booking not found");
    }

    const bookingData = bookingDoc.data()!;

    // Verify user is the rider
    if (bookingData.riderId !== userId) {
      throw new HttpsError("permission-denied", "Not authorized");
    }

    // Optional: Verify payment method belongs to customer (requires Stripe call)
    const stripe = getStripe();
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== bookingData.payment?.customerId) {
        throw new HttpsError("invalid-argument", "Payment method doesn't belong to this customer");
      }
    } catch (stripeError: any) {
      console.error("Failed to validate payment method:", stripeError);
      throw new HttpsError("invalid-argument", "Invalid payment method");
    }

    await bookingRef.update({
      "payment.paymentMethodId": paymentMethodId,
      "payment.status": "payment_method_saved",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Payment method ${paymentMethodId} saved for booking ${bookingId}`);

    return { success: true, message: "Payment method saved successfully" };
  } catch (error: any) {
    console.error("Error updating payment method:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to update payment method");
  }
});

/**
 * Step 4: Driver Accepts Booking - With Immediate Payment Authorization
 *
 * This function is called when a driver accepts a booking request.
 * It performs the following operations:
 * 1. Updates booking status to 'confirmed'
 * 2. Adds passenger to the ride
 * 3. Creates PaymentIntent with manual capture (authorizes payment IMMEDIATELY)
 * 4. Sends notifications to rider
 *
 * This replaces the 24-hour scheduled authorization, enabling same-day rides.
 */
export const acceptBookingWithPayment = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { bookingId } = request.data;
    const driverId = request.auth.uid;

    if (!bookingId) {
      throw new HttpsError("invalid-argument", "Missing bookingId");
    }

    // Rate limiting
    await checkRateLimit(driverId, "acceptBooking");

    try {
      console.log(`📋 Driver ${driverId} accepting booking ${bookingId}`);

      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) {
        throw new HttpsError("not-found", "Booking not found");
      }

      const bookingData = bookingDoc.data()!;

      // Verify driver owns this booking
      if (bookingData.driverId !== driverId) {
        throw new HttpsError("permission-denied", "Not authorized to accept this booking");
      }

      // Verify booking is in pending state
      if (bookingData.status !== "pending_driver") {
        throw new HttpsError("failed-precondition", `Booking is already ${bookingData.status}`);
      }

      // Get ride data
      const rideRef = db.collection("rides").doc(bookingData.rideId);
      const rideDoc = await rideRef.get();

      if (!rideDoc.exists) {
        throw new HttpsError("not-found", "Ride not found");
      }

      const rideData = rideDoc.data()!;

      // Get passenger data
      const passengerDoc = await db.collection("users").doc(bookingData.riderId).get();
      const passengerData = passengerDoc.exists ? passengerDoc.data()! : null;

      if (!passengerData) {
        throw new HttpsError("not-found", "Passenger not found");
      }

      // === HYBRID PAYMENT AUTHORIZATION ===
      // Stripe authorizations expire in 7 days, so:
      // - Rides within 7 days: authorize immediately
      // - Rides 7+ days away: verify payment method only, rely on 24h scheduled job

      const AUTHORIZATION_WINDOW_DAYS = 7;
      const departureTime = new Date(rideData.departureTime || rideData.departureAt);
      const now = new Date();
      const daysUntilRide = Math.ceil((departureTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const shouldAuthorizeNow = daysUntilRide <= AUTHORIZATION_WINDOW_DAYS;

      console.log(`📅 Ride departure: ${departureTime.toISOString()}, Days until ride: ${daysUntilRide}, Authorize now: ${shouldAuthorizeNow}`);

      let paymentAuthResult: {
        success: boolean;
        paymentIntentId?: string;
        error?: string;
        deferred?: boolean; // True if authorization deferred to scheduled job
      } = { success: false };

      // Check if booking has saved payment method
      if (bookingData.payment?.paymentMethodId && bookingData.payment?.customerId) {
        const stripe = getStripe();

        if (shouldAuthorizeNow) {
          // === AUTHORIZE IMMEDIATELY (ride within 7 days) ===
          try {
            // Create PaymentIntent with manual capture (authorize now, capture when ride completes)
            const paymentIntent = await stripe.paymentIntents.create({
              amount: bookingData.amountTotal,
              currency: "aud",
              customer: bookingData.payment.customerId,
              payment_method: bookingData.payment.paymentMethodId,
              confirm: true, // Automatically confirm with saved payment method
              capture_method: "manual", // Hold funds for later capture when ride completes
              automatic_payment_methods: {
                enabled: true,
                allow_redirects: "never",
              },
              metadata: {
                bookingId: bookingId,
                rideId: bookingData.rideId,
                riderId: bookingData.riderId,
                driverId: driverId,
              },
            }, {
              idempotencyKey: `accept_auth_${bookingId}`,
            });

            if (paymentIntent.status === "requires_capture") {
              // Authorization successful - funds are held for up to 7 days
              console.log(`✅ Payment authorized for booking ${bookingId}: $${(bookingData.amountTotal / 100).toFixed(2)} AUD`);
              paymentAuthResult = { success: true, paymentIntentId: paymentIntent.id };
            } else if (paymentIntent.status === "succeeded") {
              // Some payment methods capture immediately
              console.log(`✅ Payment captured immediately for booking ${bookingId}`);
              paymentAuthResult = { success: true, paymentIntentId: paymentIntent.id };
            } else {
              console.warn(`⚠️ Unexpected payment status: ${paymentIntent.status}`);
              paymentAuthResult = { success: false, error: `Unexpected status: ${paymentIntent.status}` };
            }
          } catch (stripeError: any) {
            console.error(`❌ Payment authorization failed for booking ${bookingId}:`, stripeError);
            paymentAuthResult = { success: false, error: stripeError.message };
          }
        } else {
          // === DEFER AUTHORIZATION (ride > 7 days away) ===
          // Just verify payment method is valid, don't authorize yet
          try {
            const paymentMethod = await stripe.paymentMethods.retrieve(bookingData.payment.paymentMethodId);

            // Check if payment method is valid
            if (!paymentMethod.id) {
              throw new Error("Invalid payment method");
            }

            // Check card expiration if applicable
            if (paymentMethod.card) {
              const expYear = paymentMethod.card.exp_year;
              const expMonth = paymentMethod.card.exp_month;
              const expDate = new Date(expYear, expMonth); // First day of next month

              if (expDate < departureTime) {
                console.warn(`⚠️ Card expires ${expMonth}/${expYear}, before ride on ${departureTime.toISOString()}`);
                // Don't fail, just warn - card might be auto-updated by bank
              }
            }

            console.log(`📋 Payment method verified for booking ${bookingId}, authorization deferred to 24h before ride`);
            paymentAuthResult = {
              success: true,
              deferred: true,
              // No paymentIntentId yet - will be created by scheduled job
            };
          } catch (verifyError: any) {
            console.error(`❌ Payment method verification failed for booking ${bookingId}:`, verifyError);
            paymentAuthResult = { success: false, error: verifyError.message };
          }
        }
      } else {
        console.warn(`⚠️ No payment method saved for booking ${bookingId} - proceeding without payment authorization`);
        paymentAuthResult = { success: false, error: "No payment method saved" };
      }

      // === UPDATE BOOKING AND RIDE ===
      const batch = db.batch();

      // Update booking status based on payment result
      // - authorized: Payment authorized immediately (ride within 7 days)
      // - pending_authorization: Deferred to scheduled job (ride > 7 days away)
      // - authorization_failed: Payment failed
      // - no_payment_required: No payment method saved
      let paymentUpdate: Record<string, unknown>;

      if (paymentAuthResult.success) {
        if (paymentAuthResult.deferred) {
          // Deferred authorization - scheduled job will handle 24h before ride
          paymentUpdate = {
            "payment.status": "pending_authorization",
            "payment.deferredUntil": new Date(departureTime.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 24h before ride
          };
        } else {
          // Immediate authorization successful
          paymentUpdate = {
            "payment.paymentIntentId": paymentAuthResult.paymentIntentId,
            "payment.status": "authorized",
            "payment.authorizedAt": admin.firestore.FieldValue.serverTimestamp(),
          };
        }
      } else {
        // Authorization failed or no payment method
        paymentUpdate = {
          "payment.status": paymentAuthResult.error ? "authorization_failed" : "no_payment_required",
          "payment.lastError": paymentAuthResult.error || null,
        };
      }

      batch.update(bookingRef, {
        status: "confirmed",
        passenger: {
          id: bookingData.riderId,
          name: passengerData.name || "Passenger",
          photoURL: passengerData.photoURL || null,
          rating: passengerData.rating || null,
          totalRides: passengerData.totalRides || 0,
        },
        ...paymentUpdate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Add passenger to ride
      const updatedPassengers = [...(rideData.passengers || []), {
        id: bookingData.riderId,
        seats: bookingData.seats,
        bookingId: bookingId,
        user: {
          id: bookingData.riderId,
          name: passengerData.name || "Passenger",
          displayName: passengerData.displayName || passengerData.name || "Passenger",
          photoURL: passengerData.photoURL || null,
          rating: passengerData.rating || null,
        },
      }];

      batch.update(rideRef, {
        passengers: updatedPassengers,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();
      console.log(`✅ Booking ${bookingId} confirmed and passenger added to ride`);

      // === SEND NOTIFICATIONS ===
      try {
        const driverDoc = await db.collection("users").doc(driverId).get();
        const driverData = driverDoc.data() || {};
        const driverName = driverData.name || "Driver";

        // Notify rider
        const notif = notificationTemplates.bookingAccepted(driverName);
        await createNotification({
          userId: bookingData.riderId,
          title: notif.title,
          body: notif.body,
          type: "booking",
          data: { bookingId, rideId: bookingData.rideId },
        });

        // Send email to rider
        if (passengerData.email) {
          const rideDetails = {
            origin: rideData.from?.name || rideData.origin?.name || "Origin",
            destination: rideData.to?.name || rideData.destination?.name || "Destination",
            departureTime: rideData.departureTime ? new Date(rideData.departureTime).toLocaleString() : "As scheduled",
          };

          await sendEmail(passengerData.email, "bookingAccepted", [
            passengerData.name || "Rider",
            driverName,
            rideDetails,
          ]);
        }
      } catch (notifError) {
        console.error("Failed to send notifications:", notifError);
        // Don't fail the booking for notification errors
      }

      // Log payment event
      if (paymentAuthResult.success && paymentAuthResult.paymentIntentId) {
        await logPaymentEvent(bookingId, AuditEventTypes.PAYMENT_AUTHORIZED, paymentAuthResult.paymentIntentId, true);
      }

      return {
        success: true,
        message: "Booking accepted successfully",
        bookingId,
        paymentAuthorized: paymentAuthResult.success && !paymentAuthResult.deferred,
        paymentDeferred: paymentAuthResult.deferred || false,
        paymentError: paymentAuthResult.error || null,
        daysUntilRide,
      };
    } catch (error: any) {
      console.error("Error accepting booking:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to accept booking");
    }
  }
);

/**
 * Scheduled Function: Authorize payments for rides departing in 24 hours
 * Run hourly via Cloud Scheduler
 */
export const authorizeUpcomingRidePayments = onRequest(
  { secrets: ["STRIPE_SECRET_KEY"] }, // SCHEDULER_AUTH_TOKEN will be added when scheduler is configured
  async (req, res) => {
    // Verify the request is from Cloud Scheduler (optional for now)
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.SCHEDULER_AUTH_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      res.status(401).send("Unauthorized");
      return;
    }

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twentyThreeHoursFromNow = new Date(now.getTime() + 23 * 60 * 60 * 1000);

    console.log(`🕐 Authorizing payments for rides between ${twentyThreeHoursFromNow.toISOString()} and ${twentyFourHoursFromNow.toISOString()}`);

    try {
      // Find rides departing in 23-24 hours (limit to first 50 to prevent timeout)
      const ridesSnapshot = await db
        .collection("rides")
        .where("departureTime", ">=", twentyThreeHoursFromNow.toISOString())
        .where("departureTime", "<=", twentyFourHoursFromNow.toISOString())
        .where("status", "==", "upcoming")
        .limit(50) // Prevent function timeout
        .get();

      let authorizedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (const rideDoc of ridesSnapshot.docs) {
        const rideId = rideDoc.id;

        // Get all confirmed bookings for this ride that haven't been authorized yet
        const bookingsSnapshot = await db
          .collection("bookings")
          .where("rideId", "==", rideId)
          .where("status", "==", "confirmed")
          .get();

        for (const bookingDoc of bookingsSnapshot.docs) {
          const bookingData = bookingDoc.data();

          // Skip if already authorized
          if (bookingData.payment?.paymentIntentId) {
            skippedCount++;
            continue;
          }

          // Skip if no payment method saved
          if (!bookingData.payment?.paymentMethodId) {
            console.warn(`No payment method saved for booking ${bookingDoc.id}`);
            failedCount++;
            continue;
          }

          try {
            const stripe = getStripe();

            // Create PaymentIntent with manual capture using saved payment method
            const paymentIntent = await stripe.paymentIntents.create({
              amount: bookingData.amountTotal,
              currency: "aud",
              customer: bookingData.payment.customerId,
              payment_method: bookingData.payment.paymentMethodId,
              confirm: true, // Automatically confirm with saved payment method
              capture_method: "manual", // Hold funds for later capture
              metadata: {
                bookingId: bookingDoc.id,
                rideId,
                riderId: bookingData.riderId,
              },
            }, {
              idempotencyKey: `authorize_${bookingDoc.id}_${rideId}`,
            });

            if (paymentIntent.status === "requires_capture") {
              // Authorization successful
              await bookingDoc.ref.update({
                "payment.paymentIntentId": paymentIntent.id,
                "payment.status": "authorized",
                "payment.authorizedAt": admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              authorizedCount++;
              console.log(`✅ Authorized payment for booking ${bookingDoc.id}: $${(bookingData.amountTotal / 100).toFixed(2)} AUD`);
            } else {
              throw new Error(`Unexpected payment status: ${paymentIntent.status}`);
            }
          } catch (error: any) {
            console.error(`❌ Failed to authorize payment for booking ${bookingDoc.id}:`, error);

            // Notify rider that payment authorization failed
            await createNotification({
              userId: bookingData.riderId,
              title: "Payment Authorization Failed ⚠️",
              body: "Your ride is in 24 hours but we couldn't authorize your payment. Please update your payment method.",
              type: "payment",
              data: { bookingId: bookingDoc.id, rideId },
            });

            failedCount++;
          }
        }
      }

      const message = `Processed ${ridesSnapshot.size} rides: ${authorizedCount} authorized, ${failedCount} failed, ${skippedCount} skipped`;
      console.log(`🎉 ${message}`);

      res.status(200).json({
        success: true,
        rides: ridesSnapshot.size,
        authorized: authorizedCount,
        failed: failedCount,
        skipped: skippedCount,
        message,
      });
    } catch (error) {
      console.error("❌ Error in authorize UpcomingRidePayments:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  }
);

/**
 * Get all pending booking requests for a driver
 */
export const getDriverBookingRequests = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const driverId = request.auth.uid;

  try {
    console.log(`📱 Getting booking requests for driver: ${driverId}`);

    // Query bookings where the driver is the driverId and status is pending_driver
    const bookingsSnapshot = await db
      .collection("bookings")
      .where("driverId", "==", driverId)
      .where("status", "==", "pending_driver")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    console.log(`Found ${bookingsSnapshot.size} pending booking requests`);

    const bookingRequests = [];

    for (const bookingDoc of bookingsSnapshot.docs) {
      const bookingData = bookingDoc.data();

      // Get ride details
      let rideDetails = {
        id: bookingData.rideId,
        origin: { name: "Unknown" },
        destination: { name: "Unknown" },
        departureTime: new Date().toISOString(),
        pricePerSeat: 0,
      };

      try {
        const rideDoc = await db.collection("rides").doc(bookingData.rideId).get();
        if (rideDoc.exists) {
          const rideData = rideDoc.data()!;
          rideDetails = {
            id: rideDoc.id,
            origin: rideData.from || rideData.origin || { name: "Unknown" },
            destination: rideData.to || rideData.destination || { name: "Unknown" },
            departureTime: rideData.departureTime || rideData.departureAt || new Date().toISOString(),
            pricePerSeat: rideData.pricePerSeat || 0,
          };
        }
      } catch (rideError) {
        console.error(`Failed to get ride ${bookingData.rideId}:`, rideError);
      }

      // Get rider details
      const riderId = bookingData.riderId || bookingData.passengerId;
      let riderDetails = {
        id: riderId,
        name: "Unknown",
        displayName: "Unknown",
        rating: 5.0,
        totalRides: 0,
        photoURL: null,
      };

      try {
        const riderDoc = await db.collection("users").doc(riderId).get();
        if (riderDoc.exists) {
          const riderData = riderDoc.data()!;
          riderDetails = {
            id: riderDoc.id,
            name: riderData.name || "Unknown",
            displayName: riderData.displayName || riderData.name || "Unknown",
            rating: riderData.rating || 5.0,
            totalRides: riderData.totalRides || 0,
            photoURL: riderData.photoURL || riderData.profilePicture || null,
          };
        }
      } catch (riderError) {
        console.error(`Failed to get rider ${riderId}:`, riderError);
      }

      bookingRequests.push({
        id: bookingDoc.id,
        rideId: bookingData.rideId,
        riderId: riderId,
        seats: bookingData.seats || 1,
        amountTotal: bookingData.amountTotal || 0,
        status: bookingData.status,
        createdAt: bookingData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        ride: rideDetails,
        rider: riderDetails,
        payment: {
          intentId: bookingData.payment?.paymentIntentId || bookingData.payment?.intentId || null,
          amount: bookingData.amountTotal || 0,
          platformFee: bookingData.platformFee || 500,
        },
      });
    }

    console.log(`✅ Returning ${bookingRequests.length} booking requests`);

    return {
      success: true,
      bookingRequests,
    };
  } catch (error: any) {
    console.error("❌ Error getting driver booking requests:", error);
    throw new HttpsError("internal", error.message || "Failed to get booking requests");
  }
});

/**
 * Step 2: Driver Responds to Booking Request
 *
 * This function handles the driver's response to a pending booking request.
 * The driver can either accept or decline the booking.
 *
 * ACCEPT FLOW:
 * 1. Validates the booking is in "pending_driver" status
 * 2. Validates the rider has saved a payment method
 * 3. Updates booking status to "confirmed"
 * 4. Sends notification to rider
 *
 * DECLINE FLOW:
 * 1. Validates the booking is in "pending_driver" status
 * 2. Restores the reserved seats to the ride (atomic)
 * 3. Updates booking status to "declined"
 * 4. Sends notification to rider
 *
 * NOTE: No PaymentIntent cancellation is needed because payment is not captured
 * until 24 hours before the ride via the scheduled function.
 *
 * @requires auth - User must be the driver of this booking
 * @param bookingId - The ID of the booking to respond to
 * @param action - "accept" or "decline"
 * @returns { success, action, message }
 * @throws unauthenticated - If user is not logged in
 * @throws invalid-argument - If bookingId or action is invalid
 * @throws not-found - If booking doesn't exist
 * @throws permission-denied - If user is not the driver
 * @throws failed-precondition - If booking is not in pending_driver status
 */
export const driverRespondBooking = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { bookingId, action } = request.data;
  const driverId = request.auth.uid;

  if (!bookingId || !["accept", "decline"].includes(action)) {
    throw new HttpsError("invalid-argument", "Invalid bookingId or action");
  }

  try {
    console.log(`🚗 Driver ${action}ing booking ${bookingId}`);

    let bookingData: any;

    await db.runTransaction(async (transaction) => {
      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingDoc = await transaction.get(bookingRef);

      if (!bookingDoc.exists) {
        throw new HttpsError("not-found", "Booking not found");
      }

      bookingData = bookingDoc.data()!;

      // Verify user is the driver
      if (bookingData.driverId !== driverId) {
        throw new HttpsError("permission-denied", "Only the driver can respond to this booking");
      }

      // Can only respond to pending_driver bookings
      // NOTE: The booking is created with status "pending_driver" in createPendingBooking
      if (bookingData.status !== "pending_driver") {
        throw new HttpsError("failed-precondition", `Cannot ${action} a ${bookingData.status} booking`);
      }

      if (action === "accept") {
        // Verify payment method is saved before accepting
        if (!bookingData.payment?.paymentMethodId) {
          throw new HttpsError(
            "failed-precondition",
            "Cannot accept booking - rider hasn't added payment method yet"
          );
        }

        // Accept: Change to confirmed
        transaction.update(bookingRef, {
          status: "confirmed",
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✅ Booking ${bookingId} confirmed`);
      } else {
        // Decline: Restore seats and mark as declined
        const rideRef = db.collection("rides").doc(bookingData.rideId);
        transaction.update(rideRef, {
          seatsAvailable: admin.firestore.FieldValue.increment(bookingData.seats),
          availableSeats: admin.firestore.FieldValue.increment(bookingData.seats),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.update(bookingRef, {
          status: "declined",
          declinedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`❌ Booking ${bookingId} declined, ${bookingData.seats} seats restored`);
      }
    });

    // Send notification to rider
    const bookingAcceptedNotif = notificationTemplates.bookingAccepted("Driver");
    const bookingRejectedNotif = notificationTemplates.bookingRejected();

    await createNotification({
      userId: bookingData.riderId,
      title: action === "accept" ? bookingAcceptedNotif.title : bookingRejectedNotif.title,
      body: action === "accept" ? bookingAcceptedNotif.body : bookingRejectedNotif.body,
      type: "booking",
      data: { bookingId, action },
    });

    return {
      success: true,
      action,
      message: `Booking ${action}ed successfully`,
    };
  } catch (error: any) {
    console.error(`❌ Driver respond booking error:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to respond to booking");
  }
});

/**
 * Step 3: Driver starts the ride
 * Updates ride status and notifies confirmed passengers
 */
export const startRide = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { rideId } = request.data;
  const driverId = request.auth.uid;

  if (!rideId) {
    throw new HttpsError("invalid-argument", "Missing rideId");
  }

  try {
    console.log(`🚗 Starting ride ${rideId}`);

    const rideRef = db.collection("rides").doc(rideId);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      throw new HttpsError("not-found", "Ride not found");
    }

    const rideData = rideDoc.data()!;

    if (rideData.driverId !== driverId) {
      throw new HttpsError("permission-denied", "Only the driver can start this ride");
    }

    if (rideData.status !== "upcoming") {
      throw new HttpsError("failed-precondition", `Ride is ${rideData.status}, cannot start`);
    }

    // Get count of confirmed passengers
    const confirmedBookings = await db
      .collection("bookings")
      .where("rideId", "==", rideId)
      .where("status", "==", "confirmed")
      .get();

    // Update ride status
    await rideRef.update({
      status: "active",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Ride started with ${confirmedBookings.size} passenger(s)`);

    // Notify all confirmed passengers  
    const rideStartedNotif = notificationTemplates.rideStarted();
    for (const bookingDoc of confirmedBookings.docs) {
      const riderId = bookingDoc.data().riderId;
      await createNotification({
        userId: riderId,
        title: rideStartedNotif.title || "Ride Started!",
        body: rideStartedNotif.body || "Your ride has started. Have a safe trip!",
        type: "ride",
        data: { rideId, bookingId: bookingDoc.id },
      });
    }

    return {
      success: true,
      passengerCount: confirmedBookings.size,
      message: `Ride started with ${confirmedBookings.size} passenger(s)`,
    };
  } catch (error: any) {
    console.error("❌ Start ride error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to start ride");
  }
});

/**
 * Step 4: Complete ride and process charges
 * Completes ride, processes payments, calculates payouts
 */
export const completeRideAndCharge = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { rideId } = request.data;
    const driverId = request.auth.uid;

    if (!rideId) {
      throw new HttpsError("invalid-argument", "Missing rideId");
    }

    // Rate limiting - prevent spam completion attempts
    await checkRateLimit(driverId, "completeRide");

    try {
      console.log(`💰 Completing ride ${rideId} and processing charges`);

      const rideRef = db.collection("rides").doc(rideId);
      const rideDoc = await rideRef.get();

      if (!rideDoc.exists) {
        throw new HttpsError("not-found", "Ride not found");
      }

      const rideData = rideDoc.data()!;

      if (rideData.driverId !== driverId) {
        throw new HttpsError("permission-denied", "Only the driver can complete this ride");
      }

      if (rideData.status !== "active") {
        throw new HttpsError("failed-precondition", "Ride must be active to complete");
      }

      // SECURITY CHECK: Verify minimum ride duration to prevent instant completion fraud
      const startedAt = rideData.startedAt?.toDate?.() || rideData.startedAt;
      if (startedAt) {
        const now = new Date();
        const rideStartTime = new Date(startedAt);
        const rideDurationMinutes = (now.getTime() - rideStartTime.getTime()) / (1000 * 60);

        // Minimum 5 minutes for any ride
        const MINIMUM_RIDE_DURATION_MINUTES = 5;
        if (rideDurationMinutes < MINIMUM_RIDE_DURATION_MINUTES) {
          throw new HttpsError(
            "failed-precondition",
            `Ride cannot be completed yet. Please wait at least ${Math.ceil(MINIMUM_RIDE_DURATION_MINUTES - rideDurationMinutes)} more minute(s).`
          );
        }
      }

      // Get all confirmed bookings
      const bookingsSnapshot = await db
        .collection("bookings")
        .where("rideId", "==", rideId)
        .where("status", "==", "confirmed")
        .get();
      let totalRevenue = 0;
      let successfulCharges = 0;
      let failedCharges = 0;

      const stripe = getStripe();

      // Process each booking - capture the authorized payments
      for (const bookingDoc of bookingsSnapshot.docs) {
        const bookingData = bookingDoc.data();

        // Calculate booking amount regardless of payment status
        let bookingAmount = bookingData.amountTotal || 0;
        if (bookingAmount === 0) {
          // Fallback: calculate from ride's pricePerSeat
          bookingAmount = (rideData.pricePerSeat || 0) * (bookingData.seats || 1);
          console.log(`⚠️ Booking ${bookingDoc.id} had no amountTotal, calculated from ride: $${(bookingAmount / 100).toFixed(2)}`);
        }

        try {
          const paymentIntentId = bookingData.payment?.paymentIntentId;

          if (!paymentIntentId) {
            // No payment intent - mark booking as completed but note no payment captured
            console.warn(`⚠️ No PaymentIntent for booking ${bookingDoc.id} - marking as completed without payment capture`);
            await bookingDoc.ref.update({
              status: "completed",
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              "payment.status": "no_payment_required", // Or test mode
              // Review tracking - enables pending review queries
              riderReviewedDriver: false,
              driverReviewedRider: false,
            });
            // Still count the revenue (for testing/demo purposes)
            totalRevenue += bookingAmount;
            successfulCharges++;
            continue;
          }

          // SECURITY CHECK: Verify payment amount matches booking before capture
          const paymentIntentDetails = await stripe.paymentIntents.retrieve(paymentIntentId);

          // Ensure we're not capturing more than what was authorized
          if (paymentIntentDetails.amount !== bookingAmount) {
            console.warn(
              `⚠️ Amount mismatch for booking ${bookingDoc.id}: ` +
              `PI amount=${paymentIntentDetails.amount}, booking amount=${bookingAmount}. ` +
              `Using original PI amount for safety.`
            );
            // Use the original authorized amount for safety - prevents overcharging
            bookingAmount = paymentIntentDetails.amount;
          }

          // Capture the authorized payment
          const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {}, {
            idempotencyKey: `capture_${bookingDoc.id}`,
          });

          if (paymentIntent.status === "succeeded") {
            await bookingDoc.ref.update({
              status: "completed",
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              "payment.status": "captured",
              "payment.capturedAt": admin.firestore.FieldValue.serverTimestamp(),
              "payment.verifiedAmount": paymentIntentDetails.amount, // Track verified amount
              // Review tracking - enables pending review queries
              riderReviewedDriver: false,
              driverReviewedRider: false,
            });

            totalRevenue += bookingAmount;
            successfulCharges++;
            console.log(`✅ Captured payment for booking ${bookingDoc.id}: $${(bookingAmount / 100).toFixed(2)}`);
          } else {
            throw new Error(`Payment capture failed: ${paymentIntent.status}`);
          }
        } catch (error) {
          console.error(`❌ Failed to capture payment for booking ${bookingDoc.id}:`, error);
          failedCharges++;
        }
      }

      // Calculate driver payout with $5 flat platform fee PER RIDE (not per booking)
      const platformFee = 500; // $5 AUD flat fee in cents

      if (totalRevenue < platformFee) {
        throw new HttpsError(
          "failed-precondition",
          `Insufficient revenue (A$${(totalRevenue / 100).toFixed(2)}) to cover platform fee (A$5.00)`
        );
      }

      const driverPayout = totalRevenue - platformFee;

      // Get driver's Stripe Connect account info
      const driverDoc = await db.collection("users").doc(driverId).get();
      const driverData = driverDoc.data();

      let payoutId = null;

      // Process driver payout if they have Stripe Connect set up
      if (driverData?.stripeAccountId && driverData?.stripeConnectStatus === "active") {
        try {
          const transfer = await stripe.transfers.create({
            amount: driverPayout,
            currency: "aud",
            destination: driverData.stripeAccountId,
            description: `Payout for ride ${rideId}`,
            metadata: {
              rideId,
              driverId,
            },
          }, {
            idempotencyKey: `transfer_${rideId}_${driverId}`,
          });
          payoutId = transfer.id;
          console.log(`💰 Driver payout processed: $${(driverPayout / 100).toFixed(2)} to ${driverData.stripeAccountId}`);
        } catch (payoutError) {
          console.error("Failed to process driver payout:", payoutError);
          // Don't throw - ride is still completed, payout can be retried
        }
      } else {
        console.warn(`Driver ${driverId} does not have Stripe Connect configured - payout pending`);
      }

      // Update ride status
      await rideRef.update({
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        revenue: {
          total: totalRevenue / 100,
          platformFee: platformFee / 100,
          driverPayout: driverPayout / 100,
          payoutId,
        },
      });

      console.log(`🎉 Ride completed: ${successfulCharges} charges, revenue=$${(totalRevenue / 100).toFixed(2)}, driver gets=$${(driverPayout / 100).toFixed(2)}, platform=$${(platformFee / 100).toFixed(2)}`);

      // Notify driver of payout
      await createNotification({
        userId: driverId,
        title: "Revenue Processed! 💰",
        body: `Ride completed. Your earnings of $${(driverPayout / 100).toFixed(2)} have been processed.`,
        type: "payment",
        data: { rideId, totalRevenue, driverPayout },
      });

      return {
        success: true,
        message: `Ride completed. Processed ${successfulCharges} passenger(s).`,
        summary: {
          passengerCount: successfulCharges,
          totalRevenue: totalRevenue / 100,
          platformFees: platformFee / 100,
          driverPayout: driverPayout / 100,
          failedCharges,
          payoutId,
        },
      };
    } catch (error: any) {
      console.error("❌ Complete ride error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to complete ride");
    }
  }
);

/**
 * Cancel a Booking (Rider or Driver Action)
 *
 * This function handles booking cancellation by either the rider or the driver.
 * The behavior is the same for both parties.
 *
 * CANCELLATION FLOW:
 * 1. Validates user is either the rider or driver
 * 2. Validates booking is in "pending_driver" or "confirmed" status
 * 3. Atomically restores the reserved seats to the ride
 * 4. Updates booking status to "cancelled" with cancelledBy field
 * 5. Processes Stripe refund/cancellation based on payment state
 * 6. Sends notification to the other party
 *
 * PAYMENT HANDLING:
 * - For pending bookings: Cancel SetupIntent if exists (no funds held)
 * - For authorized payments: Cancel PaymentIntent (releases hold)
 * - For captured payments: Process refund minus cancellation fee
 *
 * CANCELLATION FEES (applied to captured payments):
 * - >24h before departure: 5% fee
 * - 12-24h before departure: 25% fee
 * - <12h before departure: 50% fee
 * - After departure time: No refund
 *
 * @requires auth - User must be either the rider or driver
 * @param bookingId - The ID of the booking to cancel
 * @param reason - Optional cancellation reason
 * @returns { success, message, refund? }
 * @throws unauthenticated - If user is not logged in
 * @throws invalid-argument - If bookingId is missing
 * @throws not-found - If booking doesn't exist
 * @throws permission-denied - If user is not the rider or driver
 * @throws failed-precondition - If booking is not pending_driver or confirmed
 */
export const cancelBooking = onCall({ secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { bookingId, reason } = request.data;
  const userId = request.auth.uid;

  if (!bookingId) {
    throw new HttpsError("invalid-argument", "Missing bookingId");
  }

  try {
    console.log(`🚫 Cancelling booking ${bookingId} by user ${userId}`);

    let bookingData: any;
    let rideData: any;
    let cancelledBy: string;

    // Transaction to update booking and restore seats
    await db.runTransaction(async (transaction) => {
      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingDoc = await transaction.get(bookingRef);

      if (!bookingDoc.exists) {
        throw new HttpsError("not-found", "Booking not found");
      }

      bookingData = bookingDoc.data()!;

      // Verify user is either the rider or driver
      const isRider = bookingData.riderId === userId;
      const isDriver = bookingData.driverId === userId;

      if (!isRider && !isDriver) {
        throw new HttpsError("permission-denied", "You don't have permission to cancel this booking");
      }

      // Can only cancel pending_driver or confirmed bookings
      if (bookingData.status !== "pending_driver" && bookingData.status !== "confirmed") {
        throw new HttpsError("failed-precondition", `Cannot cancel a ${bookingData.status} booking`);
      }

      cancelledBy = isRider ? "rider" : "driver";

      // Get ride data for departure time
      const rideRef = db.collection("rides").doc(bookingData.rideId);
      const rideDoc = await transaction.get(rideRef);
      rideData = rideDoc.exists ? rideDoc.data() : null;

      // Restore seats to the ride
      transaction.update(rideRef, {
        seatsAvailable: admin.firestore.FieldValue.increment(bookingData.seats),
        availableSeats: admin.firestore.FieldValue.increment(bookingData.seats),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update booking status
      transaction.update(bookingRef, {
        status: "cancelled",
        cancelledBy,
        cancellationReason: reason || null,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Booking cancelled, ${bookingData.seats} seats restored`);
    });

    // =========================================================================
    // STRIPE REFUND/CANCELLATION PROCESSING
    // =========================================================================
    let refundResult: { status: string; amount?: number; fee?: number } | null = null;

    const paymentIntentId = bookingData.payment?.paymentIntentId;
    const setupIntentId = bookingData.payment?.setupIntentId;
    const paymentStatus = bookingData.payment?.status;

    if (paymentIntentId || setupIntentId) {
      const stripe = getStripe();

      try {
        if (paymentStatus === "authorized" && paymentIntentId) {
          // Payment was authorized but not captured - cancel to release the hold
          console.log(`💳 Cancelling authorized PaymentIntent ${paymentIntentId}`);
          await stripe.paymentIntents.cancel(paymentIntentId, {
            cancellation_reason: "requested_by_customer",
          }, {
            idempotencyKey: `cancel_pi_${bookingId}`,
          });

          // Update booking with refund info
          await db.collection("bookings").doc(bookingId).update({
            "payment.status": "cancelled",
            "payment.cancelledAt": admin.firestore.FieldValue.serverTimestamp(),
          });

          refundResult = { status: "hold_released" };
          console.log(`✅ PaymentIntent cancelled, hold released`);

        } else if (paymentStatus === "captured" && paymentIntentId) {
          // Payment was captured - need to process refund with cancellation fee
          console.log(`💳 Processing refund for captured PaymentIntent ${paymentIntentId}`);

          // Calculate cancellation fee based on time to departure
          const departureTime = rideData?.departureTime
            ? new Date(rideData.departureTime)
            : null;
          const now = new Date();
          const hoursUntilDeparture = departureTime
            ? (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60)
            : 999; // If no departure time, assume >24h

          let feePercentage: number;
          if (hoursUntilDeparture < 0) {
            // After departure - no refund
            feePercentage = 100;
          } else if (hoursUntilDeparture < 12) {
            feePercentage = 50;
          } else if (hoursUntilDeparture < 24) {
            feePercentage = 25;
          } else {
            feePercentage = 5;
          }

          const totalAmount = bookingData.amountTotal || 0;
          const cancellationFee = Math.round(totalAmount * (feePercentage / 100));
          const refundAmount = totalAmount - cancellationFee;

          if (refundAmount > 0) {
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntentId,
              amount: refundAmount,
              reason: "requested_by_customer",
            }, {
              idempotencyKey: `refund_${bookingId}`,
            });

            // Update booking with refund info
            await db.collection("bookings").doc(bookingId).update({
              "payment.status": "refunded",
              "payment.refundId": refund.id,
              "payment.refundAmount": refundAmount,
              "payment.cancellationFee": cancellationFee,
              "payment.refundedAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            refundResult = {
              status: "refunded",
              amount: refundAmount / 100,
              fee: cancellationFee / 100,
            };
            console.log(`✅ Refund processed: $${(refundAmount / 100).toFixed(2)} (fee: $${(cancellationFee / 100).toFixed(2)})`);
          } else {
            // No refund (after departure or 100% fee)
            await db.collection("bookings").doc(bookingId).update({
              "payment.status": "no_refund",
              "payment.cancellationFee": totalAmount,
              "payment.refundedAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            refundResult = {
              status: "no_refund",
              amount: 0,
              fee: totalAmount / 100,
            };
            console.log(`⚠️ No refund - cancellation fee is 100%`);
          }

        } else if (setupIntentId && !paymentIntentId) {
          // Only SetupIntent exists (pending booking) - no payment to cancel
          console.log(`ℹ️ Booking had only SetupIntent, no payment to cancel`);
          refundResult = { status: "no_payment" };
        }

      } catch (stripeError: any) {
        // Log but don't throw - booking is cancelled, payment team can reconcile
        console.error(`⚠️ Stripe cancellation/refund error for ${bookingId}:`, stripeError);

        // Update booking to note the refund failure
        await db.collection("bookings").doc(bookingId).update({
          "payment.refundError": stripeError.message || "Unknown error",
          "payment.refundFailedAt": admin.firestore.FieldValue.serverTimestamp(),
        });

        refundResult = { status: "refund_failed" };
      }
    }

    // Notify the other party
    const notificationUserId = cancelledBy === "rider" ? bookingData.driverId : bookingData.riderId;
    const cancelledNotif = notificationTemplates.bookingCancelled(cancelledBy);

    await createNotification({
      userId: notificationUserId,
      title: cancelledNotif.title,
      body: cancelledNotif.body,
      type: "booking",
      data: { bookingId, reason },
    });

    return {
      success: true,
      message: "Booking cancelled successfully",
      refund: refundResult,
    };
  } catch (error: any) {
    console.error("❌ Cancel booking error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to cancel booking");
  }
});


// ============================================================================
// BOOKING STATUS CHANGE TRIGGERS - Notifications
// ============================================================================

export const onBookingStatusChanged = onDocumentUpdated(
  { document: "bookings/{bookingId}", secrets: ["EMAIL_USER", "EMAIL_PASSWORD"] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;
    if (before.status === after.status) return; // No status change

    const bookingId = event.params.bookingId;
    const newStatus = after.status;

    console.log(`Booking ${bookingId} status changed: ${before.status} -> ${newStatus}`);

    // Track if we should notify the rider vs driver
    const isNotifyRider = ["confirmed", "accepted", "declined", "rejected", "cancelled", "completed"].includes(newStatus);
    const isNotifyDriver = ["pending_driver", "cancelled", "completed"].includes(newStatus);

    // Restore seats if an accepted booking is cancelled or rejected (rare)
    if (before.status === "accepted" && (newStatus === "cancelled" || newStatus === "rejected")) {
      await db.collection("rides").doc(after.rideId).update({
        seatsAvailable: admin.firestore.FieldValue.increment(after.seatsRequested || 1),
        availableSeats: admin.firestore.FieldValue.increment(after.seatsRequested || 1)
      });
      console.log(`Restored ${after.seatsRequested || 1} seats for ride ${after.rideId}`);
    }

    // Get user details - bookings use riderId, but also support passengerId for backwards compatibility
    const passengerId = after.riderId || after.passengerId;
    if (!passengerId) {
      console.error(`No passenger ID found for booking ${bookingId}`);
      return;
    }

    const [passengerDoc, driverDoc, rideDoc] = await Promise.all([
      db.collection("users").doc(passengerId).get(),
      db.collection("users").doc(after.driverId).get(),
      db.collection("rides").doc(after.rideId).get(),
    ]);

    const passengerData = passengerDoc.data() || {};
    const driverData = driverDoc.data() || {};
    const rideData = rideDoc.data() || {};

    const rideDetails = {
      origin: rideData.from?.name || rideData.origin || after.pickupLocation || "Origin",
      destination: rideData.to?.name || rideData.destination || after.dropoffLocation || "Destination",
      date: rideData.departureTime ? new Date(rideData.departureTime).toLocaleString() : "TBD",
      price: ((after.amountTotal || after.totalPrice || rideData.pricePerSeat * (after.seats || 1) || 0) / 100).toFixed(2),
    };

    // Handle different status changes
    switch (newStatus) {
      case "pending_driver":
        // This is a new request, notify driver
        if (driverData.email) {
          await sendEmail(driverData.email, "newBookingRequest", [
            driverData.name || "Driver",
            passengerData.name || "A rider",
            rideDetails,
          ]);
        }
        const requestNotif = notificationTemplates.newBookingRequest(passengerData.name || "A rider");
        await createNotification({
          userId: after.driverId,
          title: requestNotif.title,
          body: requestNotif.body,
          type: "booking",
          data: { bookingId, rideId: after.rideId },
        });
        break;

      case "confirmed":
      case "accepted":
        // Notify passenger
        if (passengerData.email) {
          await sendEmail(passengerData.email, "bookingAccepted", [
            passengerData.name || "Passenger",
            driverData.name || "Your driver",
            rideDetails,
          ]);
        }
        const acceptedNotif = notificationTemplates.bookingAccepted(driverData.name || "Driver");
        await createNotification({
          userId: passengerId,
          title: acceptedNotif.title,
          body: acceptedNotif.body,
          type: "booking",
          data: { bookingId, rideId: after.rideId },
        });
        break;

      case "declined":
      case "rejected":
        // Notify passenger
        if (passengerData.email) {
          await sendEmail(passengerData.email, "bookingRejected", [
            passengerData.name || "Passenger",
            rideDetails.origin,
            rideDetails.destination,
          ]);
        }
        const rejectedNotif = notificationTemplates.bookingRejected();
        await createNotification({
          userId: passengerId,
          title: rejectedNotif.title,
          body: rejectedNotif.body,
          type: "booking",
          data: { bookingId },
        });
        break;

      case "cancelled":
        // Determine who cancelled
        const cancelledBy = after.cancelledBy || "other party";

        // Notify passenger
        if (passengerData.email) {
          await sendEmail(passengerData.email, "bookingCancelled", [
            passengerData.name || "Passenger",
            cancelledBy,
            rideDetails,
          ]);
        }
        // Notify driver
        if (driverData.email) {
          await sendEmail(driverData.email, "bookingCancelled", [
            driverData.name || "Driver",
            cancelledBy,
            rideDetails,
          ]);
        }

        const cancelledNotif = notificationTemplates.bookingCancelled(cancelledBy);
        await Promise.all([
          createNotification({
            userId: passengerId,
            title: cancelledNotif.title,
            body: cancelledNotif.body,
            type: "booking",
            data: { bookingId },
          }),
          createNotification({
            userId: after.driverId,
            title: cancelledNotif.title,
            body: cancelledNotif.body,
            type: "booking",
            data: { bookingId },
          }),
        ]);
        break;

      case "completed":
        // Notify both parties
        if (passengerData.email) {
          await sendEmail(passengerData.email, "rideCompleted", [
            passengerData.name || "Passenger",
            rideDetails,
            false,
          ]);
        }
        if (driverData.email) {
          await sendEmail(driverData.email, "rideCompleted", [
            driverData.name || "Driver",
            rideDetails,
            true,
          ]);
        }

        const completedNotif = notificationTemplates.rideCompleted();
        await Promise.all([
          createNotification({
            userId: passengerId,
            title: completedNotif.title,
            body: completedNotif.body,
            type: "ride",
            data: { bookingId, rideId: after.rideId },
          }),
          createNotification({
            userId: after.driverId,
            title: completedNotif.title,
            body: completedNotif.body,
            type: "ride",
            data: { bookingId, rideId: after.rideId },
          }),
        ]);
        break;
    }
  });

// ============================================================================
// RIDE STATUS CHANGE TRIGGERS - Propagate to Bookings
// ============================================================================

export const onRideStatusChanged = onDocumentUpdated(
  { document: "rides/{rideId}", secrets: ["EMAIL_USER", "EMAIL_PASSWORD"] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;
    if (before.status === after.status) return; // No status change

    const rideId = event.params.rideId;
    const newStatus = after.status;

    console.log(`🚗 Ride ${rideId} status changed: ${before.status} -> ${newStatus}`);

    // Handle ride completion - propagate to all confirmed bookings
    if (newStatus === "completed") {
      try {
        // Get all confirmed bookings for this ride
        const bookingsSnapshot = await db.collection("bookings")
          .where("rideId", "==", rideId)
          .where("status", "==", "confirmed")
          .get();

        if (bookingsSnapshot.empty) {
          console.log(`No confirmed bookings found for ride ${rideId}`);
          return;
        }

        console.log(`📋 Found ${bookingsSnapshot.size} confirmed bookings to mark as completed`);

        // Update all confirmed bookings to completed in a batch
        const batch = db.batch();
        bookingsSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();

        console.log(`✅ Updated ${bookingsSnapshot.size} bookings to completed for ride ${rideId}`);
        // The onBookingStatusChanged trigger will now fire for each booking and send completion emails
      } catch (error) {
        console.error(`❌ Error updating bookings for completed ride ${rideId}:`, error);
      }
    }

    // Handle ride starting - mark ride as active
    if (newStatus === "active" && before.status === "upcoming") {
      console.log(`🚗 Ride ${rideId} has started`);
      // Ride is now in progress - bookings remain confirmed until completion
    }
  }
);

// ============================================================================
// PAYMENT FUNCTIONS
// ============================================================================

export const processPayment = onCall({ secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { bookingId, amount, paymentMethodId } = request.data;

  // Validate inputs
  if (!bookingId || !amount) {
    throw new HttpsError("invalid-argument", "Missing bookingId or amount");
  }

  try {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      throw new HttpsError("not-found", "Booking not found");
    }

    const bookingData = bookingDoc.data()!;

    // Verify user is the passenger
    if (bookingData.passengerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only the passenger can make payment");
    }

    // Check if Stripe key is configured
    const stripe = getStripe();

    // Create and confirm PaymentIntent
    // Note: In a full production app, you might split this into create and confirm steps
    // or use Ephemeral Keys for the mobile SDK. This is a direct charge approach.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "aud",
      payment_method: paymentMethodId, // Optional: if provided, we try to confirm immediately
      confirm: !!paymentMethodId,
      metadata: {
        bookingId,
        passengerId: request.auth.uid,
      },
      // Only include return_url if confirm is true (required by Stripe API)
      ...(paymentMethodId ? { return_url: "myapp://payment-complete" } : {}),
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never", // For this simple flow, we want immediate confirmation or error
      },
    }, {
      idempotencyKey: `booking_${bookingId}_${Math.round(amount * 100)}`, // Prevent double charges
    });

    if (paymentIntent.status === "succeeded") {
      // Payment successful immediately
      await bookingRef.update({
        paymentStatus: "paid",
        paymentId: paymentIntent.id,
        paidAmount: amount,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notifications
      const passengerDoc = await db.collection("users").doc(request.auth.uid).get();
      const passengerData = passengerDoc.data() || {};

      if (passengerData.email) {
        await sendEmail(passengerData.email, "paymentSuccess", [
          passengerData.name || "Customer",
          amount,
          bookingId,
        ]);
      }

      const paymentNotif = notificationTemplates.paymentSuccess(amount);
      await createNotification({
        userId: request.auth.uid,
        title: paymentNotif.title,
        body: paymentNotif.body,
        type: "payment",
        data: { bookingId, paymentId: paymentIntent.id, amount },
      });

      return {
        success: true,
        paymentId: paymentIntent.id,
        message: "Payment processed successfully",
        clientSecret: paymentIntent.client_secret,
      };
    } else {
      // Payment requires more action (3DS, etc.) or failed
      return {
        success: false,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        message: "Payment requires further action",
        paymentId: paymentIntent.id,
      };
    }

  } catch (error: any) {
    console.error("Error processing payment:", error);

    // Send payment failed notification if it was a payment error
    if (error.type === "StripeCardError") {
      const passengerDoc = await db.collection("users").doc(request.auth!.uid).get();
      const passengerData = passengerDoc.data() || {};

      if (passengerData.email) {
        await sendEmail(passengerData.email, "paymentFailed", [
          passengerData.name || "Customer",
          amount,
        ]);
      }

      const failedNotif = notificationTemplates.paymentFailed();
      await createNotification({
        userId: request.auth!.uid,
        title: failedNotif.title,
        body: failedNotif.body,
        type: "payment",
        data: { bookingId, error: error.message },
      });
    }

    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Payment failed");
  }
});

export const capturePayment = onCall({ secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { paymentIntentId, bookingId } = request.data;

  if (!paymentIntentId || !bookingId) {
    throw new HttpsError("invalid-argument", "Missing paymentIntentId or bookingId");
  }

  try {
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw new HttpsError("not-found", "Booking not found");
    }

    const bookingData = bookingDoc.data()!;

    // Verify user is the DRIVER of the ride (only driver can capture by accepting)
    // Or maybe we should allow the system to do it? 
    // Secure approach: Check if request.auth.uid is the driverId stored in booking
    if (bookingData.driverId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only the driver can capture payment");
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      await bookingDoc.ref.update({
        "payment.status": "captured",
        paymentStatus: "paid", // Legacy field compatibility
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, status: paymentIntent.status };
    } else {
      throw new HttpsError("aborted", `Capture failed: ${paymentIntent.status}`);
    }
  } catch (error: any) {
    console.error("Error capturing payment:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Capture failed");
  }
});

export const createStripeConnectAccount = onCall({ secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const userId = request.auth.uid;
  const userRef = db.collection("users").doc(userId);

  try {
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    let accountId = userData?.stripeAccountId;

    const stripe = getStripe();

    // Validate that we have user data
    if (!userData) {
      throw new HttpsError("failed-precondition", "User data not found");
    }

    // CRITICAL: Validate phone number exists
    if (!userData.phone) {
      throw new HttpsError(
        "failed-precondition",
        "Phone number is required for Stripe Connect setup. Please update your profile."
      );
    }

    // Sanitize phone number (remove spaces, ensure proper format)
    const sanitizedPhone = userData.phone.trim().replace(/\s+/g, '');

    // Validate phone format (basic check for Australian numbers)
    if (!sanitizedPhone.startsWith('+61') && !sanitizedPhone.startsWith('04')) {
      throw new HttpsError(
        "invalid-argument",
        "Phone number must be valid Australian format (+61... or 04...)"
      );
    }

    // Convert 04... to +61... format for consistency
    const normalizedPhone = sanitizedPhone.startsWith('04')
      ? '+61' + sanitizedPhone.substring(1)
      : sanitizedPhone;

    // Parse name for prefilling - each user should have unique data
    const nameParts = userData?.name?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    console.log(`🔍 Stripe Connect setup for user ${userId}:`, {
      email: userData.email,
      firstName,
      lastName,
      phone: normalizedPhone,
      existingAccountId: accountId || 'none',
    });

    // Check if existing account has stale/different data - if so, delete and recreate
    if (accountId) {
      try {
        const existingAccount = await stripe.accounts.retrieve(accountId);
        const existingFirstName = existingAccount.individual?.first_name || '';
        const existingLastName = existingAccount.individual?.last_name || '';
        const existingEmail = existingAccount.email || '';

        console.log(`📋 Existing Stripe account data:`, {
          existingFirstName,
          existingLastName,
          existingEmail,
          currentFirstName: firstName,
          currentLastName: lastName,
          currentEmail: userData.email,
        });

        // Check if data matches current user data
        const dataMatches =
          existingFirstName.toLowerCase() === firstName.toLowerCase() &&
          existingLastName.toLowerCase() === lastName.toLowerCase();

        if (!dataMatches && existingAccount.details_submitted !== true) {
          // Account has different data AND onboarding not completed - delete and recreate
          console.log(`⚠️ Stale account detected with mismatched data. Deleting account ${accountId}...`);

          try {
            await stripe.accounts.del(accountId);
            console.log(`🗑️ Deleted stale Stripe account ${accountId}`);
            accountId = null; // Will create fresh account below

            // Clear from Firestore
            await userRef.update({
              stripeAccountId: null,
              stripeConnectStatus: null,
              stripeConnectPhone: null,
            });
          } catch (deleteError: any) {
            console.error(`Could not delete account (may have active payouts):`, deleteError.message);
            // If we can't delete, try to update instead
          }
        } else if (dataMatches) {
          console.log(`✅ Existing account data matches current user - reusing account`);
        } else {
          console.log(`⚠️ Account has submitted details, cannot delete - will use existing`);
        }
      } catch (retrieveError: any) {
        console.warn(`Could not retrieve existing account (may be invalid): ${retrieveError.message}`);
        accountId = null; // Account doesn't exist or is invalid, create fresh
        await userRef.update({
          stripeAccountId: null,
          stripeConnectStatus: null,
        });
      }
    }

    // Create new Stripe Express Account if needed
    if (!accountId) {
      console.log(`🆕 Creating fresh Stripe Connect account for user ${userId}`);

      // IMPORTANT: Create account with VALIDATED, user-specific data
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: userData?.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        individual: {
          email: userData?.email,
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          // Note: dob and address must be provided by user during onboarding
        },
        settings: {
          payouts: {
            debit_negative_balances: true,
            schedule: {
              delay_days: 2,
              interval: 'daily',
            },
          },
        },
        metadata: {
          userId,
          appName: 'CarpoolConnect',
          userPhone: normalizedPhone,
          createdAt: new Date().toISOString(),
          userName: userData?.name || '',
        },
      });
      accountId = account.id;

      console.log(`✅ Created Stripe account ${accountId} for user ${userId} (${firstName} ${lastName})`);

      // Save ID to Firestore
      await userRef.update({
        stripeAccountId: accountId,
        stripeConnectStatus: 'created',
        stripeConnectPhone: normalizedPhone,
        stripeConnectName: userData?.name,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Generate account link for onboarding
    console.log(`🔗 Generating account link for ${accountId}`);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: "myapp://stripe-connect-refresh",
      return_url: "myapp://stripe-connect-return",
      type: "account_onboarding",
      collect: "eventually_due", // Only collect what's needed NOW, defer rest
    });

    return {
      url: accountLink.url,
      accountId: accountId
    };

  } catch (error: any) {
    console.error("Error creating Stripe Connect account:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to create Connect account");
  }
});

// ============================================================================
// SCHEDULED FUNCTIONS - Ride Reminders
// NOTE: Scheduler temporarily disabled for deployment compatibility.
// TODO: Re-enable after upgrading Firebase CLI or using Cloud Scheduler directly
// ============================================================================

/*
 * TODO: Re-enable after creating App Engine default service account  
 * Error: Default service account 'carpoolconnect1-0@appspot.gserviceaccount.com' doesn't exist
 * Alternative: Use HTTP trigger with Cloud Scheduler
 */
/*
export const sendRideReminders = functionsV1.pubsub
  .schedule("every 15 minutes")
  .onRun(async () => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

    console.log(`Checking for rides between ${fifteenMinutesFromNow.toISOString()} and ${oneHourFromNow.toISOString()}`);

    try {
      // Find rides departing in the next hour that haven't been reminded
      const ridesSnapshot = await db.collection("rides")
        .where("departureTime", ">=", fifteenMinutesFromNow.toISOString())
        .where("departureTime", "<=", oneHourFromNow.toISOString())
        .where("status", "==", "active")
        .get();

      for (const rideDoc of ridesSnapshot.docs) {
        const rideData = rideDoc.data();
        const rideId = rideDoc.id;

        // Check if reminder already sent
        if (rideData.reminderSent) continue;

        const rideDetails = {
          origin: rideData.origin,
          destination: rideData.destination,
        };

        // Get driver info
        const driverDoc = await db.collection("users").doc(rideData.driverId).get();
        const driverData = driverDoc.data() || {};

        // Send driver reminder
        if (driverData.email) {
          await sendEmail(driverData.email, "rideReminder", [
            driverData.name || "Driver",
            rideDetails,
            true,
          ]);
        }

        const reminderNotif = notificationTemplates.rideReminder(60);
        await createNotification({
          userId: rideData.driverId,
          title: reminderNotif.title,
          body: reminderNotif.body,
          type: "reminder",
          data: { rideId },
        });

        // Get accepted bookings for this ride
        const bookingsSnapshot = await db.collection("bookings")
          .where("rideId", "==", rideId)
          .where("status", "==", "accepted")
          .get();

        for (const bookingDoc of bookingsSnapshot.docs) {
          const bookingData = bookingDoc.data();
          const passengerDoc = await db.collection("users").doc(bookingData.passengerId).get();
          const passengerData = passengerDoc.data() || {};

          // Send passenger reminder
          if (passengerData.email) {
            await sendEmail(passengerData.email, "rideReminder", [
              passengerData.name || "Passenger",
              rideDetails,
              false,
            ]);
          }

          await createNotification({
            userId: bookingData.passengerId,
            title: reminderNotif.title,
            body: reminderNotif.body,
            type: "reminder",
            data: { rideId, bookingId: bookingDoc.id },
          });
        }

        // Mark reminder as sent
        await db.collection("rides").doc(rideId).update({
          reminderSent: true,
        });
      }

      console.log(`Processed ${ridesSnapshot.docs.length} rides for reminders`);
    } catch (error) {
      console.error("Error sending ride reminders:", error);
    }

    return null;
  });
*/

// ============================================================================
// STRIPE WEBHOOKS
// ============================================================================

export const stripeWebhook = onRequest({ secrets: ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"] }, async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    res.status(400).send("Webhook Error: Missing signature or secret");
    return;
  }

  let event: Stripe.Event;

  try {
    // Access rawBody which is available in Cloud Functions environment
    const rawBody = (req as any).rawBody;
    event = getStripe().webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Webhook: PaymentIntent succeeded ${paymentIntent.id}`);

        // Example: logic to idempotently update booking status if not already paid
        // const bookingId = paymentIntent.metadata.bookingId;
        // if (bookingId) { ... }
        break;
      case "payment_intent.payment_failed":
        const paymentFailed = event.data.object as Stripe.PaymentIntent;
        console.error(`Webhook: PaymentIntent failed ${paymentFailed.id}`);
        break;
      default:
        console.log(`Webhook: Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ============================================================================
// RIDE REMINDERS - Automated notifications before ride departure
// ============================================================================

/**
 * Send ride reminders for upcoming rides
 * Called by Cloud Scheduler every 15 minutes
 * Notifies drivers and passengers 15-60 minutes before departure
 */
export const sendRideReminders = onRequest(
  { secrets: ["EMAIL_USER", "EMAIL_PASSWORD"] }, // SCHEDULER_AUTH_TOKEN optional
  async (req, res) => {
    // Verify the request is from Cloud Scheduler
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.SCHEDULER_AUTH_TOKEN;

    if (!expectedToken) {
      console.warn("SCHEDULER_AUTH_TOKEN not configured");
      res.status(500).json({ success: false, error: "Server configuration error" });
      return;
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      console.warn("Unauthorized reminder request attempt");
      res.status(401).send("Unauthorized");
      return;
    }

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

    console.log(`🔔 Checking for rides between ${fifteenMinutesFromNow.toISOString()} and ${oneHourFromNow.toISOString()}`);

    try {
      // Find rides departing in the next hour that haven't been reminded
      const ridesSnapshot = await db
        .collection("rides")
        .where("departureTime", ">=", fifteenMinutesFromNow.toISOString())
        .where("departureTime", "<=", oneHourFromNow.toISOString())
        .where("status", "==", "upcoming")
        .get();

      let processedCount = 0;
      let skippedCount = 0;

      for (const rideDoc of ridesSnapshot.docs) {
        const rideData = rideDoc.data();
        const rideId = rideDoc.id;

        // Check if reminder already sent
        if (rideData.reminderSent) {
          skippedCount++;
          continue;
        }

        const rideDetails = {
          origin: rideData.origin,
          destination: rideData.destination,
        };

        // Get driver info
        const driverDoc = await db.collection("users").doc(rideData.driverId).get();
        const driverData = driverDoc.data() || {};

        // Send driver reminder
        if (driverData.email) {
          await sendEmail(driverData.email, "rideReminder", [
            driverData.name || "Driver",
            rideDetails,
            true,
          ]);
        }

        const reminderNotif = notificationTemplates.rideReminder(60);
        await createNotification({
          userId: rideData.driverId,
          title: reminderNotif.title,
          body: reminderNotif.body,
          type: "reminder",
          data: { rideId },
        });

        // Get accepted bookings for this ride
        const bookingsSnapshot = await db
          .collection("bookings")
          .where("rideId", "==", rideId)
          .where("status", "==", "confirmed")
          .get();

        // Send reminders to all passengers
        for (const bookingDoc of bookingsSnapshot.docs) {
          const bookingData = bookingDoc.data();
          const passengerId = bookingData.passengerId || bookingData.riderId;

          if (!passengerId) continue;

          const passengerDoc = await db.collection("users").doc(passengerId).get();
          const passengerData = passengerDoc.data() || {};

          // Send passenger reminder email
          if (passengerData.email) {
            await sendEmail(passengerData.email, "rideReminder", [
              passengerData.name || "Passenger",
              rideDetails,
              false,
            ]);
          }

          // Send in-app notification
          await createNotification({
            userId: passengerId,
            title: reminderNotif.title,
            body: reminderNotif.body,
            type: "reminder",
            data: { rideId, bookingId: bookingDoc.id },
          });
        }

        // Mark reminder as sent
        await db.collection("rides").doc(rideId).update({
          reminderSent: true,
          reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        processedCount++;
        console.log(`✅ Sent reminders for ride ${rideId} (${bookingsSnapshot.size} passengers)`);
      }

      const message = `Processed ${processedCount} rides, skipped ${skippedCount} (already reminded)`;
      console.log(`🎉 Ride reminders complete: ${message}`);

      res.status(200).json({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        message,
      });
    } catch (error) {
      console.error("❌ Error sending ride reminders:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  }
);

// ============================================================================
// DRIVER PAYOUTS - Process earnings for completed rides
// ============================================================================

/**
 * Process payout to driver for a completed booking
 * Transfers earnings (minus platform fee) to driver's Stripe Connect account
 */
export const processDriverPayout = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in");
    }

    const { bookingId } = request.data;
    const driverId = request.auth.uid;

    if (!bookingId) {
      throw new HttpsError("invalid-argument", "Missing bookingId");
    }

    try {
      console.log(`💰 Processing payout for booking ${bookingId} by driver ${driverId}`);

      // Get booking details
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      if (!bookingDoc.exists) {
        throw new HttpsError("not-found", "Booking not found");
      }

      const bookingData = bookingDoc.data()!;

      // Verify user is the driver
      if (bookingData.driverId !== driverId) {
        throw new HttpsError(
          "permission-denied",
          "Only the driver can request payout for this booking"
        );
      }

      // Check if booking is completed
      if (bookingData.status !== "completed") {
        throw new HttpsError(
          "failed-precondition",
          "Can only process payouts for completed rides"
        );
      }

      // Check if payment was received
      if (bookingData.paymentStatus !== "paid") {
        throw new HttpsError(
          "failed-precondition",
          "Payment must be completed before payout"
        );
      }

      // Check if payout already processed
      if (bookingData.payoutStatus === "paid") {
        throw new HttpsError("already-exists", "Payout already processed for this booking");
      }

      // Get driver's Stripe account
      const driverDoc = await db.collection("users").doc(driverId).get();
      const driverData = driverDoc.data();

      if (!driverData?.stripeAccountId) {
        throw new HttpsError(
          "failed-precondition",
          "You must set up Stripe Connect in your profile before receiving payouts"
        );
      }

      // Check if Stripe Connect is active
      if (driverData.stripeConnectStatus !== "active") {
        throw new HttpsError(
          "failed-precondition",
          "Your Stripe Connect account is not fully activated. Please complete the setup."
        );
      }

      // Calculate amounts (platform takes 10% fee)
      const totalAmount = bookingData.amountTotal || 0; // Amount in cents
      const platformFeePercent = 0.1; // 10% platform fee
      const platformFee = Math.round(totalAmount * platformFeePercent);
      const driverAmount = totalAmount - platformFee;

      console.log(`💵 Payout calculation: Total=${totalAmount} cents, Fee=${platformFee} cents, Driver=${driverAmount} cents`);

      // Create Stripe transfer to driver's connected account
      const stripe = getStripe();

      console.log(`🔄 Creating Stripe transfer to account ${driverData.stripeAccountId}`);

      const transfer = await stripe.transfers.create({
        amount: driverAmount,
        currency: "aud",
        destination: driverData.stripeAccountId,
        description: `Payout for booking ${bookingId}`,
        metadata: {
          bookingId,
          driverId,
          rideId: bookingData.rideId,
        },
      });

      console.log(`✅ Stripe transfer created: ${transfer.id}`);

      // Update booking with payout information
      await bookingDoc.ref.update({
        payoutStatus: "paid",
        payoutId: transfer.id,
        payoutAmount: driverAmount / 100, // Store in dollars for display
        platformFee: platformFee / 100,
        payoutAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send confirmation notification to driver
      await createNotification({
        userId: driverId,
        title: "💰 Payout Processed",
        body: `Your earnings of $${(driverAmount / 100).toFixed(2)} have been transferred to your account`,
        type: "payment",
        data: { bookingId, transferId: transfer.id },
      });

      console.log(`🎉 Payout processed successfully for driver ${driverId}`);

      return {
        success: true,
        payoutId: transfer.id,
        amount: driverAmount / 100,
        platformFee: platformFee / 100,
        message: "Payout processed successfully",
      };
    } catch (error: any) {
      console.error("❌ Error processing payout:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to process payout");
    }
  }
);

/**
 * Process payouts for all eligible bookings (batch processing)
 * Called by Cloud Scheduler or admin
 */
export const processAutomaticPayouts = onRequest(
  { secrets: ["STRIPE_SECRET_KEY"] }, // SCHEDULER_AUTH_TOKEN optional
  async (req, res) => {
    // Verify authorization
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.SCHEDULER_AUTH_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      console.log("💰 Starting automatic payout processing");

      // Find completed bookings that haven't been paid out yet
      // Only process bookings completed more than 24 hours ago (cooling period)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const eligibleBookings = await db
        .collection("bookings")
        .where("status", "==", "completed")
        .where("paymentStatus", "==", "paid")
        .where("payoutStatus", "==", "pending")
        .where("updatedAt", "<=", oneDayAgo)
        .limit(50) // Process in batches
        .get();

      let successCount = 0;
      let failCount = 0;

      for (const bookingDoc of eligibleBookings.docs) {
        try {
          const bookingData = bookingDoc.data();
          const driverId = bookingData.driverId;

          // Get driver data
          const driverDoc = await db.collection("users").doc(driverId).get();
          const driverData = driverDoc.data();

          if (!driverData?.stripeAccountId || driverData.stripeConnectStatus !== "active") {
            console.log(`⏭️ Skipping booking ${bookingDoc.id}: Driver Stripe not ready`);
            continue;
          }

          // Calculate payout
          const totalAmount = bookingData.amountTotal || 0;
          const platformFee = Math.round(totalAmount * 0.1);
          const driverAmount = totalAmount - platformFee;

          const stripe = getStripe();
          const transfer = await stripe.transfers.create({
            amount: driverAmount,
            currency: "aud",
            destination: driverData.stripeAccountId,
            metadata: {
              bookingId: bookingDoc.id,
              driverId,
              rideId: bookingData.rideId,
            },
          });

          // Update booking
          await bookingDoc.ref.update({
            payoutStatus: "paid",
            payoutId: transfer.id,
            payoutAmount: driverAmount / 100,
            platformFee: platformFee / 100,
            payoutAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          successCount++;
          console.log(`✅ Processed payout for booking ${bookingDoc.id}`);
        } catch (error) {
          failCount++;
          console.error(`❌ Failed to process payout for booking ${bookingDoc.id}:`, error);
        }
      }

      const message = `Processed ${successCount} payouts, ${failCount} failed`;
      console.log(`🎉 Automatic payouts complete: ${message}`);

      res.status(200).json({
        success: true,
        processed: successCount,
        failed: failCount,
        message,
      });
    } catch (error) {
      console.error("❌ Error in automatic payout processing:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  }
);

// ============================================================================
// RIDE STATUS CLEANUP - Mark expired rides
// ============================================================================

/**
 * Update rides that are past their departure time
 * Marks them as "expired" to keep data clean
 */
export const updateExpiredRides = onRequest(
  { secrets: [] }, // SCHEDULER_AUTH_TOKEN optional
  async (req, res) => {
    // Verify authorization
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.SCHEDULER_AUTH_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      res.status(401).send("Unauthorized");
      return;
    }

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    console.log(`🧹 Checking for expired rides (before ${twoHoursAgo.toISOString()})`);

    try {
      // Find rides that are past their departure time but still marked as "upcoming"
      const expiredRidesSnapshot = await db
        .collection("rides")
        .where("status", "==", "upcoming")
        .where("departureTime", "<=", twoHoursAgo.toISOString())
        .get();

      const batch = db.batch();
      let count = 0;

      expiredRidesSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: "expired",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
      });

      if (count > 0) {
        await batch.commit();
        console.log(`✅ Updated ${count} expired rides`);
      } else {
        console.log("✨ No expired rides found");
      }

      res.status(200).json({
        success: true,
        updated: count,
        message: `Updated ${count} expired rides`,
      });
    } catch (error) {
      console.error("❌ Error updating expired rides:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  }
);

// ============================================================================
// STRIPE PAYMENT INTENT (FOR RIDERS)
// ============================================================================

export const createPaymentIntent = onCall({
  secrets: ["STRIPE_SECRET_KEY"],
  // Set timeout to 30 seconds (default is 60, we want faster failure)
  timeoutSeconds: 30,
}, async (request) => {
  const startTime = Date.now();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { amount, currency = "aud", rideId, bookingId, seats } = request.data;
  const userId = request.auth.uid;
  const email = request.auth.token.email;
  const name = request.auth.token.name || "CarpoolUser";

  if (!amount) {
    throw new HttpsError("invalid-argument", "Missing amount");
  }

  try {
    const stripe = getStripe();

    // 1. Get or Create Stripe Customer (required sequentially)
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    let customerId = userDoc.data()?.stripeCustomerId;

    if (!customerId) {
      // Create new customer
      console.log(`Creating new Stripe customer for user ${userId}`);
      const customer = await stripe.customers.create({
        email: email,
        name: name,
        metadata: { firebaseUID: userId },
      });
      customerId = customer.id;
      // Fire-and-forget Firestore write (don't await)
      userRef.set({ stripeCustomerId: customerId }, { merge: true })
        .catch(err => console.error("Background customer save failed:", err));
    }

    // 2. Create Ephemeral Key and Payment Intent IN PARALLEL
    // This is the key optimization - these two operations don't depend on each other
    const [ephemeralKey, paymentIntent] = await Promise.all([
      stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: "2023-10-16" }
      ),
      stripe.paymentIntents.create({
        amount: parseInt(amount),
        currency: currency,
        customer: customerId,
        setup_future_usage: 'off_session', // Save card for future use
        capture_method: 'manual', // Authorize only
        metadata: {
          userId,
          rideId,
          bookingId: bookingId || 'new_booking',
          seats: String(seats),
        },
        description: `Carpool Ride: ${seats} seat(s)`,
      }),
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Payment intent created in ${duration}ms`);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customerId: customerId,
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Error creating payment intent (${duration}ms):`, error);
    throw new HttpsError("internal", error.message || "Failed to create payment intent");
  }
});

// ============================================================================
// SCHEDULED CLEANUP FUNCTIONS
// ============================================================================

/**
 * Cleanup expired pending bookings
 * Runs every hour to expire booking requests that drivers haven't responded to within 48 hours.
 * This prevents seat deadlock where seats remain locked indefinitely.
 */
export const cleanupExpiredBookings = onSchedule("every 1 hours", async () => {
  console.log("🧹 Starting expired bookings cleanup...");

  const now = new Date();
  // Expire bookings older than 48 hours
  const cutoffTime = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  try {
    // Find all pending_driver bookings older than cutoff
    const expiredBookingsSnapshot = await db
      .collection("bookings")
      .where("status", "==", "pending_driver")
      .where("createdAt", "<", cutoffTime)
      .get();

    if (expiredBookingsSnapshot.empty) {
      console.log("✅ No expired bookings found");
      return;
    }

    console.log(`📋 Found ${expiredBookingsSnapshot.size} expired bookings to process`);

    let expiredCount = 0;
    let errorCount = 0;

    for (const bookingDoc of expiredBookingsSnapshot.docs) {
      try {
        const bookingData = bookingDoc.data();
        const bookingId = bookingDoc.id;
        const rideId = bookingData.rideId;
        const seats = bookingData.seats || 1;
        const riderId = bookingData.riderId || bookingData.passengerId;
        const driverId = bookingData.driverId;

        await db.runTransaction(async (transaction) => {
          // Get current booking state
          const bookingRef = db.collection("bookings").doc(bookingId);
          const currentBookingDoc = await transaction.get(bookingRef);

          if (!currentBookingDoc.exists) {
            console.log(`⚠️ Booking ${bookingId} no longer exists`);
            return;
          }

          const currentBookingData = currentBookingDoc.data();

          // Only process if still in pending_driver state (avoid race conditions)
          if (currentBookingData?.status !== "pending_driver") {
            console.log(`⚠️ Booking ${bookingId} status changed to ${currentBookingData?.status}`);
            return;
          }

          // Get ride to restore seats
          const rideRef = db.collection("rides").doc(rideId);
          const rideDoc = await transaction.get(rideRef);

          if (rideDoc.exists) {
            const rideData = rideDoc.data();
            const currentSeats = rideData?.availableSeats ?? rideData?.seatsAvailable ?? 0;
            const totalSeats = rideData?.totalSeats ?? rideData?.seatsTotal ?? 4;
            // Restore seats but don't exceed total
            const newSeats = Math.min(currentSeats + seats, totalSeats);

            transaction.update(rideRef, {
              availableSeats: newSeats,
              seatsAvailable: newSeats,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          // Mark booking as expired
          transaction.update(bookingRef, {
            status: "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            expiredReason: "Driver did not respond within 48 hours",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        // Send notifications outside transaction
        if (riderId) {
          await createNotification({
            userId: riderId,
            title: "Booking Request Expired",
            body: "Your booking request expired because the driver did not respond within 48 hours. Please try booking another ride.",
            type: "booking",
            data: { bookingId, rideId },
          });
        }

        if (driverId) {
          await createNotification({
            userId: driverId,
            title: "Booking Request Expired",
            body: "A booking request expired because it wasn't responded to within 48 hours.",
            type: "booking",
            data: { bookingId, rideId },
          });
        }

        expiredCount++;
        console.log(`✅ Expired booking ${bookingId}`);
      } catch (bookingError) {
        errorCount++;
        console.error(`❌ Error expiring booking ${bookingDoc.id}:`, bookingError);
      }
    }

    console.log(`🧹 Cleanup complete: ${expiredCount} expired, ${errorCount} errors`);
  } catch (error) {
    console.error("❌ Fatal error in cleanupExpiredBookings:", error);
    throw error;
  }
});

/**
 * Retry failed payment authorizations
 * Runs every hour to retry payment authorizations that failed, up to 3 attempts.
 * After 3 failures, marks booking as payment_failed and auto-cancels.
 */
export const retryFailedPaymentAuthorizations = onSchedule("every 1 hours", async () => {
  console.log("💳 Starting failed payment authorization retry...");

  const MAX_RETRIES = 3;

  try {
    // Find bookings with failed authorization that haven't exceeded retry limit
    const failedAuthSnapshot = await db
      .collection("bookings")
      .where("status", "==", "confirmed")
      .where("payment.status", "==", "authorization_failed")
      .get();

    if (failedAuthSnapshot.empty) {
      console.log("✅ No failed authorizations to retry");
      return;
    }

    console.log(`📋 Found ${failedAuthSnapshot.size} failed authorizations to process`);

    const stripe = getStripe();
    let retryCount = 0;
    let failedPermanentlyCount = 0;

    for (const bookingDoc of failedAuthSnapshot.docs) {
      const bookingData = bookingDoc.data();
      const bookingId = bookingDoc.id;
      const currentRetries = bookingData.payment?.authorizationRetries || 0;

      if (currentRetries >= MAX_RETRIES) {
        // Max retries reached - mark as permanently failed
        console.log(`❌ Booking ${bookingId} exceeded max retries (${MAX_RETRIES})`);

        await db.runTransaction(async (transaction) => {
          const bookingRef = db.collection("bookings").doc(bookingId);
          const rideRef = db.collection("rides").doc(bookingData.rideId);

          const rideDoc = await transaction.get(rideRef);
          if (rideDoc.exists) {
            const rideData = rideDoc.data();
            const currentSeats = rideData?.availableSeats ?? 0;
            const totalSeats = rideData?.totalSeats ?? 4;
            const newSeats = Math.min(currentSeats + (bookingData.seats || 1), totalSeats);

            transaction.update(rideRef, {
              availableSeats: newSeats,
              seatsAvailable: newSeats,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          transaction.update(bookingRef, {
            status: "payment_failed",
            "payment.status": "permanently_failed",
            "payment.failedAt": admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        // Notify rider
        const riderId = bookingData.riderId || bookingData.passengerId;
        if (riderId) {
          await createNotification({
            userId: riderId,
            title: "Payment Failed - Booking Cancelled",
            body: "We couldn't authorize your payment after multiple attempts. Your booking has been cancelled. Please update your payment method and try again.",
            type: "payment",
            data: { bookingId, rideId: bookingData.rideId },
          });
        }

        failedPermanentlyCount++;
        continue;
      }

      // Attempt retry
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: bookingData.amountTotal,
          currency: "aud",
          customer: bookingData.payment.customerId,
          payment_method: bookingData.payment.paymentMethodId,
          confirm: true,
          capture_method: "manual",
          metadata: {
            bookingId,
            rideId: bookingData.rideId,
            riderId: bookingData.riderId,
            retryAttempt: String(currentRetries + 1),
          },
        }, {
          idempotencyKey: `retry_auth_${bookingId}_${currentRetries + 1}`,
        });

        if (paymentIntent.status === "requires_capture") {
          // Success!
          await bookingDoc.ref.update({
            "payment.status": "authorized",
            "payment.intentId": paymentIntent.id,
            "payment.authorizedAt": admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`✅ Successfully re-authorized booking ${bookingId}`);
          retryCount++;
        } else {
          // Still failing
          await bookingDoc.ref.update({
            "payment.authorizationRetries": currentRetries + 1,
            "payment.lastRetryAt": admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (stripeError: any) {
        console.error(`❌ Retry failed for booking ${bookingId}:`, stripeError.message);
        await bookingDoc.ref.update({
          "payment.authorizationRetries": currentRetries + 1,
          "payment.lastRetryAt": admin.firestore.FieldValue.serverTimestamp(),
          "payment.lastRetryError": stripeError.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    console.log(`💳 Retry complete: ${retryCount} successful, ${failedPermanentlyCount} permanently failed`);
  } catch (error) {
    console.error("❌ Fatal error in retryFailedPaymentAuthorizations:", error);
    throw error;
  }
});

// ============================================================================
// DRIVER DOCUMENT EXPIRY CHECK - Scheduled Daily
// ============================================================================

/**
 * Scheduled function to check for expired driver documents
 * Runs daily at 2 AM to:
 * 1. Mark expired drivers as 'expired' status
 * 2. Send 30-day warning notifications for upcoming expirations
 * 3. Notify drivers when their approval expires
 */
export const checkDriverExpirations = onSchedule("every day 02:00", async () => {
  console.log("🔍 Starting daily driver expiry check...");

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let expiredCount = 0;
  let warningCount = 0;

  try {
    // Get all approved drivers with an expiry date
    const approvedDriversSnapshot = await db.collection("users")
      .where("driverApproval.status", "==", "approved")
      .where("driverApproval.expiryDate", "!=", null)
      .get();

    console.log(`Found ${approvedDriversSnapshot.size} approved drivers with expiry dates`);

    for (const userDoc of approvedDriversSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const expiryDate = new Date(userData.driverApproval?.expiryDate);

      // Check if expired
      if (expiryDate <= now) {
        console.log(`⚠️ Driver ${userId} has expired - updating status`);

        await db.collection("users").doc(userId).update({
          "driverApproval.status": "expired",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send expiry notification
        await createNotification({
          userId,
          title: "Driver Approval Expired",
          body: "Your driver approval has expired. Please contact admin to renew your documents and continue posting rides.",
          type: "system",
          data: { action: "driver_expired" },
        });

        expiredCount++;
        continue;
      }

      // Check for 30-day warning
      if (expiryDate <= thirtyDaysFromNow && !userData.driverApproval?.expiryNotificationSent) {
        const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`📅 Driver ${userId} expires in ${daysRemaining} days - sending warning`);

        await createNotification({
          userId,
          title: "Driver Approval Expiring Soon",
          body: `Your driver approval expires in ${daysRemaining} days. Please contact admin to update your documents before expiry.`,
          type: "system",
          data: { action: "driver_expiry_warning", daysRemaining },
        });

        // Mark notification as sent
        await db.collection("users").doc(userId).update({
          "driverApproval.expiryNotificationSent": true,
          "driverApproval.expiryNotificationDate": now.toISOString(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        warningCount++;
      }
    }

    console.log(`✅ Driver expiry check complete. Expired: ${expiredCount}, Warnings sent: ${warningCount}`);

  } catch (error) {
    console.error("❌ Error during driver expiry check:", error);
    throw error;
  }
});

// ============================================================================
// IDENTITY VERIFICATION (Stripe Identity)
// ============================================================================

// ============================================================================
// ACCOUNT DELETION (App Store Requirement)
// ============================================================================

/**
 * Delete user account and all associated data
 * Required for App Store compliance - users must be able to delete their accounts
 */
export const deleteUserAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in to delete account");
  }

  const userId = request.auth.uid;
  console.log(`🗑️ Starting account deletion for user: ${userId}`);

  try {
    // 1. Get user data first (for Stripe cleanup)
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const stripe = getStripe();
    let refundsProcessed = 0;
    let refundErrors = 0;

    // 2. Cancel all pending/confirmed bookings where user is passenger (with refunds)
    logger.info("Cancelling user's passenger bookings with refunds");
    const passengerBookings = await db.collection("bookings")
      .where("passengerId", "==", userId)
      .where("status", "in", ["pending", "pending_driver", "confirmed"])
      .get();

    for (const bookingDoc of passengerBookings.docs) {
      const booking = bookingDoc.data();

      // Process refund if payment exists
      if (booking.payment?.intentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.intentId);

          if (paymentIntent.status === "requires_capture") {
            // Cancel uncaptured payment
            await stripe.paymentIntents.cancel(booking.payment.intentId);
            await bookingDoc.ref.update({
              "payment.status": "cancelled",
              "payment.refundReason": "Passenger account deleted",
            });
            refundsProcessed++;
          } else if (paymentIntent.status === "succeeded" && paymentIntent.amount_received > 0) {
            // Refund captured payment - full refund since it's account deletion
            await stripe.refunds.create({
              payment_intent: booking.payment.intentId,
              reason: "requested_by_customer",
            });
            await bookingDoc.ref.update({
              "payment.status": "refunded",
              "payment.refundReason": "Passenger account deleted - full refund",
            });
            refundsProcessed++;
          }
        } catch (refundError: unknown) {
          logger.error("Failed to process refund for passenger booking", refundError);
          refundErrors++;
        }
      }

      // Restore seats to the ride
      if (booking.rideId && booking.seats) {
        try {
          await db.collection("rides").doc(booking.rideId).update({
            availableSeats: admin.firestore.FieldValue.increment(booking.seats),
            seatsAvailable: admin.firestore.FieldValue.increment(booking.seats),
          });
        } catch (e) {
          // Ride may not exist anymore
        }
      }

      await bookingDoc.ref.update({
        status: "cancelled",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelReason: "User account deleted",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    logger.info(`Cancelled ${passengerBookings.size} passenger bookings, ${refundsProcessed} refunds processed`);

    // 3. Cancel all bookings where user is driver (with refunds for passengers)
    const driverBookings = await db.collection("bookings")
      .where("driverId", "==", userId)
      .where("status", "in", ["pending", "pending_driver", "confirmed"])
      .get();

    for (const bookingDoc of driverBookings.docs) {
      const booking = bookingDoc.data();

      // Process refund for the passenger if payment exists
      if (booking.payment?.intentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.intentId);

          if (paymentIntent.status === "requires_capture") {
            await stripe.paymentIntents.cancel(booking.payment.intentId);
            await bookingDoc.ref.update({
              "payment.status": "cancelled",
              "payment.refundReason": "Driver account deleted - booking cancelled",
            });
            refundsProcessed++;
          } else if (paymentIntent.status === "succeeded" && paymentIntent.amount_received > 0) {
            // Full refund since driver deleted account (not passenger's fault)
            await stripe.refunds.create({
              payment_intent: booking.payment.intentId,
              reason: "requested_by_customer",
            });
            await bookingDoc.ref.update({
              "payment.status": "refunded",
              "payment.refundReason": "Driver account deleted - full refund",
            });
            refundsProcessed++;
          }
        } catch (refundError: unknown) {
          logger.error("Failed to process refund for driver booking", refundError);
          refundErrors++;
        }
      }

      // Notify the passenger that their booking was cancelled
      const passengerId = booking.passengerId || booking.riderId;
      if (passengerId) {
        await createNotification({
          userId: passengerId,
          title: "Booking Cancelled",
          body: "Your booking was cancelled because the driver deleted their account. A full refund will be processed.",
          type: "booking",
          data: { bookingId: bookingDoc.id, rideId: booking.rideId },
        });
      }

      // Restore seats to the ride
      if (booking.rideId && booking.seats) {
        try {
          await db.collection("rides").doc(booking.rideId).update({
            availableSeats: admin.firestore.FieldValue.increment(booking.seats),
            seatsAvailable: admin.firestore.FieldValue.increment(booking.seats),
          });
        } catch (e) {
          // Ride may not exist anymore
        }
      }

      await bookingDoc.ref.update({
        status: "cancelled",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelReason: "Driver account deleted",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    logger.info(`Cancelled ${driverBookings.size} driver bookings, total refunds: ${refundsProcessed}, errors: ${refundErrors}`);

    // 4. Cancel/delete user's rides
    console.log(`🚗 Cancelling user's rides...`);
    const userRides = await db.collection("rides")
      .where("driverId", "==", userId)
      .where("status", "in", ["active", "scheduled"])
      .get();

    const batch2 = db.batch();
    userRides.forEach((doc) => {
      batch2.update(doc.ref, {
        status: "cancelled",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelReason: "Driver account deleted",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch2.commit();
    console.log(`✅ Cancelled ${userRides.size} rides`);

    // 5. Delete user's notifications
    console.log(`🔔 Deleting notifications...`);
    const notifications = await db.collection("notifications")
      .where("userId", "==", userId)
      .get();

    const batch3 = db.batch();
    notifications.forEach((doc) => {
      batch3.delete(doc.ref);
    });
    await batch3.commit();
    console.log(`✅ Deleted ${notifications.size} notifications`);

    // 6. Delete emergency contacts
    console.log(`📞 Deleting emergency contacts...`);
    const emergencyContacts = await db.collection("emergency_contacts")
      .where("userId", "==", userId)
      .get();

    const batch4 = db.batch();
    emergencyContacts.forEach((doc) => {
      batch4.delete(doc.ref);
    });
    await batch4.commit();
    console.log(`✅ Deleted ${emergencyContacts.size} emergency contacts`);

    // 7. Delete Stripe Connect account if exists
    if (userData?.stripeAccountId) {
      console.log(`💳 Deleting Stripe Connect account...`);
      try {
        const stripe = getStripe();
        await stripe.accounts.del(userData.stripeAccountId);
        console.log(`✅ Deleted Stripe Connect account: ${userData.stripeAccountId}`);
      } catch (stripeError: any) {
        // Log but don't fail - account may have active payouts
        console.error(`⚠️ Could not delete Stripe account (may have active payouts):`, stripeError.message);
      }
    }

    // 8. Create audit log entry before deleting user document
    await db.collection("audit_logs").add({
      action: "ACCOUNT_DELETED",
      entityType: "user",
      entityId: userId,
      userId: userId,
      data: {
        email: userData?.email || "unknown",
        deletedAt: new Date().toISOString(),
        bookingsCancelled: passengerBookings.size + driverBookings.size,
        ridesCancelled: userRides.size,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 9. Delete user document from Firestore
    console.log(`👤 Deleting user document...`);
    await db.collection("users").doc(userId).delete();
    console.log(`✅ User document deleted`);

    // 10. Delete Firebase Auth account
    console.log(`🔐 Deleting Firebase Auth account...`);
    await admin.auth().deleteUser(userId);
    console.log(`✅ Firebase Auth account deleted`);

    console.log(`🎉 Account deletion complete for user: ${userId}`);

    return {
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    };
  } catch (error: any) {
    console.error(`❌ Error deleting account for user ${userId}:`, error);
    throw new HttpsError("internal", error.message || "Failed to delete account. Please contact support.");
  }
});

// ============================================================================
// SCHEDULED FUNCTIONS - Expiry Jobs
// ============================================================================

/**
 * Expire old rides that are 2+ hours past departure time without being started
 * Runs every 30 minutes
 */
export const expireOldRides = onSchedule(
  { schedule: "every 30 minutes", timeZone: "Australia/Sydney" },
  async () => {
    console.log("🕐 Running expireOldRides scheduled job...");

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    try {
      // Find upcoming rides past 2h after departure
      const ridesSnapshot = await db.collection("rides")
        .where("status", "==", "upcoming")
        .get();

      let expiredCount = 0;

      for (const rideDoc of ridesSnapshot.docs) {
        const rideData = rideDoc.data();
        const departureTime = new Date(rideData.departureTime || rideData.departureAt);

        if (departureTime < twoHoursAgo) {
          console.log(`⏰ Expiring ride ${rideDoc.id} (departed ${departureTime.toISOString()})`);

          // Update ride status to expired
          await db.collection("rides").doc(rideDoc.id).update({
            status: "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Find and handle all confirmed bookings for this ride
          const bookingsSnapshot = await db.collection("bookings")
            .where("rideId", "==", rideDoc.id)
            .where("status", "==", "confirmed")
            .get();

          for (const bookingDoc of bookingsSnapshot.docs) {
            const bookingData = bookingDoc.data();

            // Cancel booking with full refund
            await db.collection("bookings").doc(bookingDoc.id).update({
              status: "cancelled_by_driver",
              cancellationReason: "Ride expired - driver did not start",
              refundAmount: bookingData.amountTotal || 0,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Notify passenger
            await createNotification({
              userId: bookingData.riderId,
              title: "Ride Expired",
              body: "Your ride was cancelled because the driver didn't start. You will receive a full refund.",
              type: "ride",
              data: { rideId: rideDoc.id, bookingId: bookingDoc.id },
            });
          }

          // Notify driver
          await createNotification({
            userId: rideData.driverId,
            title: "Ride Expired ⏰",
            body: "Your ride has expired because it wasn't started. All passengers have been refunded.",
            type: "ride",
            data: { rideId: rideDoc.id },
          });

          expiredCount++;
        }
      }

      console.log(`✅ Expired ${expiredCount} rides`);
    } catch (error) {
      console.error("❌ Error in expireOldRides:", error);
    }
  }
);

/**
 * Expire stale bookings that have been pending_driver for 48+ hours
 * Runs every hour
 */
export const expireStaleBookings = onSchedule(
  { schedule: "every 1 hours", timeZone: "Australia/Sydney" },
  async () => {
    console.log("🕐 Running expireStaleBookings scheduled job...");

    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    try {
      // Find pending bookings older than 48 hours
      const bookingsSnapshot = await db.collection("bookings")
        .where("status", "==", "pending_driver")
        .get();

      let expiredCount = 0;

      for (const bookingDoc of bookingsSnapshot.docs) {
        const bookingData = bookingDoc.data();
        const createdAt = bookingData.createdAt?.toDate?.() || new Date(bookingData.createdAt);

        if (createdAt < fortyEightHoursAgo) {
          console.log(`⏰ Expiring booking ${bookingDoc.id} (created ${createdAt.toISOString()})`);

          await db.runTransaction(async (transaction) => {
            // Update booking status
            transaction.update(bookingDoc.ref, {
              status: "expired",
              expiredAt: admin.firestore.FieldValue.serverTimestamp(),
              expiredReason: "No driver response within 48 hours",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Restore seats to ride
            const rideRef = db.collection("rides").doc(bookingData.rideId);
            transaction.update(rideRef, {
              availableSeats: admin.firestore.FieldValue.increment(bookingData.seats || 1),
              seatsAvailable: admin.firestore.FieldValue.increment(bookingData.seats || 1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          // Notify rider
          await createNotification({
            userId: bookingData.riderId,
            title: "Booking Expired",
            body: "Your booking request expired because the driver didn't respond in time. Try booking another ride!",
            type: "booking",
            data: { bookingId: bookingDoc.id, rideId: bookingData.rideId },
          });

          expiredCount++;
        }
      }

      console.log(`✅ Expired ${expiredCount} stale bookings`);
    } catch (error) {
      console.error("❌ Error in expireStaleBookings:", error);
    }
  }
);

// ============================================================================
// NO-SHOW SYSTEM
// ============================================================================

/**
 * Mark a passenger as no-show
 * Called by driver when passenger doesn't appear
 */
export const markNoShow = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { bookingId } = request.data;
    const driverId = request.auth.uid;

    if (!bookingId) {
      throw new HttpsError("invalid-argument", "Missing bookingId");
    }

    try {
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      if (!bookingDoc.exists) {
        throw new HttpsError("not-found", "Booking not found");
      }

      const bookingData = bookingDoc.data()!;

      // Validate driver owns the ride
      if (bookingData.driverId !== driverId) {
        throw new HttpsError("permission-denied", "Only the driver can mark no-show");
      }

      // Validate booking is confirmed
      if (bookingData.status !== "confirmed") {
        throw new HttpsError("failed-precondition", "Can only mark confirmed bookings as no-show");
      }

      // Capture full payment
      const stripe = getStripe();
      let paymentCaptured = false;

      if (bookingData.payment?.intentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment.intentId);

          if (paymentIntent.status === "requires_capture") {
            await stripe.paymentIntents.capture(bookingData.payment.intentId);
            paymentCaptured = true;
            console.log(`💳 Captured payment for no-show booking ${bookingId}`);
          } else if (paymentIntent.status === "succeeded") {
            // Already captured
            paymentCaptured = true;
          }
        } catch (stripeError: any) {
          console.error("Stripe capture failed for no-show:", stripeError.message);
        }
      }

      // Update booking
      await db.collection("bookings").doc(bookingId).update({
        status: "no_show",
        noShowAt: admin.firestore.FieldValue.serverTimestamp(),
        "payment.status": paymentCaptured ? "captured" : bookingData.payment?.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Increment rider's no-show count
      await db.collection("users").doc(bookingData.riderId).update({
        noShowCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify rider
      await createNotification({
        userId: bookingData.riderId,
        title: "Marked as No-Show ⚠️",
        body: "You were marked as no-show for your ride. Full fare has been charged.",
        type: "booking",
        data: { bookingId },
      });

      console.log(`✅ No-show marked for booking ${bookingId}`);

      return {
        success: true,
        message: "Passenger marked as no-show. Full fare charged.",
        paymentCaptured,
      };
    } catch (error: any) {
      console.error("Error marking no-show:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to mark no-show");
    }
  }
);

// ============================================================================
// CANCELLATION FEES
// ============================================================================

/**
 * Calculate cancellation fee based on time until departure
 */
function calculateCancellationFee(amountTotal: number, departureTime: Date): { fee: number; refund: number; feePercent: number } {
  const now = new Date();
  const hoursUntil = (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  let feePercent: number;

  if (hoursUntil > 24) {
    feePercent = 5;
  } else if (hoursUntil > 12) {
    feePercent = 25;
  } else if (hoursUntil > 0) {
    feePercent = 50;
  } else {
    feePercent = 100; // Past departure
  }

  const fee = Math.round(amountTotal * (feePercent / 100));
  const refund = amountTotal - fee;

  return { fee, refund, feePercent };
}

/**
 * Cancel booking with time-based fee
 */
export const cancelBookingWithFee = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { bookingId, reason } = request.data;
    const userId = request.auth.uid;

    if (!bookingId) {
      throw new HttpsError("invalid-argument", "Missing bookingId");
    }

    try {
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      if (!bookingDoc.exists) {
        throw new HttpsError("not-found", "Booking not found");
      }

      const bookingData = bookingDoc.data()!;

      // Validate user is the rider
      if (bookingData.riderId !== userId) {
        throw new HttpsError("permission-denied", "Only the rider can cancel their booking");
      }

      // Cannot cancel completed or already cancelled bookings
      if (["completed", "cancelled_by_rider", "cancelled_by_driver", "no_show", "expired"].includes(bookingData.status)) {
        throw new HttpsError("failed-precondition", "Cannot cancel this booking");
      }

      // Get ride for departure time
      const rideDoc = await db.collection("rides").doc(bookingData.rideId).get();
      const rideData = rideDoc.data();
      const departureTime = new Date(rideData?.departureTime || rideData?.departureAt || Date.now());

      // Calculate fee
      const { fee, refund, feePercent } = calculateCancellationFee(
        bookingData.amountTotal || 0,
        departureTime
      );

      console.log(`💸 Cancellation: ${feePercent}% fee ($${(fee / 100).toFixed(2)}), refund $${(refund / 100).toFixed(2)}`);

      // Process refund if there's a payment
      let refundProcessed = false;
      if (bookingData.payment?.intentId && refund > 0) {
        try {
          const stripe = getStripe();
          const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment.intentId);

          if (paymentIntent.status === "requires_capture") {
            // Cancel authorization - no charge
            await stripe.paymentIntents.cancel(bookingData.payment.intentId);
            refundProcessed = true;
          } else if (paymentIntent.status === "succeeded") {
            // Already captured - issue partial refund
            await stripe.refunds.create({
              payment_intent: bookingData.payment.intentId,
              amount: refund,
            });
            refundProcessed = true;
          }
        } catch (stripeError: any) {
          console.error("Stripe refund failed:", stripeError.message);
        }
      }

      // Update booking
      await db.runTransaction(async (transaction) => {
        transaction.update(bookingDoc.ref, {
          status: "cancelled_by_rider",
          cancellationReason: reason || "Cancelled by rider",
          cancellationFee: fee,
          refundAmount: refund,
          cancelledBy: userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Restore seats to ride
        const rideRef = db.collection("rides").doc(bookingData.rideId);
        transaction.update(rideRef, {
          availableSeats: admin.firestore.FieldValue.increment(bookingData.seats || 1),
          seatsAvailable: admin.firestore.FieldValue.increment(bookingData.seats || 1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Increment cancellation count
      await db.collection("users").doc(userId).update({
        cancellationCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify driver
      await createNotification({
        userId: bookingData.driverId,
        title: "Booking Cancelled",
        body: `A passenger cancelled their booking. Check your ride details.`,
        type: "booking",
        data: { bookingId, rideId: bookingData.rideId },
      });

      return {
        success: true,
        message: feePercent > 0
          ? `Booking cancelled. ${feePercent}% fee applied ($${(fee / 100).toFixed(2)}). Refund: $${(refund / 100).toFixed(2)}`
          : "Booking cancelled with full refund.",
        fee,
        refund,
        feePercent,
        refundProcessed,
      };
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to cancel booking");
    }
  }
);

/**
 * Get cancellation fee preview before confirming
 */
export const getCancellationFeePreview = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { bookingId } = request.data;

  if (!bookingId) {
    throw new HttpsError("invalid-argument", "Missing bookingId");
  }

  try {
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw new HttpsError("not-found", "Booking not found");
    }

    const bookingData = bookingDoc.data()!;

    // Get ride for departure time
    const rideDoc = await db.collection("rides").doc(bookingData.rideId).get();
    const rideData = rideDoc.data();
    const departureTime = new Date(rideData?.departureTime || rideData?.departureAt || Date.now());

    // Calculate fee
    const { fee, refund, feePercent } = calculateCancellationFee(
      bookingData.amountTotal || 0,
      departureTime
    );

    return {
      success: true,
      amountTotal: bookingData.amountTotal || 0,
      fee,
      refund,
      feePercent,
      departureTime: departureTime.toISOString(),
    };
  } catch (error: any) {
    console.error("Error getting cancellation fee preview:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to get fee preview");
  }
});


// ============================================================================
// STRIPE PAYMENT WEBHOOK HANDLER (with deduplication)
// ============================================================================

/**
 * Handle Stripe payment webhooks with deduplication
 */
export const handleStripePaymentWebhook = onRequest(
  { secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      res.status(500).send("Webhook secret not configured");
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log(`📥 Stripe webhook: ${event.type} (${event.id})`);

    // Deduplication: Check if already processed
    const eventRef = db.collection("stripe_events").doc(event.id);
    const existingEvent = await eventRef.get();

    if (existingEvent.exists) {
      console.log(`Event ${event.id} already processed, skipping`);
      res.json({ received: true, duplicate: true });
      return;
    }

    // Mark as processing
    await eventRef.set({
      id: event.id,
      type: event.type,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "processing",
    });

    try {
      // Handle payment_intent events
      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
      } else if (event.type === "payment_intent.canceled") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentCanceled(paymentIntent);
      } else if (event.type === "charge.captured") {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeCaptured(charge);
      } else if (event.type === "charge.failed") {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeFailed(charge);
      }

      // Mark as completed
      await eventRef.update({ status: "completed" });
      res.json({ received: true });
    } catch (error: any) {
      console.error("Error processing webhook:", error);
      await eventRef.update({ status: "failed", error: error.message });
      res.status(500).send(`Processing error: ${error.message}`);
    }
  }
);

// Webhook handlers
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;
  if (!bookingId) return;

  console.log(`💰 PaymentIntent succeeded for booking ${bookingId}`);

  await logPaymentEvent(bookingId, AuditEventTypes.PAYMENT_CAPTURED, paymentIntent.id, true, {
    amount: paymentIntent.amount,
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;
  if (!bookingId) return;

  console.log(`❌ PaymentIntent failed for booking ${bookingId}`);

  const bookingRef = db.collection("bookings").doc(bookingId);
  const bookingDoc = await bookingRef.get();

  if (!bookingDoc.exists) return;

  const bookingData = bookingDoc.data()!;
  const retries = (bookingData.payment?.authorizationRetries || 0) + 1;

  await bookingRef.update({
    "payment.status": "authorization_failed",
    "payment.authorizationRetries": retries,
    "payment.lastAuthorizationAttempt": new Date().toISOString(),
    "payment.lastAuthorizationError": paymentIntent.last_payment_error?.message || "Unknown error",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logPaymentEvent(bookingId, AuditEventTypes.PAYMENT_AUTH_FAILED, paymentIntent.id, false, {
    error: paymentIntent.last_payment_error?.message,
    retries,
  });

  // Notify rider
  await createNotification({
    userId: bookingData.riderId,
    title: "Payment Issue ⚠️",
    body: "Your payment failed. Please update your payment method to keep your booking.",
    type: "payment",
    data: { bookingId },
  });
}

async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;
  if (!bookingId) return;

  console.log(`🚫 PaymentIntent canceled for booking ${bookingId}`);

  await db.collection("bookings").doc(bookingId).update({
    "payment.status": "cancelled",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logPaymentEvent(bookingId, AuditEventTypes.PAYMENT_CANCELLED, paymentIntent.id, true);
}

async function handleChargeCaptured(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) return;

  // Find booking by payment intent
  const bookingsSnapshot = await db.collection("bookings")
    .where("payment.intentId", "==", paymentIntentId)
    .limit(1)
    .get();

  if (bookingsSnapshot.empty) return;

  const bookingDoc = bookingsSnapshot.docs[0];
  console.log(`✅ Charge captured for booking ${bookingDoc.id}`);

  await bookingDoc.ref.update({
    "payment.status": "captured",
    "payment.latestChargeId": charge.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logPaymentEvent(bookingDoc.id, AuditEventTypes.PAYMENT_CAPTURED, paymentIntentId, true, {
    chargeId: charge.id,
    amount: charge.amount,
  });
}

async function handleChargeFailed(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) return;

  const bookingsSnapshot = await db.collection("bookings")
    .where("payment.intentId", "==", paymentIntentId)
    .limit(1)
    .get();

  if (bookingsSnapshot.empty) return;

  const bookingDoc = bookingsSnapshot.docs[0];
  const bookingData = bookingDoc.data();
  const captureRetries = (bookingData.payment?.captureRetries || 0) + 1;

  console.log(`❌ Charge failed for booking ${bookingDoc.id} (attempt ${captureRetries})`);

  await bookingDoc.ref.update({
    "payment.status": "capture_failed",
    "payment.captureRetries": captureRetries,
    "payment.lastCaptureAttempt": new Date().toISOString(),
    "payment.lastCaptureError": charge.failure_message || "Capture failed",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logPaymentEvent(bookingDoc.id, AuditEventTypes.PAYMENT_CAPTURE_FAILED, paymentIntentId, false, {
    error: charge.failure_message,
    retries: captureRetries,
  });
}

// ============================================================================
// AUTHORIZATION & CAPTURE RETRY FUNCTIONS
// ============================================================================

/**
 * Retry authorization for failed payments
 * Called by rider or scheduled job
 */
export const retryPaymentAuthorization = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { bookingId } = request.data;
    const userId = request.auth.uid;

    if (!bookingId) {
      throw new HttpsError("invalid-argument", "Missing bookingId");
    }

    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw new HttpsError("not-found", "Booking not found");
    }

    const bookingData = bookingDoc.data()!;

    // Only rider can retry
    if (bookingData.riderId !== userId) {
      throw new HttpsError("permission-denied", "Only the rider can retry payment");
    }

    // Check payment status
    if (bookingData.payment?.status !== "authorization_failed") {
      throw new HttpsError("failed-precondition", "Payment doesn't need retry");
    }

    try {
      const stripe = getStripe();

      // Create new payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: bookingData.amountTotal,
        currency: "aud",
        customer: bookingData.stripeCustomerId,
        capture_method: "manual",
        metadata: { bookingId, rideId: bookingData.rideId },
      });

      // Update booking
      await bookingDoc.ref.update({
        "payment.intentId": paymentIntent.id,
        "payment.status": "authorized",
        "payment.authorizationRetries": admin.firestore.FieldValue.increment(1),
        "payment.lastAuthorizationAttempt": new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logPaymentEvent(bookingId, AuditEventTypes.PAYMENT_AUTH_RETRY, paymentIntent.id, true);

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        message: "Please complete the payment",
      };
    } catch (error: any) {
      console.error("Retry authorization failed:", error);
      throw new HttpsError("internal", error.message || "Failed to retry");
    }
  }
);

/**
 * Retry capture for failed captures
 * Called by admin or scheduled job
 */
export const retryCapturePayment = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { bookingId } = request.data;

    if (!bookingId) {
      throw new HttpsError("invalid-argument", "Missing bookingId");
    }

    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw new HttpsError("not-found", "Booking not found");
    }

    const bookingData = bookingDoc.data()!;

    if (bookingData.payment?.status !== "capture_failed") {
      throw new HttpsError("failed-precondition", "Payment doesn't need capture retry");
    }

    try {
      const stripe = getStripe();

      await stripe.paymentIntents.capture(bookingData.payment.intentId);

      await bookingDoc.ref.update({
        "payment.status": "captured",
        "payment.captureRetries": admin.firestore.FieldValue.increment(1),
        "payment.lastCaptureAttempt": new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logPaymentEvent(bookingId, AuditEventTypes.PAYMENT_CAPTURE_RETRY, bookingData.payment.intentId, true);

      return { success: true, message: "Payment captured successfully" };
    } catch (error: any) {
      console.error("Retry capture failed:", error);

      await bookingDoc.ref.update({
        "payment.lastCaptureError": error.message,
        "payment.lastCaptureAttempt": new Date().toISOString(),
      });

      throw new HttpsError("internal", error.message || "Failed to capture");
    }
  }
);

/**
 * Clean up bookings with failed authorizations past grace period
 * Runs every 6 hours
 */
export const cleanupFailedAuthorizations = onSchedule(
  { schedule: "every 6 hours", timeZone: "Australia/Sydney" },
  async () => {
    console.log("🧹 Running cleanupFailedAuthorizations...");

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const bookingsSnapshot = await db.collection("bookings")
      .where("payment.status", "==", "authorization_failed")
      .get();

    let cleanedCount = 0;

    for (const bookingDoc of bookingsSnapshot.docs) {
      const bookingData = bookingDoc.data();
      const lastAttempt = bookingData.payment?.lastAuthorizationAttempt
        ? new Date(bookingData.payment.lastAuthorizationAttempt)
        : null;

      if (lastAttempt && lastAttempt < twelveHoursAgo) {
        console.log(`🗑️ Cleaning up booking ${bookingDoc.id} - grace period expired`);

        await db.runTransaction(async (transaction) => {
          // Cancel booking
          transaction.update(bookingDoc.ref, {
            status: "payment_failed",
            "payment.status": "permanently_failed",
            "payment.failedAt": new Date().toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Restore seats
          const rideRef = db.collection("rides").doc(bookingData.rideId);
          transaction.update(rideRef, {
            availableSeats: admin.firestore.FieldValue.increment(bookingData.seats || 1),
            seatsAvailable: admin.firestore.FieldValue.increment(bookingData.seats || 1),
          });
        });

        // Notify rider
        await createNotification({
          userId: bookingData.riderId,
          title: "Booking Cancelled",
          body: "Your booking was cancelled due to payment failure.",
          type: "booking",
          data: { bookingId: bookingDoc.id },
        });

        await logAuditEvent({
          eventType: AuditEventTypes.BOOKING_CANCELLED,
          actorId: "system",
          actorRole: "system",
          resourceType: "booking",
          resourceId: bookingDoc.id,
          action: "cancelled_payment_failed",
          previousState: { status: bookingData.status },
          newState: { status: "payment_failed" },
        });

        cleanedCount++;
      }
    }

    console.log(`✅ Cleaned up ${cleanedCount} bookings with failed authorizations`);
  }
);


export {
  createVerificationSession,
  getVerificationStatus,
  handleIdentityWebhook
} from './identity-verification';

// Geohash migration functions for backfilling rides
export {
  backfillRideGeohashes,
  backfillRideGeohashesHttp,
  backfillBookingReviewFields,
  ensureRideGeohashes
} from './geohash-migration';
