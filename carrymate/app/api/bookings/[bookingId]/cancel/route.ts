import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import { enrichBookingWithTrip, getBookingById, serverTimestamp } from '@/lib/booking-store';
import { calculateCancellationRefund } from '@/lib/refund';
import { dollarsToCents } from '@/lib/utils';
import { bookingCancelledEmail, sendEmail } from '@/lib/email';
import type { User } from '@/types';

interface CancelBody {
  reason?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { bookingId: string } }
): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = (await request.json()) as CancelBody;

    let booking = await getBookingById(params.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    booking = await enrichBookingWithTrip(booking);

    const isSender = booking.senderId === userId;
    const isTraveller = booking.travellerId === userId;

    if (!isSender && !isTraveller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cancellableStatuses = ['pending', 'accepted', 'paid'];
    if (!cancellableStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: 'Booking cannot be cancelled in its current status' },
        { status: 400 }
      );
    }

    const refundCalc = calculateCancellationRefund(booking, booking.status);

    if (booking.status === 'paid' && !refundCalc.eligible) {
      return NextResponse.json({ error: refundCalc.message }, { status: 400 });
    }

    if (booking.stripePaymentIntentId && refundCalc.eligible && refundCalc.refundAmount > 0) {
      const stripe = getStripe();
      await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        amount: dollarsToCents(refundCalc.refundAmount),
        reason: 'requested_by_customer',
        metadata: {
          bookingId: booking.id,
          reason: body.reason ?? 'Booking cancelled',
          refundPercent: String(refundCalc.refundPercent),
        },
      });
    }

    const newStatus =
      booking.status === 'paid' && refundCalc.refundPercent === 100
        ? 'refunded'
        : 'cancelled';

    const batch = getAdminDb().batch();
    const bookingRef = getAdminDb().collection('bookings').doc(booking.id);

    batch.update(bookingRef, {
      status: newStatus,
      cancelledAt: serverTimestamp(),
      cancelledBy: userId,
      updatedAt: serverTimestamp(),
    });

    if (booking.status === 'pending' || booking.status === 'accepted') {
      batch.update(getAdminDb().collection('trips').doc(booking.tripId), {
        currentItems: FieldValue.increment(-1),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    const emailTemplate = bookingCancelledEmail(body.reason);
    const notifyIds = [booking.senderId, booking.travellerId];

    await Promise.all(
      notifyIds.map(async (id) => {
        const snap = await getAdminDb().collection('users').doc(id).get();
        const user = snap.data() as User | undefined;
        if (user?.email) {
          await sendEmail({ to: user.email, ...emailTemplate });
        }
      })
    );

    return NextResponse.json({
      success: true,
      status: newStatus,
      refundAmount: refundCalc.refundAmount,
      travellerCompensation: refundCalc.travellerCompensation,
      refundPercent: refundCalc.refundPercent,
      message: refundCalc.message,
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
