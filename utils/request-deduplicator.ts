/**
 * Request deduplication utility to prevent duplicate submissions
 */

interface PendingRequest {
    promise: Promise<any>;
    timestamp: number;
}

class RequestDeduplicator {
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private readonly timeout = 30000; // 30 seconds

    /**
     * Execute a request with deduplication
     * If the same key is already in progress, return the existing promise
     */
    async execute<T>(
        key: string,
        requestFn: () => Promise<T>,
        options: { timeout?: number } = {}
    ): Promise<T> {
        const requestTimeout = options.timeout || this.timeout;

        // Check if request is already in progress
        const existing = this.pendingRequests.get(key);
        if (existing) {
            const age = Date.now() - existing.timestamp;

            // If request is still fresh, return the existing promise
            if (age < requestTimeout) {
                console.log(`🔄 Deduplicating request: ${key} (age: ${age}ms)`);
                return existing.promise as Promise<T>;
            } else {
                // Request is too old, remove it
                this.pendingRequests.delete(key);
            }
        }

        // Create new request
        const promise = requestFn();

        this.pendingRequests.set(key, {
            promise,
            timestamp: Date.now(),
        });

        try {
            const result = await promise;
            this.pendingRequests.delete(key);
            return result;
        } catch (error) {
            this.pendingRequests.delete(key);
            throw error;
        }
    }

    /**
     * Clear a specific request from cache
     */
    clear(key: string): void {
        this.pendingRequests.delete(key);
    }

    /**
     * Clear all pending requests
     */
    clearAll(): void {
        this.pendingRequests.clear();
    }

    /**
     * Clean up old requests (call periodically)
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, request] of this.pendingRequests.entries()) {
            if (now - request.timestamp > this.timeout) {
                this.pendingRequests.delete(key);
            }
        }
    }
}

// Global instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Decorator/wrapper for deduplicating async functions
 */
export function deduplicate<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    getKey: (...args: Parameters<T>) => string
): T {
    return ((...args: Parameters<T>) => {
        const key = getKey(...args);
        return requestDeduplicator.execute(key, () => fn(...args));
    }) as T;
}

/**
 * Usage examples:
 * 
 * // Deduplicate booking requests
 * const bookRide = deduplicate(
 *   async (rideId: string, userId: string) => { ... },
 *   (rideId, userId) => `book-${rideId}-${userId}`
 * );
 * 
 * // Or use directly
 * await requestDeduplicator.execute(
 *   `update-ride-${rideId}`,
 *   () => ridesService.update(rideId, data)
 * );
 */

// Clean up old requests every minute
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        requestDeduplicator.cleanup();
    }, 60000);
}
