/**
 * Ride-specific helper utilities
 * Consolidates ride-related calculations and logic
 */

import { Ride, Booking, Location } from '@/types';

/**
 * Normalized ride display data interface
 * Provides consistent field names regardless of how data is stored
 */
export interface RideDisplayData {
    id: string;
    origin: {
        name: string;
        address: string;
        latitude?: number;
        longitude?: number;
    };
    destination: {
        name: string;
        address: string;
        latitude?: number;
        longitude?: number;
    };
    departureTime: string;
    departureDate: Date;
    seatsAvailable: number;
    seatsTotal: number;
    pricePerSeat: number;
    priceFormatted: string;
    status: string;
    driverId: string;
    driver?: {
        id?: string;
        name: string;
        rating?: number;
        photoURL?: string;
    };
    duration?: string;
    distance?: string;
}

/**
 * Get normalized ride display data
 * Handles all legacy field names and provides consistent data structure
 * @param ride - Ride object (may have inconsistent field names)
 * @returns Normalized RideDisplayData object
 */
export const getRideDisplayData = (ride: Ride): RideDisplayData => {
    // Normalize origin location
    const originData = ride.origin || ride.from || ({} as Location);
    const origin = {
        name: originData?.name || 'Unknown origin',
        address: originData?.address || 'Address not available',
        latitude: originData?.latitude,
        longitude: originData?.longitude,
    };

    // Normalize destination location
    const destData = ride.destination || ride.to || ({} as Location);
    const destination = {
        name: destData?.name || 'Unknown destination',
        address: destData?.address || 'Address not available',
        latitude: destData?.latitude,
        longitude: destData?.longitude,
    };

    // Normalize departure time
    const departureTimeStr = ride.departureAt || ride.departureTime || new Date().toISOString();
    const departureDate = new Date(departureTimeStr);

    // Normalize seats
    const seatsAvailable = ride.availableSeats ?? ride.seatsAvailable ?? 0;
    const seatsTotal = ride.seatsTotal ?? ride.vehicle?.seats ?? 4;

    // Normalize price
    const pricePerSeat = ride.pricePerSeat ?? 0;
    const priceFormatted = `$${(pricePerSeat / 100).toFixed(2)}`;

    // Normalize driver info
    const driver = ride.driver ? {
        id: ride.driver.id,
        name: ride.driver.name || ride.driver.displayName || 'Unknown driver',
        rating: ride.driver.rating,
        photoURL: ride.driver.photoURL || ride.driver.profilePicture,
    } : undefined;

    return {
        id: ride.id,
        origin,
        destination,
        departureTime: departureTimeStr,
        departureDate,
        seatsAvailable: Math.max(0, seatsAvailable), // Ensure never negative
        seatsTotal,
        pricePerSeat,
        priceFormatted,
        status: ride.status || 'upcoming',
        driverId: ride.driverId,
        driver,
        duration: ride.duration,
        distance: ride.distance,
    };
};

/**
 * Format departure time for display
 * @param departureTime - ISO date string
 * @returns Formatted time string (e.g., "Mon, Dec 12 at 3:30 PM")
 */
export const formatDepartureTime = (departureTime: string): string => {
    try {
        const date = new Date(departureTime);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        }) + ' at ' + date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return 'Date unavailable';
    }
};

/**
 * Get short time display (e.g., "3:30 PM")
 */
