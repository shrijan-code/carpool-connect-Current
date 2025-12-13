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
        const resolvedParams = await params;
        const rideDoc = await db.collection('rides').doc(resolvedParams.id).get();

        if (!rideDoc.exists) {
            return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
        }

        const rideData = rideDoc.data();

        // Fetch driver info
        let driver = null;
        if (rideData?.driverId) {
            const driverDoc = await db.collection('users').doc(rideData.driverId).get();
            if (driverDoc.exists) {
                const driverData = driverDoc.data();
                driver = {
                    id: driverDoc.id,
                    name: driverData?.name || 'Unknown',
                    email: driverData?.email || '',
                    phone: driverData?.phone || '',
                    rating: driverData?.rating || 0,
                };
            }
        }

        // Fetch bookings for this ride
        const bookingsSnapshot = await db.collection('bookings')
            .where('rideId', '==', resolvedParams.id)
            .orderBy('createdAt', 'desc')
            .get();

        const bookings = await Promise.all(
            bookingsSnapshot.docs.map(async (doc) => {
                const bookingData = doc.data();
                let passenger = null;

                const passengerId = bookingData.riderId || bookingData.passengerId;
                if (passengerId) {
                    const passengerDoc = await db.collection('users').doc(passengerId).get();
                    if (passengerDoc.exists) {
                        const passengerData = passengerDoc.data();
                        passenger = {
                            id: passengerDoc.id,
                            name: passengerData?.name || 'Unknown',
                            email: passengerData?.email || '',
                        };
                    }
                }

                return {
                    id: doc.id,
                    ...bookingData,
                    createdAt: bookingData.createdAt?.toDate?.()?.toISOString() || bookingData.createdAt,
                    passenger,
                };
            })
        );

        const ride = {
            id: rideDoc.id,
            ...rideData,
            createdAt: rideData?.createdAt?.toDate?.()?.toISOString() || rideData?.createdAt,
            departureTime: rideData?.departureTime?.toDate?.()?.toISOString() || rideData?.departureTime || rideData?.departureAt,
            driver,
            bookings,
        };

        return NextResponse.json({ ride });
    } catch (error) {
        console.error('Error fetching ride:', error);
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
        const { action, ...data } = await request.json();

        const rideDoc = await db.collection('rides').doc(resolvedParams.id).get();
        if (!rideDoc.exists) {
            return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
        }

        const rideData = rideDoc.data();
        let updateData: Record<string, any> = { updatedAt: new Date().toISOString() };

        switch (action) {
            case 'cancel':
                updateData.status = 'cancelled';
                updateData.cancelledAt = new Date().toISOString();
                updateData.cancelledBy = 'admin';
                updateData.cancellationReason = data.reason || 'Cancelled by admin';

                // Also cancel all pending/confirmed bookings
                const bookingsToCancel = await db.collection('bookings')
                    .where('rideId', '==', resolvedParams.id)
                    .where('status', 'in', ['pending', 'confirmed', 'pending_driver'])
                    .get();

                const batch = db.batch();
                bookingsToCancel.docs.forEach((doc) => {
                    batch.update(doc.ref, {
                        status: 'cancelled',
                        cancelledBy: 'admin',
                        cancellationReason: 'Ride cancelled by admin',
                        updatedAt: new Date().toISOString(),
                    });
                });
                await batch.commit();
                break;

            case 'update':
                if (data.status) updateData.status = data.status;
                if (data.pricePerSeat) updateData.pricePerSeat = data.pricePerSeat;
                if (data.seatsAvailable) updateData.seatsAvailable = data.seatsAvailable;
                break;

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

        await db.collection('rides').doc(resolvedParams.id).update(updateData);

        // Log the admin action
        await db.collection('admin_logs').add({
            action: `ride_${action}`,
            adminId: session.id,
            adminEmail: session.email,
            targetRideId: resolvedParams.id,
            data: { ...data, previousStatus: rideData?.status },
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, action });
    } catch (error) {
        console.error('Error updating ride:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
