'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/trips', label: 'Trips' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/incidents', label: 'Incidents' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    document.cookie = 'admin_token=; path=/; max-age=0';
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b bg-brand-primary text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <span className="font-bold">CarryMate Admin</span>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-sm text-brand-light hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <nav className="hidden w-48 shrink-0 flex-col gap-1 md:flex">
          {adminLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                pathname === href
                  ? 'bg-brand-primary text-white'
                  : 'text-gray-700 hover:bg-white'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
