import { useRef, useCallback, useState } from 'react';

/**
 * Hook to prevent duplicate action submissions (double-clicks)
 * 
 * Usage:
 * const { isProcessing, wrapAction } = usePreventDoubleClick();
 * 
 * const handleClick = wrapAction(async () => {
 *   await someAsyncAction();
 * });
 * 
 * <Button onPress={handleClick} disabled={isProcessing} />
 */
export function usePreventDoubleClick(debounceMs: number = 1000) {
    const [isProcessing, setIsProcessing] = useState(false);
    const lastClickTimeRef = useRef<number>(0);
    const processingRef = useRef<boolean>(false);

    const wrapAction = useCallback(<T,>(action: () => Promise<T> | T): () => Promise<T | undefined> => {
        return async () => {
            const now = Date.now();

            // Debounce check - prevent clicks within debounce window
            if (now - lastClickTimeRef.current < debounceMs) {
                console.log('[usePreventDoubleClick] Debounced - ignoring click');
                return undefined;
            }

            // Check if already processing
            if (processingRef.current) {
                console.log('[usePreventDoubleClick] Already processing - ignoring click');
                return undefined;
            }

            lastClickTimeRef.current = now;
            processingRef.current = true;
            setIsProcessing(true);

            try {
                return await action();
            } finally {
                processingRef.current = false;
                setIsProcessing(false);
            }
        };
    }, [debounceMs]);

    // For use with Alert-based confirmations
    const withProcessingGuard = useCallback(<T,>(action: () => Promise<T> | T): () => Promise<T | undefined> => {
        return async () => {
            // Check if already processing (skip debounce for confirmed actions)
            if (processingRef.current) {
                console.log('[usePreventDoubleClick] Already processing - ignoring click');
                return undefined;
            }

            processingRef.current = true;
            setIsProcessing(true);

            try {
                return await action();
            } finally {
                processingRef.current = false;
                setIsProcessing(false);
            }
        };
    }, []);

    const reset = useCallback(() => {
        processingRef.current = false;
        setIsProcessing(false);
        lastClickTimeRef.current = 0;
    }, []);

    return {
        isProcessing,
        wrapAction,
        withProcessingGuard,
        reset,
    };
}

/**
 * Simple debounce function for one-off use
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, wait);
    };
}

/**
 * Creates a function that can only be called once until reset
 */
export function createOneTimeGuard() {
    let called = false;

    return {
        guard: <T>(action: () => T): T | undefined => {
            if (called) {
                console.log('[OneTimeGuard] Already called - ignoring');
                return undefined;
            }
            called = true;
            return action();
        },
        reset: () => {
            called = false;
        },
        isCalled: () => called,
    };
}
