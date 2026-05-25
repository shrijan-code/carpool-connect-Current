'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import type { Trip } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import { format } from 'date-fns';

export default function AdminTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getDocs(query(collection(getClientDb(), 'trips'), orderBy('createdAt', 'desc'))).then((snap) => {
      setTrips(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip));
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner className="mx-auto mt-20" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">All trips</h1>
      <Card padding={false}>
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Route</th>
              <th className="px-4 py-3 text-left">Traveller</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Items</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="px-4 py-3">{t.fromCity} → {t.toCity}</td>
                <td className="px-4 py-3">{t.travellerName}</td>
                <td className="px-4 py-3">
                  {t.travelDate?.toDate ? format(t.travelDate.toDate(), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3 capitalize">{t.status}</td>
                <td className="px-4 py-3">{t.currentItems}/{t.maxItems}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
