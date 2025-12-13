import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search') || '';
        const limit = parseInt(searchParams.get('limit') || '100');

        let query: any = db.collection('bookings').orderBy('createdAt', 'desc');

        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.limit(limit).get();

        const bookings = await Promise.all(
            snapshot.docs.map(async (doc: any) => {
                const data = doc.data();

                // Fetch rider info
                let rider = null;
                const riderId = data.riderId || data.passengerId;
                if (riderId) {
                    const riderDoc = await db.collection('users').doc(riderId).get();
                    if (riderDoc.exists) {
                        const riderData = riderDoc.data();
                        rider = {
                            id: riderDoc.id,
                            name: riderData?.name || 'Unknown',
                            email: riderData?.email || '',
                        };
                    }
                }

                // Fetch ride info
                let ride = null;
                if (data.rideId) {
                    const rideDoc = await db.collection('rides').doc(data.rideId).get();
                    if (rideDoc.exists) {
                        const rideData = rideDoc.data();
                        ride = {
                            id: rideDoc.id,
                            origin: rideData?.from?.name || rideData?.origin?.name || rideData?.origin || 'Unknown',
                            destination: rideData?.to?.name || rideData?.destination?.name || rideData?.destination || 'Unknown',
                            departureTime: rideData?.departureTime || rideData?.departureAt,
                        };
                    }
                }

                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                    rider,
                    ride,
                };
            })
        );

        // Client-side search filtering
        let filteredBookings = bookings;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredBookings = bookings.filter((booking: any) =>
                booking.id.toLowerCase().includes(searchLower) ||
                booking.rider?.name?.toLowerCase().includes(searchLower) ||
                booking.rider?.email?.toLowerCase().includes(searchLower)
            );
        }

        return NextResponse.json({ bookings: filteredBookings });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
