import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword, canManageAdmins } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import admin from '@/lib/firebase-admin';

// GET: List all admins
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only global admins can list admins
    if (!canManageAdmins(session.role)) {
        return NextResponse.json({ error: 'Forbidden: Admin management access required' }, { status: 403 });
    }

    try {
        const snapshot = await db.collection('admins')
            .orderBy('createdAt', 'desc')
            .get();

        const admins = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            lastLogin: doc.data().lastLogin?.toDate?.()?.toISOString() || doc.data().lastLogin,
            // Never expose password hash
            password: undefined,
            passwordHash: undefined,
        }));

        return NextResponse.json({ admins });
    } catch (error) {
        console.error('Error fetching admins:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: Create new admin
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only global admins can create admins
    if (!canManageAdmins(session.role)) {
        return NextResponse.json({ error: 'Forbidden: Only Global Admins can create new admins' }, { status: 403 });
    }

    try {
        const { name, email, role, password } = await request.json();

        // Validate required fields
        if (!name || !email || !role) {
            return NextResponse.json({ error: 'Name, email, and role are required' }, { status: 400 });
        }

        // Validate role
        const validRoles = ['global_admin', 'editor_admin', 'viewer_admin'];
        if (!validRoles.includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        // Check if admin with email already exists
        const existingAdmin = await db.collection('admins')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (!existingAdmin.empty) {
            return NextResponse.json({ error: 'An admin with this email already exists' }, { status: 409 });
        }

        // Generate password if not provided
        const adminPassword = password || Math.random().toString(36).slice(-8) + 'A1!';
        const passwordHash = await hashPassword(adminPassword);

        // Create admin document
        const adminData = {
            name,
            email,
            role,
            passwordHash,
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: session.id,
        };

        const docRef = await db.collection('admins').add(adminData);

        // Log the action
        await db.collection('admin_logs').add({
            action: 'create_admin',
            adminId: session.id,
            adminName: session.name,
            targetAdminId: docRef.id,
            targetAdminEmail: email,
            data: { name, email, role },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
            success: true,
            admin: {
                id: docRef.id,
                name,
                email,
                role,
            },
            generatedPassword: password ? undefined : adminPassword,
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
