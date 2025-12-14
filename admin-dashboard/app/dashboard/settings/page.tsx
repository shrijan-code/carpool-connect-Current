import Link from 'next/link';
import { Shield, User, Bell, Palette } from 'lucide-react';

export default function SettingsPage() {
    const settingsSections = [
        {
            name: 'Security',
            description: 'Manage multi-factor authentication and account security',
            href: '/dashboard/settings/security',
            icon: Shield,
            available: true,
        },
        {
            name: 'Profile',
            description: 'Update your name, email, and password',
            href: '/dashboard/settings/profile',
            icon: User,
            available: false,
        },
        {
            name: 'Notifications',
            description: 'Configure email and push notifications',
            href: '/dashboard/settings/notifications',
            icon: Bell,
            available: false,
        },
        {
            name: 'Appearance',
            description: 'Customize theme and display preferences',
            href: '/dashboard/settings/appearance',
            icon: Palette,
            available: false,
        },
    ];

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">Manage your account and preferences</p>

            <div className="grid md:grid-cols-2 gap-4">
                {settingsSections.map((section) => (
                    <Link
                        key={section.name}
                        href={section.available ? section.href : '#'}
                        className={`bg-white dark:bg-gray-900 rounded-lg shadow p-6 flex items-start gap-4 transition-all ${section.available
                                ? 'hover:shadow-lg hover:border-purple-500 border border-transparent cursor-pointer'
                                : 'opacity-60 cursor-not-allowed'
                            }`}
                    >
                        <div className={`p-3 rounded-lg ${section.available ? 'bg-purple-100 dark:bg-purple-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                            <section.icon className={`w-6 h-6 ${section.available ? 'text-purple-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                {section.name}
                                {!section.available && (
                                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded">
                                        Coming Soon
                                    </span>
                                )}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {section.description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
