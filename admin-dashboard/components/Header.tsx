'use client';

import { AdminUser } from '@/types';
import { Bell } from 'lucide-react';

interface HeaderProps {
    admin: AdminUser;
}

export default function Header({ admin }: HeaderProps) {
    return (
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Welcome back, {admin.name.split(' ')[0]}!</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Manage your CarpoolConnect platform</p>
                </div>

                <div className="flex items-center gap-4">
                    <button className="relative p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>
                </div>
            </div>
        </header>
    );
}
