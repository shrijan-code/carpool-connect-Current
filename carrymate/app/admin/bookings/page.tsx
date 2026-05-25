'use client';

import { Fragment, useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import type { Booking, BookingStatus } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void getDocs(query(collection(getClientDb(), 'bookings'), orderBy('createdAt', 'desc'))).then((snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking));
      setLoading(false);
    });
  }, []);

  const filtered =
    statusFilter === 'all' ? bookings : bookings.filter((b) => b.status === statusFilter);

  const adminAction = async (bookingId: string, action: string) => {
    const confirmText = prompt(`Type CONFIRM to ${action} booking ${bookingId.slice(0, 8)}`);
    if (confirmText !== 'CONFIRM') return;
    alert(`Admin action "${action}" logged. Implement server-side handler for production.`);
  };

  if (loading) return <LoadingSpinner className="mx-auto mt-20" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">All bookings</h1>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'all')}
        className="mb-4 rounded-lg border px-3 py-2 text-sm"
      >
        <option value="all">All statuses</option>
        {(['pending', 'accepted', 'paid', 'picked_up', 'delivered', 'cancelled', 'disputed', 'refunded'] as BookingStatus[]).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <Card padding={false}>
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Route</th>
              <th className="px-4 py-3 text-left">Sender</th>
              <th className="px-4 py-3 text-left">Traveller</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <Fragment key={b.id}>
                <tr
                  className="cursor-pointer border-b hover:bg-gray-50"
                  onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs">{b.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    {b.fromCity && b.toCity ? `${b.fromCity} → ${b.toCity}` : '—'}
                  </td>
                  <td className="px-4 py-3">{b.senderName}</td>
                  <td className="px-4 py-3">{b.travellerId.slice(0, 8)}…</td>
                  <td className="px-4 py-3"><BookingStatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">${b.agreedPrice?.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setExpanded(b.id); }}>
                      View
                    </Button>
                  </td>
                </tr>
                {expanded === b.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-4 py-4">
                      <p className="mb-2"><strong>Item:</strong> {b.itemDescription}</p>
                      <p className="mb-2"><strong>Created:</strong> {b.createdAt?.toDate ? format(b.createdAt.toDate(), 'PPpp') : '—'}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => void adminAction(b.id, 'force complete')}>Force complete</Button>
                        <Button size="sm" variant="outline" onClick={() => void adminAction(b.id, 'force cancel')}>Force cancel</Button>
                        <Button size="sm" variant="danger" onClick={() => void adminAction(b.id, 'issue refund')}>Issue refund</Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
