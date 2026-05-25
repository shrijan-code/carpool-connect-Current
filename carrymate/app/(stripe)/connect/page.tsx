import { Suspense } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StripeConnectPage from './StripeConnectClient';

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <StripeConnectPage />
    </Suspense>
  );
}
