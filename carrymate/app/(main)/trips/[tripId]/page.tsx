'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { Calendar, Package, Pencil, Trash2 } from 'lucide-react';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { bookingSchema, type BookingFormData } from '@/lib/validations';
import { calculateBookingPricing } from '@/lib/utils';
import { CITIES, ITEM_CATEGORIES, type Trip } from '@/types';
import RouteDisplay from '@/components/ui/RouteDisplay';
import UserCard from '@/components/ui/UserCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PhoneInput from '@/components/forms/PhoneInput';
import { DetailPageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/toast/ToastProvider';

const spaceLabels = {
  small: 'Small (backpack)',
  medium: 'Medium (carry-on)',
  large: 'Large (checked bag)',
};

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editPrice, setEditPrice] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { recipientCity: 'Sydney' },
  });

  const estimatedWeight = watch('estimatedWeight') ?? 1;
  const recipientPhone = watch('recipientPhone') ?? '';

  useEffect(() => {
    const tripRef = doc(getClientDb(), 'trips', tripId);
    const unsubscribe = onSnapshot(tripRef, (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Trip;
        setTrip(data);
        setEditNotes(data.notes);
        setEditPrice(data.pricePerKg);
      } else {
        setTrip(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  const isTraveller = user?.uid === trip?.travellerId;
  const canBook =
    trip &&
    trip.status === 'open' &&
    trip.currentItems < trip.maxItems &&
    user &&
    !isTraveller;

  const pricing = trip ? calculateBookingPricing(estimatedWeight, trip.pricePerKg) : null;

  const onBook = async (data: BookingFormData) => {
    if (!user || !userProfile || !trip) return;
    setBookingLoading(true);
    try {
      const bookingId = await runTransaction(getClientDb(), async (transaction) => {
        const tripRef = doc(getClientDb(), 'trips', tripId);
        const tripSnap = await transaction.get(tripRef);
        if (!tripSnap.exists()) throw new Error('Trip not found');

        const tripData = tripSnap.data() as Omit<Trip, 'id'>;
        if (tripData.status !== 'open') throw new Error('Trip is no longer available');
        if (tripData.currentItems >= tripData.maxItems) throw new Error('Trip is full');

        const { deliveryFee, platformFee, total, travellerPayout } = calculateBookingPricing(
          data.estimatedWeight,
          tripData.pricePerKg
        );

        const bookingRef = doc(collection(getClientDb(), 'bookings'));
        transaction.set(bookingRef, {
          tripId,
          travellerId: tripData.travellerId,
          senderId: user.uid,
          senderName: userProfile.displayName,
          recipientName: data.recipientName,
          recipientPhone: data.recipientPhone,
          recipientCity: data.recipientCity,
          itemDescription: data.itemDescription,
          itemCategory: data.itemCategory,
          itemPhotoURL: '',
          estimatedWeight: data.estimatedWeight,
          agreedPrice: deliveryFee,
          platformFee,
          travellerPayout,
          declarationSignedAt: null,
          declarationData: null,
          stripePaymentIntentId: null,
          stripeTransferId: null,
          status: 'pending',
          pickupLocation: data.pickupLocation,
          pickupConfirmedAt: null,
          deliveryConfirmedAt: null,
          cancelledAt: null,
          cancelledBy: null,
          disputeReason: null,
          fromCity: tripData.fromCity,
          toCity: tripData.toCity,
          travelDate: tripData.travelDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const newCount = tripData.currentItems + 1;
        transaction.update(tripRef, {
          currentItems: newCount,
          status: newCount >= tripData.maxItems ? 'full' : 'open',
          updatedAt: serverTimestamp(),
        });

        return bookingRef.id;
      });

      toast('Booking request sent!', 'success');
      router.push(`/bookings/${bookingId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create booking';
      toast(message, 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelTrip = async () => {
    if (!trip || !confirm('Cancel this trip? Pending bookings will need to be handled separately.'))
      return;
    try {
      await updateDoc(doc(getClientDb(), 'trips', trip.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      toast('Trip cancelled.', 'success');
    } catch {
      toast('Failed to cancel trip.', 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!trip) return;
    try {
      await updateDoc(doc(getClientDb(), 'trips', trip.id), {
        notes: editNotes,
        pricePerKg: editPrice,
        updatedAt: serverTimestamp(),
      });
      setEditMode(false);
      toast('Trip updated.', 'success');
    } catch {
      toast('Failed to update trip.', 'error');
    }
  };

  if (loading) return <DetailPageSkeleton />;

  if (!trip) {
    return (
      <EmptyState
        icon={Package}
        title="Trip not found"
        description="This trip may have been removed or the link is incorrect."
        actionLabel="Browse trips"
        onAction={() => router.push('/trips')}
      />
    );
  }

  const travelDate = trip.travelDate?.toDate?.() ?? new Date();

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <RouteDisplay fromCity={trip.fromCity} toCity={trip.toCity} className="mb-4" />
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(travelDate, 'dd MMM yyyy')} at {trip.departureTime}
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {spaceLabels[trip.availableSpace]}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                trip.status === 'open'
                  ? 'bg-green-100 text-green-700'
                  : trip.status === 'full'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {trip.status}
            </span>
          </div>
        </div>

        <Card>
          <UserCard
            user={{
              uid: trip.travellerId,
              displayName: trip.travellerName,
              photoURL: trip.travellerPhoto,
              rating: trip.travellerRating,
              totalRatings: 0,
              totalDeliveries: 0,
              communityVerified: false,
            }}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Trip details</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">Price</dt>
              <dd className="font-semibold text-brand-primary">${trip.pricePerKg.toFixed(2)}/kg</dd>
            </div>
            <div>
              <dt className="text-gray-500">Capacity</dt>
              <dd>
                {trip.currentItems}/{trip.maxItems} items · max {trip.maxWeight} kg
              </dd>
            </div>
          </dl>
          {trip.restrictions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-gray-500">Restrictions</p>
              <div className="flex flex-wrap gap-1">
                {trip.restrictions.map((r) => (
                  <span
                    key={r}
                    className="rounded bg-brand-light px-2 py-0.5 text-xs text-brand-primary"
                  >
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          {trip.notes && (
            <p className="mt-4 text-sm text-gray-600">
              <span className="font-medium text-gray-700">Notes: </span>
              {trip.notes}
            </p>
          )}
        </Card>

        {isTraveller && trip.status !== 'cancelled' && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Manage trip</h2>
            {editMode ? (
              <div className="space-y-4">
                <Input
                  label="Price per kg (AUD)"
                  type="number"
                  step="0.5"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    maxLength={200}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setEditMode(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleSaveEdit()}>Save changes</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit trip
                </Button>
                <Button variant="danger" onClick={() => void handleCancelTrip()}>
                  <Trash2 className="h-4 w-4" />
                  Cancel trip
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <div>
        {canBook ? (
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Send an item</h2>
            {!user ? (
              <p className="text-sm text-gray-600">
                <Link href={`/login?redirect=/trips/${tripId}`} className="text-brand-primary underline">
                  Log in
                </Link>{' '}
                to book this trip.
              </p>
            ) : (
              <form onSubmit={handleSubmit(onBook)} className="space-y-4">
                <Input
                  label="Recipient name"
                  error={errors.recipientName?.message}
                  {...register('recipientName')}
                />
                <PhoneInput
                  value={recipientPhone}
                  onChange={(v) => setValue('recipientPhone', v, { shouldValidate: true })}
                  error={errors.recipientPhone?.message}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Recipient city
                  </label>
                  <select
                    {...register('recipientCity')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Item category
                  </label>
                  <select
                    {...register('itemCategory')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {ITEM_CATEGORIES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Item description
                  </label>
                  <textarea
                    {...register('itemDescription')}
                    rows={3}
                    placeholder="Describe your item in detail (min 20 characters)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                  {errors.itemDescription && (
                    <p className="mt-1 text-xs text-brand-danger">{errors.itemDescription.message}</p>
                  )}
                </div>
                <Input
                  label="Estimated weight (kg)"
                  type="number"
                  step="0.1"
                  min={0.1}
                  max={trip.maxWeight}
                  error={errors.estimatedWeight?.message}
                  {...register('estimatedWeight', { valueAsNumber: true })}
                />
                <Input
                  label="Pickup location"
                  placeholder="Address or meeting point"
                  error={errors.pickupLocation?.message}
                  {...register('pickupLocation')}
                />

                {pricing && (
                  <div className="rounded-lg bg-brand-light p-3 text-sm">
                    <div className="flex justify-between">
                      <span>Delivery fee</span>
                      <span>${pricing.deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Platform fee</span>
                      <span>${pricing.platformFee.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex justify-between font-semibold">
                      <span>Total</span>
                      <span>${pricing.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" loading={bookingLoading}>
                  Request booking
                </Button>
              </form>
            )}
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-gray-600">
              {isTraveller
                ? 'This is your trip.'
                : trip.status !== 'open'
                  ? 'This trip is no longer accepting bookings.'
                  : 'This trip is full.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
