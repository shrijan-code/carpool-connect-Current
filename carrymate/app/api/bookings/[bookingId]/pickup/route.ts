import { NextResponse } from 'next/server';
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
      return NextResponse.json(
        { error: 'Only the traveller can confirm pickup' },
        { status: 403 }
      );
    }

    if (booking.status !== 'paid') {
      return NextResponse.json(
        { error: 'Booking must be paid before pickup can be confirmed' },
        { status: 400 }
      );
    }

    await getAdminDb().collection('bookings').doc(booking.id).update({
      status: 'picked_up',
      pickupConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, status: 'picked_up' });
  } catch (error) {
    console.error('Confirm pickup error:', error);
    return NextResponse.json({ error: 'Failed to confirm pickup' }, { status: 500 });
  }
}
