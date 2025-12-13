/**
 * Simple in-memory cache with TTL for Firestore data
 * Reduces redundant reads by caching frequently accessed data
 */

interface CacheItem<T> {
    data: T;
    expiry: number;
}

class DataCache {
    private cache = new Map<string, CacheItem<any>>();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Run cleanup every 30 seconds to remove expired items
        this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    }

    /**
     * Get cached data if it exists and hasn't expired
     */
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    /**
     * Cache data with a TTL (default 30 seconds)
     */
    set<T>(key: string, data: T, ttlMs: number = 30000): void {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttlMs,
        });
    }

    /**
     * Check if a key exists and is not expired
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Invalidate a specific cache key
     */
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Invalidate all keys matching a pattern
     */
    invalidatePattern(pattern: RegExp): void {
        const keys = Array.from(this.cache.keys());
        keys.forEach(key => {
            if (pattern.test(key)) {
                this.cache.delete(key);
            }
        });
    }

    /**
     * Clear all cached data
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove expired items
     */
    private cleanup(): void {
        const now = Date.now();
        const keys = Array.from(this.cache.keys());
        let removed = 0;

        keys.forEach(key => {
            const item = this.cache.get(key);
            if (item && now > item.expiry) {
                this.cache.delete(key);
                removed++;
            }
        });

        if (removed > 0) {
            console.log(`[Cache] Cleaned up ${removed} expired items`);
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }

    /**
     * Stop the cleanup interval (call on app shutdown)
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
    }
}

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
    RIDES_LIST: 30000,        // 30 seconds for ride lists
    RIDE_DETAIL: 60000,       // 1 minute for individual ride details
    USER_BOOKINGS: 30000,     // 30 seconds for user bookings
    REFRESH_COOLDOWN: 10000,  // 10 second cooldown between refreshes
    SEARCH_RESULTS: 60000,    // 1 minute for search results
} as const;

// Cache key generators
export const CACHE_KEYS = {
    userRides: (userId: string) => `user-rides-${userId}`,
    userBookings: (userId: string) => `user-bookings-${userId}`,
    rideDetail: (rideId: string) => `ride-${rideId}`,
    availableRides: () => 'available-rides',
    searchResults: (query: string) => `search-${query}`,
    refreshCooldown: (type: string) => `refresh-cooldown-${type}`,
} as const;

// Global cache instance
export const dataCache = new DataCache();

export default dataCache;
