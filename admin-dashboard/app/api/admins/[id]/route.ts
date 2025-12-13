import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword, canManageAdmins } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import admin from '@/lib/firebase-admin';

// GET: Get admin details
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageAdmins(session.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const resolvedParams = await params;
        const adminDoc = await db.collection('admins').doc(resolvedParams.id).get();

        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
        }

        const adminData = adminDoc.data();
        return NextResponse.json({
            admin: {
                id: adminDoc.id,
                ...adminData,
                password: undefined,
                passwordHash: undefined,
                createdAt: adminData?.createdAt?.toDate?.()?.toISOString() || adminData?.createdAt,
                lastLogin: adminData?.lastLogin?.toDate?.()?.toISOString() || adminData?.lastLogin,
            }
        });
    } catch (error) {
        console.error('Error fetching admin:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Update admin (role, active status)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageAdmins(session.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const resolvedParams = await params;
        const body = await request.json();
        const { action, ...data } = body;

        const adminDoc = await db.collection('admins').doc(resolvedParams.id).get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
        }

        // Prevent self-modification of critical fields
        if (resolvedParams.id === session.id && (action === 'deactivate' || action === 'change_role')) {
            return NextResponse.json({ error: 'You cannot deactivate yourself or change your own role' }, { status: 400 });
        }

        let updateData: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

        switch (action) {
            case 'deactivate':
                updateData.active = false;
                break;
            case 'activate':
                updateData.active = true;
                break;
            case 'change_role':
                const validRoles = ['global_admin', 'editor_admin', 'viewer_admin'];
                if (!validRoles.includes(data.role)) {
                    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
                }
                updateData.role = data.role;
                break;
            case 'reset_password':
                const newPassword = data.password || Math.random().toString(36).slice(-8) + 'A1!';
                updateData.passwordHash = await hashPassword(newPassword);
                break;
            case 'update':
                if (data.name) updateData.name = data.name;
                if (data.email) updateData.email = data.email;
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        await adminDoc.ref.update(updateData);

        // Log the action
        await db.collection('admin_logs').add({
            action: `admin_${action}`,
            adminId: session.id,
            adminName: session.name,
            targetAdminId: resolvedParams.id,
            data: { action, ...data },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating admin:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Remove admin (permanently)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageAdmins(session.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const resolvedParams = await params;

        // Prevent self-deletion
        if (resolvedParams.id === session.id) {
            return NextResponse.json({ error: 'You cannot delete yourself' }, { status: 400 });
        }

        const adminDoc = await db.collection('admins').doc(resolvedParams.id).get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
        }

        const adminData = adminDoc.data();
        await adminDoc.ref.delete();

        // Log the action
        await db.collection('admin_logs').add({
            action: 'delete_admin',
            adminId: session.id,
            adminName: session.name,
            targetAdminId: resolvedParams.id,
            targetAdminEmail: adminData?.email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting admin:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
