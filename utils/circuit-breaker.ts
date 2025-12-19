/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures when external services (Stripe, Firebase, etc.) are down.
 * Three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are immediately rejected
 * - HALF_OPEN: Testing if service has recovered
 */

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
    /** Number of failures before opening circuit (default: 5) */
    failureThreshold: number;
    /** Time in ms before attempting recovery (default: 30000 = 30s) */
    resetTimeout: number;
    /** Number of successful calls needed to close circuit (default: 3) */
    successThreshold: number;
    /** Optional callback when circuit opens */
    onOpen?: (serviceName: string) => void;
    /** Optional callback when circuit closes */
    onClose?: (serviceName: string) => void;
    /** Optional callback when circuit half-opens */
    onHalfOpen?: (serviceName: string) => void;
}

export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number | null;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 30000,
    successThreshold: 3,
};

/**
 * Circuit Breaker for a specific service
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failures: number = 0;
    private successes: number = 0;
    private lastFailureTime: number | null = null;
    private totalRequests: number = 0;
    private totalFailures: number = 0;
    private totalSuccesses: number = 0;
    private options: CircuitBreakerOptions;
    private serviceName: string;

    constructor(serviceName: string, options: Partial<CircuitBreakerOptions> = {}) {
        this.serviceName = serviceName;
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.totalRequests++;

        if (this.state === CircuitState.OPEN) {
            // Check if we should transition to half-open
            if (this.shouldAttemptReset()) {
                this.transitionTo(CircuitState.HALF_OPEN);
            } else {
                throw new CircuitBreakerOpenError(
                    `Circuit breaker is open for ${this.serviceName}. ` +
                    `Service appears to be unavailable. Try again later.`
                );
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * Check if enough time has passed to attempt recovery
     */
    private shouldAttemptReset(): boolean {
        if (!this.lastFailureTime) return true;
        return Date.now() - this.lastFailureTime >= this.options.resetTimeout;
    }

    /**
     * Handle successful request
     */
    private onSuccess(): void {
        this.totalSuccesses++;
        this.failures = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.successes++;
            if (this.successes >= this.options.successThreshold) {
                this.transitionTo(CircuitState.CLOSED);
            }
        }
    }

    /**
     * Handle failed request
     */
    private onFailure(): void {
        this.totalFailures++;
        this.failures++;
        this.lastFailureTime = Date.now();
        this.successes = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            // Any failure in half-open immediately opens the circuit
            this.transitionTo(CircuitState.OPEN);
        } else if (this.failures >= this.options.failureThreshold) {
            this.transitionTo(CircuitState.OPEN);
        }
    }

    /**
     * Transition to a new state
     */
    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;

        if (oldState !== newState) {
            console.log(`[CircuitBreaker:${this.serviceName}] ${oldState} → ${newState}`);

            switch (newState) {
                case CircuitState.OPEN:
                    this.options.onOpen?.(this.serviceName);
                    break;
                case CircuitState.CLOSED:
                    this.failures = 0;
                    this.successes = 0;
                    this.options.onClose?.(this.serviceName);
                    break;
                case CircuitState.HALF_OPEN:
                    this.successes = 0;
                    this.options.onHalfOpen?.(this.serviceName);
                    break;
            }
        }
    }

    /**
     * Get current circuit breaker statistics
     */
    getStats(): CircuitBreakerStats {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailureTime: this.lastFailureTime,
            totalRequests: this.totalRequests,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
        };
    }

    /**
     * Manually reset the circuit breaker
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        console.log(`[CircuitBreaker:${this.serviceName}] Manually reset to CLOSED`);
    }

    /**
     * Check if the circuit is allowing requests
     */
    isAllowingRequests(): boolean {
        if (this.state === CircuitState.CLOSED) return true;
        if (this.state === CircuitState.HALF_OPEN) return true;
        if (this.state === CircuitState.OPEN && this.shouldAttemptReset()) return true;
        return false;
    }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CircuitBreakerOpenError';
    }
}

/**
 * Registry of circuit breakers for different services
 */
class CircuitBreakerRegistry {
    private breakers: Map<string, CircuitBreaker> = new Map();

    /**
     * Get or create a circuit breaker for a service
     */
    get(serviceName: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
        if (!this.breakers.has(serviceName)) {
            this.breakers.set(serviceName, new CircuitBreaker(serviceName, options));
        }
        return this.breakers.get(serviceName)!;
    }

    /**
     * Get stats for all circuit breakers
     */
    getAllStats(): Record<string, CircuitBreakerStats> {
        const stats: Record<string, CircuitBreakerStats> = {};
        for (const [name, breaker] of this.breakers.entries()) {
            stats[name] = breaker.getStats();
        }
        return stats;
    }

    /**
     * Reset all circuit breakers
     */
    resetAll(): void {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }
}

// Singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// Pre-defined circuit breakers for common services
export const stripeCircuitBreaker = circuitBreakerRegistry.get('stripe', {
    failureThreshold: 3,
    resetTimeout: 60000, // 1 minute for payment service
    successThreshold: 2,
});

export const firebaseCircuitBreaker = circuitBreakerRegistry.get('firebase', {
    failureThreshold: 5,
    resetTimeout: 30000,
    successThreshold: 3,
});

export const googleMapsCircuitBreaker = circuitBreakerRegistry.get('googleMaps', {
    failureThreshold: 5,
    resetTimeout: 30000,
    successThreshold: 3,
});

/**
 * Decorator for class methods to wrap with circuit breaker
 * 
 * Usage:
 * @withCircuitBreaker('stripe')
 * async processPayment() { ... }
 */
export function withCircuitBreaker(serviceName: string, options?: Partial<CircuitBreakerOptions>) {
    return function (
        _target: unknown,
        _propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const breaker = circuitBreakerRegistry.get(serviceName, options);

        descriptor.value = async function (...args: unknown[]) {
            return breaker.execute(() => originalMethod.apply(this, args));
        };

        return descriptor;
    };
}
