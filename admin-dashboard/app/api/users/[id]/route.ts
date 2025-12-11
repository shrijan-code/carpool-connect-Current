import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userDoc = await db.collection('users').doc(params.id).get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        // Fetch user's rides as driver
        const ridesSnapshot = await db.collection('rides')
            .where('driverId', '==', params.id)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const rides = ridesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        }));

        // Fetch user's bookings as passenger
        const bookingsSnapshot = await db.collection('bookings')
            .where('passengerId', '==', params.id)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const bookings = bookingsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        }));

        // Fetch emergency contacts
        const contactsSnapshot = await db.collection('emergency_contacts')
            .where('userId', '==', params.id)
            .get();

        const emergencyContacts = contactsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        const user = {
            id: userDoc.id,
            ...userData,
            createdAt: userData?.createdAt?.toDate?.()?.toISOString() || userData?.createdAt,
            rides,
            bookings,
            emergencyContacts,
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

    // Only super_admin can suspend users
    if (session.role !== 'super_admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { suspended } = await request.json();

        await db.collection('users').doc(params.id).update({
            suspended,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