export const formatTimeShort = (departureTime: string): string => {
    try {
        return new Date(departureTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return 'N/A';
    }
};

/**
 * Get short date display (e.g., "Dec 12")
 */
export const formatDateShort = (departureTime: string): string => {
    try {
        return new Date(departureTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return 'N/A';
    }
};


/**
 * Calculate available seats for a ride
 * @param ride - Ride object
 * @param bookings - Array of bookings for this ride (optional)
 * @returns Number of available seats
 */
export const calculateAvailableSeats = (ride: Ride, bookings?: Booking[]): number => {
    const totalSeats = ride.availableSeats || ride.seatsAvailable || 0;

    if (!bookings || bookings.length === 0) {
        return totalSeats;
    }

    // Sum up confirmed booking seats
    const bookedSeats = bookings
        .filter(b => b.status === 'confirmed' || b.status === 'pending_driver')
        .reduce((sum, b) => sum + (b.seats || 0), 0);

    return Math.max(0, totalSeats - bookedSeats);
};

/**
 * Calculate total price for booking
 * @param pricePerSeat - Price per seat in cents
 * @param seats - Number of seats
 * @param platformFee - Optional platform fee in cents (default: 500 = $5)
 * @returns Object with breakdown of costs
 */
export const calculateBookingPrice = (
    pricePerSeat: number,
    seats: number,
    platformFee: number = 500
): {
    subtotal: number;
    platformFee: number;
    total: number;
} => {
    const subtotal = pricePerSeat * seats;
    return {
        subtotal,
        platformFee,
        total: subtotal + platformFee
    };
};

/**
 * Calculate driver payout amount (after platform fee)
 * @param totalAmount - Total amount paid by rider in cents
 * @param platformFeePercentage - Platform fee percentage (default: 0.10 for 10%)
 * @returns Object with payout breakdown
 */
export const calculateDriverPayout = (
    totalAmount: number,
    platformFeePercentage: number = 0.10
): {
    platformFee: number;
    driverAmount: number;
} => {
    const platformFee = Math.round(totalAmount * platformFeePercentage);
    const driverAmount = totalAmount - platformFee;

    return {
        platformFee,
        driverAmount
    };
};

/**
 * Check if ride is upcoming (not started yet)
 * @param ride - Ride object
 * @returns True if ride is in the future
 */
export const isRideUpcoming = (ride: Ride): boolean => {
    const departureTime = ride.departureTime || ride.departureAt;
    if (!departureTime) return false;

    const departureDate = new Date(departureTime);
    return departureDate.getTime() > Date.now();
};

/**
 * Check if ride has started
 * @param ride - Ride object
 * @returns True if ride has started
 */
export const isRideActive = (ride: Ride): boolean => {
    const departureTime = ride.departureTime || ride.departureAt;
    if (!departureTime) return false;

    const departureDate = new Date(departureTime);
    const now = Date.now();

    // Consider ride active if it's past departure time but within reasonable completion window
    return departureDate.getTime() <= now && ride.status === 'active';
};

/**
 * Check if ride is completed
 * @param ride - Ride object
 * @returns True if ride is completed
 */
export const isRideCompleted = (ride: Ride): boolean => {
    return ride.status === 'completed';
};

/**
 * Check if ride is expired (past departure time and still upcoming status)
 * @param ride - Ride object
 * @param bufferHours - Buffer hours to consider expired (default: 2)
 * @returns True if ride should be marked as expired
 */
export const isRideExpired = (ride: Ride, bufferHours: number = 2): boolean => {
    if (ride.status !== 'upcoming') return false;

    const departureTime = ride.departureTime || ride.departureAt;
    if (!departureTime) return false;

    const departureDate = new Date(departureTime);
    const expirationTime = departureDate.getTime() + (bufferHours * 60 * 60 * 1000);

    return Date.now() > expirationTime;
};

/**
 * Check if booking can be cancelled
 * @param booking - Booking object
 * @param ride - Associated ride object
 * @param minHoursBeforeDeparture - Minimum hours before departure to allow cancellation (default: 2)
 * @returns Object with can cancel status and reason
 */
export const canCancelBooking = (
    booking: Booking,
    ride: Ride,
    minHoursBeforeDeparture: number = 2
): { canCancel: boolean; reason?: string } => {
    // Can't cancel if already cancelled or completed
    if (booking.status === 'cancelled' || booking.status === 'completed') {
        return { canCancel: false, reason: `Booking is already ${booking.status}` };
    }

    // Check time remaining
    const departureTime = ride.departureTime || ride.departureAt;
    if (!departureTime) {
        return { canCancel: true };
    }

    const departureDate = new Date(departureTime);
    const hoursUntilDeparture = (departureDate.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilDeparture < minHoursBeforeDeparture) {
        return {
            canCancel: false,
            reason: `Can only cancel bookings at least ${minHoursBeforeDeparture} hours before departure`
        };
    }

    return { canCancel: true };
};

/**
 * Get ride status display text
 * @param ride - Ride object
 * @returns Human-readable status text
 */
export const getRideStatusText = (ride: Ride): string => {
    switch (ride.status) {
        case 'upcoming':
            return 'Upcoming';
        case 'active':
            return 'In Progress';
        case 'completed':
            return 'Completed';
        case 'cancelled':
            return 'Cancelled';
        case 'expired':
            return 'Expired';
        default:
            return 'Unknown';
    }
};

/**
 * Get booking status display text
 * @param booking - Booking object
 * @returns Human-readable status text
 */
export const getBookingStatusText = (booking: Booking): string => {
    switch (booking.status) {
        case 'pending_payment':
            return 'Payment Pending';
        case 'pending_driver':
            return 'Awaiting Driver Approval';
        case 'confirmed':
            return 'Confirmed';
        case 'cancelled':
            return 'Cancelled';
        case 'completed':
            return 'Completed';
        case 'rejected':
            return 'Rejected';
        default:
            return 'Unknown';
    }
};

/**
 * Estimate ride duration in minutes (simple calculation)
 * @param distanceKm - Distance in kilometers
 * @param averageSpeedKmh - Average speed in km/h (default: 50)
 * @returns Estimated duration in minutes
 */
export const estimateRideDuration = (
    distanceKm: number,
    averageSpeedKmh: number = 50
): number => {
    if (distanceKm <= 0 || averageSpeedKmh <= 0) return 0;

    const hours = distanceKm / averageSpeedKmh;
    return Math.round(hours * 60);
};

/**
 * Calculate estimated arrival time
 * @param departureTime - Departure date/time
 * @param durationMinutes - Ride duration in minutes
 * @returns Estimated arrival Date object
 */
export const calculateArrivalTime = (
    departureTime: Date | string,
    durationMinutes: number
): Date => {
    const departure = typeof departureTime === 'string' ? new Date(departureTime) : departureTime;
    return new Date(departure.getTime() + durationMinutes * 60 * 1000);
};

/**
 * Check if user can book this ride
 * @param ride - Ride object
 * @param userId - User ID
 * @param userRole - User role ('driver' or 'rider')
 * @returns Object with can book status and reason
 */
export const canBookRide = (
    ride: Ride,
    userId: string,
    userRole: string
): { canBook: boolean; reason?: string } => {
    // Can't book your own ride
    if (ride.driverId === userId) {
        return { canBook: false, reason: 'Cannot book your own ride' };
    }

    // Only riders can book
    if (userRole !== 'rider') {
        return { canBook: false, reason: 'Only riders can book rides' };
    }

    // Check if ride is upcoming
    if (!isRideUpcoming(ride)) {
        return { canBook: false, reason: 'Ride has already departed or ended' };
    }

    // Check if seats are available
    const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
    if (availableSeats <= 0) {
        return { canBook: false, reason: 'No seats available' };
    }

    return { canBook: true };
};

/**
 * Sort rides by departure time
 * @param rides - Array of rides
 * @param ascending - Sort in ascending order (default: true)
 * @returns Sorted array of rides
 */
export const sortRidesByDeparture = (rides: Ride[], ascending: boolean = true): Ride[] => {
    return [...rides].sort((a, b) => {
        const timeA = new Date(a.departureTime || a.departureAt || 0).getTime();
        const timeB = new Date(b.departureTime || b.departureAt || 0).getTime();
        return ascending ? timeA - timeB : timeB - timeA;
    });
};
