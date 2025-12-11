'use client';

import { useEffect, useState } from 'react';
import { DashboardStats } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Users, Car, AlertTriangle, DollarSign, TrendingUp, Activity } from 'lucide-react';

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard/stats')
            .then(res => res.json())
            .then(data => {
                setStats(data.stats);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="text-center py-12 text-gray-900 dark:text-white">Loading...</div>;
    }

    const statCards = [
        {
            label: 'Total Users',
            value: stats?.totalUsers || 0,
            icon: Users,
            color: 'bg-blue-500',
            change: `+${stats?.userGrowth || 0} this month`,
        },
        {
            label: 'Total Rides',
            value: stats?.totalRides || 0,
            icon: Car,
            color: 'bg-green-500',
        },
        {
            label: 'Active Rides',
            value: stats?.activeRides || 0,
            icon: Activity,
            color: 'bg-purple-500',
        },
        {
            label: 'Pending Reports',
            value: stats?.pendingSafetyReports || 0,
            icon: AlertTriangle,
            color: 'bg-red-500',
        },
        {
            label: 'Total Revenue',
            value: formatCurrency(stats?.totalRevenue || 0),
            icon: DollarSign,
            color: 'bg-green-600',
        },
        {
            label: 'User Growth',
            value: `+${stats?.userGrowth || 0}`,
            icon: TrendingUp,
            color: 'bg-indigo-500',
            subtitle: 'Last 30 days',
        },
    ];

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {statCards.map((stat, index) => (
                    <div key={index} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`${stat.color} p-3 rounded-lg`}>
                                <stat.icon className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">{stat.label}</h3>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                        {stat.change && (
                            <p className="text-sm text-green-600 dark:text-green-500 mt-2">{stat.change}</p>
                        )}
                        {stat.subtitle && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{stat.subtitle}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <a
                        href="/dashboard/safety-reports"
                        className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <AlertTriangle className="w-8 h-8 text-red-500 mr-4" />
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Safety Reports</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {stats?.pendingSafetyReports || 0} pending reports
                            </p>
                        </div>
                    </a>

                    <a
                        href="/dashboard/users"
                        className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <Users className="w-8 h-8 text-blue-500 mr-4" />
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">User Management</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">View and manage all users</p>
                        </div>
                    </a>

                    <a
                        href="/dashboard/rides"
                        className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <Car className="w-8 h-8 text-green-500 mr-4" />
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Rides Management</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{stats?.activeRides || 0} active rides</p>
                        </div>
                    </a>

                    <a
                        href="/dashboard/analytics"
                        className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <TrendingUp className="w-8 h-8 text-purple-500 mr-4" />
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Analytics</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">View detailed analytics</p>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    );
}
