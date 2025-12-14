import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase-admin';
import {
    verifyEmailOtp,
    verifyTotp,
    generateEmailOtp,
    storeOtp,
    sendOtpEmail,
} from '@/lib/mfa';
import { createSession, AdminUser } from '@/lib/auth';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

// POST: Verify MFA code and complete login
export async function POST(request: NextRequest) {
    try {
        const { mfaToken, code, method } = await request.json();

        if (!mfaToken || !code || !method) {
            return NextResponse.json(
                { error: 'MFA token, code, and method are required' },
                { status: 400 }
            );
        }

        // Verify the MFA token
        let adminData: any;
        try {
            const { jwtVerify } = await import('jose');
            const { payload } = await jwtVerify(mfaToken, secret);
            adminData = payload.pendingAdmin;
        } catch {
            return NextResponse.json(
                { error: 'Invalid or expired MFA session' },
                { status: 401 }
            );
        }

        // Get admin document for TOTP secret if needed
        const adminDoc = await db.collection('admins').doc(adminData.id).get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
        }

        const admin = adminDoc.data();
        let isValid = false;

        // Verify based on method
        if (method === 'email') {
            isValid = await verifyEmailOtp(adminData.id, code);
        } else if (method === 'totp') {
            if (!admin?.totpSecret) {
                return NextResponse.json(
                    { error: 'TOTP not configured' },
                    { status: 400 }
                );
            }
            isValid = verifyTotp(code, admin.totpSecret);
        }

        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid verification code' },
                { status: 401 }
            );
        }

        // Create full session
        const sessionAdmin: AdminUser = {
            id: adminData.id,
            email: adminData.email,
            name: adminData.name,
            role: adminData.role,
        };

        await createSession(sessionAdmin);

        return NextResponse.json({
            success: true,
            admin: sessionAdmin,
        });
    } catch (error) {
        console.error('MFA verification error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET: Request a new email OTP
export async function GET(request: NextRequest) {
    try {
        const mfaToken = request.nextUrl.searchParams.get('token');

        if (!mfaToken) {
            return NextResponse.json(
                { error: 'MFA token required' },
                { status: 400 }
            );
        }

        // Verify the MFA token
        let adminData: any;
        try {
            const { jwtVerify } = await import('jose');
            const { payload } = await jwtVerify(mfaToken, secret);
            adminData = payload.pendingAdmin;
        } catch {
            return NextResponse.json(
                { error: 'Invalid or expired MFA session' },
                { status: 401 }
            );
        }

        // Generate and send new OTP
        const otp = generateEmailOtp();
        await storeOtp(adminData.id, otp);
        const sent = await sendOtpEmail(adminData.email, otp, adminData.name);

        if (!sent) {
            return NextResponse.json(
                { error: 'Failed to send verification email' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Verification code sent to your email',
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
