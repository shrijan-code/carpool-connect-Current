'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { CreditCard, DollarSign, TrendingUp, Hash } from 'lucide-react';

export default function PaymentsPage() {
    const [payments, setPayments] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        try {
            const res = await fetch('/api/payments');
            const data = await res.json();
            setPayments(data.payments || []);
            setStats(data.stats);
        } catch (error) {
            console.error('Failed to fetch payments:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'succeeded':
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-900 dark:text-white">Loading...</div>;
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Payments</h1>
                <p className="text-gray-600 dark:text-gray-400">View platform transactions and revenue</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                ${stats?.totalRevenue?.toFixed(2) || '0.00'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Platform Fees</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                ${stats?.totalPlatformFees?.toFixed(2) || '0.00'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Hash className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats?.totalTransactions || 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Recent Transactions
                    </h3>
                </div>

                {payments.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Transaction ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Amount
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Platform Fee
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Date
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {payments.map((payment: any) => (
                                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-mono text-sm text-gray-900 dark:text-white">
                                            {payment.paymentIntentId?.slice(-12) || payment.id.slice(-12)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        ${((payment.amount || 0) / 100).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 dark:text-purple-400">
                                        ${((payment.platformFee || 0) / 100).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                                            {payment.status || 'unknown'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {formatDate(payment.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No transactions found
                    </div>
                )}
            </div>
        </div>
    );
}
