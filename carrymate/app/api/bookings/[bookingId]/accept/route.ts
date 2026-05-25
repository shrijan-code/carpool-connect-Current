import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import { getBookingById, serverTimestamp } from '@/lib/booking-store';
import { bookingAcceptedEmail, sendEmail } from '@/lib/email';
import type { User } from '@/types';

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
      return NextResponse.json({ error: 'Only the traveller can accept this booking' }, { status: 403 });
    }

    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: 'Booking is not in pending status' },
        { status: 400 }
      );
    }

    await getAdminDb().collection('bookings').doc(booking.id).update({
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });

    const senderSnap = await getAdminDb().collection('users').doc(booking.senderId).get();
    const travellerSnap = await getAdminDb().collection('users').doc(booking.travellerId).get();
    const sender = senderSnap.data() as User | undefined;
    const traveller = travellerSnap.data() as User | undefined;

    if (sender?.email && traveller?.displayName) {
      const email = bookingAcceptedEmail(
        sender.displayName,
        traveller.displayName,
        booking.id
      );
      await sendEmail({ to: sender.email, ...email });
    }

    return NextResponse.json({ success: true, status: 'accepted' });
  } catch (error) {
    console.error('Accept booking error:', error);
    return NextResponse.json({ error: 'Failed to accept booking' }, { status: 500 });
  }
}
