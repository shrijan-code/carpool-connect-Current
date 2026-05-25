import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import { getBookingById, serverTimestamp } from '@/lib/booking-store';
import {
  deliveryConfirmedEmail,
  sendEmail,
} from '@/lib/email';
import type { User } from '@/types';

interface ConfirmDeliveryBody {
  bookingId: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = (await request.json()) as ConfirmDeliveryBody;
    if (!body.bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const booking = await getBookingById(body.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.senderId !== userId) {
      return NextResponse.json(
        { error: 'Only the sender can confirm delivery on behalf of the recipient' },
        { status: 403 }
      );
    }

    if (booking.status !== 'picked_up') {
      return NextResponse.json(
        { error: 'Booking must be picked up before delivery can be confirmed' },
        { status: 400 }
      );
    }

    if (!booking.stripePaymentIntentId) {
      return NextResponse.json({ error: 'No payment intent found for booking' }, { status: 400 });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.capture(booking.stripePaymentIntentId);

    await getAdminDb().collection('bookings').doc(booking.id).update({
      status: 'delivered',
      deliveryConfirmedAt: serverTimestamp(),
      stripeTransferId: paymentIntent.transfer_data?.destination ?? booking.stripeTransferId,
      updatedAt: serverTimestamp(),
    });

    const [senderSnap, travellerSnap] = await Promise.all([
      getAdminDb().collection('users').doc(booking.senderId).get(),
      getAdminDb().collection('users').doc(booking.travellerId).get(),
    ]);

    const sender = senderSnap.data() as User | undefined;
    const traveller = travellerSnap.data() as User | undefined;

    if (sender?.email) {
      const email = deliveryConfirmedEmail(sender.displayName, booking.travellerPayout, 'sender');
      await sendEmail({ to: sender.email, ...email });
    }

    if (traveller?.email) {
      const email = deliveryConfirmedEmail(
        traveller.displayName,
        booking.travellerPayout,
        'traveller'
      );
      await sendEmail({ to: traveller.email, ...email });
    }

    await getAdminDb().collection('users').doc(booking.travellerId).update({
      totalDeliveries: (traveller?.totalDeliveries ?? 0) + 1,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, status: 'delivered' });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    return NextResponse.json({ error: 'Failed to confirm delivery' }, { status: 500 });
  }
}
