'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { LayoutDashboard, Package, ClipboardList, PlusCircle } from 'lucide-react';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import type { Booking, Trip } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import RouteDisplay from '@/components/ui/RouteDisplay';
import { DetailPageSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function DashboardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [sendingBookings, setSendingBookings] = useState<Booking[]>([]);
  const [carryingBookings, setCarryingBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    async function loadData() {
      try {
        const [tripsSnap, sendingSnap, carryingSnap] = await Promise.all([
          getDocs(
            query(
              collection(getClientDb(), 'trips'),
              where('travellerId', '==', user!.uid),
              where('status', 'in', ['open', 'full']),
              orderBy('travelDate', 'asc'),
              limit(5)
            )
          ),
          getDocs(
            query(
              collection(getClientDb(), 'bookings'),
              where('senderId', '==', user!.uid),
              orderBy('createdAt', 'desc'),
              limit(5)
            )
          ),
          getDocs(
            query(
              collection(getClientDb(), 'bookings'),
              where('travellerId', '==', user!.uid),
              orderBy('createdAt', 'desc'),
              limit(5)
            )
          ),
        ]);

        setTrips(tripsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip));
        setSendingBookings(sendingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking));
        setCarryingBookings(carryingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking));
      } catch {
        // Queries may fail without composite indexes; fall back to empty
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const activeSending = sendingBookings.filter(
    (b) => !['cancelled', 'refunded', 'delivered'].includes(b.status)
  ).length;
  const activeCarrying = carryingBookings.filter(
    (b) => !['cancelled', 'refunded', 'delivered'].includes(b.status)
  ).length;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back{userProfile?.displayName ? `, ${userProfile.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-gray-600">Here is an overview of your CarryMate activity.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/trips/new">
            <Button>
              <PlusCircle className="h-4 w-4" />
              Post trip
            </Button>
          </Link>
          <Link href="/trips">
            <Button variant="outline">Find carrier</Button>
          </Link>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-light p-2">
              <Package className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trips.length}</p>
              <p className="text-sm text-gray-500">Open trips</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-light p-2">
              <ClipboardList className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeSending}</p>
              <p className="text-sm text-gray-500">Items sending</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-light p-2">
              <LayoutDashboard className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCarrying}</p>
              <p className="text-sm text-gray-500">Items carrying</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your trips</h2>
            <Link href="/trips/new" className="text-sm text-brand-primary hover:underline">
              Post new
            </Link>
          </div>
          {trips.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500">No open trips. Post one to start earning.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <Link key={trip.id} href={`/trips/${trip.id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <RouteDisplay fromCity={trip.fromCity} toCity={trip.toCity} showDistance={false} />
                    <p className="mt-2 text-xs text-gray-500">
                      {format(trip.travelDate.toDate(), 'dd MMM yyyy')} · {trip.currentItems}/
                      {trip.maxItems} items
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent bookings</h2>
            <Link href="/bookings" className="text-sm text-brand-primary hover:underline">
              View all
            </Link>
          </div>
          {[...sendingBookings, ...carryingBookings]
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
            .slice(0, 5).length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500">No bookings yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {[...sendingBookings, ...carryingBookings]
                .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
                .slice(0, 5)
                .map((booking) => (
                  <Link key={booking.id} href={`/bookings/${booking.id}`}>
                    <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
                      <div>
                        <p className="text-sm font-medium">{booking.senderName}</p>
                        {booking.fromCity && booking.toCity && (
                          <p className="text-xs text-gray-500">
                            {booking.fromCity} → {booking.toCity}
                          </p>
                        )}
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </Card>
                  </Link>
                ))}
            </div>
          )}
        </section>
      </div>

      {userProfile && !userProfile.stripeOnboardingComplete && (
        <Card className="mt-8 border-brand-warning/30 bg-amber-50">
          <p className="text-sm text-amber-800">
            Complete Stripe setup to receive payouts when you carry items.{' '}
            <Link href="/connect" className="font-medium underline">
              Set up now
            </Link>
          </p>
        </Card>
      )}
    </div>
  );
}
