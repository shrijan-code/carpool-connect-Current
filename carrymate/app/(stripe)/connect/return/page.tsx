'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Link from 'next/link';

export default function StripeConnectReturnPage() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'complete' | 'incomplete'>('loading');

  useEffect(() => {
    async function checkStatus() {
      if (!user) {
        router.push('/login?redirect=/connect/return');
        return;
      }

      try {
        const res = await fetch('/api/stripe/connect/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid }),
        });
        const data = (await res.json()) as { complete?: boolean };
        await refreshProfile();
        setStatus(data.complete ? 'complete' : 'incomplete');
      } catch {
        setStatus('incomplete');
      }
    }

    void checkStatus();
  }, [user, router, refreshProfile]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-600">Verifying your Stripe account…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md text-center">
        {status === 'complete' ? (
          <>
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-brand-success" />
            <h1 className="mb-2 text-2xl font-bold text-gray-900">Payouts enabled</h1>
            <p className="mb-6 text-sm text-gray-600">
              Your Stripe account is set up. You can now post trips and receive payouts.
            </p>
            <Link href="/trips/new">
              <Button className="w-full">Post your first trip</Button>
            </Link>
          </>
        ) : (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-brand-warning" />
            <h1 className="mb-2 text-2xl font-bold text-gray-900">Setup incomplete</h1>
            <p className="mb-6 text-sm text-gray-600">
              Stripe onboarding is not finished yet. Please complete all required steps.
            </p>
            <Link href="/connect">
              <Button className="w-full">Continue setup</Button>
            </Link>
          </>
        )}
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-gray-500 hover:text-brand-primary">
          Go to dashboard
        </Link>
      </Card>
    </div>
  );
}
