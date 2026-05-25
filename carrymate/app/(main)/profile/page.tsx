'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Star } from 'lucide-react';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { CITIES, type City } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { DetailPageSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/toast/ToastProvider';
import Image from 'next/image';

export default function ProfilePage() {
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/profile');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName);
      setBio(userProfile.bio ?? '');
      setCities(userProfile.cities ?? []);
    }
  }, [userProfile]);

  const toggleCity = (city: City) => {
    setCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    if (displayName.trim().length < 2) {
      toast('Display name must be at least 2 characters.', 'error');
      return;
    }
    if (cities.length === 0) {
      toast('Select at least one city.', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(getClientDb(), 'users', user.uid), {
        displayName: displayName.trim(),
        bio: bio.trim(),
        cities,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      toast('Profile updated.', 'success');
    } catch {
      toast('Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DetailPageSkeleton />;
  if (!userProfile) return null;

  const initials = userProfile.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Your profile</h1>

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full bg-brand-light">
            {userProfile.photoURL ? (
              <Image
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                fill
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand-primary">
                {initials}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-brand-warning text-brand-warning" />
              <span className="font-medium">{userProfile.rating.toFixed(1)}</span>
              <span className="text-sm text-gray-500">({userProfile.totalRatings} ratings)</span>
            </div>
            <p className="text-sm text-gray-500">{userProfile.email}</p>
          </div>
        </div>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="space-y-6"
      >
        <Card>
          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={300}
              placeholder="Tell others about yourself"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Cities you travel</h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => toggleCity(city)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  cities.includes(city)
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-lg font-semibold">Payouts</h2>
          <p className="mb-4 text-sm text-gray-600">
            {userProfile.stripeOnboardingComplete
              ? 'Stripe Connect is set up. You can receive payouts.'
              : 'Set up Stripe to receive payouts when you carry items.'}
          </p>
          {!userProfile.stripeOnboardingComplete && (
            <Link href="/connect">
              <Button variant="outline">Set up Stripe</Button>
            </Link>
          )}
        </Card>

        <Button type="submit" size="lg" className="w-full" loading={saving}>
          Save profile
        </Button>
      </form>
    </div>
  );
}
