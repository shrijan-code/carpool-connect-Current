'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import type { Booking } from '@/types';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { BookingRowSkeleton } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import RouteDisplay from '@/components/ui/RouteDisplay';
import { DetailPageSkeleton } from '@/components/ui/Skeleton';

type Tab = 'sending' | 'carrying';

export default function BookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('sending');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/bookings');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const field = tab === 'sending' ? 'senderId' : 'travellerId';
    const q = query(
      collection(getClientDb(), 'bookings'),
      where(field, '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setBookings(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking)
        );
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [user, tab]);

  const activeBookings = useMemo(
    () => bookings.filter((b) => !['cancelled', 'refunded', 'delivered'].includes(b.status)),
    [bookings]
  );

  if (authLoading) return <DetailPageSkeleton />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My bookings</h1>
        <p className="mt-1 text-gray-600">Track items you are sending or carrying.</p>
      </div>

      <div className="mb-6 flex gap-2 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setTab('sending');
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'sending' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600'
          }`}
        >
          I am sending
        </button>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setTab('carrying');
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'carrying' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600'
          }`}
        >
          I am carrying
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <BookingRowSkeleton key={i} />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === 'sending' ? 'No items sent yet' : 'No items to carry yet'}
          description={
            tab === 'sending'
              ? 'Find a carrier and send your first item.'
              : 'Post a trip to start receiving booking requests.'
          }
          actionLabel={tab === 'sending' ? 'Find a carrier' : 'Post a trip'}
          onAction={() => router.push(tab === 'sending' ? '/trips' : '/trips/new')}
        />
      ) : (
        <div className="space-y-3">
          {activeBookings.length > 0 && (
            <p className="text-sm text-gray-500">{activeBookings.length} active booking(s)</p>
          )}
          {bookings.map((booking) => {
            const travelDate = booking.travelDate?.toDate?.();
            return (
              <Link key={booking.id} href={`/bookings/${booking.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {booking.fromCity && booking.toCity && (
                        <RouteDisplay
                          fromCity={booking.fromCity}
                          toCity={booking.toCity}
                          showDistance={false}
                          className="mb-2"
                        />
                      )}
                      <p className="text-sm text-gray-600">
                        {tab === 'sending' ? `To: ${booking.recipientName}` : `From: ${booking.senderName}`}
                      </p>
                      {travelDate && (
                        <p className="text-xs text-gray-400">
                          {format(travelDate, 'dd MMM yyyy')}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-medium">${booking.agreedPrice.toFixed(2)} AUD</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <BookingStatusBadge status={booking.status} />
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
