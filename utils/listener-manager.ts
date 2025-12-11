import { collection, onSnapshot, query, Unsubscribe } from 'firebase/firestore';
import { logger } from '@/utils/logger';

/**
 * Centralized real-time listener management to prevent memory leaks
 */
class ListenerManager {
    private listeners: Map<string, Unsubscribe> = new Map();

    /**
     * Register a new listener with automatic cleanup
     */
    register(key: string, unsubscribe: Unsubscribe): void {
        // Clean up any existing listener with the same key
        this.unregister(key);

        this.listeners.set(key, unsubscribe);
        logger.debug('Registered listener', { key, totalListeners: this.listeners.size });
    }

    /**
     * Unregister and clean up a listener
     */
    unregister(key: string): void {
        const existing = this.listeners.get(key);
        if (existing) {
            existing();
            this.listeners.delete(key);
            logger.debug('Unregistered listener', { key, totalListeners: this.listeners.size });
        }
    }

    /**
     * Unregister all listeners matching a pattern
     */
    unregisterPattern(pattern: RegExp): void {
        const keys = Array.from(this.listeners.keys());
        keys.forEach(key => {
            if (pattern.test(key)) {
                this.unregister(key);
            }
        });
    }

    /**
     * Clean up all listeners
     */
    unregisterAll(): void {
        logger.debug('Unregistering all listeners', { count: this.listeners.size });
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners.clear();
    }

    /**
     * Get count of active listeners
     */
    getCount(): number {
        return this.listeners.size;
    }

    /**
     * Check if a listener exists
     */
    has(key: string): boolean {
        return this.listeners.has(key);
    }
}

// Global instance
export const listenerManager = new ListenerManager();

/**
 * Hook-style wrapper for React components
 * Automatically cleans up on unmount
 */
export function useFirestoreListener<T>(
    key: string,
    queryRef: any,
    callback: (data: T[]) => void,
    errorCallback?: (error: Error) => void
): () => void {
    const unsubscribe = onSnapshot(
        queryRef,
        (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as T[];

            callback(data);
        },
        (error) => {
            logger.error('Firestore listener error', error, { key });
            if (errorCallback) {
                errorCallback(error as Error);
            }
        }
    );

    listenerManager.register(key, unsubscribe);

    // Return cleanup function
    return () => {
        listenerManager.unregister(key);
    };
}

/**
 * Debounced listener to prevent rapid updates
 */
export function useDebouncedListener<T>(
    key: string,
    queryRef: any,
    callback: (data: T[]) => void,
    delay: number = 300
): () => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return useFirestoreListener<T>(
        key,
        queryRef,
        (data) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                callback(data);
                timeoutId = null;
            }, delay);
        }
    );
}

/**
 * Clean up all listeners for a specific user
 * Call this on logout
 */
export function cleanupUserListeners(userId: string): void {
    listenerManager.unregisterPattern(new RegExp(`^user-${userId}-`));
}

/**
 * Example usage patterns:
 * 
 * // In a React component:
 * useEffect(() => {
 *   const cleanup = useFirestoreListener(
 *     'user-123-rides',
 *     query(collection(db, 'rides'), where('driverId', '==', '123')),
 *     (rides) => setRides(rides)
 *   );
 *   return cleanup;
 * }, []);
 * 
 * // In a store:
 * subscribeToRides(userId: string) {
 *   const q = query(collection(db, 'rides'), where('driverId', '==', userId));
 *   const cleanup = useFirestoreListener(`user-${userId}-rides`, q, (rides) => {
 *     this.rides = rides;
 *   });
 *   return cleanup;
 * }
 */
