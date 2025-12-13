'use client';

import { useEffect, useState } from 'react';
import { Ride } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Car, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function RidesPage() {
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchRides();
    }, [statusFilter]);

    const fetchRides = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);

        const res = await fetch(`/api/rides?${params}`);
        const data = await res.json();
        setRides(data.rides || []);
        setLoading(false);
    };

    const filteredRides = search
        ? rides.filter((ride: any) => {
            const searchLower = search.toLowerCase();
            const origin = ride.from?.name || ride.origin?.name || ride.origin || '';
            const destination = ride.to?.name || ride.destination?.name || ride.destination || '';
            return (
                ride.id.toLowerCase().includes(searchLower) ||
                origin.toLowerCase().includes(searchLower) ||
                destination.toLowerCase().includes(searchLower)
            );
        })
        : rides;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
            case 'in_progress':
                return 'bg-green-100 text-green-800';
            case 'upcoming':
                return 'bg-blue-100 text-blue-800';
            case 'completed':
                return 'bg-gray-100 text-gray-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Rides</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage all rides on the platform</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-6 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by ride ID or location..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="all">All Statuses</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
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
                                    ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Route
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Departure
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Seats
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Price
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredRides.map((ride: any) => {
                                const origin = ride.from?.name || ride.origin?.name || ride.origin || 'Unknown';
                                const destination = ride.to?.name || ride.destination?.name || ride.destination || 'Unknown';
                                return (
                                    <tr key={ride.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-gray-400">
                                            #{ride.id.slice(-6)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <Car className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3" />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                                        {origin}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                                        to {destination}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {formatDate(ride.departureTime || ride.departureAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {ride.seatsAvailable || ride.availableSeats || 0} / {ride.seatsTotal || ride.totalSeats || 4}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {formatCurrency(ride.pricePerSeat)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ride.status)}`}>
                                                {ride.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <Link
                                                href={`/dashboard/rides/${ride.id}`}
                                                className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 flex items-center gap-1"
                                            >
                                                View Details
                                                <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredRides.length === 0 && (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No rides found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
