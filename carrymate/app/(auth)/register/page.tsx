'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  linkWithPhoneNumber,
  updateProfile,
  type ConfirmationResult,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getClientAuth, getClientDb } from '@/lib/firebase';
import { registerSchema, type RegisterFormData } from '@/lib/validations';
import { getAuthErrorMessage, setSession } from '@/lib/session-client';
import { useToast } from '@/components/toast/ToastProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PhoneInput from '@/components/forms/PhoneInput';
import type { Community } from '@/types';

const COMMUNITIES: { value: Community; label: string }[] = [
  { value: 'nepali', label: 'Nepali' },
  { value: 'indian', label: 'Indian' },
  { value: 'srilankan', label: 'Sri Lankan' },
  { value: 'filipino', label: 'Filipino' },
  { value: 'other', label: 'Other' },
];

type RegisterStep = 'details' | 'phone';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [step, setStep] = useState<RegisterStep>('details');
  const [formData, setFormData] = useState<RegisterFormData | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      phone: '+61',
      password: '',
      community: 'other',
    },
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
    recaptchaRef.current = new RecaptchaVerifier(getClientAuth(), 'register-recaptcha', {
      size: 'invisible',
    });
    return recaptchaRef.current;
  };

  const createUserDocument = async (uid: string, data: RegisterFormData) => {
    await setDoc(doc(getClientDb(), 'users', uid), {
      uid,
      displayName: data.displayName,
      email: data.email,
      phone: data.phone,
      photoURL: null,
      idVerified: false,
      communityVerified: false,
      community: data.community,
      rating: 0,
      totalRatings: 0,
      totalDeliveries: 0,
      totalSent: 0,
      stripeAccountId: null,
      stripeOnboardingComplete: false,
      bio: '',
      cities: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const onDetailsSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        getClientAuth(),
        data.email,
        data.password
      );
      await updateProfile(userCredential.user, { displayName: data.displayName });

      const verifier = getRecaptchaVerifier();
      const phoneConfirmation = await linkWithPhoneNumber(
        userCredential.user,
        data.phone,
        verifier
      );

      setFormData(data);
      setConfirmation(phoneConfirmation);
      setStep('phone');
      toast('Verification code sent to your phone', 'success');
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      toast(getAuthErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyPhone = async () => {
    if (!confirmation || !formData) {
      toast('Please complete the registration form first', 'error');
      return;
    }
    if (otp.length !== 6) {
      toast('Enter the 6-digit verification code', 'error');
      return;
    }

    setLoading(true);
    try {
      await confirmation.confirm(otp);

      const user = getClientAuth().currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      await createUserDocument(user.uid, formData);

      const idToken = await user.getIdToken();
      await setSession(idToken);

      toast('Account created successfully!', 'success');
      router.push('/onboarding');
    } catch (error) {
      toast(getAuthErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!formData) return;

    setLoading(true);
    try {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;

      const user = getClientAuth().currentUser;
      if (!user) {
        toast('Session expired. Please start again.', 'error');
        setStep('details');
        return;
      }

      const verifier = getRecaptchaVerifier();
      const phoneConfirmation = await linkWithPhoneNumber(user, formData.phone, verifier);
      setConfirmation(phoneConfirmation);
      setOtp('');
      toast('New verification code sent', 'success');
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      toast(getAuthErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h1 className="mb-2 text-2xl font-bold text-brand-primary">Create account</h1>
      <p className="mb-6 text-sm text-gray-600">
        {step === 'details'
          ? 'Join the CarryMate community'
          : 'Verify your phone number to complete registration'}
      </p>

      {step === 'details' ? (
        <form onSubmit={handleSubmit(onDetailsSubmit)} className="space-y-4">
          <Input
            label="Display name"
            autoComplete="name"
            error={errors.displayName?.message}
            {...register('displayName')}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                value={field.value}
                onChange={field.onChange}
                error={errors.phone?.message}
              />
            )}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="w-full">
            <label htmlFor="community" className="mb-1 block text-sm font-medium text-gray-700">
              Community
            </label>
            <select
              id="community"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              {...register('community')}
            >
              {COMMUNITIES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.community?.message && (
              <p className="mt-1 text-xs text-brand-danger">{errors.community.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Continue
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-gray-900">{formData?.phone}</span>
          </p>
          <Input
            label="Verification code"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Button
            type="button"
            className="w-full"
            loading={loading}
            onClick={() => void onVerifyPhone()}
          >
            Verify & create account
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={loading}
            onClick={() => void resendOtp()}
          >
            Resend code
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => {
              setStep('details');
              setOtp('');
              setConfirmation(null);
            }}
          >
            Back to details
          </Button>
        </div>
      )}

      <div id="register-recaptcha" />

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
