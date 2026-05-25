'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import type { User } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getDocs(query(collection(getClientDb(), 'users'), orderBy('createdAt', 'desc'))).then((snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as User));
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner className="mx-auto mt-20" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">All users</h1>
      <Card padding={false}>
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Community</th>
              <th className="px-4 py-3 text-left">Rating</th>
              <th className="px-4 py-3 text-left">Deliveries</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid} className="border-b">
                <td className="px-4 py-3">{u.displayName}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.phone}</td>
                <td className="px-4 py-3 capitalize">{u.community}</td>
                <td className="px-4 py-3">{u.rating.toFixed(1)} ({u.totalRatings})</td>
                <td className="px-4 py-3">{u.totalDeliveries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
