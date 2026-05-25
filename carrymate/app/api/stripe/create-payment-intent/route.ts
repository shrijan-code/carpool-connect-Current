import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import { enrichBookingWithTrip, getBookingById } from '@/lib/booking-store';
import { dollarsToCents } from '@/lib/utils';
import type { User } from '@/types';

interface CreatePaymentIntentBody {
  bookingId: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = (await request.json()) as CreatePaymentIntentBody;
    if (!body.bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const rawBooking = await getBookingById(body.bookingId);
    if (!rawBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = await enrichBookingWithTrip(rawBooking);

    if (booking.senderId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (booking.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Booking must be accepted before payment' },
        { status: 400 }
      );
    }

    if (!booking.declarationSignedAt || !booking.declarationData) {
      return NextResponse.json(
        { error: 'Prohibited items declaration must be completed first' },
        { status: 400 }
      );
    }

    const travellerSnap = await getAdminDb().collection('users').doc(booking.travellerId).get();
    if (!travellerSnap.exists) {
      return NextResponse.json({ error: 'Traveller not found' }, { status: 404 });
    }

    const traveller = travellerSnap.data() as User;
    if (!traveller.stripeAccountId || !traveller.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: 'Traveller has not completed Stripe onboarding' },
        { status: 400 }
      );
    }

    const totalAmount = booking.agreedPrice + booking.platformFee;
    const amountCents = dollarsToCents(totalAmount);
    const applicationFeeCents = dollarsToCents(booking.platformFee);

    const stripe = getStripe();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'aud',
      capture_method: 'manual',
      transfer_data: {
        destination: traveller.stripeAccountId,
      },
      application_fee_amount: applicationFeeCents,
      metadata: {
        bookingId: booking.id,
        senderId: booking.senderId,
        travellerId: booking.travellerId,
      },
    });

    await getAdminDb().collection('bookings').doc(booking.id).update({
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      platformFee: booking.platformFee,
      travellerPayout: booking.travellerPayout,
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 });
  }
}
