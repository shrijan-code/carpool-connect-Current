import Link from 'next/link';
import { Calendar, Package } from 'lucide-react';
import type { Trip } from '@/types';
import RouteDisplay from './RouteDisplay';
import UserCard from './UserCard';
import Button from './Button';
import { format } from 'date-fns';

interface TripCardProps {
  trip: Trip;
}

const spaceLabels = {
  small: 'Small (backpack)',
  medium: 'Medium (carry-on)',
  large: 'Large (checked bag)',
};

export default function TripCard({ trip }: TripCardProps) {
  const travelDate = trip.travelDate?.toDate?.() ?? new Date();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
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
        showLink={false}
        className="mb-4"
      />
      <RouteDisplay fromCity={trip.fromCity} toCity={trip.toCity} className="mb-3" />
      <div className="mb-3 flex flex-wrap gap-3 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {format(travelDate, 'dd MMM yyyy')} at {trip.departureTime}
        </span>
        <span className="flex items-center gap-1">
          <Package className="h-4 w-4" />
          {spaceLabels[trip.availableSpace]}
        </span>
      </div>
      <p className="mb-3 text-lg font-semibold text-brand-primary">
        ${trip.pricePerKg.toFixed(2)}/kg
      </p>
      {trip.restrictions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {trip.restrictions.slice(0, 3).map((r) => (
            <span key={r} className="rounded bg-brand-light px-2 py-0.5 text-xs text-brand-primary">
              {r.replace(/_/g, ' ')}
            </span>
          ))}
          {trip.restrictions.length > 3 && (
            <span className="text-xs text-gray-400">+{trip.restrictions.length - 3} more</span>
          )}
        </div>
      )}
      <Link href={`/trips/${trip.id}`}>
        <Button className="w-full" variant="outline">
          View details
        </Button>
      </Link>
    </div>
  );
}
