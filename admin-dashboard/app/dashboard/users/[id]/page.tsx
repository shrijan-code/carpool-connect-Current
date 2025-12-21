'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import {
    ArrowLeft, Mail, Phone, Shield, AlertTriangle, CheckCircle,
    XCircle, Key, Bell, Edit2, CreditCard, Car, Ticket, Clock
} from 'lucide-react';

interface ActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

function ActionModal({ isOpen, onClose, title, children }: ActionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}

export default function UserDetailPage() {
    const params = useParams();
    const userId = params.id as string;
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showResetLinkModal, setShowResetLinkModal] = useState(false);
    const [resetLink, setResetLink] = useState('');
    const [notification, setNotification] = useState({ title: '', body: '' });
    const [editData, setEditData] = useState({ name: '', phone: '', role: '' });

    useEffect(() => {
        if (userId) {
            fetchUser();
        }
    }, [userId]);

    const fetchUser = async () => {
        try {
            const res = await fetch(`/api/users/${userId}`);
            const data = await res.json();
            setUser(data.user);
            if (data.user) {
                setEditData({
                    name: data.user.name || '',
                    phone: data.user.phone || '',
                    role: data.user.role || 'rider',
                });
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: string, data?: any) => {
        if (action === 'suspend' && !confirm('Are you sure you want to suspend this user?')) return;
        if (action === 'unsuspend' && !confirm('Activate this user account?')) return;

        setActionLoading(action);
        try {
            const method = ['reset_password', 'send_notification'].includes(action) ? 'POST' : 'PATCH';
            const res = await fetch(`/api/users/${userId}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data }),
            });
            const result = await res.json();

            if (res.ok) {
                if (action === 'reset_password' && result.resetLink) {
                    setResetLink(result.resetLink);
                    setShowResetLinkModal(true);
                }
                if (action === 'send_notification') {
                    setShowNotificationModal(false);
                    setNotification({ title: '', body: '' });
                    alert('Notification sent successfully');
                }
                if (action === 'update_details' || action === 'update_role') {
                    setShowEditModal(false);
                }
                fetchUser();
            } else {
                alert(result.error || 'Action failed');
            }
        } catch (error) {
            console.error('Action failed:', error);
            alert('Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-900 dark:text-white">Loading...</div>;
    }

    if (!user) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400 mb-4">User not found</p>
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
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Users
            </button>

            {/* User Header */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{user.name}</h1>
                        <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {user.email}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${user.role === 'driver' ? 'bg-blue-100 text-blue-800' :
                            user.role === 'both' ? 'bg-purple-100 text-purple-800' :
                                'bg-green-100 text-green-800'
                            }`}>
                            {user.role}
                        </span>
                        {user.suspended && (
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                                Suspended
                            </span>
                        )}
                        {user.verified && (
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                                Verified
                            </span>
                        )}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                            <Phone className="w-4 h-4" />
                            <span className="text-sm">Phone</span>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">{user.phone || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rating</div>
                        <p className="font-medium text-gray-900 dark:text-white">⭐ {user.rating?.toFixed(1) || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Rides</div>
                        <p className="font-medium text-gray-900 dark:text-white">{user.totalRides || 0}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Member Since</div>
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(user.createdAt)}</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t dark:border-gray-700">
                    {user.suspended ? (
                        <button
                            onClick={() => handleAction('unsuspend')}
                            disabled={actionLoading !== null}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            <CheckCircle className="w-4 h-4" />
                            {actionLoading === 'unsuspend' ? 'Activating...' : 'Activate User'}
                        </button>
                    ) : (
                        <button
                            onClick={() => handleAction('suspend')}
                            disabled={actionLoading !== null}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            {actionLoading === 'suspend' ? 'Suspending...' : 'Suspend User'}
                        </button>
                    )}

                    <button
                        onClick={() => handleAction('reset_password')}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        <Key className="w-4 h-4" />
                        {actionLoading === 'reset_password' ? 'Generating...' : 'Reset Password'}
                    </button>

                    <button
                        onClick={() => setShowNotificationModal(true)}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        <Bell className="w-4 h-4" />
                        Send Notification
                    </button>

                    <button
                        onClick={() => setShowEditModal(true)}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        <Edit2 className="w-4 h-4" />
                        Edit User
                    </button>
                </div>
            </div>

            {/* Stripe Status */}
            {user.stripeInfo && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <CreditCard className="w-5 h-5" />
                        Stripe Connect Status
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Account ID</p>
                            <p className="font-mono text-sm text-gray-900 dark:text-white">
                                {user.stripeInfo.accountId || 'Not connected'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${user.stripeInfo.connectStatus === 'active' ? 'bg-green-100 text-green-800' :
                                user.stripeInfo.connectStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {user.stripeInfo.connectStatus}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Charges Enabled</p>
                            <p className="text-gray-900 dark:text-white">{user.stripeInfo.chargesEnabled ? '✅ Yes' : '❌ No'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Payment Methods</p>
                            <p className="text-gray-900 dark:text-white">{user.paymentMethodsCount || 0}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Driver Verification Status - for drivers with pending approval */}
            {(user.role === 'driver' || user.role === 'both') && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Car className="w-5 h-5" />
                        Driver Verification
                    </h3>

                    {/* Approval Status */}
                    <div className="mb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Approval Status</p>
                        <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${user.driverApproval?.status === 'approved' ? 'bg-green-100 text-green-800' :
                                user.driverApproval?.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    user.driverApproval?.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                            }`}>
                            {user.driverApproval?.status || 'Not Submitted'}
                        </span>
                    </div>

                    {/* Vehicle Details */}
                    {user.carDetails && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Vehicle</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {user.carDetails.make} {user.carDetails.model} ({user.carDetails.year})
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Color</p>
                                <p className="font-medium text-gray-900 dark:text-white">{user.carDetails.color || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">License Plate</p>
                                <p className="font-medium text-gray-900 dark:text-white">{user.carDetails.licensePlate || 'N/A'}</p>
                            </div>
                        </div>
                    )}

                    {/* Document Links */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="p-4 border dark:border-gray-700 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Registration Document</p>
                            {user.carDetails?.registrationDocument ? (
                                <a
                                    href={user.carDetails.registrationDocument}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                                >
                                    📄 View Registration
                                </a>
                            ) : (
                                <span className="text-gray-500 text-sm">Not uploaded</span>
                            )}
                        </div>
                        <div className="p-4 border dark:border-gray-700 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Insurance Document</p>
                            {user.carDetails?.insuranceDocument ? (
                                <a
                                    href={user.carDetails.insuranceDocument}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                                >
                                    📄 View Insurance
                                </a>
                            ) : (
                                <span className="text-gray-500 text-sm">Not uploaded</span>
                            )}
                        </div>
                    </div>

                    {/* Approval Actions - show only if pending or can be changed */}
                    {user.driverApproval?.status === 'pending' && (
                        <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                            <button
                                onClick={() => {
                                    if (confirm('Approve this driver? They will be able to create rides.')) {
                                        handleAction('approve_driver');
                                    }
                                }}
                                disabled={actionLoading !== null}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {actionLoading === 'approve_driver' ? 'Approving...' : 'Approve Driver'}
                            </button>
                            <button
                                onClick={() => {
                                    const reason = prompt('Enter rejection reason:');
                                    if (reason) {
                                        handleAction('reject_driver', { reason });
                                    }
                                }}
                                disabled={actionLoading !== null}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <XCircle className="w-4 h-4" />
                                {actionLoading === 'reject_driver' ? 'Rejecting...' : 'Reject Driver'}
                            </button>
                        </div>
                    )}

                    {/* Show rejection reason if rejected */}
                    {user.driverApproval?.status === 'rejected' && user.driverApproval?.rejectionReason && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-600 dark:text-red-400">
                                <strong>Rejection Reason:</strong> {user.driverApproval.rejectionReason}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Emergency Contacts */}
            {user.emergencyContacts && user.emergencyContacts.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Shield className="w-5 h-5" />
                        Emergency Contacts
                    </h3>
                    <div className="space-y-4">
                        {user.emergencyContacts.map((contact: any, index: number) => (
                            <div key={index} className="border-l-4 border-purple-500 pl-4">
                                <p className="font-medium text-gray-900 dark:text-white">{contact.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{contact.relationship}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{contact.phone}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Rides as Driver */}
            {user.rides && user.rides.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Car className="w-5 h-5" />
                        Rides as Driver ({user.rides.length})
                    </h3>
                    <div className="space-y-3">
                        {user.rides.slice(0, 5).map((ride: any) => (
                            <div key={ride.id} className="border-b dark:border-gray-700 pb-3 last:border-0">
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {ride.from?.name || ride.origin} → {ride.to?.name || ride.destination}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(ride.departureTime || ride.departureAt)} • {ride.status}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bookings as Passenger */}
            {user.bookings && user.bookings.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Ticket className="w-5 h-5" />
                        Bookings as Passenger ({user.bookings.length})
                    </h3>
                    <div className="space-y-3">
                        {user.bookings.slice(0, 5).map((booking: any) => (
                            <div key={booking.id} className="border-b dark:border-gray-700 pb-3 last:border-0">
                                <p className="font-medium text-gray-900 dark:text-white">Booking #{booking.id.slice(-6)}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {booking.seats} seat(s) • {booking.status}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Admin Action Logs */}
            {user.adminLogs && user.adminLogs.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Clock className="w-5 h-5" />
                        Admin Action History
                    </h3>
                    <div className="space-y-3">
                        {user.adminLogs.map((log: any) => (
                            <div key={log.id} className="flex items-start gap-3 text-sm">
                                <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {formatDate(log.createdAt)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${log.action === 'suspend' ? 'bg-red-100 text-red-800' :
                                    log.action === 'unsuspend' ? 'bg-green-100 text-green-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                    {log.action}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">by {log.adminEmail}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Send Notification Modal */}
            <ActionModal
                isOpen={showNotificationModal}
                onClose={() => setShowNotificationModal(false)}
                title="Send Notification"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                        <input
                            type="text"
                            value={notification.title}
                            onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="Notification title"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                        <textarea
                            value={notification.body}
                            onChange={(e) => setNotification({ ...notification, body: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            rows={3}
                            placeholder="Notification message"
                        />
                    </div>
                    <button
                        onClick={() => handleAction('send_notification', notification)}
                        disabled={!notification.title || !notification.body || actionLoading !== null}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {actionLoading === 'send_notification' ? 'Sending...' : 'Send Notification'}
                    </button>
                </div>
            </ActionModal>

            {/* Edit User Modal */}
            <ActionModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                title="Edit User"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                        <input
                            type="tel"
                            value={editData.phone}
                            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                        <select
                            value={editData.role}
                            onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                            <option value="rider">Rider</option>
                            <option value="driver">Driver</option>
                            <option value="both">Both</option>
                        </select>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleAction('update_details', { name: editData.name, phone: editData.phone })}
                            disabled={actionLoading !== null}
                            className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                            Save Details
                        </button>
                        <button
                            onClick={() => handleAction('update_role', { role: editData.role })}
                            disabled={actionLoading !== null}
                            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Update Role
                        </button>
                    </div>
                </div>
            </ActionModal>

            {/* Reset Link Modal */}
            <ActionModal
                isOpen={showResetLinkModal}
                onClose={() => setShowResetLinkModal(false)}
                title="Password Reset Link"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Share this link with the user to reset their password:
                    </p>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                        <code className="text-xs break-all text-gray-900 dark:text-white">{resetLink}</code>
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(resetLink);
                            alert('Link copied!');
                        }}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                        Copy Link
                    </button>
                </div>
            </ActionModal>
        </div>
    );
}
