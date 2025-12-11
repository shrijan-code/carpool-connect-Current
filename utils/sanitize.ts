/**
 * Input sanitization utilities for XSS protection
 */

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export function sanitizeString(input: string | null | undefined): string {
    if (!input) return '';

    return input
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string | null | undefined): string {
    if (!email) return '';

    return email.trim().toLowerCase();
}

/**
 * Sanitize phone number - keep only digits and +
 */
export function sanitizePhone(phone: string | null | undefined): string {
    if (!phone) return '';

    return phone.replace(/[^\d+]/g, '');
}

/**
 * Sanitize HTML content (basic - for display purposes)
 * For production, use a library like DOMPurify
 */
export function sanitizeHTML(html: string | null | undefined): string {
    if (!html) return '';

    const tagMap: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };

    return html.replace(/[&<>"'/]/g, (tag) => tagMap[tag] || tag);
}

/**
 * Sanitize object by recursively sanitizing all string values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const sanitized: any = {};

    for (const key in obj) {
        const value = obj[key];

        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeObject(value);
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map(item =>
                typeof item === 'string' ? sanitizeString(item) :
                    (item && typeof item === 'object') ? sanitizeObject(item) :
                        item
            );
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized as T;
}

/**
 * Validate and sanitize user input for safety reports
 */
export function sanitizeSafetyReportInput(input: {
    description: string;
    type: string;
    severity: string;
}): {
    description: string;
    type: string;
    severity: string;
} {
    return {
        description: sanitizeString(input.description).slice(0, 2000), // Max 2000 chars
        type: sanitizeString(input.type),
        severity: sanitizeString(input.severity),
    };
}

/**
 * Validate and sanitize message input for chat
 */
export function sanitizeMessageInput(message: string): string {
    return sanitizeString(message).slice(0, 1000); // Max 1000 chars
}

/**
 * Validate URL to prevent javascript: and data: protocols
 */
export function sanitizeURL(url: string | null | undefined): string | null {
    if (!url) return null;

    const trimmed = url.trim();

    // Allow only http, https, and mailto protocols
    if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
        return null;
    }

    return trimmed;
}

/**
 * Validate file name to prevent path traversal
 */
export function sanitizeFileName(fileName: string | null | undefined): string {
    if (!fileName) return 'unnamed';

    return fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
        .replace(/\.{2,}/g, '_') // Prevent path traversal (..)
        .slice(0, 255); // Max filename length
}
