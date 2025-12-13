'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { FileText, User, Car, AlertTriangle, Bell, Key, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState('all');

    useEffect(() => {
        fetchLogs();
    }, [actionFilter]);

    const fetchLogs = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (actionFilter !== 'all') params.append('action', actionFilter);

        try {
            const res = await fetch(`/api/logs?${params}`);
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'suspend':
            case 'unsuspend':
                return <AlertTriangle className="w-4 h-4" />;
            case 'create_user':
                return <UserPlus className="w-4 h-4" />;
            case 'reset_password':
                return <Key className="w-4 h-4" />;
            case 'send_notification':
                return <Bell className="w-4 h-4" />;
            case 'ride_cancel':
                return <Car className="w-4 h-4" />;
            default:
                return <FileText className="w-4 h-4" />;
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'suspend':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'unsuspend':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'create_user':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'reset_password':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'send_notification':
                return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'ride_cancel':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        }
    };

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Audit Logs</h1>
                <p className="text-gray-600 dark:text-gray-400">View admin actions and system events</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-6 p-4">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by action:</label>
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="all">All Actions</option>
                        <option value="create_user">Create User</option>
                        <option value="suspend">Suspend User</option>
                        <option value="unsuspend">Unsuspend User</option>
                        <option value="reset_password">Reset Password</option>
                        <option value="send_notification">Send Notification</option>
                        <option value="update_details">Update Details</option>
                        <option value="update_role">Update Role</option>
                        <option value="ride_cancel">Ride Cancel</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-900 dark:text-white">Loading...</div>
            ) : (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                    {logs.length > 0 ? (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {logs.map((log: any) => (
                                <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-lg ${getActionColor(log.action)}`}>
                                            {getActionIcon(log.action)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getActionColor(log.action)}`}>
                                                    {log.action?.replace(/_/g, ' ').toUpperCase()}
                                                </span>
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    by {log.adminEmail}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-900 dark:text-white">
                                                {log.targetUserId && (
                                                    <span>
                                                        User:{' '}
                                                        <Link
                                                            href={`/dashboard/users/${log.targetUserId}`}
                                                            className="text-purple-600 hover:text-purple-900 dark:text-purple-400"
                                                        >
                                                            {log.targetEmail || log.targetUserId.slice(-8)}
                                                        </Link>
                                                    </span>
                                                )}
                                                {log.targetRideId && (
                                                    <span>
                                                        Ride:{' '}
                                                        <Link
                                                            href={`/dashboard/rides/${log.targetRideId}`}
                                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                                                        >
                                                            #{log.targetRideId.slice(-6)}
                                                        </Link>
                                                    </span>
                                                )}
                                            </div>
                                            {log.data && Object.keys(log.data).length > 0 && (
                                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono">
                                                    {JSON.stringify(log.data, null, 2).slice(0, 200)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {formatDate(log.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No audit logs found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
