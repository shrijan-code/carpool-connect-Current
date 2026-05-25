import { ArrowRight } from 'lucide-react';
import type { City } from '@/types';
import { ROUTE_DISTANCES } from '@/types';
import { cn, getRouteKey } from '@/lib/utils';

interface RouteDisplayProps {
  fromCity: City;
  toCity: City;
  className?: string;
  showDistance?: boolean;
}

export default function RouteDisplay({
  fromCity,
  toCity,
  className,
  showDistance = true,
}: RouteDisplayProps) {
  const route = ROUTE_DISTANCES[getRouteKey(fromCity, toCity)];

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <span>{fromCity}</span>
        <ArrowRight className="h-5 w-5 text-brand-secondary" />
        <span>{toCity}</span>
      </div>
      {showDistance && route && (
        <p className="text-sm text-gray-500">
          {route.km} km · ~{route.hours} hrs
        </p>
      )}
    </div>
  );
}
