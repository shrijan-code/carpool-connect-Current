'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Menu,
  X,
  Package,
  PlusCircle,
  ClipboardList,
  User,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Image from 'next/image';

const navLinks = [
  { href: '/trips', label: 'Find a carrier', icon: Package },
  { href: '/trips/new', label: 'Post a trip', icon: PlusCircle },
  { href: '/bookings', label: 'My bookings', icon: ClipboardList },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, userProfile, signOut, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const hasActiveBookings =
    userProfile &&
    (userProfile.totalDeliveries > 0 || userProfile.totalSent > 0);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-xl font-bold text-brand-primary">
          CarryMate
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-brand-primary',
                pathname.startsWith(href) ? 'text-brand-primary' : 'text-gray-600'
              )}
            >
              {label}
            </Link>
          ))}
          {user && hasActiveBookings && (
            <Link href="/emergency">
              <Button variant="danger" size="sm">
                <AlertTriangle className="h-4 w-4" />
                Emergency
              </Button>
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {loading ? null : user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100"
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-full bg-brand-light">
                  {userProfile?.photoURL ? (
                    <Image
                      src={userProfile.photoURL}
                      alt={userProfile.displayName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-brand-primary">
                      {userProfile?.displayName?.[0] ?? 'U'}
                    </span>
                  )}
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-white py-1 shadow-lg">
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2 text-sm hover:bg-gray-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm hover:bg-gray-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-brand-danger hover:bg-gray-50"
                    onClick={() => {
                      setDropdownOpen(false);
                      void signOut();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t bg-white px-4 py-4 md:hidden">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 py-3 text-sm font-medium"
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {user && (
            <button
              type="button"
              className="flex w-full items-center gap-2 py-3 text-sm text-brand-danger"
              onClick={() => {
                setMobileOpen(false);
                void signOut();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
