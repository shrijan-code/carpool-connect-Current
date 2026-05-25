import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast/ToastProvider';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-light/40 to-white px-4 py-12">
          <Link
            href="/"
            className="mb-8 text-2xl font-bold text-brand-primary transition-colors hover:text-brand-secondary"
          >
            CarryMate
          </Link>
          <div className="w-full max-w-md">{children}</div>
          <p className="mt-8 text-center text-sm text-gray-500">
            Carry more. Share the journey.
          </p>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
