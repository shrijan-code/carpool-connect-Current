import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from './firebase-admin';
import admin from './firebase-admin';

// Email transporter - reuse from existing setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// =====================
// EMAIL OTP FUNCTIONS
// =====================

/**
 * Generate a 6-digit OTP
 */
export function generateEmailOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash OTP for secure storage
 */
export function hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Store OTP for admin (hashed, with expiry)
 */
export async function storeOtp(adminId: string, otp: string): Promise<void> {
    const hashedOtp = hashOtp(otp);
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.collection('admins').doc(adminId).update({
        pendingOtp: hashedOtp,
        pendingOtpExpiry: admin.firestore.Timestamp.fromDate(expiry),
    });
}

/**
 * Verify email OTP
 */
export async function verifyEmailOtp(adminId: string, otp: string): Promise<boolean> {
    const adminDoc = await db.collection('admins').doc(adminId).get();
    if (!adminDoc.exists) return false;

    const data = adminDoc.data();
    if (!data?.pendingOtp || !data?.pendingOtpExpiry) return false;

    // Check expiry
    const expiry = data.pendingOtpExpiry.toDate();
    if (new Date() > expiry) {
        // Clear expired OTP
        await adminDoc.ref.update({
            pendingOtp: admin.firestore.FieldValue.delete(),
            pendingOtpExpiry: admin.firestore.FieldValue.delete(),
        });
        return false;
    }

    // Verify hash
    const hashedInput = hashOtp(otp);
    if (hashedInput !== data.pendingOtp) return false;

    // Clear OTP after successful verification
    await adminDoc.ref.update({
        pendingOtp: admin.firestore.FieldValue.delete(),
        pendingOtpExpiry: admin.firestore.FieldValue.delete(),
    });

    return true;
}

/**
 * Send OTP email
 */
export async function sendOtpEmail(email: string, otp: string, adminName: string): Promise<boolean> {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'CarpoolConnect Admin - Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #6366F1;">CarpoolConnect Admin</h2>
                    <p>Hi ${adminName},</p>
                    <p>Your verification code is:</p>
                    <div style="background: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F2937;">${otp}</span>
                    </div>
                    <p style="color: #6B7280; font-size: 14px;">This code expires in 5 minutes.</p>
                    <p style="color: #6B7280; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error('Failed to send OTP email:', error);
        return false;
    }
}

// =====================
// TOTP FUNCTIONS
// =====================

/**
 * Generate a new TOTP secret
 */
export function generateTotpSecret(): string {
    return authenticator.generateSecret();
}

/**
 * Generate QR code for TOTP setup
 */
export async function generateTotpQrCode(email: string, secret: string): Promise<string> {
    const issuer = 'CarpoolConnect Admin';
    const otpauth = authenticator.keyuri(email, issuer, secret);
    return QRCode.toDataURL(otpauth);
}

/**
 * Verify TOTP code
 */
export function verifyTotp(token: string, secret: string): boolean {
    try {
        return authenticator.verify({ token, secret });
    } catch {
        return false;
    }
}

/**
 * Store TOTP secret for admin
 */
export async function storeTotpSecret(adminId: string, secret: string): Promise<void> {
    await db.collection('admins').doc(adminId).update({
        totpSecret: secret,
        totpVerified: false, // Will be set to true after first successful verification
    });
}

/**
 * Complete TOTP setup (after first successful verification)
 */
export async function completeTotpSetup(adminId: string): Promise<void> {
    await db.collection('admins').doc(adminId).update({
        totpVerified: true,
        mfaEnabled: true,
        mfaMethod: 'totp',
    });
}

// =====================
// MFA MANAGEMENT
// =====================

export type MfaMethod = 'email' | 'totp' | 'both' | null;

/**
 * Get admin's MFA status
 */
export async function getMfaStatus(adminId: string): Promise<{
    enabled: boolean;
    method: MfaMethod;
    totpConfigured: boolean;
}> {
    const adminDoc = await db.collection('admins').doc(adminId).get();
    if (!adminDoc.exists) {
        return { enabled: false, method: null, totpConfigured: false };
    }

    const data = adminDoc.data();
    return {
        enabled: data?.mfaEnabled ?? false,
        method: data?.mfaMethod ?? null,
        totpConfigured: data?.totpVerified ?? false,
    };
}

/**
 * Enable/disable MFA
 */
export async function updateMfaSettings(
    adminId: string,
    enabled: boolean,
    method: MfaMethod
): Promise<void> {
    await db.collection('admins').doc(adminId).update({
        mfaEnabled: enabled,
        mfaMethod: method,
    });
}

/**
 * Disable TOTP (remove secret)
 */
export async function disableTotp(adminId: string): Promise<void> {
    const adminDoc = await db.collection('admins').doc(adminId).get();
    const data = adminDoc.data();

    const updates: any = {
        totpSecret: admin.firestore.FieldValue.delete(),
        totpVerified: false,
    };

    // If TOTP was the only method, disable MFA entirely
    if (data?.mfaMethod === 'totp') {
        updates.mfaEnabled = false;
        updates.mfaMethod = null;
    } else if (data?.mfaMethod === 'both') {
        updates.mfaMethod = 'email';
    }

    await adminDoc.ref.update(updates);
}
