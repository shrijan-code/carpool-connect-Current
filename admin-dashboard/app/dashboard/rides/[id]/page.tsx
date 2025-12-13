'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
    ArrowLeft, Car, User, MapPin, Clock, DollarSign,
    Users, AlertTriangle, CheckCircle, XCircle
} from 'lucide-react';
import Link from 'next/link';

export default function RideDetailPage() {
    const params = useParams();
    const rideId = params.id as string;
    const router = useRouter();
    const [ride, setRide] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);

    useEffect(() => {
        if (rideId) {
            fetchRide();
        }
    }, [rideId]);

    const fetchRide = async () => {
        try {
            const res = await fetch(`/api/rides/${rideId}`);
            const data = await res.json();
            setRide(data.ride);
        } catch (error) {
            console.error('Failed to fetch ride:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this ride? All bookings will also be cancelled.')) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/rides/${rideId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', reason: cancelReason }),
            });

            if (res.ok) {
                setShowCancelModal(false);
                fetchRide();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to cancel ride');
            }
        } catch (error) {
            alert('Failed to cancel ride');
        } finally {
            setActionLoading(false);
        }
    };

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

    if (loading) {
        return <div className="text-center py-12 text-gray-900 dark:text-white">Loading...</div>;
    }

    if (!ride) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400 mb-4">Ride not found</p>
                <button onClick={() => router.back()} className="text-purple-600 hover:text-purple-900">
                    ← Back to Rides
                </button>
            </div>
        );
    }

    const origin = ride.from?.name || ride.origin?.name || ride.origin || 'Unknown';
    const destination = ride.to?.name || ride.destination?.name || ride.destination || 'Unknown';

    return (
        <div>
            <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Rides
            </button>

            {/* Ride Header */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Car className="w-6 h-6 text-purple-600" />
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Ride #{ride.id.slice(-6)}
                            </h1>
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(ride.status)}`}>
                                {ride.status}
                            </span>
                        </div>
                    </div>
                    {ride.status !== 'cancelled' && ride.status !== 'completed' && (
                        <button
                            onClick={() => setShowCancelModal(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                        >
                            <XCircle className="w-4 h-4" />
                            Cancel Ride
                        </button>
                    )}
                </div>

                {/* Route */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">From</p>
                                <p className="font-medium text-gray-900 dark:text-white">{origin}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">To</p>
                                <p className="font-medium text-gray-900 dark:text-white">{destination}</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm">Departure</span>
                            </div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {formatDate(ride.departureTime)}
                            </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                                <DollarSign className="w-4 h-4" />
                                <span className="text-sm">Price/Seat</span>
                            </div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {formatCurrency(ride.pricePerSeat)}
                            </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                                <Users className="w-4 h-4" />
                                <span className="text-sm">Seats</span>
                            </div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {ride.seatsAvailable || ride.availableSeats || 0} / {ride.seatsTotal || ride.totalSeats || 4}
                            </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Created</div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {formatDate(ride.createdAt)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Revenue (if completed) */}
                {ride.revenue && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                        <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Revenue Breakdown</h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-green-600 dark:text-green-400">Total Revenue</p>
                                <p className="font-bold text-green-800 dark:text-green-200">${ride.revenue.total?.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-green-600 dark:text-green-400">Platform Fee</p>
                                <p className="font-bold text-green-800 dark:text-green-200">${ride.revenue.platformFee?.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-green-600 dark:text-green-400">Driver Payout</p>
                                <p className="font-bold text-green-800 dark:text-green-200">${ride.revenue.driverPayout?.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Driver Info */}
            {ride.driver && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <User className="w-5 h-5" />
                        Driver
                    </h3>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">{ride.driver.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{ride.driver.email}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">⭐ {ride.driver.rating?.toFixed(1) || 'N/A'}</p>
                            </div>
                        </div>
                        <Link
                            href={`/dashboard/users/${ride.driver.id}`}
                            className="text-purple-600 hover:text-purple-900 text-sm"
                        >
                            View Profile →
                        </Link>
                    </div>
                </div>
            )}

            {/* Bookings */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <Users className="w-5 h-5" />
                    Bookings ({ride.bookings?.length || 0})
                </h3>
                {ride.bookings && ride.bookings.length > 0 ? (
                    <div className="space-y-4">
                        {ride.bookings.map((booking: any) => (
                            <div key={booking.id} className="flex items-center justify-between border-b dark:border-gray-700 pb-4 last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                        <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {booking.passenger?.name || 'Unknown Passenger'}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {booking.seats} seat(s) • ${((booking.amountTotal || 0) / 100).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                                        {booking.status}
                                    </span>
                                    {booking.passenger && (
                                        <Link
                                            href={`/dashboard/users/${booking.passenger.id}`}
                                            className="text-purple-600 hover:text-purple-900 text-sm"
                                        >
                                            View →
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No bookings yet</p>
                )}
            </div>

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cancel Ride</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            This will cancel the ride and all associated bookings. This action cannot be undone.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Reason (optional)
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                rows={2}
                                placeholder="Enter cancellation reason..."
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                Keep Ride
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={actionLoading}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {actionLoading ? 'Cancelling...' : 'Cancel Ride'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
