'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import {
    Users, Plus, Shield, Edit2, Trash2,
    CheckCircle, XCircle, Key, MoreVertical
} from 'lucide-react';
import { ROLE_PERMISSIONS, AdminRole } from '@/types';

interface Admin {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    active: boolean;
    createdAt: string;
    lastLogin?: string;
}

export default function AdminsPage() {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionMenu, setActionMenu] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        try {
            const res = await fetch('/api/admins');
            if (res.status === 403) {
                setError('You do not have permission to view admin management.');
                setLoading(false);
                return;
            }
            const data = await res.json();
            setAdmins(data.admins || []);
        } catch (err) {
            setError('Failed to load admins');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (adminId: string, action: string, data?: any) => {
        if (action === 'deactivate' && !confirm('Deactivate this admin? They will no longer be able to login.')) return;
        if (action === 'delete' && !confirm('Permanently delete this admin? This cannot be undone.')) return;

        setActionLoading(adminId);
        try {
            const method = action === 'delete' ? 'DELETE' : 'PATCH';
            const res = await fetch(`/api/admins/${adminId}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: method === 'PATCH' ? JSON.stringify({ action, ...data }) : undefined,
            });

            const result = await res.json();
            if (res.ok) {
                fetchAdmins();
                setActionMenu(null);
            } else {
                alert(result.error || 'Action failed');
            }
        } catch (err) {
            alert('An error occurred');
        } finally {
            setActionLoading(null);
        }
    };

    const getRoleBadgeColor = (role: AdminRole) => {
        switch (role) {
            case 'global_admin':
                return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'editor_admin':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'viewer_admin':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-900 dark:text-white">Loading...</div>;
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-500 mb-4">{error}</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-7 h-7 text-purple-600" />
                        Admin Management
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage admin accounts and permissions
                    </p>
                </div>
                <Link
                    href="/dashboard/admins/create"
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Admin
                </Link>
            </div>

            {/* Role Legend */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Role Permissions</h3>
                <div className="grid md:grid-cols-3 gap-4">
                    {Object.entries(ROLE_PERMISSIONS).map(([role, perm]) => (
                        <div key={role} className="flex items-start gap-3">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(role as AdminRole)}`}>
                                {perm.label}
                            </span>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{perm.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Admins Table */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Admin
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Last Login
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {admins.map((admin) => (
                            <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                            <span className="text-purple-600 dark:text-purple-400 font-medium">
                                                {admin.name?.charAt(0)?.toUpperCase() || 'A'}
                                            </span>
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {admin.name}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {admin.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(admin.role)}`}>
                                        {ROLE_PERMISSIONS[admin.role]?.label || admin.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {admin.active ? (
                                        <span className="flex items-center gap-1 text-green-600">
                                            <CheckCircle className="w-4 h-4" />
                                            Active
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-red-600">
                                            <XCircle className="w-4 h-4" />
                                            Inactive
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {admin.lastLogin ? formatDate(admin.lastLogin) : 'Never'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm relative">
                                    <button
                                        onClick={() => setActionMenu(actionMenu === admin.id ? null : admin.id)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                        disabled={actionLoading === admin.id}
                                    >
                                        <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                    </button>

                                    {actionMenu === admin.id && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-10">
                                            <button
                                                onClick={() => {
                                                    const newRole = prompt('Enter new role (global_admin, editor_admin, viewer_admin):', admin.role);
                                                    if (newRole) handleAction(admin.id, 'change_role', { role: newRole });
                                                }}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Change Role
                                            </button>
                                            <button
                                                onClick={() => handleAction(admin.id, 'reset_password')}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                            >
                                                <Key className="w-4 h-4" />
                                                Reset Password
                                            </button>
                                            {admin.active ? (
                                                <button
                                                    onClick={() => handleAction(admin.id, 'deactivate')}
                                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-orange-600"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Deactivate
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleAction(admin.id, 'activate')}
                                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-green-600"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Activate
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleAction(admin.id, 'delete')}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {admins.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No admins found
                    </div>
                )}
            </div>
        </div>
    );
}
