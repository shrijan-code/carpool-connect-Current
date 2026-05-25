'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Camera } from 'lucide-react';
import { useAuth, isProfileComplete } from '@/lib/auth-context';
import { onboardingSchema } from '@/lib/validations';
import { getClientDb } from '@/lib/firebase';
import { useToast } from '@/components/toast/ToastProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { CITIES, type City } from '@/types';
import type { z } from 'zod';

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedCities, setSelectedCities] = useState<City[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      bio: '',
      cities: [],
    },
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login?redirect=/onboarding');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && userProfile && isProfileComplete(userProfile)) {
      router.replace('/dashboard');
    }
  }, [userProfile, loading, router]);

  useEffect(() => {
    if (userProfile?.photoURL) {
      setPhotoPreview(userProfile.photoURL);
    }
    if (userProfile?.cities?.length) {
      setSelectedCities(userProfile.cities);
      setValue('cities', userProfile.cities);
    }
  }, [userProfile, setValue]);

  const toggleCity = (city: City) => {
    setSelectedCities((prev) => {
      const next = prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city];
      setValue('cities', next, { shouldValidate: true });
      return next;
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5 MB', 'error');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) {
      return userProfile?.photoURL ?? null;
    }

    setUploading(true);
    try {
      const signedResponse = await fetch('/api/upload/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: photoFile.type,
          filename: photoFile.name,
        }),
      });

      if (!signedResponse.ok) {
        const data = (await signedResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Failed to prepare upload');
      }

      const { signedUrl, publicUrl } = (await signedResponse.json()) as {
        signedUrl: string;
        publicUrl: string;
      };

      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': photoFile.type },
        body: photoFile,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo');
      }

      return publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: OnboardingFormData) => {
    if (!user) return;

    try {
      const photoURL = await uploadPhoto();

      await updateDoc(doc(getClientDb(), 'users', user.uid), {
        bio: data.bio ?? '',
        cities: data.cities,
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });

      await refreshProfile();
      toast('Profile updated!', 'success');
      router.push('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      toast(message, 'error');
    }
  };

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </Card>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Card>
      <h1 className="mb-2 text-2xl font-bold text-brand-primary">Complete your profile</h1>
      <p className="mb-6 text-sm text-gray-600">
        Help others get to know you before booking or posting trips
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed border-brand-primary/40 bg-brand-light transition-colors hover:border-brand-primary"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Profile preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-brand-primary">
                <Camera className="h-8 w-8" />
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Change
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
          <p className="text-xs text-gray-500">Profile photo (optional)</p>
        </div>

        <Input
          label="Bio"
          placeholder="Tell others a bit about yourself…"
          error={errors.bio?.message}
          {...register('bio')}
        />

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            Cities you travel between <span className="text-brand-danger">*</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((city) => {
              const selected = selectedCities.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => toggleCity(city)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-brand-primary text-white'
                      : 'border border-gray-300 text-gray-700 hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </div>
          {errors.cities?.message && (
            <p className="mt-1 text-xs text-brand-danger">{errors.cities.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting || uploading}
        >
          Continue to dashboard
        </Button>
      </form>
    </Card>
  );
}
