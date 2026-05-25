'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { AlertTriangle } from 'lucide-react';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { tripSchema, type TripFormData } from '@/lib/validations';
import { CITIES, RESTRICTIONS } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { useToast } from '@/components/toast/ToastProvider';
import { DetailPageSkeleton } from '@/components/ui/Skeleton';

export default function NewTripPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TripFormData>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      restrictions: [],
      notes: '',
      pricePerKg: 15,
      maxWeight: 5,
      maxItems: 3,
      availableSpace: 'medium',
    },
  });

  const selectedRestrictions = watch('restrictions') ?? [];
  const fromCity = watch('fromCity');
  const toCity = watch('toCity');
  const travelDate = watch('travelDate');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/trips/new');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    async function checkDuplicate() {
      if (!user || !fromCity || !toCity || !travelDate) {
        setDuplicateWarning(false);
        return;
      }
      const dateStart = new Date(travelDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(travelDate);
      dateEnd.setHours(23, 59, 59, 999);

      const q = query(
        collection(getClientDb(), 'trips'),
        where('travellerId', '==', user.uid),
        where('fromCity', '==', fromCity),
        where('toCity', '==', toCity),
        where('status', 'in', ['open', 'full'])
      );

      const snap = await getDocs(q);
      const hasDuplicate = snap.docs.some((d) => {
        const data = d.data();
        const tripDate = (data.travelDate as Timestamp).toDate();
        return tripDate >= dateStart && tripDate <= dateEnd;
      });
      setDuplicateWarning(hasDuplicate);
    }
    void checkDuplicate();
  }, [user, fromCity, toCity, travelDate]);

  const toggleRestriction = (value: string) => {
    const current = selectedRestrictions;
    if (current.includes(value)) {
      setValue(
        'restrictions',
        current.filter((r) => r !== value)
      );
    } else {
      setValue('restrictions', [...current, value]);
    }
  };

  const onSubmit = async (data: TripFormData) => {
    if (!user || !userProfile) return;

    if (!userProfile.stripeOnboardingComplete) {
      toast('Complete Stripe onboarding before posting a trip.', 'warning');
      router.push('/connect');
      return;
    }

    setSubmitting(true);
    try {
      const travelTimestamp = Timestamp.fromDate(new Date(data.travelDate + 'T00:00:00'));

      const docRef = await addDoc(collection(getClientDb(), 'trips'), {
        travellerId: user.uid,
        travellerName: userProfile.displayName,
        travellerPhoto: userProfile.photoURL,
        travellerRating: userProfile.rating,
        fromCity: data.fromCity,
        toCity: data.toCity,
        travelDate: travelTimestamp,
        departureTime: data.departureTime,
        availableSpace: data.availableSpace,
        pricePerKg: data.pricePerKg,
        maxWeight: data.maxWeight,
        maxItems: data.maxItems,
        currentItems: 0,
        restrictions: data.restrictions,
        notes: data.notes ?? '',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast('Trip posted successfully!', 'success');
      router.push(`/trips/${docRef.id}`);
    } catch {
      toast('Failed to post trip. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <DetailPageSkeleton />;

  if (!userProfile?.stripeOnboardingComplete) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-brand-warning" />
        <h1 className="mb-2 text-xl font-semibold">Stripe setup required</h1>
        <p className="mb-6 text-sm text-gray-600">
          You need to complete Stripe Connect onboarding to receive payouts as a carrier.
        </p>
        <Link href="/connect">
          <Button>Set up payouts</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Post a trip</h1>
      <p className="mb-8 text-gray-600">Share your journey and earn by carrying items for others.</p>

      {duplicateWarning && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-brand-warning/30 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            You already have an open trip on this route and date. You can still post another, but
            consider updating your existing trip instead.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Route & schedule</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fromCity" className="mb-1 block text-sm font-medium text-gray-700">
                From city
              </label>
              <select
                id="fromCity"
                {...register('fromCity')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="">Select city</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              {errors.fromCity && (
                <p className="mt-1 text-xs text-brand-danger">{errors.fromCity.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="toCity" className="mb-1 block text-sm font-medium text-gray-700">
                To city
              </label>
              <select
                id="toCity"
                {...register('toCity')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="">Select city</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              {errors.toCity && (
                <p className="mt-1 text-xs text-brand-danger">{errors.toCity.message}</p>
              )}
            </div>
            <Input
              label="Travel date"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              error={errors.travelDate?.message}
              {...register('travelDate')}
            />
            <Input
              label="Departure time"
              type="time"
              error={errors.departureTime?.message}
              {...register('departureTime')}
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Capacity & pricing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="availableSpace" className="mb-1 block text-sm font-medium text-gray-700">
                Available space
              </label>
              <select
                id="availableSpace"
                {...register('availableSpace')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="small">Small (backpack)</option>
                <option value="medium">Medium (carry-on)</option>
                <option value="large">Large (checked bag)</option>
              </select>
            </div>
            <Input
              label="Price per kg (AUD)"
              type="number"
              step="0.5"
              min={5}
              max={50}
              error={errors.pricePerKg?.message}
              {...register('pricePerKg', { valueAsNumber: true })}
            />
            <Input
              label="Max weight (kg)"
              type="number"
              min={1}
              max={20}
              error={errors.maxWeight?.message}
              {...register('maxWeight', { valueAsNumber: true })}
            />
            <Input
              label="Max items"
              type="number"
              min={1}
              max={10}
              error={errors.maxItems?.message}
              {...register('maxItems', { valueAsNumber: true })}
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Restrictions</h2>
          <div className="flex flex-wrap gap-2">
            {RESTRICTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleRestriction(value)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  selectedRestrictions.includes(value)
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Notes</h2>
          <textarea
            {...register('notes')}
            rows={3}
            maxLength={200}
            placeholder="Any extra details for senders (optional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
          {errors.notes && (
            <p className="mt-1 text-xs text-brand-danger">{errors.notes.message}</p>
          )}
        </Card>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Post trip
        </Button>
      </form>
    </div>
  );
}
