'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Mail, Smartphone, RefreshCw } from 'lucide-react';

function MfaContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [code, setCode] = useState('');
    const [method, setMethod] = useState<'email' | 'totp'>('email');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);

    // Get MFA data from URL params (passed from login)
    const mfaToken = searchParams.get('token');
    const mfaMethod = searchParams.get('method') as 'email' | 'totp' | 'both';
    const totpConfigured = searchParams.get('totp') === 'true';
    const adminName = searchParams.get('name');
    const adminEmail = searchParams.get('email');

    useEffect(() => {
        if (!mfaToken) {
            router.push('/login');
        }

        // Set default method based on what's available
        if (mfaMethod === 'totp' || (mfaMethod === 'both' && totpConfigured)) {
            setMethod('totp');
        } else {
            setMethod('email');
        }
    }, [mfaToken, mfaMethod, totpConfigured, router]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/mfa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mfaToken, code, method }),
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/dashboard');
                router.refresh();
            } else {
                setError(data.error || 'Verification failed');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendEmail = async () => {
        if (countdown > 0) return;

        setResending(true);
        setError('');

        try {
            const res = await fetch(`/api/auth/mfa?token=${encodeURIComponent(mfaToken || '')}`);
            const data = await res.json();

            if (res.ok) {
                setCountdown(60); // 60 second cooldown
            } else {
                setError(data.error || 'Failed to send code');
            }
        } catch (err) {
            setError('Failed to resend code');
        } finally {
            setResending(false);
        }
    };

    if (!mfaToken) {
        return null;
    }

    const showMethodToggle = mfaMethod === 'both' && totpConfigured;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-md">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-purple-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Verify Your Identity
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Hi {adminName}, please verify to continue
                    </p>
                </div>

                {/* Method Toggle */}
                {showMethodToggle && (
                    <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setMethod('email')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors ${method === 'email'
                                ? 'bg-white dark:bg-gray-700 shadow text-purple-600'
                                : 'text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            <Mail className="w-4 h-4" />
                            Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setMethod('totp')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors ${method === 'totp'
                                ? 'bg-white dark:bg-gray-700 shadow text-purple-600'
                                : 'text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            <Smartphone className="w-4 h-4" />
                            Authenticator
                        </button>
                    </div>
                )}

                {/* Method Description */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                    {method === 'email' ? (
                        <div className="flex items-start gap-3">
                            <Mail className="w-5 h-5 text-purple-600 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Email Verification
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                    A 6-digit code was sent to {adminEmail}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3">
                            <Smartphone className="w-5 h-5 text-purple-600 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Authenticator App
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Enter the code from your authenticator app
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Verification Code
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                            placeholder="000000"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || code.length !== 6}
                        className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {loading ? 'Verifying...' : 'Verify & Sign In'}
                    </button>
                </form>

                {/* Resend Email */}
                {method === 'email' && (
                    <div className="mt-4 text-center">
                        <button
                            onClick={handleResendEmail}
                            disabled={resending || countdown > 0}
                            className="text-purple-600 hover:text-purple-700 text-sm flex items-center justify-center gap-1 mx-auto disabled:text-gray-400"
                        >
                            <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                            {countdown > 0
                                ? `Resend in ${countdown}s`
                                : resending
                                    ? 'Sending...'
                                    : 'Resend code'}
                        </button>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <button
                        onClick={() => router.push('/login')}
                        className="text-gray-600 dark:text-gray-400 text-sm hover:underline"
                    >
                        ← Back to login
                    </button>
                </div>
            </div>
        </div>
    );
}

function MfaLoading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-md">
                <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Shield className="w-8 h-8 text-purple-600" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        </div>
    );
}

export default function MfaPage() {
    return (
        <Suspense fallback={<MfaLoading />}>
            <MfaContent />
        </Suspense>
    );
}
