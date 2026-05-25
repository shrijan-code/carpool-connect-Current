import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import type { User } from '@/types';

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const userSnap = await getAdminDb().collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userSnap.data() as User;
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    let accountId = user.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { userId },
      });
      accountId = account.id;

      await getAdminDb().collection('users').doc(userId).update({
        stripeAccountId: accountId,
        updatedAt: new Date(),
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/stripe/connect`,
      return_url: `${appUrl}/stripe/connect/return`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ accountLinkUrl: accountLink.url });
  } catch (error) {
    console.error('Stripe connect create-account error:', error);
    return NextResponse.json({ error: 'Failed to create Stripe account' }, { status: 500 });
  }
}
