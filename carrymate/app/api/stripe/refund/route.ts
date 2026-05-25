import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import { enrichBookingWithTrip, getBookingById, serverTimestamp } from '@/lib/booking-store';
import { calculateCancellationRefund } from '@/lib/refund';
import { dollarsToCents } from '@/lib/utils';
import { bookingCancelledEmail, sendEmail } from '@/lib/email';
import type { User } from '@/types';

interface RefundBody {
  bookingId: string;
  reason?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = (await request.json()) as RefundBody;
    if (!body.bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    let booking = await getBookingById(body.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    booking = await enrichBookingWithTrip(booking);

    const isParticipant =
      booking.senderId === userId ||
      booking.travellerId === userId;
    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const refundCalc = calculateCancellationRefund(booking, booking.status);
    if (!refundCalc.eligible) {
      return NextResponse.json({ error: refundCalc.message }, { status: 400 });
    }

    if (!booking.stripePaymentIntentId) {
      return NextResponse.json({ error: 'No payment to refund' }, { status: 400 });
    }

    const stripe = getStripe();
    const refundCents = dollarsToCents(refundCalc.refundAmount);

    if (refundCents > 0) {
      await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        amount: refundCents,
        reason: 'requested_by_customer',
        metadata: {
          bookingId: booking.id,
          reason: body.reason ?? 'Booking cancelled',
          refundPercent: String(refundCalc.refundPercent),
        },
      });
    }

    const newStatus = refundCalc.refundPercent === 100 ? 'refunded' : 'cancelled';

    await getAdminDb().collection('bookings').doc(booking.id).update({
      status: newStatus,
      cancelledAt: serverTimestamp(),
      cancelledBy: userId,
      updatedAt: serverTimestamp(),
    });

    const notifyIds = [booking.senderId, booking.travellerId];
    const users = await Promise.all(
      notifyIds.map((id) => getAdminDb().collection('users').doc(id).get())
    );

    const emailTemplate = bookingCancelledEmail(body.reason);
    await Promise.all(
      users
        .map((snap) => snap.data() as User | undefined)
        .filter((user): user is User => Boolean(user?.email))
        .map((user) => sendEmail({ to: user.email, ...emailTemplate }))
    );

    return NextResponse.json({
      success: true,
      refundAmount: refundCalc.refundAmount,
      travellerCompensation: refundCalc.travellerCompensation,
      refundPercent: refundCalc.refundPercent,
      message: refundCalc.message,
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
}
