import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import {
    generateTotpSecret,
    generateTotpQrCode,
    verifyTotp,
    storeTotpSecret,
    completeTotpSetup,
    getMfaStatus,
    updateMfaSettings,
    disableTotp,
    MfaMethod,
} from '@/lib/mfa';

// GET: Get MFA settings and generate TOTP setup if needed
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const action = request.nextUrl.searchParams.get('action');

        if (action === 'totp-setup') {
            // Generate new TOTP secret and QR code
            const secret = generateTotpSecret();
            const qrCode = await generateTotpQrCode(session.email, secret);

            // Store secret (not yet verified)
            await storeTotpSecret(session.id, secret);

            return NextResponse.json({
                secret,
                qrCode,
            });
        }

        // Default: return MFA status
        const status = await getMfaStatus(session.id);
        return NextResponse.json(status);
    } catch (error) {
        console.error('MFA setup GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST: Update MFA settings
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { action, code, method } = await request.json();

        switch (action) {
            case 'verify-totp': {
                // Verify TOTP code to complete setup
                const adminDoc = await db.collection('admins').doc(session.id).get();
                const admin = adminDoc.data();

                if (!admin?.totpSecret) {
                    return NextResponse.json(
                        { error: 'TOTP not configured. Please start setup first.' },
                        { status: 400 }
                    );
                }

                const isValid = verifyTotp(code, admin.totpSecret);
                if (!isValid) {
                    return NextResponse.json(
                        { error: 'Invalid code. Please try again.' },
                        { status: 400 }
                    );
                }

                // Complete TOTP setup
                await completeTotpSetup(session.id);

                return NextResponse.json({
                    success: true,
                    message: 'Authenticator app configured successfully!',
                });
            }

            case 'enable-email': {
                // Enable email MFA
                const currentStatus = await getMfaStatus(session.id);
                const newMethod: MfaMethod = currentStatus.totpConfigured ? 'both' : 'email';
                await updateMfaSettings(session.id, true, newMethod);

                return NextResponse.json({
                    success: true,
                    message: 'Email verification enabled',
                });
            }

            case 'disable-email': {
                const currentStatus = await getMfaStatus(session.id);
                if (currentStatus.method === 'email') {
                    await updateMfaSettings(session.id, false, null);
                } else if (currentStatus.method === 'both') {
                    await updateMfaSettings(session.id, true, 'totp');
                }

                return NextResponse.json({
                    success: true,
                    message: 'Email verification disabled',
                });
            }

            case 'disable-totp': {
                await disableTotp(session.id);
                return NextResponse.json({
                    success: true,
                    message: 'Authenticator app disabled',
                });
            }

            case 'disable-all': {
                await updateMfaSettings(session.id, false, null);
                await disableTotp(session.id);
                return NextResponse.json({
                    success: true,
                    message: 'MFA disabled',
                });
            }

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('MFA setup POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
