'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import type { Booking, User, Incident } from '@/types';
import { format } from 'date-fns';

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    trips: 0,
    bookings: 0,
    revenue: 0,
    platformFees: 0,
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [openIncidents, setOpenIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [usersSnap, tripsSnap, bookingsSnap, incidentsSnap] = await Promise.all([
          getDocs(collection(getClientDb(), 'users')),
          getDocs(collection(getClientDb(), 'trips')),
          getDocs(query(collection(getClientDb(), 'bookings'), orderBy('createdAt', 'desc'), limit(20))),
          getDocs(query(collection(getClientDb(), 'incidents'), orderBy('createdAt', 'desc'), limit(10))),
        ]);

        let revenue = 0;
        let platformFees = 0;
        const bookings = bookingsSnap.docs.map((d) => {
          const b = { id: d.id, ...d.data() } as Booking;
          if (b.status === 'delivered' || b.status === 'paid' || b.status === 'picked_up') {
            revenue += b.agreedPrice ?? 0;
            platformFees += b.platformFee ?? 0;
          }
          return b;
        });

        const users = usersSnap.docs
          .map((d) => ({ uid: d.id, ...d.data() }) as User)
          .slice(0, 10);

        const incidents = incidentsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Incident)
          .filter((i) => i.status === 'open');

        setStats({
          users: usersSnap.size,
          trips: tripsSnap.size,
          bookings: bookingsSnap.size,
          revenue,
          platformFees,
        });
        setRecentBookings(bookings);
        setRecentUsers(users);
        setOpenIncidents(incidents);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total users', value: stats.users },
          { label: 'Total trips', value: stats.trips },
          { label: 'Total bookings', value: stats.bookings },
          { label: 'Platform fees earned', value: `$${stats.platformFees.toFixed(2)}` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-brand-primary">{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Recent bookings</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Route</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={b.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">
                    {b.fromCity && b.toCity ? `${b.fromCity} → ${b.toCity}` : b.id.slice(0, 8)}
                  </td>
                  <td className="py-2 pr-4">
                    <BookingStatusBadge status={b.status} />
                  </td>
                  <td className="py-2 pr-4">${b.agreedPrice?.toFixed(2) ?? '0.00'}</td>
                  <td className="py-2">
                    {b.createdAt?.toDate
                      ? format(b.createdAt.toDate(), 'dd MMM yyyy')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">New users</h2>
          <ul className="space-y-2 text-sm">
            {recentUsers.map((u) => (
              <li key={u.uid} className="flex justify-between border-b border-gray-100 py-2">
                <span>{u.displayName}</span>
                <span className="text-gray-400">{u.email}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Open incidents ({openIncidents.length})</h2>
          {openIncidents.length === 0 ? (
            <p className="text-sm text-gray-500">No open incidents.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {openIncidents.map((i) => (
                <li key={i.id} className="border-b border-gray-100 py-2">
                  <span className="font-medium">{i.type}</span> — {i.description.slice(0, 60)}…
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
