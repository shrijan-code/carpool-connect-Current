import { useState, useCallback, useRef, useEffect } from 'react';

interface OptimizedStateOptions<T> {
  debounceMs?: number;
  throttleMs?: number;
  equalityFn?: (a: T, b: T) => boolean;
  onStateChange?: (newState: T, prevState: T) => void;
}

export const useOptimizedState = <T>(
  initialState: T,
  options: OptimizedStateOptions<T> = {}
) => {
  const {
    debounceMs = 0,
    throttleMs = 0,
    equalityFn = (a, b) => a === b,
    onStateChange
  } = options;

  const [state, setState] = useState<T>(initialState);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const throttleTimeoutRef = useRef<NodeJS.Timeout>();
  const lastThrottleTime = useRef<number>(0);
  const prevStateRef = useRef<T>(initialState);

  const setOptimizedState = useCallback((newState: T | ((prev: T) => T)) => {
    const resolvedNewState = typeof newState === 'function' 
      ? (newState as (prev: T) => T)(state) 
      : newState;

    // Skip update if values are equal
    if (equalityFn(resolvedNewState, state)) {
      return;
    }

    const updateState = () => {
      const prevState = prevStateRef.current;
      setState(resolvedNewState);
      prevStateRef.current = resolvedNewState;
      
      if (onStateChange) {
        onStateChange(resolvedNewState, prevState);
      }
    };

    // Handle debouncing
    if (debounceMs > 0) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(updateState, debounceMs);
      return;
    }

    // Handle throttling
    if (throttleMs > 0) {
      const now = Date.now();
      const timeSinceLastThrottle = now - lastThrottleTime.current;
      
      if (timeSinceLastThrottle >= throttleMs) {
        lastThrottleTime.current = now;
        updateState();
      } else if (!throttleTimeoutRef.current) {
        const remainingTime = throttleMs - timeSinceLastThrottle;
        throttleTimeoutRef.current = setTimeout(() => {
          throttleTimeoutRef.current = undefined;
          lastThrottleTime.current = Date.now();
          updateState();
        }, remainingTime);
      }
      return;
    }

    // No debouncing or throttling
    updateState();
  }, [state, debounceMs, throttleMs, equalityFn, onStateChange]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  return [state, setOptimizedState] as const;
};

// Hook for managing multiple optimized states
export const useOptimizedStates = <T extends Record<string, any>>(
  initialStates: T,
  options: Partial<Record<keyof T, OptimizedStateOptions<T[keyof T]>>> = {}
) => {
  const states = {} as T;
  const setters = {} as { [K in keyof T]: (value: T[K] | ((prev: T[K]) => T[K])) => void };

  Object.keys(initialStates).forEach((key) => {
    const [state, setState] = useOptimizedState(
      initialStates[key],
      options[key] || {}
    );
    states[key as keyof T] = state;
    setters[key as keyof T] = setState;
  });

  return [states, setters] as const;
};