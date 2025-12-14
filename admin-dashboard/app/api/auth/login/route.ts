import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { verifyAdmin, createSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import { generateEmailOtp, storeOtp, sendOtpEmail } from '@/lib/mfa';
import {
    checkIpRateLimit,
    checkEmailRateLimit,
    recordIpFailure,
    recordEmailFailure,
    resetRateLimit,
} from '@/lib/rate-limiter';
import {
    validateEmail,
    validatePassword,
    getClientIp,
    logSecurityEvent,
    checkAccountLockout,
    recordFailedLoginAttempt,
    resetFailedLoginAttempts,
} from '@/lib/security';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

// Security headers for all responses
const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
};

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
        // 1. Rate limiting check (IP-based)
        const ipRateLimit = checkIpRateLimit(clientIp);
        if (!ipRateLimit.allowed) {
            await logSecurityEvent('login_rate_limited', {
                ip: clientIp,
                reason: 'IP rate limit exceeded',
                userAgent,
            });

            return NextResponse.json(
                {
                    error: ipRateLimit.reason,
                    retryAfter: ipRateLimit.retryAfterSeconds,
                },
                {
                    status: 429,
                    headers: {
                        ...securityHeaders,
                        'Retry-After': String(ipRateLimit.retryAfterSeconds || 900),
                    },
                }
            );
        }

        // 2. Parse and validate input
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400, headers: securityHeaders }
            );
        }

        const { email, password } = body;

        // 3. Validate email format
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            return NextResponse.json(
                { error: emailValidation.error },
                { status: 400, headers: securityHeaders }
            );
        }
        const sanitizedEmail = emailValidation.sanitized!;

        // 4. Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return NextResponse.json(
                { error: passwordValidation.error },
                { status: 400, headers: securityHeaders }
            );
        }

        // 5. Rate limiting check (email-based)
        const emailRateLimit = checkEmailRateLimit(sanitizedEmail);
        if (!emailRateLimit.allowed) {
            await logSecurityEvent('login_rate_limited', {
                email: sanitizedEmail,
                ip: clientIp,
                reason: 'Email rate limit exceeded',
                userAgent,
            });

            return NextResponse.json(
                {
                    error: emailRateLimit.reason,
                    retryAfter: emailRateLimit.retryAfterSeconds,
                },
                {
                    status: 429,
                    headers: {
                        ...securityHeaders,
                        'Retry-After': String(emailRateLimit.retryAfterSeconds || 1800),
                    },
                }
            );
        }

        // 6. Attempt authentication
        const admin = await verifyAdmin(sanitizedEmail, password);

        if (!admin) {
            // Record failures
            recordIpFailure(clientIp);
            recordEmailFailure(sanitizedEmail);

            // Log the failed attempt
            await logSecurityEvent('login_failed', {
                email: sanitizedEmail,
                ip: clientIp,
                reason: 'Invalid credentials',
                userAgent,
            });

            // Generic error (don't reveal if email exists)
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401, headers: securityHeaders }
            );
        }

        // 7. Check account lockout status
        const lockout = await checkAccountLockout(admin.id);
        if (lockout.locked) {
            await logSecurityEvent('account_locked', {
                email: sanitizedEmail,
                ip: clientIp,
                reason: lockout.reason,
                lockedUntil: lockout.lockedUntil?.toISOString(),
                userAgent,
            });

            return NextResponse.json(
                {
                    error: 'Account is temporarily locked. Please try again later.',
                    lockedUntil: lockout.lockedUntil?.toISOString(),
                },
                { status: 423, headers: securityHeaders }
            );
        }

        // 8. Reset rate limits and failed attempts on successful auth
        resetRateLimit(clientIp, sanitizedEmail);
        await resetFailedLoginAttempts(admin.id);

        // 9. Check if MFA is enabled for this admin
        const adminDoc = await db.collection('admins').doc(admin.id).get();
        const adminData = adminDoc.data();

        if (adminData?.mfaEnabled) {
            // MFA is enabled - create a temporary MFA token
            const mfaToken = await new SignJWT({ pendingAdmin: admin })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('10m') // 10 minutes to complete MFA
                .sign(secret);

            // If email method is enabled, send OTP automatically
            let emailSent = false;
            if (adminData.mfaMethod === 'email' || adminData.mfaMethod === 'both') {
                const otp = generateEmailOtp();
                await storeOtp(admin.id, otp);
                emailSent = await sendOtpEmail(admin.email, otp, admin.name);
            }

            return NextResponse.json(
                {
                    mfaRequired: true,
                    mfaToken,
                    mfaMethod: adminData.mfaMethod,
                    totpConfigured: adminData.totpVerified ?? false,
                    emailSent,
                    admin: {
                        name: admin.name,
                        email: admin.email,
                    },
                },
                { headers: securityHeaders }
            );
        }

        // 10. No MFA - create regular session and log success
        await createSession(admin);

        await logSecurityEvent('login_success', {
            email: sanitizedEmail,
            ip: clientIp,
            adminId: admin.id,
            userAgent,
        });

        return NextResponse.json(
            {
                success: true,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                },
            },
            { headers: securityHeaders }
        );
    } catch (error) {
        console.error('Login error:', error);

        // Log the error (without exposing details to client)
        await logSecurityEvent('login_failed', {
            ip: clientIp,
            reason: 'Internal server error',
            userAgent,
        });

        return NextResponse.json(
            { error: 'An error occurred. Please try again.' },
            { status: 500, headers: securityHeaders }
        );
    }
}
