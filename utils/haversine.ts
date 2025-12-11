import { Location } from '@/types';

/**
 * Calculate the Haversine distance between two points on Earth
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters
  return distance;
}

/**
 * Calculate distance between two Location objects or coordinate objects
 * @param location1 First location (Location or { latitude, longitude })
 * @param location2 Second location (Location or { latitude, longitude })
 * @returns Distance in meters
 */
export function calculateLocationDistance(
  location1: Location | { latitude: number; longitude: number },
  location2: Location | { latitude: number; longitude: number }
): number {
  return calculateHaversineDistance(
    location1.latitude,
    location1.longitude,
    location2.latitude,
    location2.longitude
  );
}

/**
 * Check if a ride is within walking distance tolerance
 * @param riderStart Rider's start location
 * @param riderEnd Rider's end location
 * @param rideStart Ride's start location
 * @param rideEnd Ride's end location
 * @param walkingTolerance Maximum walking distance in meters
 * @returns Object with distances and whether ride is within tolerance
 */
export function isRideWithinWalkingDistance(
  riderStart: Location,
  riderEnd: Location,
  rideStart: Location,
  rideEnd: Location,
  walkingTolerance: number
): {
  startDistance: number;
  endDistance: number;
  isWithinTolerance: boolean;
  totalWalkingDistance: number;
} {
  const startDistance = calculateLocationDistance(riderStart, rideStart);
  const endDistance = calculateLocationDistance(riderEnd, rideEnd);
  const totalWalkingDistance = startDistance + endDistance;
  
  const isWithinTolerance = 
    startDistance <= walkingTolerance && 
    endDistance <= walkingTolerance;

  return {
    startDistance,
    endDistance,
    isWithinTolerance,
    totalWalkingDistance,
  };
}

/**
 * Filter rides based on walking distance tolerance
 * @param rides Array of rides to filter
 * @param riderStart Rider's start location
 * @param riderEnd Rider's end location
 * @param walkingTolerance Maximum walking distance in meters
 * @returns Filtered and sorted rides with distance information
 */
export function filterRidesByWalkingDistance<T extends { from: Location; to: Location }>(
  rides: T[],
  riderStart: Location,
  riderEnd: Location,
  walkingTolerance: number
): (T & { walkingInfo: ReturnType<typeof isRideWithinWalkingDistance> })[] {
  const ridesWithDistance = rides.map(ride => ({
    ...ride,
    walkingInfo: isRideWithinWalkingDistance(
      riderStart,
      riderEnd,
      ride.from,
      ride.to,
      walkingTolerance
    ),
  }));

  // Filter rides within tolerance and sort by total walking distance
  return ridesWithDistance
    .filter(ride => ride.walkingInfo.isWithinTolerance)
    .sort((a, b) => a.walkingInfo.totalWalkingDistance - b.walkingInfo.totalWalkingDistance);
}

/**
 * Format distance for display
 * @param distanceInMeters Distance in meters
 * @returns Formatted string (e.g., "250m", "1.2km")
 */
export function formatDistance(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`;
  } else {
    return `${(distanceInMeters / 1000).toFixed(1)}km`;
  }
}

/**
 * Estimate walking time based on distance
 * @param distanceInMeters Distance in meters
 * @param walkingSpeedMps Walking speed in meters per second (default: 1.4 m/s ≈ 5 km/h)
 * @returns Walking time in minutes
 */
export function estimateWalkingTime(
  distanceInMeters: number,
  walkingSpeedMps: number = 1.4
): number {
  const timeInSeconds = distanceInMeters / walkingSpeedMps;
  return Math.ceil(timeInSeconds / 60); // Round up to nearest minute
}

/**
 * Format walking time for display
 * @param distanceInMeters Distance in meters
 * @returns Formatted string (e.g., "3 min walk")
 */
export function formatWalkingTime(distanceInMeters: number): string {
  const minutes = estimateWalkingTime(distanceInMeters);
  return `${minutes} min walk`;
}