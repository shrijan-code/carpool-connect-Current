'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  type ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getClientAuth, getClientDb } from '@/lib/firebase';
import { isProfileComplete } from '@/lib/auth-context';
import { loginEmailSchema } from '@/lib/validations';
import { getAuthErrorMessage, setSession } from '@/lib/session-client';
import { useToast } from '@/components/toast/ToastProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PhoneInput from '@/components/forms/PhoneInput';
import type { User } from '@/types';
import type { z } from 'zod';

type LoginTab = 'phone' | 'email';
type EmailFormData = z.infer<typeof loginEmailSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [tab, setTab] = useState<LoginTab>('phone');
  const [phone, setPhone] = useState('+61');
  const [phoneError, setPhoneError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EmailFormData>({
    resolver: zodResolver(loginEmailSchema),
  });

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const getRecaptchaVerifier = () => {
    if (recaptchaRef.current) {
      return recaptchaRef.current;
    }
    recaptchaRef.current = new RecaptchaVerifier(getClientAuth(), 'login-recaptcha', {
      size: 'invisible',
    });
    return recaptchaRef.current;
  };

  const redirectAfterLogin = async (uid: string) => {
    const snap = await getDoc(doc(getClientDb(), 'users', uid));
    const profile = snap.exists() ? ({ uid, ...snap.data() } as User) : null;
    const redirect = searchParams.get('redirect');
    const destination =
      redirect && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : isProfileComplete(profile)
          ? '/dashboard'
          : '/onboarding';
    router.push(destination);
  };

  const completeLogin = async () => {
    const user = getClientAuth().currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    const idToken = await user.getIdToken();
    await setSession(idToken);
    toast('Welcome back!', 'success');
    await redirectAfterLogin(user.uid);
  };

  const handleSendOtp = async () => {
    setPhoneError('');
    if (!/^\+61[0-9]{9}$/.test(phone)) {
      setPhoneError('Must be Australian mobile number');
      return;
    }

    setPhoneLoading(true);
    try {
      const verifier = getRecaptchaVerifier();
      const result = await signInWithPhoneNumber(getClientAuth(), phone, verifier);
      setConfirmation(result);
      setOtpSent(true);
      toast('Verification code sent', 'success');
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      toast(getAuthErrorMessage(error), 'error');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!confirmation || otp.length !== 6) {
      toast('Enter the 6-digit verification code', 'error');
      return;
    }

    setPhoneLoading(true);
    try {
      await confirmation.confirm(otp);
      await completeLogin();
    } catch (error) {
      toast(getAuthErrorMessage(error), 'error');
    } finally {
      setPhoneLoading(false);
    }
  };

  const onEmailSubmit = async (data: EmailFormData) => {
    try {
      await signInWithEmailAndPassword(getClientAuth(), data.email, data.password);
      await completeLogin();
    } catch (error) {
      toast(getAuthErrorMessage(error), 'error');
    }
  };

  const handleForgotPassword = async () => {
    const email = getValues('email');
    if (!email) {
      toast('Enter your email address first', 'warning');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(getClientAuth(), email);
      toast('Password reset email sent', 'success');
    } catch (error) {
      toast(getAuthErrorMessage(error), 'error');
    } finally {
      setResetLoading(false);
    }
  };

  const switchTab = (next: LoginTab) => {
    setTab(next);
    setOtpSent(false);
    setOtp('');
    setConfirmation(null);
    setPhoneError('');
  };

  return (
    <Card>
      <h1 className="mb-2 text-2xl font-bold text-brand-primary">Welcome back</h1>
      <p className="mb-6 text-sm text-gray-600">Sign in to your CarryMate account</p>

      <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => switchTab('phone')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'phone'
              ? 'bg-white text-brand-primary shadow-sm'
              : 'text-gray-600 hover:text-brand-primary'
          }`}
        >
          Phone OTP
        </button>
        <button
          type="button"
          onClick={() => switchTab('email')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'email'
              ? 'bg-white text-brand-primary shadow-sm'
              : 'text-gray-600 hover:text-brand-primary'
          }`}
        >
          Email
        </button>
      </div>

      {tab === 'phone' ? (
        <div className="space-y-4">
          <PhoneInput
            value={phone}
            onChange={setPhone}
            error={phoneError}
            disabled={otpSent}
          />

          {otpSent && (
            <Input
              label="Verification code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          )}

          {!otpSent ? (
            <Button
              type="button"
              className="w-full"
              loading={phoneLoading}
              onClick={() => void handleSendOtp()}
            >
              Send verification code
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                className="w-full"
                loading={phoneLoading}
                onClick={() => void handleVerifyOtp()}
              >
                Verify & sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setOtpSent(false);
                  setOtp('');
                  setConfirmation(null);
                }}
              >
                Use a different number
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleForgotPassword()}
              disabled={resetLoading}
              className="text-sm text-brand-secondary hover:text-brand-primary hover:underline disabled:opacity-50"
            >
              {resetLoading ? 'Sending…' : 'Forgot password?'}
            </button>
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>
      )}

      <div id="login-recaptcha" />

      <p className="mt-6 text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-brand-primary hover:underline">
          Register
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">Loading…</p>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
