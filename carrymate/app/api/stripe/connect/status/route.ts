import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { uid } = (await request.json()) as { uid?: string };
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const accountId = userSnap.data()?.stripeAccountId as string | null;
    if (!accountId) {
      return NextResponse.json({ complete: false });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);
    const complete = account.details_submitted && account.charges_enabled;

    if (complete !== userSnap.data()?.stripeOnboardingComplete) {
      await userRef.update({ stripeOnboardingComplete: complete });
    }

    return NextResponse.json({ complete });
  } catch (error) {
    console.error('Stripe status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
