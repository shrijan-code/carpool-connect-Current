import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { serverTimestamp } from '@/lib/booking-store';
import {
  bookingCancelledEmail,
  paymentConfirmedEmail,
  sendEmail,
} from '@/lib/email';
import type { User } from '@/types';

export const runtime = 'nodejs';

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const bookingId = paymentIntent.metadata.bookingId;
  if (!bookingId) return;

  await getAdminDb().collection('bookings').doc(bookingId).update({
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const senderId = paymentIntent.metadata.senderId;
  if (!senderId) return;

  const senderSnap = await getAdminDb().collection('users').doc(senderId).get();
  const sender = senderSnap.data() as User | undefined;
  if (sender?.email) {
    const email = bookingCancelledEmail('Payment failed');
    await sendEmail({ to: sender.email, ...email });
  }
}

async function handlePaymentAuthorized(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const bookingId = paymentIntent.metadata.bookingId;
  if (!bookingId) return;

  const bookingRef = getAdminDb().collection('bookings').doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) return;

  const booking = bookingSnap.data();
  if (booking?.status !== 'accepted') return;

  if (paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'succeeded') {
    return;
  }

  await bookingRef.update({
    status: 'paid',
    updatedAt: serverTimestamp(),
  });

  const travellerId = paymentIntent.metadata.travellerId;
  const senderId = paymentIntent.metadata.senderId;

  const [travellerSnap, senderSnap] = await Promise.all([
    travellerId ? getAdminDb().collection('users').doc(travellerId).get() : null,
    senderId ? getAdminDb().collection('users').doc(senderId).get() : null,
  ]);

  const traveller = travellerSnap?.data() as User | undefined;
  const sender = senderSnap?.data() as User | undefined;

  if (traveller?.email) {
    const email = paymentConfirmedEmail(traveller.displayName, bookingId, 'traveller');
    await sendEmail({ to: traveller.email, ...email });
  }

  if (sender?.email) {
    const email = paymentConfirmedEmail(sender.displayName, bookingId, 'sender');
    await sendEmail({ to: sender.email, ...email });
  }
}

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  const userId = account.metadata?.userId;
  if (!userId) return;

  const onboardingComplete =
    account.details_submitted === true &&
    account.charges_enabled === true &&
    account.payouts_enabled === true;

  await getAdminDb().collection('users').doc(userId).update({
    stripeOnboardingComplete: onboardingComplete,
    updatedAt: serverTimestamp(),
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const stripe = getStripe();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentAuthorized(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.amount_capturable_updated':
        await handlePaymentAuthorized(event.data.object as Stripe.PaymentIntent);
        break;
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
