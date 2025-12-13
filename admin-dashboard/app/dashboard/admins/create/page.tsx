'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { ROLE_PERMISSIONS, AdminRole } from '@/types';

export default function CreateAdminPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<{ password?: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'viewer_admin' as AdminRole,
        password: '',
        autoGeneratePassword: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    role: formData.role,
                    password: formData.autoGeneratePassword ? undefined : formData.password,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess({
                    password: data.generatedPassword,
                });
            } else {
                setError(data.error || 'Failed to create admin');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const copyPassword = () => {
        if (success?.password) {
            navigator.clipboard.writeText(success.password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (success) {
        return (
            <div className="max-w-md mx-auto">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Created!</h2>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            The new admin account has been created successfully.
                        </p>
                    </div>

                    {success.password && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                                ⚠️ Save this password - it won't be shown again!
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded border font-mono text-sm">
                                    {success.password}
                                </code>
                                <button
                                    onClick={copyPassword}
                                    className="p-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push('/dashboard/admins')}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            Back to Admins
                        </button>
                        <button
                            onClick={() => {
                                setSuccess(null);
                                setFormData({ name: '', email: '', role: 'viewer_admin', password: '', autoGeneratePassword: true });
                            }}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            Create Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto">
            <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admins
            </button>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-6 h-6 text-purple-600" />
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create New Admin</h1>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Full Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="John Smith"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email Address *
                        </label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="admin@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Role *
                        </label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminRole })}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                            {Object.entries(ROLE_PERMISSIONS).map(([role, perm]) => (
                                <option key={role} value={role}>
                                    {perm.label} - {perm.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={formData.autoGeneratePassword}
                                onChange={(e) => setFormData({ ...formData, autoGeneratePassword: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            <span className="text-gray-700 dark:text-gray-300">Auto-generate password</span>
                        </label>
                    </div>

                    {!formData.autoGeneratePassword && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white pr-10"
                                    placeholder="Enter password"
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? 'Creating...' : 'Create Admin'}
                    </button>
                </form>
            </div>
        </div>
    );
}
