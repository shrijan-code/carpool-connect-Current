import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

// Lazy initialization to avoid errors before admin.initializeApp() in index.ts
const getDb = () => admin.firestore();

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Maximum requests per window
    action: string;        // Action name for tracking
}

// Default rate limit configurations
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
    createBooking: {
        windowMs: 60 * 1000,    // 1 minute
        maxRequests: 5,         // 5 booking attempts per minute
        action: "createBooking",
    },
    createPendingBooking: {
        windowMs: 60 * 1000,
        maxRequests: 5,
        action: "createPendingBooking",
    },
    cancelBooking: {
        windowMs: 60 * 1000,
        maxRequests: 10,
        action: "cancelBooking",
    },
    sendMessage: {
        windowMs: 60 * 1000,
        maxRequests: 30,        // 30 messages per minute
        action: "sendMessage",
    },
    createRide: {
        windowMs: 60 * 1000,
        maxRequests: 5,         // 5 rides per minute
        action: "createRide",
    },
    startRide: {
        windowMs: 60 * 1000,
        maxRequests: 3,
        action: "startRide",
    },
    completeRide: {
        windowMs: 60 * 1000,
        maxRequests: 3,
        action: "completeRide",
    },
    safetyReport: {
        windowMs: 60 * 1000,
        maxRequests: 3,         // 3 safety reports per minute
        action: "safetyReport",
    },
};

/**
 * Check if a user has exceeded their rate limit for an action.
 * Uses Firestore with TTL for automatic cleanup.
 * 
 * @param userId - The user's Firebase Auth UID
 * @param action - The action being rate limited
 * @returns Promise<void> - Throws HttpsError if rate limit exceeded
 */
export async function checkRateLimit(userId: string, action: string): Promise<void> {
    const config = RATE_LIMITS[action];
    if (!config) {
        console.warn(`No rate limit config for action: ${action}`);
        return; // No rate limit configured, allow through
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Collection path: rate_limits/{userId}/actions/{action}_{timestamp}
    const rateLimitRef = getDb().collection("rate_limits").doc(userId);

    try {
        await getDb().runTransaction(async (transaction) => {
            const doc = await transaction.get(rateLimitRef);
            const data = doc.exists ? doc.data() || {} : {};

            // Get action-specific entries
            const actionKey = `${action}_timestamps`;
            let timestamps: number[] = data[actionKey] || [];

            // Filter to only include timestamps within the window
            timestamps = timestamps.filter((ts: number) => ts > windowStart);

            if (timestamps.length >= config.maxRequests) {
                const oldestTimestamp = Math.min(...timestamps);
                const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);

                throw new HttpsError(
                    "resource-exhausted",
                    `Too many requests. Please try again in ${retryAfter} seconds.`
                );
            }

            // Add current timestamp
            timestamps.push(now);

            // Update the document
            transaction.set(rateLimitRef, {
                ...data,
                [actionKey]: timestamps,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                // TTL for automatic cleanup (24 hours)
                expiresAt: new Date(now + 24 * 60 * 60 * 1000),
            }, { merge: true });
        });
    } catch (error: unknown) {
        if (error instanceof HttpsError) {
            throw error;
        }
        // Log error but don't block the request if rate limiting fails
        console.error("Rate limit check failed:", error);
    }
}

/**
 * Decorator-style function to wrap a Cloud Function with rate limiting.
 * 
 * @param action - The action name for rate limiting
 * @param handler - The Cloud Function handler
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit<T>(
    action: string,
    handler: (userId: string, data: T) => Promise<unknown>
): (userId: string, data: T) => Promise<unknown> {
    return async (userId: string, data: T) => {
        await checkRateLimit(userId, action);
        return handler(userId, data);
    };
}
