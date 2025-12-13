'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AdminUser, ROLE_PERMISSIONS, AdminRole } from '@/types';
import {
    LayoutDashboard, Users, Car, AlertTriangle, BarChart3, Settings,
    LogOut, Ticket, CreditCard, FileText, Shield
} from 'lucide-react';

interface SidebarProps {
    admin: AdminUser;
}

export default function Sidebar({ admin }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    // Check if user can manage admins
    const canManageAdmins = ROLE_PERMISSIONS[admin.role as AdminRole]?.canManageAdmins ?? false;
    const canEditData = ROLE_PERMISSIONS[admin.role as AdminRole]?.canEditData ?? false;

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Safety Reports', href: '/dashboard/safety-reports', icon: AlertTriangle },
        { name: 'Users', href: '/dashboard/users', icon: Users },
        { name: 'Rides', href: '/dashboard/rides', icon: Car },
        { name: 'Bookings', href: '/dashboard/bookings', icon: Ticket },
        { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
        { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
        { name: 'Audit Logs', href: '/dashboard/logs', icon: FileText },
        // Admin Management - only visible to global_admin
        ...(canManageAdmins ? [{ name: 'Admin Management', href: '/dashboard/admins', icon: Shield }] : []),
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    // Get role label
    const roleLabel = ROLE_PERMISSIONS[admin.role as AdminRole]?.label || admin.role.replace('_', ' ');

    return (
        <div className="fixed inset-y-0 left-0 w-64 bg-gray-900 dark:bg-gray-950 text-white">
            <div className="flex flex-col h-full">
                <div className="p-6">
                    <h1 className="text-2xl font-bold">CarpoolConnect</h1>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">Admin Dashboard</p>
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <item.icon className="w-5 h-5 mr-3" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <p className="text-sm font-medium">{admin.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{roleLabel}</p>
                        </div>
                    </div>
                    {!canEditData && (
                        <div className="mb-2 px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 text-center">
                            View Only Mode
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
