import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageAdmins } from '@/lib/auth';
import { db, auth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only global_admin can create users
    if (!canManageAdmins(session.role)) {
        return NextResponse.json({ error: 'Forbidden: Only Global Admins can create users' }, { status: 403 });
    }

    try {
        const { email, name, phone, role, password } = await request.json();

        // Validate required fields
        if (!email || !name || !role) {
            return NextResponse.json(
                { error: 'Email, name, and role are required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate role
        const validRoles = ['driver', 'rider', 'both'];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: 'Role must be driver, rider, or both' },
                { status: 400 }
            );
        }

        // Generate password if not provided
        const userPassword = password || Math.random().toString(36).slice(-12) + 'A1!';

        // Create Firebase Auth user
        const userRecord = await auth.createUser({
            email,
            password: userPassword,
            displayName: name,
            phoneNumber: phone ? (phone.startsWith('+') ? phone : `+61${phone.replace(/^0/, '')}`) : undefined,
        });

        // Create Firestore user document
        const userData = {
            email,
            name,
            displayName: name,
            phone: phone || '',
            role,
            preferredRole: role === 'both' ? 'rider' : role,
            canBeDriver: role === 'driver' || role === 'both',
            canBeRider: role === 'rider' || role === 'both',
            rating: 5.0,
            totalRides: 0,
            verified: false,
            suspended: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: session.id,
            createdByAdmin: true,
        };

        await db.collection('users').doc(userRecord.uid).set(userData);

        // Log the admin action
        await db.collection('admin_logs').add({
            action: 'create_user',
            adminId: session.id,
            adminEmail: session.email,
            targetUserId: userRecord.uid,
            targetEmail: email,
            data: { role, name },
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            user: {
                id: userRecord.uid,
                ...userData,
            },
            generatedPassword: password ? undefined : userPassword,
            message: 'User created successfully',
        });
    } catch (error: any) {
        console.error('Error creating user:', error);

        // Handle specific Firebase errors
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json(
                { error: 'A user with this email already exists' },
                { status: 409 }
            );
        }
        if (error.code === 'auth/invalid-phone-number') {
            return NextResponse.json(
                { error: 'Invalid phone number format' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Failed to create user' },
            { status: 500 }
        );
    }
}
