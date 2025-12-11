'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Mail, Phone, Shield, AlertTriangle } from 'lucide-react';

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        try {
            const res = await fetch(`/api/users/${resolvedParams.id}`);
            const data = await res.json();
            setUser(data.user);
        } catch (error) {
            console.error('Failed to fetch user:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSuspend = async () => {
        if (!confirm('Are you sure you want to suspend this user?')) return;

        try {
            await fetch(`/api/users/${resolvedParams.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'suspended' }),
            });
            fetchUser();
        } catch (error) {
            console.error('Failed to suspend user:', error);
        }
    };

    if (loading) {
        return <div className="text-center py-12">Loading...</div>;
    }

    if (!user) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600 mb-4">User not found</p>
                <button
                    onClick={() => router.back()}
                    className="text-purple-600 hover:text-purple-900"
                >
                    ← Back to Users
                </button>
            </div>
        );
    }

    return (
        <div>
            <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Users
            </button>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">{user.name}</h1>
                        <p className="text-gray-600">{user.email}</p>
                    </div>
                    <div className="flex gap-2">
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${user.role === 'driver' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                            {user.role}
                        </span>
                        {user.status === 'suspended' && (
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                                Suspended
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-6">
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
                        <p className="text-gray-900 flex items-center">
                            <Phone className="w-4 h-4 mr-2" />
                            {user.phone || 'N/A'}
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Rating</h3>
                        <p className="text-gray-900">⭐ {user.rating?.toFixed(1) || 'N/A'}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Member Since</h3>
                        <p className="text-gray-900">{formatDate(user.createdAt)}</p>
                    </div>
                </div>

                <div className="border-t pt-4">
                    <button
                        onClick={handleSuspend}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                        disabled={user.status === 'suspended'}
                    >
                        <AlertTriangle className="w-4 h-4" />
                        {user.status === 'suspended' ? 'Already Suspended' : 'Suspend User'}
                    </button>
                </div>
            </div>

            {user.emergencyContacts && user.emergencyContacts.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Shield className="w-5 h-5 mr-2" />
                        Emergency Contacts
                    </h3>
                    <div className="space-y-4">
                        {user.emergencyContacts.map((contact: any, index: number) => (
                            <div key={index} className="border-l-4 border-purple-500 pl-4">
                                <p className="font-medium">{contact.name}</p>
                                <p className="text-sm text-gray-600">{contact.relationship}</p>
                                <p className="text-sm text-gray-600">{contact.phone}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {user.rides && user.rides.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4">Rides as Driver ({user.rides.length})</h3>
                    <div className="space-y-3">
                        {user.rides.slice(0, 5).map((ride: any) => (
                            <div key={ride.id} className="border-b pb-3 last:border-0">
                                <p className="font-medium">{ride.origin} → {ride.destination}</p>
                                <p className="text-sm text-gray-600">{formatDate(ride.departureTime)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {user.bookings && user.bookings.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Bookings as Passenger ({user.bookings.length})</h3>
                    <div className="space-y-3">
                        {user.bookings.slice(0, 5).map((booking: any) => (
                            <div key={booking.id} className="border-b pb-3 last:border-0">
                                <p className="font-medium">Booking #{booking.id.slice(-6)}</p>
                                <p className="text-sm text-gray-600">
                                    {booking.seats} seat(s) • {booking.status}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
