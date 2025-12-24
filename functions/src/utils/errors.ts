/**
 * Error handling utilities for Firebase Cloud Functions
 * Provides type-safe error handling and standardized error responses
 */

import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "./logger";

/**
 * Standard error codes used across Cloud Functions
 */
export type ErrorCode =
    | "unauthenticated"
    | "permission-denied"
    | "not-found"
    | "invalid-argument"
    | "failed-precondition"
    | "aborted"
    | "internal";

/**
 * Extract a message from an unknown error type safely
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "An unknown error occurred";
}

/**
 * Check if an error is a Stripe error
 */
export function isStripeError(error: unknown): error is { type: string; message: string } {
    return (
        typeof error === "object" &&
        error !== null &&
        "type" in error &&
        typeof (error as Record<string, unknown>).type === "string"
    );
}

/**
 * Check if an error is an HttpsError
 */
export function isHttpsError(error: unknown): error is HttpsError {
    return error instanceof HttpsError;
}

/**
 * Wrap an async handler with standardized error handling
 * Logs errors and converts them to appropriate HttpsError responses
 */
export async function withErrorHandling<T>(
    operation: string,
    handler: () => Promise<T>,
    defaultCode: ErrorCode = "internal"
): Promise<T> {
    try {
        return await handler();
    } catch (error: unknown) {
        // If it's already an HttpsError, re-throw it
        if (isHttpsError(error)) {
            logger.error(`${operation} failed`, error);
            throw error;
        }

        // Handle Stripe-specific errors
        if (isStripeError(error)) {
            logger.error(`${operation} failed (Stripe)`, error);
            const code = error.type === "StripeCardError" ? "aborted" : "internal";
            throw new HttpsError(code, error.message || "Payment processing error");
        }

        // Generic error handling
        const message = getErrorMessage(error);
        logger.error(`${operation} failed`, error);
        throw new HttpsError(defaultCode, message || `${operation} failed`);
    }
}

/**
 * Create a standardized success response
 */
export function successResponse<T extends Record<string, unknown>>(
    data: T
): { success: true } & T {
    return { success: true, ...data };
}

/**
 * Create a standardized error response for HTTP endpoints
 */
export function errorResponse(
    message: string,
    details?: Record<string, unknown>
): { success: false; error: string; details?: Record<string, unknown> } {
    return {
        success: false,
        error: message,
        ...(details ? { details } : {}),
    };
}

/**
 * Validate that a required field exists
 * Throws HttpsError if the field is missing
 */
export function requireField<T>(
    value: T | undefined | null,
    fieldName: string
): T {
    if (value === undefined || value === null) {
        throw new HttpsError("invalid-argument", `Missing required field: ${fieldName}`);
    }
    return value;
}

/**
 * Validate that the user is authenticated
 * Throws HttpsError if not authenticated
 */
export function requireAuth(auth: { uid: string } | undefined): { uid: string } {
    if (!auth) {
        throw new HttpsError("unauthenticated", "User must be logged in");
    }
    return auth;
}
