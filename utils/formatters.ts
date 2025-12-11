/**
 * Shared formatting utilities
 * Consolidates date, price, and other formatters used across the app
 */

/**
 * Format price in cents to dollar string
 * @param cents - Price in cents
 * @returns Formatted price string (e.g., "$15.00")
 */
export const formatPrice = (cents: number): string => {
    if (typeof cents !== 'number' || isNaN(cents)) {
        return '$0.00';
    }
    return `$${(cents / 100).toFixed(2)}`;
};

/**
 * Format price in dollars to dollar string
 * @param dollars - Price in dollars
 * @returns Formatted price string (e.g., "$15.00")
 */
export const formatPriceDollars = (dollars: number): string => {
    if (typeof dollars !== 'number' || isNaN(dollars)) {
        return '$0.00';
    }
    return `$${dollars.toFixed(2)}`;
};

/**
 * Format date to readable string
 * @param date - Date object or ISO string
 * @returns Formatted date (e.g., "Mon, Dec 10")
 */
export const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
        return 'Invalid date';
    }
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Format time to readable string
 * @param date - Date object or ISO string
 * @returns Formatted time (e.g., "2:30 PM")
 */
export const formatTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
        return 'Invalid time';
    }
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

/**
 * Format date and time together
 * @param date - Date object or ISO string
 * @returns Formatted date and time (e.g., "Mon, Dec 10 at 2:30 PM")
 */
export const formatDateTime = (date: Date | string): string => {
    return `${formatDate(date)} at ${formatTime(date)}`;
};

/**
 * Format relative time (time ago)
 * @param date - Date object, ISO string, or Firestore Timestamp
 * @returns Relative time string (e.g., "5m ago", "2h ago", "3d ago")
 */
export const formatTimeAgo = (date: Date | string | any): string => {
    // Handle Firestore Timestamp
    let d: Date;
    if (date?.toDate && typeof date.toDate === 'function') {
        d = date.toDate();
    } else if (typeof date === 'string') {
        d = new Date(date);
    } else if (date instanceof Date) {
        d = date;
    } else {
        return 'Unknown';
    }

    if (isNaN(d.getTime())) {
        return 'Unknown';
    }

    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
};

/**
 * Format distance in meters
 * @param meters - Distance in meters
 * @returns Formatted distance (e.g., "1.5 km", "500 m")
 */
export const formatDistance = (meters: number): string => {
    if (typeof meters !== 'number' || isNaN(meters)) {
        return '0 m';
    }

    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Format duration in minutes
 * @param minutes - Duration in minutes
 * @returns Formatted duration (e.g., "1h 30m", "45m")
 */
export const formatDuration = (minutes: number): string => {
    if (typeof minutes !== 'number' || isNaN(minutes)) {
        return '0m';
    }

    if (minutes < 60) {
        return `${Math.round(minutes)}m`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (mins === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
};

/**
 * Format phone number
 * @param phone - Phone number string
 * @returns Formatted phone number
 */
export const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
};

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number): string => {
    if (!text || text.length <= maxLength) {
        return text;
    }
    return `${text.substring(0, maxLength)}...`;
};

/**
 * Pluralize word based on count
 * @param count - Number for pluralization
 * @param singular - Singular form
 * @param plural - Plural form (optional, defaults to singular + 's')
 * @returns Pluralized string
 */
export const pluralize = (count: number, singular: string, plural?: string): string => {
    if (count === 1) {
        return singular;
    }
    return plural || `${singular}s`;
};

/**
 * Format seat count with pluralization
 * @param count - Number of seats
 * @returns Formatted seat string (e.g., "1 seat", "3 seats")
 */
export const formatSeats = (count: number): string => {
    return `${count} ${pluralize(count, 'seat')}`;
};
