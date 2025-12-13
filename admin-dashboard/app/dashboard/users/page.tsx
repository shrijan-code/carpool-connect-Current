'use client';

import { useEffect, useState } from 'react';
import { User } from '@/types';
import { formatDate } from '@/lib/utils';
import { Search, User as UserIcon, ExternalLink, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchUsers();
    }, [search]);

    const fetchUsers = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.append('search', search);

        const res = await fetch(`/api/users?${params}`);
        const data = await res.json();
        setUsers(data.users || []);
        setLoading(false);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Users</h1>
                    <p className="text-gray-600 dark:text-gray-400">View and manage all platform users</p>
                </div>
                <Link
                    href="/dashboard/users/create"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                    <UserPlus className="w-5 h-5" />
                    Create User
                </Link>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-6 p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email, or phone..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
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
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Rating
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Total Rides
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Member Since
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {users.map((user: any) => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                                <UserIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.suspended ? (
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                                Suspended
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        ⭐ {user.rating?.toFixed(1) || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {user.totalRides || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {formatDate(user.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <Link
                                            href={`/dashboard/users/${user.id}`}
                                            className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 flex items-center gap-1"
                                        >
                                            View Profile
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {users.length === 0 && (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No users found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
