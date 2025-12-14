'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Mail, Smartphone, Check, X, Loader2 } from 'lucide-react';

interface MfaStatus {
    enabled: boolean;
    method: 'email' | 'totp' | 'both' | null;
    totpConfigured: boolean;
}

export default function SecuritySettingsPage() {
    const router = useRouter();
    const [status, setStatus] = useState<MfaStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // TOTP Setup state
    const [showTotpSetup, setShowTotpSetup] = useState(false);
    const [totpSecret, setTotpSecret] = useState('');
    const [totpQrCode, setTotpQrCode] = useState('');
    const [totpCode, setTotpCode] = useState('');

    useEffect(() => {
        fetchMfaStatus();
    }, []);

    const fetchMfaStatus = async () => {
        try {
            const res = await fetch('/api/auth/mfa/setup');
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (err) {
            setError('Failed to load MFA settings');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: string, data?: any) => {
        setActionLoading(action);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/auth/mfa/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data }),
            });

            const result = await res.json();

            if (res.ok) {
                setSuccess(result.message || 'Settings updated');
                fetchMfaStatus();
                if (action === 'verify-totp') {
                    setShowTotpSetup(false);
                }
            } else {
                setError(result.error || 'Action failed');
            }
        } catch (err) {
            setError('An error occurred');
        } finally {
            setActionLoading(null);
        }
    };

    const startTotpSetup = async () => {
        setActionLoading('totp-setup');
        setError('');

        try {
            const res = await fetch('/api/auth/mfa/setup?action=totp-setup');
            const data = await res.json();

            if (res.ok) {
                setTotpSecret(data.secret);
                setTotpQrCode(data.qrCode);
                setShowTotpSetup(true);
            } else {
                setError(data.error || 'Failed to start setup');
            }
        } catch (err) {
            setError('Failed to start TOTP setup');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    const emailEnabled = status?.method === 'email' || status?.method === 'both';
    const totpEnabled = status?.method === 'totp' || status?.method === 'both';

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <Shield className="w-7 h-7 text-purple-600" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Security Settings
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage multi-factor authentication for your account
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-lg mb-6">
                    {success}
                </div>
            )}

            {/* MFA Status Banner */}
            <div className={`rounded-lg p-4 mb-6 ${status?.enabled
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                }`}>
                <div className="flex items-center gap-3">
                    {status?.enabled ? (
                        <Check className="w-5 h-5 text-green-600" />
                    ) : (
                        <X className="w-5 h-5 text-yellow-600" />
                    )}
                    <div>
                        <p className={`font-medium ${status?.enabled ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                            {status?.enabled ? 'MFA is enabled' : 'MFA is not enabled'}
                        </p>
                        <p className={`text-sm ${status?.enabled ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                            {status?.enabled
                                ? 'Your account is protected with multi-factor authentication'
                                : 'Enable MFA to secure your admin account'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Email OTP */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Mail className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                Email Verification
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Receive a verification code via email when signing in
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleAction(emailEnabled ? 'disable-email' : 'enable-email')}
                        disabled={actionLoading !== null}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${emailEnabled
                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                    >
                        {actionLoading === 'enable-email' || actionLoading === 'disable-email'
                            ? 'Saving...'
                            : emailEnabled ? 'Disable' : 'Enable'}
                    </button>
                </div>
            </div>

            {/* Authenticator App */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                            <Smartphone className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                Authenticator App
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Use Google Authenticator, Microsoft Authenticator, or similar apps
                            </p>
                            {status?.totpConfigured && (
                                <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                                    <Check className="w-3 h-3" />
                                    Configured
                                </span>
                            )}
                        </div>
                    </div>
                    {status?.totpConfigured ? (
                        <button
                            onClick={() => handleAction('disable-totp')}
                            disabled={actionLoading !== null}
                            className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 transition-colors"
                        >
                            {actionLoading === 'disable-totp' ? 'Removing...' : 'Remove'}
                        </button>
                    ) : (
                        <button
                            onClick={startTotpSetup}
                            disabled={actionLoading !== null}
                            className="px-4 py-2 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                        >
                            {actionLoading === 'totp-setup' ? 'Loading...' : 'Set Up'}
                        </button>
                    )}
                </div>

                {/* TOTP Setup Modal */}
                {showTotpSetup && (
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                            Set Up Authenticator App
                        </h4>

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    1. Scan this QR code with your authenticator app:
                                </p>
                                {totpQrCode && (
                                    <img
                                        src={totpQrCode}
                                        alt="TOTP QR Code"
                                        className="w-48 h-48 bg-white p-2 rounded-lg mx-auto"
                                    />
                                )}
                            </div>

                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    Or enter this code manually:
                                </p>
                                <code className="block p-2 bg-white dark:bg-gray-900 rounded border font-mono text-sm break-all">
                                    {totpSecret}
                                </code>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    2. Enter the 6-digit code from your app:
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={totpCode}
                                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                        className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono tracking-widest"
                                        placeholder="000000"
                                    />
                                    <button
                                        onClick={() => handleAction('verify-totp', { code: totpCode })}
                                        disabled={totpCode.length !== 6 || actionLoading !== null}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        {actionLoading === 'verify-totp' ? 'Verifying...' : 'Verify'}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowTotpSetup(false)}
                                className="text-gray-600 dark:text-gray-400 text-sm hover:underline"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Disable All */}
            {status?.enabled && (
                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            if (confirm('This will disable all MFA methods. Are you sure?')) {
                                handleAction('disable-all');
                            }
                        }}
                        disabled={actionLoading !== null}
                        className="text-red-600 hover:text-red-700 text-sm"
                    >
                        Disable all MFA
                    </button>
                </div>
            )}
        </div>
    );
}
