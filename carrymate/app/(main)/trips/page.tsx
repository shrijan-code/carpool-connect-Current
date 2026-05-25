'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { format, isSameDay, parseISO } from 'date-fns';
import { Package, Search } from 'lucide-react';
import { getClientDb } from '@/lib/firebase';
import type { City, SpaceSize, Trip } from '@/types';
import { CITIES } from '@/types';
import TripCard from '@/components/ui/TripCard';
import EmptyState from '@/components/ui/EmptyState';
import { TripCardSkeleton } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useRouter } from 'next/navigation';

type SortOption = 'date_asc' | 'date_desc' | 'price_asc' | 'price_desc' | 'rating_desc';

const spaceOptions: { value: SpaceSize | ''; label: string }[] = [
  { value: '', label: 'Any space' },
  { value: 'small', label: 'Small (backpack)' },
  { value: 'medium', label: 'Medium (carry-on)' },
  { value: 'large', label: 'Large (checked bag)' },
];

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCity, setFromCity] = useState<City | ''>('');
  const [toCity, setToCity] = useState<City | ''>('');
  const [dateFilter, setDateFilter] = useState('');
  const [spaceFilter, setSpaceFilter] = useState<SpaceSize | ''>('');
  const [sortBy, setSortBy] = useState<SortOption>('date_asc');

  useEffect(() => {
    const q = query(
      collection(getClientDb(), 'trips'),
      where('status', '==', 'open'),
      orderBy('travelDate', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Trip
        );
        setTrips(data);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, []);

  const filteredTrips = useMemo(() => {
    let result = [...trips];

    if (fromCity) result = result.filter((t) => t.fromCity === fromCity);
    if (toCity) result = result.filter((t) => t.toCity === toCity);
    if (spaceFilter) result = result.filter((t) => t.availableSpace === spaceFilter);
    if (dateFilter) {
      const filterDate = parseISO(dateFilter);
      result = result.filter((t) => {
        const tripDate = t.travelDate?.toDate?.() ?? new Date();
        return isSameDay(tripDate, filterDate);
      });
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return b.travelDate.toMillis() - a.travelDate.toMillis();
        case 'price_asc':
          return a.pricePerKg - b.pricePerKg;
        case 'price_desc':
          return b.pricePerKg - a.pricePerKg;
        case 'rating_desc':
          return b.travellerRating - a.travellerRating;
        default:
          return a.travelDate.toMillis() - b.travelDate.toMillis();
      }
    });

    return result;
  }, [trips, fromCity, toCity, spaceFilter, dateFilter, sortBy]);

  const minDate = format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Find a carrier</h1>
        <p className="mt-1 text-gray-600">Browse open trips between Canberra, Sydney, and Melbourne.</p>
      </div>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="from" className="mb-1 block text-sm font-medium text-gray-700">
              From
            </label>
            <select
              id="from"
              value={fromCity}
              onChange={(e) => setFromCity(e.target.value as City | '')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">Any city</option>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-sm font-medium text-gray-700">
              To
            </label>
            <select
              id="to"
              value={toCity}
              onChange={(e) => setToCity(e.target.value as City | '')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">Any city</option>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <Input
            id="date"
            label="Travel date"
            type="date"
            min={minDate}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <div>
            <label htmlFor="space" className="mb-1 block text-sm font-medium text-gray-700">
              Available space
            </label>
            <select
              id="space"
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value as SpaceSize | '')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              {spaceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="mb-1 block text-sm font-medium text-gray-700">
              Sort by
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="date_asc">Date (soonest)</option>
              <option value="date_desc">Date (latest)</option>
              <option value="price_asc">Price (low to high)</option>
              <option value="price_desc">Price (high to low)</option>
              <option value="rating_desc">Rating (highest)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No trips found"
          description="Try adjusting your filters or check back later for new trips."
          actionLabel="Post a trip"
          onAction={() => router.push('/trips/new')}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">
            <Search className="mr-1 inline h-4 w-4" />
            {filteredTrips.length} trip{filteredTrips.length !== 1 ? 's' : ''} available
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
