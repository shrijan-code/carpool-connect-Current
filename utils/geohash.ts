/**
 * Geohash Utilities for Location-Based Ride Search
 * 
 * Geohash precision levels:
 * - Precision 4: ~39km x 19km (city/region level)
 * - Precision 5: ~5km x 5km (suburb level)
 * - Precision 6: ~1.2km x 0.6km (neighborhood level)
 * - Precision 7: ~150m x 150m (street level)
 */

import ngeohash from 'ngeohash';

// Default precision for ride searches (suburb level)
export const DEFAULT_GEOHASH_PRECISION = 5;
export const CITY_GEOHASH_PRECISION = 4;
export const NEIGHBORHOOD_GEOHASH_PRECISION = 6;

/**
 * Encode latitude/longitude to geohash string
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param precision Geohash precision (default: 5 for ~5km grid)
 * @returns Geohash string
 */
export function encodeGeohash(
    latitude: number,
    longitude: number,
    precision: number = DEFAULT_GEOHASH_PRECISION
): string {
    return ngeohash.encode(latitude, longitude, precision);
}

/**
 * Decode geohash to latitude/longitude
 * @param geohash Geohash string
 * @returns Object with latitude and longitude
 */
export function decodeGeohash(geohash: string): { latitude: number; longitude: number } {
    const decoded = ngeohash.decode(geohash);
    return {
        latitude: decoded.latitude,
        longitude: decoded.longitude,
    };
}

/**
 * Get neighboring geohash cells for a given geohash
 * This is useful for expanding search to adjacent areas
 * @param geohash Center geohash
 * @returns Array of 8 neighboring geohashes + the center
 */
export function getNeighborGeohashes(geohash: string): string[] {
    const neighbors = ngeohash.neighbors(geohash);
    return [
        geohash,
        neighbors.n,
        neighbors.ne,
        neighbors.e,
        neighbors.se,
        neighbors.s,
        neighbors.sw,
        neighbors.w,
        neighbors.nw,
    ];
}

/**
 * Get a bounding box of coordinates for a geohash cell
 * @param geohash Geohash string
 * @returns Bounding box [minLat, minLon, maxLat, maxLon]
 */
export function getGeohashBounds(geohash: string): [number, number, number, number] {
    return ngeohash.decode_bbox(geohash) as [number, number, number, number];
}

/**
 * Create geohash fields for a ride's origin and destination
 * This is used when creating/updating rides to enable efficient searches
 */
export function createRideGeohashes(
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number
): {
    originGeohash: string;        // Suburb precision (5)
    originGeohash4: string;       // City precision (4)
    destinationGeohash: string;   // Suburb precision (5)
    destinationGeohash4: string;  // City precision (4)
} {
    return {
        originGeohash: encodeGeohash(originLat, originLon, DEFAULT_GEOHASH_PRECISION),
        originGeohash4: encodeGeohash(originLat, originLon, CITY_GEOHASH_PRECISION),
        destinationGeohash: encodeGeohash(destLat, destLon, DEFAULT_GEOHASH_PRECISION),
        destinationGeohash4: encodeGeohash(destLat, destLon, CITY_GEOHASH_PRECISION),
    };
}

/**
 * Get geohash range for Firestore query
 * This allows querying all geohashes that start with a prefix
 * 
 * @param geohash The geohash prefix to search
 * @returns Object with start and end bounds for range query
 */
export function getGeohashRange(geohash: string): { start: string; end: string } {
    // For a prefix "r3gx", we want to match "r3gx*"
    // In Firestore, we query: >= "r3gx" AND < "r3gy" (next character)
    const lastChar = geohash.charAt(geohash.length - 1);
    const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
    const endHash = geohash.slice(0, -1) + nextChar;

    return {
        start: geohash,
        end: endHash,
    };
}

/**
 * Get multiple geohash ranges for expanded search (center + neighbors)
 * This is useful when searching a wider area
 */
export function getExpandedGeohashRanges(
    latitude: number,
    longitude: number,
    precision: number = DEFAULT_GEOHASH_PRECISION
): Array<{ start: string; end: string }> {
    const centerHash = encodeGeohash(latitude, longitude, precision);
    const allHashes = getNeighborGeohashes(centerHash);

    return allHashes.map(hash => getGeohashRange(hash));
}

/**
 * Check if a geohash is within a set of target geohashes
 * Useful for client-side filtering after a broad query
 */
export function isGeohashInArea(
    geohash: string,
    targetGeohashes: string[]
): boolean {
    const prefix = geohash.substring(0, DEFAULT_GEOHASH_PRECISION);
    return targetGeohashes.some(target =>
        prefix.startsWith(target) || target.startsWith(prefix)
    );
}

/**
 * Estimate approximate distance covered by a geohash cell
 * @param precision Geohash precision
 * @returns Approximate cell dimensions in kilometers
 */
export function getGeohashCellSize(precision: number): { widthKm: number; heightKm: number } {
    // Approximate dimensions based on geohash precision
    const sizes: Record<number, { widthKm: number; heightKm: number }> = {
        1: { widthKm: 5000, heightKm: 5000 },
        2: { widthKm: 1250, heightKm: 625 },
        3: { widthKm: 156, heightKm: 156 },
        4: { widthKm: 39, heightKm: 19 },
        5: { widthKm: 5, heightKm: 5 },
        6: { widthKm: 1.2, heightKm: 0.6 },
        7: { widthKm: 0.15, heightKm: 0.15 },
        8: { widthKm: 0.038, heightKm: 0.019 },
    };

    return sizes[precision] || { widthKm: 5, heightKm: 5 };
}

/**
 * Get the best precision for a search radius
 * @param radiusKm Search radius in kilometers
 * @returns Appropriate geohash precision
 */
export function getPrecisionForRadius(radiusKm: number): number {
    if (radiusKm >= 50) return 3;
    if (radiusKm >= 20) return 4;
    if (radiusKm >= 5) return 5;
    if (radiusKm >= 1) return 6;
    return 7;
}
