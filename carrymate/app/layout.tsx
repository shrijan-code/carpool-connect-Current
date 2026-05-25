import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast/ToastProvider';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CarryMate — Community item delivery',
  description: 'Send items with trusted travellers between Canberra, Sydney, and Melbourne.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white font-sans text-gray-900 antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
