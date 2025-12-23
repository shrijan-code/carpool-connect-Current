/**
 * Audit Event Logging Utility
 * Tracks all state changes for dispute resolution and debugging
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface AuditEvent {
    id?: string;
    timestamp: admin.firestore.FieldValue;
    eventType: string;
    actorId: string;
    actorRole: 'rider' | 'driver' | 'system' | 'admin';
    resourceType: 'ride' | 'booking' | 'payment' | 'user' | 'review';
    resourceId: string;
    action: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to Firestore
 */
export async function logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    try {
        const auditEvent: AuditEvent = {
            ...event,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await db.collection('audit_events').add(auditEvent);
        console.log(`📝 Audit event logged: ${event.eventType} | ${event.resourceType}/${event.resourceId} | Actor: ${event.actorId}`);
        return docRef.id;
    } catch (error) {
        console.error('❌ Failed to log audit event:', error);
        // Don't throw - audit logging should not block operations
        return '';
    }
}

/**
 * Common audit event types
 */
export const AuditEventTypes = {
    // Booking events
    BOOKING_CREATED: 'BOOKING_CREATED',
    BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
    BOOKING_DECLINED: 'BOOKING_DECLINED',
    BOOKING_CANCELLED: 'BOOKING_CANCELLED',
    BOOKING_EXPIRED: 'BOOKING_EXPIRED',
    BOOKING_NO_SHOW: 'BOOKING_NO_SHOW',

    // Payment events
    PAYMENT_AUTHORIZED: 'PAYMENT_AUTHORIZED',
    PAYMENT_AUTH_FAILED: 'PAYMENT_AUTH_FAILED',
    PAYMENT_AUTH_RETRY: 'PAYMENT_AUTH_RETRY',
    PAYMENT_CAPTURED: 'PAYMENT_CAPTURED',
    PAYMENT_CAPTURE_FAILED: 'PAYMENT_CAPTURE_FAILED',
    PAYMENT_CAPTURE_RETRY: 'PAYMENT_CAPTURE_RETRY',
    PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
    PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',

    // Ride events
    RIDE_CREATED: 'RIDE_CREATED',
    RIDE_STARTED: 'RIDE_STARTED',
    RIDE_COMPLETED: 'RIDE_COMPLETED',
    RIDE_CANCELLED: 'RIDE_CANCELLED',
    RIDE_EXPIRED: 'RIDE_EXPIRED',

    // User events
    USER_CREATED: 'USER_CREATED',
    USER_VERIFIED: 'USER_VERIFIED',
    USER_SUSPENDED: 'USER_SUSPENDED',
    DRIVER_APPROVED: 'DRIVER_APPROVED',

    // Review events
    REVIEW_SUBMITTED: 'REVIEW_SUBMITTED',
} as const;

/**
 * Helper to log booking state changes
 */
export async function logBookingStateChange(
    bookingId: string,
    actorId: string,
    actorRole: AuditEvent['actorRole'],
    action: string,
    previousStatus: string,
    newStatus: string,
    metadata?: Record<string, unknown>
): Promise<string> {
    return logAuditEvent({
        eventType: `BOOKING_${action.toUpperCase()}`,
        actorId,
        actorRole,
        resourceType: 'booking',
        resourceId: bookingId,
        action,
        previousState: { status: previousStatus },
        newState: { status: newStatus },
        metadata,
    });
}

/**
 * Helper to log payment events
 */
export async function logPaymentEvent(
    bookingId: string,
    eventType: string,
    paymentIntentId: string,
    success: boolean,
    metadata?: Record<string, unknown>
): Promise<string> {
    return logAuditEvent({
        eventType,
        actorId: 'system',
        actorRole: 'system',
        resourceType: 'payment',
        resourceId: bookingId,
        action: eventType.toLowerCase().replace('payment_', ''),
        newState: {
            paymentIntentId,
            success,
            timestamp: new Date().toISOString(),
        },
        metadata,
    });
}

/**
 * Helper to log ride state changes
 */
export async function logRideStateChange(
    rideId: string,
    actorId: string,
    actorRole: AuditEvent['actorRole'],
    action: string,
    previousStatus: string,
    newStatus: string,
    metadata?: Record<string, unknown>
): Promise<string> {
    return logAuditEvent({
        eventType: `RIDE_${action.toUpperCase()}`,
        actorId,
        actorRole,
        resourceType: 'ride',
        resourceId: rideId,
        action,
        previousState: { status: previousStatus },
        newState: { status: newStatus },
        metadata,
    });
}
