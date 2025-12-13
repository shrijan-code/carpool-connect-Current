import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageAdmins } from '@/lib/auth';
import { db, auth } from '@/lib/firebase-admin';
import admin from '@/lib/firebase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const resolvedParams = await params;
        const userDoc = await db.collection('users').doc(resolvedParams.id).get();

        if (!userDoc.exists) {
            console.log('User document not found for ID:', resolvedParams.id);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        // Fetch user's rides as driver - with fallback
        let rides: any[] = [];
        try {
            const ridesSnapshot = await db.collection('rides')
                .where('driverId', '==', resolvedParams.id)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            rides = ridesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            }));
        } catch (ridesError) {
            console.log('Error fetching rides (may need index):', ridesError);
        }

        // Fetch user's bookings as passenger - with fallback
        let bookings: any[] = [];
        try {
            const bookingsSnapshot = await db.collection('bookings')
                .where('riderId', '==', resolvedParams.id)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            bookings = bookingsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            }));
        } catch (bookingsError) {
            console.log('Error fetching bookings (may need index):', bookingsError);
        }

        // Fetch emergency contacts - with fallback
        let emergencyContacts: any[] = [];
        try {
            const contactsSnapshot = await db.collection('emergency_contacts')
                .where('userId', '==', resolvedParams.id)
                .get();

            emergencyContacts = contactsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (contactsError) {
            console.log('Error fetching emergency contacts:', contactsError);
        }

        // Fetch payment methods count - with fallback
        let paymentMethodsCount = 0;
        try {
            const paymentMethodsSnapshot = await db.collection('payment_methods')
                .where('userId', '==', resolvedParams.id)
                .get();
            paymentMethodsCount = paymentMethodsSnapshot.size;
        } catch (paymentError) {
            console.log('Error fetching payment methods:', paymentError);
        }

        // Fetch admin action logs for this user - with fallback
        let adminLogs: any[] = [];
        try {
            const logsSnapshot = await db.collection('admin_logs')
                .where('targetUserId', '==', resolvedParams.id)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            adminLogs = logsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (logsError) {
            console.log('Error fetching admin logs (may need index):', logsError);
        }

        const user = {
            id: userDoc.id,
            ...userData,
            createdAt: userData?.createdAt?.toDate?.()?.toISOString() || userData?.createdAt,
            rides,
            bookings,
            emergencyContacts,
            paymentMethodsCount,
            adminLogs,
            stripeInfo: {
                accountId: userData?.stripeAccountId || null,
                connectStatus: userData?.stripeConnectStatus || 'not_started',
                chargesEnabled: userData?.stripeChargesEnabled || false,
                detailsSubmitted: userData?.stripeDetailsSubmitted || false,
            },
        };

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const resolvedParams = await params;
        const body = await request.json();
        const { action, ...data } = body;

        // Different actions require different permission levels
        const adminOnlyActions = ['suspend', 'unsuspend', 'update_role', 'delete'];
        if (adminOnlyActions.includes(action) && !canManageAdmins(session.role)) {
            return NextResponse.json({ error: 'Forbidden: Global Admin access required' }, { status: 403 });
        }

        const userDoc = await db.collection('users').doc(resolvedParams.id).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        let updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
        let logAction = action || 'update';

        switch (action) {
            case 'suspend':
                updateData.suspended = true;
                updateData.suspendedAt = new Date().toISOString();
                updateData.suspendedBy = session.id;
                break;

            case 'unsuspend':
                updateData.suspended = false;
                updateData.suspendedAt = admin.firestore.FieldValue.delete();
                updateData.suspendedBy = admin.firestore.FieldValue.delete();
                break;

            case 'update_role':
                if (!['driver', 'rider', 'both'].includes(data.role)) {
                    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
                }
                updateData.role = data.role;
                updateData.canBeDriver = data.role === 'driver' || data.role === 'both';
                updateData.canBeRider = data.role === 'rider' || data.role === 'both';
                break;

            case 'update_details':
                if (data.name) updateData.name = data.name;
                if (data.displayName) updateData.displayName = data.displayName;
                if (data.phone) updateData.phone = data.phone;
                break;

            default:
                // Legacy support for simple suspended boolean
                if (typeof data.suspended === 'boolean') {
                    updateData.suspended = data.suspended;
                    logAction = data.suspended ? 'suspend' : 'unsuspend';
                }
                if (typeof data.status === 'string') {
                    updateData.status = data.status;
                    logAction = 'update_status';
                }
        }

        await db.collection('users').doc(resolvedParams.id).update(updateData);

        // Log the admin action
        await db.collection('admin_logs').add({
            action: logAction,
            adminId: session.id,
            adminEmail: session.email,
            targetUserId: resolvedParams.id,
            targetEmail: userData?.email,
            previousData: { suspended: userData?.suspended, role: userData?.role },
            newData: updateData,
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, action: logAction });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Reset password endpoint
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const resolvedParams = await params;
        const { action, ...data } = await request.json();

        const userDoc = await db.collection('users').doc(resolvedParams.id).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        switch (action) {
            case 'reset_password': {
                if (!userData?.email) {
                    return NextResponse.json({ error: 'User has no email' }, { status: 400 });
                }

                // Generate password reset link
                const resetLink = await auth.generatePasswordResetLink(userData.email);

                // Log the action
                await db.collection('admin_logs').add({
                    action: 'reset_password',
                    adminId: session.id,
                    adminEmail: session.email,
                    targetUserId: resolvedParams.id,
                    targetEmail: userData.email,
                    createdAt: new Date().toISOString(),
                });

                return NextResponse.json({
                    success: true,
                    message: 'Password reset link generated',
                    resetLink, // In production, you might email this instead
                });
            }

            case 'send_notification': {
                const { title, body, type = 'system' } = data;

                if (!title || !body) {
                    return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
                }

                // Create notification in Firestore
                await db.collection('notifications').add({
                    userId: resolvedParams.id,
                    title,
                    body,
                    type,
                    read: false,
                    createdAt: new Date().toISOString(),
                    sentBy: session.id,
                });

                // Log the action
                await db.collection('admin_logs').add({
                    action: 'send_notification',
                    adminId: session.id,
                    adminEmail: session.email,
                    targetUserId: resolvedParams.id,
                    targetEmail: userData?.email,
                    data: { title, body },
                    createdAt: new Date().toISOString(),
                });

                return NextResponse.json({ success: true, message: 'Notification sent' });
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error processing user action:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
