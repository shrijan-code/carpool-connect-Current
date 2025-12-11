import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface MemoryOptimizationOptions {
  clearOnBackground?: boolean;
  maxCacheSize?: number;
  cleanupInterval?: number;
  onMemoryWarning?: () => void;
}

export const useMemoryOptimization = (options: MemoryOptimizationOptions = {}) => {
  const {
    clearOnBackground = true,
    maxCacheSize = 100,
    cleanupInterval = 5 * 60 * 1000, // 5 minutes
    onMemoryWarning
  } = options;

  const cacheRef = useRef<Map<string, { data: any; timestamp: number; accessCount: number }>>(new Map());
  const cleanupIntervalRef = useRef<NodeJS.Timeout>();

  // LRU Cache implementation
  const setCache = useCallback((key: string, data: any) => {
    const cache = cacheRef.current;
    
    // Remove oldest entries if cache is full
    if (cache.size >= maxCacheSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => {
        // Sort by access count (ascending) then by timestamp (ascending)
        if (a[1].accessCount !== b[1].accessCount) {
          return a[1].accessCount - b[1].accessCount;
        }
        return a[1].timestamp - b[1].timestamp;
      });
      
      // Remove the least recently used entry
      const [oldestKey] = entries[0];
      cache.delete(oldestKey);
    }
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1
    });
  }, [maxCacheSize]);

  const getCache = useCallback((key: string) => {
    const cache = cacheRef.current;
    const entry = cache.get(key);
    
    if (entry) {
      // Update access count and timestamp
      entry.accessCount++;
      entry.timestamp = Date.now();
      return entry.data;
    }
    
    return null;
  }, []);

  const clearCache = useCallback((keyPattern?: string) => {
    const cache = cacheRef.current;
    
    if (keyPattern) {
      const regex = new RegExp(keyPattern);
      const keysToDelete = Array.from(cache.keys()).filter(key => regex.test(key));
      keysToDelete.forEach(key => cache.delete(key));
    } else {
      cache.clear();
    }
  }, []);

  const getCacheStats = useCallback(() => {
    const cache = cacheRef.current;
    const entries = Array.from(cache.values());
    
    return {
      size: cache.size,
      totalAccessCount: entries.reduce((sum, entry) => sum + entry.accessCount, 0),
      oldestEntry: entries.reduce((oldest, entry) => 
        !oldest || entry.timestamp < oldest.timestamp ? entry : oldest, null as any
      ),
      memoryUsage: JSON.stringify(Array.from(cache.entries())).length // Rough estimate
    };
  }, []);

  // Cleanup old entries
  const performCleanup = useCallback(() => {
    const cache = cacheRef.current;
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    const keysToDelete: string[] = [];
    cache.forEach((entry, key) => {
      if (now - entry.timestamp > maxAge && entry.accessCount < 2) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => cache.delete(key));
    
    console.log(`Memory cleanup: removed ${keysToDelete.length} entries, ${cache.size} remaining`);
  }, []);

  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' && clearOnBackground) {
      // Clear cache when app goes to background
      clearCache();
      console.log('Memory optimization: cleared cache on background');
    } else if (nextAppState === 'active') {
      // Perform cleanup when app becomes active
      performCleanup();
    }
  }, [clearOnBackground, clearCache, performCleanup]);

  // Handle memory warnings
  const handleMemoryWarning = useCallback(() => {
    console.warn('Memory warning received, performing aggressive cleanup');
    
    // Clear half of the cache, keeping most recently accessed items
    const cache = cacheRef.current;
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => b[1].accessCount - a[1].accessCount || b[1].timestamp - a[1].timestamp);
    
    const itemsToRemove = Math.floor(entries.length / 2);
    const keysToDelete = entries.slice(-itemsToRemove).map(([key]) => key);
    keysToDelete.forEach(key => cache.delete(key));
    
    if (onMemoryWarning) {
      onMemoryWarning();
    }
  }, [onMemoryWarning]);

  useEffect(() => {
    // Set up app state listener
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Set up cleanup interval
    cleanupIntervalRef.current = setInterval(performCleanup, cleanupInterval);
    
    // Set up memory warning listener (iOS only)
    // Note: React Native doesn't have a built-in memory warning listener
    // This would need to be implemented with native modules in a real app
    
    return () => {
      appStateSubscription?.remove();
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [handleAppStateChange, performCleanup, cleanupInterval]);

  return {
    setCache,
    getCache,
    clearCache,
    getCacheStats,
    performCleanup,
    handleMemoryWarning
  };
};

// Hook for optimizing component re-renders
export const useRenderOptimization = () => {
  const renderCountRef = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  useEffect(() => {
    renderCountRef.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    // Log excessive re-renders
    if (renderCountRef.current > 10 && timeSinceLastRender < 100) {
      console.warn(`Component re-rendered ${renderCountRef.current} times, last render was ${timeSinceLastRender}ms ago`);
    }
  });

  const getRenderStats = useCallback(() => ({
    renderCount: renderCountRef.current,
    lastRenderTime: lastRenderTime.current
  }), []);

  return { getRenderStats };
};