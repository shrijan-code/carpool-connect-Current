'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import type { Incident } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | Incident['status']>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    void getDocs(query(collection(getClientDb(), 'incidents'), orderBy('createdAt', 'desc'))).then((snap) => {
      setIncidents(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Incident));
      setLoading(false);
    });
  }, []);

  const filtered =
    statusFilter === 'all' ? incidents : incidents.filter((i) => i.status === statusFilter);

  const updateStatus = async (incidentId: string, status: Incident['status']) => {
    try {
      await updateDoc(doc(getClientDb(), 'incidents', incidentId), {
        status,
        adminNotes: notes,
        resolvedAt: status === 'resolved' ? new Date().toISOString() : null,
      });
      setIncidents((prev) =>
        prev.map((i) => (i.id === incidentId ? { ...i, status, adminNotes: notes } : i))
      );
      setExpanded(null);
      setNotes('');
    } catch (err) {
      console.error(err);
      alert('Failed to update incident. Admin SDK may be required for production.');
    }
  };

  if (loading) return <LoadingSpinner className="mx-auto mt-20" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Incidents</h1>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        className="mb-4 rounded-lg border px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="investigating">Investigating</option>
        <option value="resolved">Resolved</option>
      </select>
      <div className="space-y-4">
        {filtered.map((incident) => (
          <Card key={incident.id}>
            <div
              className="flex cursor-pointer items-start justify-between"
              onClick={() => setExpanded(expanded === incident.id ? null : incident.id)}
            >
              <div>
                <span className="rounded bg-brand-danger/10 px-2 py-0.5 text-xs font-medium text-brand-danger capitalize">
                  {incident.type.replace(/_/g, ' ')}
                </span>
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs capitalize">{incident.status}</span>
                <p className="mt-2 text-sm text-gray-700">{incident.description}</p>
                <p className="mt-1 text-xs text-gray-400">
                  Booking: {incident.bookingId.slice(0, 8)}… ·{' '}
                  {incident.createdAt?.toDate ? format(incident.createdAt.toDate(), 'PPpp') : '—'}
                </p>
              </div>
            </div>
            {expanded === incident.id && (
              <div className="mt-4 border-t pt-4">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Admin notes"
                  rows={3}
                  className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void updateStatus(incident.id, 'investigating')}>
                    Mark investigating
                  </Button>
                  <Button size="sm" onClick={() => void updateStatus(incident.id, 'resolved')}>
                    Mark resolved
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-gray-500">No incidents found.</p>}
      </div>
    </div>
  );
}
