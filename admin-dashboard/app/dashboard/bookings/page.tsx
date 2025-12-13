'use client';

import { useEffect, useState } from 'react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Search, Ticket, User, Car, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function BookingsPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchBookings();
    }, [statusFilter]);

    const fetchBookings = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (search) params.append('search', search);

        const res = await fetch(`/api/bookings?${params}`);
        const data = await res.json();
        setBookings(data.bookings || []);
        setLoading(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'pending':
            case 'pending_driver':
            case 'pending_payment':
                return 'bg-yellow-100 text-yellow-800';
            case 'cancelled':
            case 'declined':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredBookings = search
        ? bookings.filter((b: any) => {
            const searchLower = search.toLowerCase();
            return (
                b.id.toLowerCase().includes(searchLower) ||
                b.rider?.name?.toLowerCase().includes(searchLower) ||
                b.rider?.email?.toLowerCase().includes(searchLower)
            );
        })
        : bookings;

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Bookings</h1>
                <p className="text-gray-600 dark:text-gray-400">View and manage all ride bookings</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-6 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by booking ID or rider..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="pending_driver">Pending Driver</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="declined">Declined</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-900 dark:text-white">Loading...</div>
            ) : (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Booking
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Rider
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Ride
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Seats
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Amount
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredBookings.map((booking: any) => (
                                <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Ticket className="w-4 h-4 text-purple-600" />
                                            <span className="font-mono text-sm text-gray-900 dark:text-white">
                                                #{booking.id.slice(-6)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <div className="text-sm">
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {booking.rider?.name || 'Unknown'}
                                                </p>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs">
                                                    {booking.rider?.email || ''}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Car className="w-4 h-4 text-gray-400" />
                                            <div className="text-sm">
                                                <p className="text-gray-900 dark:text-white truncate max-w-[150px]">
                                                    {booking.ride?.origin || 'Unknown'}
                                                </p>
                                                <p className="text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                                                    → {booking.ride?.destination || 'Unknown'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {booking.seats || 1}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        ${((booking.amountTotal || 0) / 100).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {formatDate(booking.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex gap-3">
                                            {booking.rider?.id && (
                                                <Link
                                                    href={`/dashboard/users/${booking.rider.id}`}
                                                    className="text-purple-600 hover:text-purple-900 dark:text-purple-400"
                                                    title="View Rider"
                                                >
                                                    <User className="w-4 h-4" />
                                                </Link>
                                            )}
                                            {booking.rideId && (
                                                <Link
                                                    href={`/dashboard/rides/${booking.rideId}`}
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                                                    title="View Ride"
                                                >
                                                    <Car className="w-4 h-4" />
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredBookings.length === 0 && (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No bookings found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
