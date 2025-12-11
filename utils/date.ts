/**
 * Date formatting utilities for consistent date handling
 */

/**
 * Standard date format for the application: en-AU
 */
const LOCALE = 'en-AU';
const TIMEZONE = 'Australia/Sydney';

/**
 * Format date for display (e.g., "10 Dec 2025, 10:30 PM")
 */
export function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return 'Invalid Date';

    return d.toLocaleString(LOCALE, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TIMEZONE,
    });
}

/**
 * Format date only (e.g., "10 Dec 2025")
 */
export function formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return 'Invalid Date';

    return d.toLocaleDateString(LOCALE, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: TIMEZONE,
    });
}

/**
 * Format time only (e.g., "10:30 PM")
 */
export function formatTime(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return 'Invalid Date';

    return d.toLocaleTimeString(LOCALE, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TIMEZONE,
    });
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return 'Invalid Date';

    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (Math.abs(diffMins) < 1) return 'just now';
    if (Math.abs(diffMins) < 60) return `${Math.abs(diffMins)} min${Math.abs(diffMins) === 1 ? '' : 's'} ${diffMins < 0 ? 'ago' : 'from now'}`;
    if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? '' : 's'} ${diffHours < 0 ? 'ago' : 'from now'}`;
    if (Math.abs(diffDays) < 7) return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ${diffDays < 0 ? 'ago' : 'from now'}`;

    return formatDate(d);
}

/**
 * Parse various date formats to Date object
 */
export function parseDate(input: any): Date | null {
    if (!input) return null;

    // Already a Date
    if (input instanceof Date) {
        return isNaN(input.getTime()) ? null : input;
    }

    // Firestore Timestamp
    if (input.toDate && typeof input.toDate === 'function') {
        return input.toDate();
    }

    // String or number
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Convert to ISO string for storage
 */
export function toISOString(date: Date | string | null | undefined): string | null {
    const parsed = parseDate(date);
    return parsed ? parsed.toISOString() : null;
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string | null | undefined): boolean {
    const parsed = parseDate(date);
    if (!parsed) return false;
    return parsed.getTime() < Date.now();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string | null | undefined): boolean {
    const parsed = parseDate(date);
    if (!parsed) return false;
    return parsed.getTime() > Date.now();
}

/**
 * Add days to a date
 */
export function addDays(date: Date | string, days: number): Date {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/**
 * Add hours to a date
 */
export function addHours(date: Date | string, hours: number): Date {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
}

/**
 * Get start of day
 */
export function startOfDay(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }

    return `${seconds}s`;
}
