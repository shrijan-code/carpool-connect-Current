/**
 * Security Utilities for Admin Authentication
 * 
 * Provides input validation, sanitization, and audit logging.
 */

import { db } from './firebase-admin';
import admin from './firebase-admin';

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validate and sanitize email input
 */
export function validateEmail(email: string): { valid: boolean; sanitized?: string; error?: string } {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }

    // Trim and lowercase
    const sanitized = email.trim().toLowerCase();

    // Length check
    if (sanitized.length > 254) {
        return { valid: false, error: 'Email is too long' };
    }

    // Format check
    if (!EMAIL_REGEX.test(sanitized)) {
        return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate password input
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters' };
    }

    if (password.length > 128) {
        return { valid: false, error: 'Password is too long' };
    }

    return { valid: true };
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
    // Check various headers for the real IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp;
    }

    // Fallback for local development
    return '127.0.0.1';
}

export type SecurityLogType =
    | 'login_success'
    | 'login_failed'
    | 'login_rate_limited'
    | 'account_locked'
    | 'mfa_success'
    | 'mfa_failed'
    | 'logout';

interface SecurityLogData {
    email?: string;
    ip?: string;
    reason?: string;
    userAgent?: string;
    [key: string]: any;
}

/**
 * Log security event to Firestore
 */
export async function logSecurityEvent(
    type: SecurityLogType,
    data: SecurityLogData
): Promise<void> {
    try {
        await db.collection('admin_security_logs').add({
            type,
            ...data,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        // Don't fail the request if logging fails, but log to console
        console.error('Failed to log security event:', error);
    }
}

/**
 * Check account lockout status from Firestore
 */
export async function checkAccountLockout(adminId: string): Promise<{
    locked: boolean;
    lockedUntil?: Date;
    reason?: string;
}> {
    try {
        const adminDoc = await db.collection('admins').doc(adminId).get();
        const data = adminDoc.data();

        if (!data) {
            return { locked: false };
        }

        // Check if account is locked
        if (data.lockedUntil) {
            const lockedUntil = data.lockedUntil.toDate();
            if (new Date() < lockedUntil) {
                return {
                    locked: true,
                    lockedUntil,
                    reason: data.lockReason || 'Too many failed login attempts',
                };
            }
            // Lock expired, clear it
            await db.collection('admins').doc(adminId).update({
                lockedUntil: admin.firestore.FieldValue.delete(),
                failedLoginAttempts: 0,
            });
        }

        return { locked: false };
    } catch (error) {
        console.error('Error checking account lockout:', error);
        return { locked: false };
    }
}

/**
 * Record failed login attempt and potentially lock account
 */
export async function recordFailedLoginAttempt(
    adminId: string,
    maxAttempts: number = 5,
    lockoutMinutes: number = 30
): Promise<{ locked: boolean; attemptsRemaining: number }> {
    try {
        const adminRef = db.collection('admins').doc(adminId);
        const adminDoc = await adminRef.get();
        const data = adminDoc.data();

        if (!data) {
            return { locked: false, attemptsRemaining: maxAttempts };
        }

        const currentAttempts = (data.failedLoginAttempts || 0) + 1;

        if (currentAttempts >= maxAttempts) {
            // Lock the account
            const lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
            await adminRef.update({
                failedLoginAttempts: currentAttempts,
                lockedUntil: admin.firestore.Timestamp.fromDate(lockedUntil),
                lockReason: 'Too many failed login attempts',
            });

            return { locked: true, attemptsRemaining: 0 };
        }

        // Increment counter
        await adminRef.update({
            failedLoginAttempts: currentAttempts,
            lastFailedLogin: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { locked: false, attemptsRemaining: maxAttempts - currentAttempts };
    } catch (error) {
        console.error('Error recording failed login:', error);
        return { locked: false, attemptsRemaining: maxAttempts };
    }
}

/**
 * Reset failed login attempts on successful login
 */
export async function resetFailedLoginAttempts(adminId: string): Promise<void> {
    try {
        await db.collection('admins').doc(adminId).update({
            failedLoginAttempts: 0,
            lockedUntil: admin.firestore.FieldValue.delete(),
            lockReason: admin.firestore.FieldValue.delete(),
        });
    } catch (error) {
        console.error('Error resetting failed login attempts:', error);
    }
}
