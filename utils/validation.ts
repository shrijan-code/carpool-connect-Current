/**
 * Shared validation utilities
 * Consolidates validation logic used across the app
 */

/**
 * Validate email address
 * @param email - Email string to validate
 * @returns True if valid email format
 */
export const validateEmail = (email: string): boolean => {
    if (!email || typeof email !== 'string') {
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
};

/**
 * Validate phone number (flexible format)
 * @param phone - Phone number string
 * @returns True if valid phone format
 */
export const validatePhone = (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') {
        return false;
    }

    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Check if it has 10 digits (US format) or 11 (with country code)
    return cleaned.length >= 10 && cleaned.length <= 15;
};

/**
 * Validate price value
 * @param price - Price string or number
 * @returns Validation result with error message if invalid
 */
export const validatePrice = (price: string | number): { valid: boolean; error?: string } => {
    const num = typeof price === 'string' ? parseFloat(price) : price;

    if (isNaN(num)) {
        return { valid: false, error: 'Please enter a valid number' };
    }

    if (num <= 0) {
        return { valid: false, error: 'Price must be greater than zero' };
    }

    if (num > 1000) {
        return { valid: false, error: 'Price cannot exceed $1,000' };
    }

    return { valid: true };
};

/**
 * Validate number of seats
 * @param seats - Number of seats
 * @returns Validation result with error message if invalid
 */
export const validateSeats = (seats: number): { valid: boolean; error?: string } => {
    if (!Number.isInteger(seats)) {
        return { valid: false, error: 'Seats must be a whole number' };
    }

    if (seats < 1) {
        return { valid: false, error: 'At least 1 seat is required' };
    }

    if (seats > 8) {
        return { valid: false, error: 'Maximum 8 seats allowed' };
    }

    return { valid: true };
};

/**
 * Validate location object
 * @param location - Location object to validate
 * @returns True if location has required fields
 */
export const validateLocation = (location: any): boolean => {
    if (!location || typeof location !== 'object') {
        return false;
    }

    return !!(
        location.name &&
        location.address &&
        typeof location.latitude === 'number' &&
        typeof location.longitude === 'number' &&
        !isNaN(location.latitude) &&
        !isNaN(location.longitude)
    );
};

/**
 * Validate date is in the future
 * @param date - Date to validate
 * @param minMinutesAhead - Minimum minutes ahead (default 5)
 * @returns Validation result with error message if invalid
 */
export const validateFutureDate = (
    date: Date | string,
    minMinutesAhead: number = 5
): { valid: boolean; error?: string } => {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) {
        return { valid: false, error: 'Invalid date' };
    }

    const now = new Date();
    const minDate = new Date(now.getTime() + minMinutesAhead * 60 * 1000);

    if (d < minDate) {
        return {
            valid: false,
            error: `Date must be at least ${minMinutesAhead} minutes in the future`
        };
    }

    // Check if date is not too far in the future (e.g., 1 year)
    const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    if (d > maxDate) {
        return { valid: false, error: 'Date cannot be more than 1 year in the future' };
    }

    return { valid: true };
};

/**
 * Validate name (non-empty, reasonable length)
 * @param name - Name string
 * @returns Validation result with error message if invalid
 */
export const validateName = (name: string): { valid: boolean; error?: string } => {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Name is required' };
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters' };
    }

    if (trimmed.length > 50) {
        return { valid: false, error: 'Name cannot exceed 50 characters' };
    }

    return { valid: true };
};

/**
 * Validate password strength
 * @param password - Password string
 * @returns Validation result with error message if invalid
 */
export const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (password.length > 128) {
        return { valid: false, error: 'Password cannot exceed 128 characters' };
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
        return { valid: false, error: 'Password must contain at least one number' };
    }

    // Check for at least one letter
    if (!/[a-zA-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one letter' };
    }

    return { valid: true };
};

/**
 * Validate coordinates
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns True if valid coordinates
 */
export const validateCoordinates = (lat: number, lng: number): boolean => {
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
};

/**
 * Validate URL
 * @param url - URL string
 * @returns True if valid URL format
 */
export const validateUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') {
        return false;
    }

    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validate ride edit permissions
 * @param ride - The ride object to check
 * @param userId - The user attempting to edit
 * @param hasConfirmedBookings - Whether the ride has confirmed bookings
 * @returns Object with canEdit boolean and reason if not allowed
 */
export const validateRideEditPermissions = (
    ride: { driverId: string; status: string },
    userId: string,
    hasConfirmedBookings: boolean
): { canEdit: boolean; reason?: string } => {
    // Check ownership
    if (ride.driverId !== userId) {
        return { canEdit: false, reason: 'You can only edit your own rides' };
    }

    // Check ride status
    if (ride.status !== 'upcoming') {
        return {
            canEdit: false,
            reason: `Cannot edit a ${ride.status} ride. Only upcoming rides can be edited.`
        };
    }

    // Check for confirmed bookings
    if (hasConfirmedBookings) {
        return {
            canEdit: false,
            reason: 'Cannot edit ride with confirmed bookings'
        };
    }

    return { canEdit: true };
};
