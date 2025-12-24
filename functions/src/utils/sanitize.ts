/**
 * Input Sanitization Utilities
 * 
 * Provides functions to sanitize user-generated content to prevent:
 * - XSS attacks
 * - Script injection
 * - SQL injection (not applicable for Firestore but good practice)
 * - HTML injection
 */

/**
 * Sanitize a string by removing/escaping potentially dangerous characters.
 * Safe for display in HTML contexts.
 * 
 * @param input - The string to sanitize
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Sanitized string
 */
export function sanitizeString(input: unknown, maxLength = 10000): string {
    if (typeof input !== "string") {
        return "";
    }

    let sanitized = input
        // Remove null bytes
        .replace(/\0/g, "")
        // Escape HTML special characters
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;")
        // Remove control characters except newlines and tabs
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        // Trim whitespace
        .trim();

    // Enforce max length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
}

/**
 * Sanitize text for use in chat messages.
 * Allows some formatting but removes dangerous content.
 * 
 * @param input - The message text
 * @returns Sanitized message
 */
export function sanitizeMessage(input: unknown): string {
    if (typeof input !== "string") {
        return "";
    }

    // Maximum message length: 5000 characters
    let sanitized = sanitizeString(input, 5000);

    // Remove potential script URLs
    sanitized = sanitized.replace(/javascript:/gi, "");
    sanitized = sanitized.replace(/data:/gi, "");
    sanitized = sanitized.replace(/vbscript:/gi, "");

    // Remove on* event handlers that might have slipped through
    sanitized = sanitized.replace(/on\w+\s*=/gi, "");

    return sanitized;
}

/**
 * Sanitize notes/comments field.
 * 
 * @param input - The notes text
 * @returns Sanitized notes
 */
export function sanitizeNotes(input: unknown): string {
    return sanitizeString(input, 500);
}

/**
 * Sanitize a review comment.
 * 
 * @param input - The review text
 * @returns Sanitized review
 */
export function sanitizeReview(input: unknown): string {
    return sanitizeMessage(input);
}

/**
 * Sanitize a user's display name.
 * Only allows alphanumeric, spaces, and common punctuation.
 * 
 * @param input - The display name
 * @returns Sanitized name
 */
export function sanitizeName(input: unknown): string {
    if (typeof input !== "string") {
        return "";
    }

    return input
        // Remove HTML/script
        .replace(/<[^>]*>/g, "")
        // Only allow letters, numbers, spaces, hyphens, apostrophes
        .replace(/[^\p{L}\p{N}\s\-']/gu, "")
        // Collapse multiple spaces
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 100);
}

/**
 * Sanitize phone number - only digits and common separators.
 * 
 * @param input - The phone number
 * @returns Sanitized phone number
 */
export function sanitizePhone(input: unknown): string {
    if (typeof input !== "string") {
        return "";
    }

    return input
        .replace(/[^\d\s\-+()]/g, "")
        .trim()
        .substring(0, 20);
}

/**
 * Sanitize email - basic format validation.
 * 
 * @param input - The email address
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(input: unknown): string {
    if (typeof input !== "string") {
        return "";
    }

    const email = input.trim().toLowerCase();

    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email) || email.length > 254) {
        return "";
    }

    return email;
}

/**
 * Validate and sanitize a numeric value.
 * 
 * @param input - The input value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Default if invalid
 * @returns Validated number
 */
export function sanitizeNumber(
    input: unknown,
    min: number,
    max: number,
    defaultValue: number
): number {
    const num = Number(input);

    if (isNaN(num) || !isFinite(num)) {
        return defaultValue;
    }

    return Math.max(min, Math.min(max, Math.round(num)));
}

/**
 * Validate and sanitize a URL.
 * 
 * @param input - The URL string
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(input: unknown): string {
    if (typeof input !== "string") {
        return "";
    }

    const url = input.trim();

    // Only allow http and https protocols
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return "";
    }

    try {
        new URL(url);
        return url.substring(0, 2000); // Max URL length
    } catch {
        return "";
    }
}
