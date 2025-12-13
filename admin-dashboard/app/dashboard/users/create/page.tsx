'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Eye, EyeOff, Copy, Check } from 'lucide-react';

export default function CreateUserPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<{ password?: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'rider',
        password: '',
        autoGeneratePassword: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone || undefined,
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
                setError(data.error || 'Failed to create user');
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
            <div>
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Users
                </button>

                <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-lg shadow p-8">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Created!</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            The user account has been created successfully.
                        </p>
                    </div>

                    {success.password && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                                Generated Password (save this now)
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded border font-mono text-sm">
                                    {success.password}
                                </code>
                                <button
                                    onClick={copyPassword}
                                    className="p-2 hover:bg-yellow-100 dark:hover:bg-yellow-800 rounded transition-colors"
                                    title="Copy password"
                                >
                                    {copied ? (
                                        <Check className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <Copy className="w-5 h-5 text-yellow-700" />
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push('/dashboard/users')}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            Back to Users
                        </button>
                        <button
                            onClick={() => {
                                setSuccess(null);
                                setFormData({
                                    name: '',
                                    email: '',
                                    phone: '',
                                    role: 'rider',
                                    password: '',
                                    autoGeneratePassword: true,
                                });
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
        <div>
            <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Users
            </button>

            <div className="max-w-md mx-auto">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <UserPlus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New User</h1>
                            <p className="text-gray-600 dark:text-gray-400">Add a new user to the platform</p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
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
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="John Smith"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email Address *
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="john@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="0412 345 678"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Role *
                            </label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                <option value="rider">Rider</option>
                                <option value="driver">Driver</option>
                                <option value="both">Both (Driver & Rider)</option>
                            </select>
                        </div>

                        <div className="border-t dark:border-gray-700 pt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    id="autoGenerate"
                                    checked={formData.autoGeneratePassword}
                                    onChange={(e) => setFormData({ ...formData, autoGeneratePassword: e.target.checked })}
                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <label htmlFor="autoGenerate" className="text-sm text-gray-700 dark:text-gray-300">
                                    Auto-generate password
                                </label>
                            </div>

                            {!formData.autoGeneratePassword && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Password *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="Enter password"
                                            required={!formData.autoGeneratePassword}
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
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            {loading ? 'Creating User...' : 'Create User'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
