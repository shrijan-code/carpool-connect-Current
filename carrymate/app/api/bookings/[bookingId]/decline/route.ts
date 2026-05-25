import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import { getBookingById, serverTimestamp } from '@/lib/booking-store';

export async function POST(
  request: Request,
  { params }: { params: { bookingId: string } }
): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const booking = await getBookingById(params.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.travellerId !== userId) {
      return NextResponse.json({ error: 'Only the traveller can decline this booking' }, { status: 403 });
    }

    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: 'Booking is not in pending status' },
        { status: 400 }
      );
    }

    const batch = getAdminDb().batch();

    batch.update(getAdminDb().collection('bookings').doc(booking.id), {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy: userId,
      updatedAt: serverTimestamp(),
    });

    batch.update(getAdminDb().collection('trips').doc(booking.tripId), {
      currentItems: FieldValue.increment(-1),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ success: true, status: 'cancelled' });
  } catch (error) {
    console.error('Decline booking error:', error);
    return NextResponse.json({ error: 'Failed to decline booking' }, { status: 500 });
  }
}
