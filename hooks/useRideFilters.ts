import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Ride, Location } from '@/types';
import { calculateLocationDistance } from '@/utils/haversine';

export interface FilterOptions {
  city?: string;
  suburb?: string;
  postcode?: string;
  maxDistance?: number; // in km
  minPrice?: number;
  maxPrice?: number;
  minSeats?: number;
  userLocation?: { latitude: number; longitude: number };
}

/**
 * Parse address to extract city, suburb, and postcode
 * Enhanced parser for Australian addresses
 */
function parseAddress(address: string): { city?: string; suburb?: string; postcode?: string } {
  if (!address) return {};

  const parts = address.split(',').map(part => part.trim());
  const result: { city?: string; suburb?: string; postcode?: string } = {};

  // Look for Australian postcode (4 digits)
  const postcodeMatch = address.match(/\b\d{4}\b/);
  if (postcodeMatch) {
    result.postcode = postcodeMatch[0];
  }

  // Look for Australian states/territories
  const statePattern = /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT|New South Wales|Victoria|Queensland|Western Australia|South Australia|Tasmania|Australian Capital Territory|Northern Territory)\b/i;
  const stateMatch = address.match(statePattern);

  if (parts.length >= 2) {
    // If we found a state, the part before it is likely the city
    if (stateMatch) {
      const stateIndex = parts.findIndex(part => statePattern.test(part));
      if (stateIndex > 0) {
        result.city = parts[stateIndex - 1];
      }
      // Suburb is typically the first part
      if (parts.length > 0) {
        result.suburb = parts[0];
      }
    } else {
      // Fallback: last part is city, first part is suburb
      result.city = parts[parts.length - 1].replace(/\d{4}/, '').trim();
      result.suburb = parts[0];
    }
  }

  return result;
}

/**
 * Check if location matches text-based filters
 */
function matchesLocationFilters(
  location: Location,
  filters: { city?: string; suburb?: string; postcode?: string }
): boolean {
  if (!location?.address) return false;

  const parsed = parseAddress(location.address);

  // City filter
  if (filters.city) {
    const cityLower = filters.city.toLowerCase();
    const cityMatch = parsed.city?.toLowerCase().includes(cityLower) ||
      location.address.toLowerCase().includes(cityLower);
    if (!cityMatch) return false;
  }

  // Suburb filter
  if (filters.suburb) {
    const suburbLower = filters.suburb.toLowerCase();
    const suburbMatch = parsed.suburb?.toLowerCase().includes(suburbLower) ||
      location.address.toLowerCase().includes(suburbLower);
    if (!suburbMatch) return false;
  }

  // Postcode filter
  if (filters.postcode) {
    const postcodeMatch = parsed.postcode?.includes(filters.postcode) ||
      location.address.includes(filters.postcode);
    if (!postcodeMatch) return false;
  }

  return true;
}

/**
 * Check if either pickup or destination is within distance from user location
 * This ensures the user can reach at least one end of the journey
 */
function isRideWithinDistance(
  pickupLocation: Location,
  destinationLocation: Location,
  userLocation: { latitude: number; longitude: number },
  maxDistanceKm: number
): boolean {
  const pickupDistance = calculateLocationDistance(
    userLocation,
    { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude }
  ) / 1000; // Convert to km

  const destinationDistance = calculateLocationDistance(
    userLocation,
    { latitude: destinationLocation.latitude, longitude: destinationLocation.longitude }
  ) / 1000; // Convert to km

  // Return true if user is within distance of either pickup OR destination
  return pickupDistance <= maxDistanceKm || destinationDistance <= maxDistanceKm;
}

/**
 * Filter rides based on provided filters
 */
export function filterRides(rides: Ride[], filters: FilterOptions): Ride[] {
  return rides.filter(ride => {
    const fromLocation = ride.from || ride.origin;
    const toLocation = ride.to || ride.destination;

    if (!fromLocation || !toLocation) return false;

    // Text-based location filters (check both from and to)
    const locationFilters = {
      city: filters.city,
      suburb: filters.suburb,
      postcode: filters.postcode
    };

    const hasLocationFilter = filters.city || filters.suburb || filters.postcode;
    if (hasLocationFilter) {
      const fromMatches = matchesLocationFilters(fromLocation, locationFilters);
      const toMatches = matchesLocationFilters(toLocation, locationFilters);
      if (!fromMatches && !toMatches) return false;
    }

    // Distance filter (if user location is provided)
    // Check if user is within distance of either pickup or destination
    if (filters.maxDistance && filters.userLocation) {
      const withinDistance = isRideWithinDistance(
        fromLocation,
        toLocation,
        filters.userLocation,
        filters.maxDistance
      );
      if (!withinDistance) return false;
    }

    // Price filters
    if (filters.minPrice && ride.pricePerSeat < filters.minPrice) return false;
    if (filters.maxPrice && ride.pricePerSeat > filters.maxPrice) return false;

    // Minimum seats filter
    const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
    if (filters.minSeats && availableSeats < filters.minSeats) return false;

    return true;
  });
}

/**
 * Hook for managing ride filters
 */
export function useRideFilters(initialRides: Ride[] = []) {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [rides, setRides] = useState<Ride[]>(initialRides);

  // Update rides when initialRides changes - use ref to prevent infinite loops
  const prevInitialRidesRef = useRef<Ride[]>([]);
  const initialRidesStringified = JSON.stringify(initialRides.map(r => r.id));

  useEffect(() => {
    const prevStringified = JSON.stringify(prevInitialRidesRef.current.map(r => r.id));
    if (initialRidesStringified !== prevStringified) {
      prevInitialRidesRef.current = initialRides;
      setRides(initialRides);
    }
  }, [initialRidesStringified, initialRides]);

  const filteredRides = useMemo(() => {
    console.log('Filtering rides:', rides.length, 'with filters:', filters);
    const filtered = filterRides(rides, filters);
    console.log('Filtered results:', filtered.length, 'rides');
    return filtered;
  }, [rides, filters]);

  const updateFilters = useCallback((newFilters: Partial<FilterOptions>) => {
    console.log('Updating filters:', newFilters);
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      console.log('New filter state:', updated);
      return updated;
    });
  }, []);

  const clearFilters = useCallback(() => {
    console.log('Clearing all filters');
    setFilters({});
  }, []);

  const updateRides = useCallback((newRides: Ride[]) => {
    console.log('Updating rides:', newRides.length);
    setRides(newRides);
  }, []);

  const activeFiltersCount = useMemo(() => {
    const count = Object.values(filters).filter(value => {
      if (value === undefined || value === null || value === '') return false;
      if (typeof value === 'number' && value === 0) return false;
      if (typeof value === 'object' && value !== null) return true; // userLocation object
      return true;
    }).length;
    console.log('Active filters count:', count, 'from filters:', filters);
    return count;
  }, [filters]);

  return {
    filters,
    filteredRides,
    updateFilters,
    clearFilters,
    updateRides,
    activeFiltersCount,
    totalRides: rides.length,
    filteredCount: filteredRides.length
  };
}