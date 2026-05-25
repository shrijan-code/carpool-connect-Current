'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/toast/ToastProvider';

export default function StripeConnectPage() {
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/connect');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (searchParams.get('refresh') === '1') {
      toast('Stripe onboarding was interrupted. Please try again.', 'warning');
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (userProfile?.stripeOnboardingComplete) {
      router.replace('/trips/new');
    }
  }, [userProfile, router]);

  const startOnboarding = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast(data.error ?? 'Failed to start onboarding.', 'error');
      }
    } catch {
      toast('Failed to connect to Stripe.', 'error');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CreditCard className="mx-auto mb-4 h-12 w-12 text-brand-primary" />
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Set up payouts</h1>
        <p className="mb-6 text-sm text-gray-600">
          Connect your bank account via Stripe to receive payments when you carry items for others.
        </p>
        <Button className="w-full" onClick={() => void startOnboarding()} loading={connecting}>
          Continue to Stripe
        </Button>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-gray-500 hover:text-brand-primary"
          onClick={() => void refreshProfile()}
        >
          Skip for now
        </Link>
      </Card>
    </div>
  );
}
