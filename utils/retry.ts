/**
 * Retry Utility with Exponential Backoff
 * 
 * Purpose: Automatically retry failed operations with exponential backoff
 * This handles transient failures like network issues, API rate limits, etc.
 * 
 * For long-term stability: This prevents temporary failures from causing
 * permanent errors in the application.
 */

export interface RetryOptions {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
    onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'retryableErrors'>> = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableErrors?: string[]): boolean {
    // Network errors are always retryable
    if (error.message?.includes('network') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('fetch failed')) {
        return true;
    }

    // HTTP status codes that are retryable
    if (error.status === 429 || // Rate limited
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        error.status === 504) { // Gateway timeout
        return true;
    }

    // Firebase/Firestore specific retryable errors
    if (error.code === 'unavailable' ||
        error.code === 'resource-exhausted' ||
        error.code === 'deadline-exceeded' ||
        error.code === 'aborted') {
        return true;
    }

    // Stripe specific retryable errors
    if (error.type === 'StripeConnectionError' ||
        error.type === 'StripeAPIError' ||
        error.code === 'rate_limit') {
        return true;
    }

    // Check custom retryable error messages
    if (retryableErrors) {
        return retryableErrors.some(msg =>
            error.message?.toLowerCase().includes(msg.toLowerCase())
        );
    }

    return false;
}

/**
 * Calculate delay with jitter to prevent thundering herd
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'onRetry' | 'retryableErrors'>>): number {
    const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
    // Add jitter: random value between 0-25% of the delay
    const jitter = cappedDelay * 0.25 * Math.random();
    return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with automatic retry and exponential backoff
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise with the result of the function
 * 
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetchUserData(userId),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Check if we've exhausted retries
            if (attempt > opts.maxRetries) {
                break;
            }

            // Check if error is retryable
            if (!isRetryableError(error, options.retryableErrors)) {
                throw error; // Non-retryable error, throw immediately
            }

            const delayMs = calculateDelay(attempt, opts);

            // Call onRetry callback if provided
            if (options.onRetry) {
                options.onRetry(error, attempt, delayMs);
            } else {
                console.warn(`[Retry] Attempt ${attempt}/${opts.maxRetries} failed, retrying in ${delayMs}ms:`, error.message);
            }

            await sleep(delayMs);
        }
    }

    // All retries exhausted
    throw lastError || new Error('All retry attempts failed');
}

/**
 * Create a retryable version of any async function
 * 
 * @example
 * ```ts
 * const fetchWithRetry = createRetryable(fetchData, { maxRetries: 3 });
 * const result = await fetchWithRetry(userId);
 * ```
 */
export function createRetryable<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions = {}
): T {
    return ((...args: Parameters<T>) =>
        withRetry(() => fn(...args), options)
    ) as T;
}

/**
 * Retry wrapper for Firebase callable functions
 */
export async function withFirebaseRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    return withRetry(fn, {
        maxRetries,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        onRetry: (error, attempt, delay) => {
            console.warn(`[Firebase] Retry ${attempt}/${maxRetries} in ${delay}ms:`, error.message);
        },
    });
}

/**
 * Retry wrapper specifically for Stripe API calls
 */
export async function withStripeRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    return withRetry(fn, {
        maxRetries,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        retryableErrors: ['rate_limit', 'connection_error', 'api_error'],
        onRetry: (error, attempt, delay) => {
            console.warn(`[Stripe] Retry ${attempt}/${maxRetries} in ${delay}ms:`, error.message);
        },
    });
}
