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

    const userData = userSnap.data()!;
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    let accountId = userData.stripeAccountId as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        email: userData.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { firebaseUid: uid },
      });
      accountId = account.id;
      await userRef.update({ stripeAccountId: accountId });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/connect?refresh=1`,
      return_url: `${appUrl}/connect/return`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error('Stripe connect error:', error);
    return NextResponse.json({ error: 'Failed to create onboarding link' }, { status: 500 });
  }
}
