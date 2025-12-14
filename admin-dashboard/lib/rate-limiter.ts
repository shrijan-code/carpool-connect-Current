/**
 * Rate Limiter for Admin Authentication
 * 
 * Provides protection against brute force attacks by limiting:
 * - Login attempts per IP address
 * - Login attempts per email address
 * 
 * Uses in-memory storage (resets on server restart).
 * For production multi-instance deployments, consider Redis.
 */

interface RateLimitEntry {
    attempts: number;
    firstAttempt: number;
    lockedUntil?: number;
}

// In-memory stores
const ipAttempts = new Map<string, RateLimitEntry>();
const emailAttempts = new Map<string, RateLimitEntry>();

// Configuration
const IP_MAX_ATTEMPTS = 5;
const IP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const IP_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

const EMAIL_MAX_ATTEMPTS = 10;
const EMAIL_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const EMAIL_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes lockout

export interface RateLimitResult {
    allowed: boolean;
    reason?: string;
    retryAfterSeconds?: number;
}

/**
 * Clean up expired entries periodically
 */
function cleanupExpired(store: Map<string, RateLimitEntry>, windowMs: number) {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        // Remove if window expired and not locked
        if (now - entry.firstAttempt > windowMs && (!entry.lockedUntil || now > entry.lockedUntil)) {
            store.delete(key);
        }
    }
}

/**
 * Check if a request is rate limited
 */
function checkLimit(
    key: string,
    store: Map<string, RateLimitEntry>,
    maxAttempts: number,
    windowMs: number,
    lockoutMs: number
): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);

    // No previous attempts
    if (!entry) {
        return { allowed: true };
    }

    // Check if currently locked out
    if (entry.lockedUntil && now < entry.lockedUntil) {
        const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
        return {
            allowed: false,
            reason: 'Too many failed attempts. Please try again later.',
            retryAfterSeconds,
        };
    }

    // Check if window has expired (reset counter)
    if (now - entry.firstAttempt > windowMs) {
        store.delete(key);
        return { allowed: true };
    }

    // Check if max attempts exceeded
    if (entry.attempts >= maxAttempts) {
        // Apply lockout
        entry.lockedUntil = now + lockoutMs;
        store.set(key, entry);

        const retryAfterSeconds = Math.ceil(lockoutMs / 1000);
        return {
            allowed: false,
            reason: 'Too many failed attempts. Account temporarily locked.',
            retryAfterSeconds,
        };
    }

    return { allowed: true };
}

/**
 * Record a failed login attempt
 */
function recordAttempt(
    key: string,
    store: Map<string, RateLimitEntry>,
    windowMs: number
): void {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now - entry.firstAttempt > windowMs) {
        // Start new window
        store.set(key, { attempts: 1, firstAttempt: now });
    } else {
        // Increment existing
        entry.attempts++;
        store.set(key, entry);
    }
}

/**
 * Reset attempts for a key (on successful login)
 */
function resetAttempts(key: string, store: Map<string, RateLimitEntry>): void {
    store.delete(key);
}

// Public API

/**
 * Check if IP is rate limited
 */
export function checkIpRateLimit(ip: string): RateLimitResult {
    cleanupExpired(ipAttempts, IP_WINDOW_MS);
    return checkLimit(ip, ipAttempts, IP_MAX_ATTEMPTS, IP_WINDOW_MS, IP_LOCKOUT_MS);
}

/**
 * Check if email is rate limited
 */
export function checkEmailRateLimit(email: string): RateLimitResult {
    cleanupExpired(emailAttempts, EMAIL_WINDOW_MS);
    return checkLimit(email.toLowerCase(), emailAttempts, EMAIL_MAX_ATTEMPTS, EMAIL_WINDOW_MS, EMAIL_LOCKOUT_MS);
}

/**
 * Record failed login attempt for IP
 */
export function recordIpFailure(ip: string): void {
    recordAttempt(ip, ipAttempts, IP_WINDOW_MS);
}

/**
 * Record failed login attempt for email
 */
export function recordEmailFailure(email: string): void {
    recordAttempt(email.toLowerCase(), emailAttempts, EMAIL_WINDOW_MS);
}

/**
 * Reset rate limit on successful login
 */
export function resetRateLimit(ip: string, email: string): void {
    resetAttempts(ip, ipAttempts);
    resetAttempts(email.toLowerCase(), emailAttempts);
}

/**
 * Get current attempt count for debugging/monitoring
 */
export function getAttemptCounts(ip: string, email: string): { ipAttempts: number; emailAttempts: number } {
    const ipEntry = ipAttempts.get(ip);
    const emailEntry = emailAttempts.get(email.toLowerCase());

    return {
        ipAttempts: ipEntry?.attempts ?? 0,
        emailAttempts: emailEntry?.attempts ?? 0,
    };
}
