/**
 * Ride and Booking Validation Helpers
 * 
 * These functions enforce the business rules for ride/booking operations
 * as defined in the Booking System Architecture.
 * 
 * ============================================================================
 * FIELD NAMING CONVENTIONS (IMPORTANT FOR MAINTAINERS)
 * ============================================================================
 * 
 * Due to historical evolution, some fields have dual names. BOTH should be
 * updated together for compatibility:
 * 
 * SEATS:
 * - `seatsAvailable` and `availableSeats` - both represent the same value
 * - Always update BOTH when modifying seat counts
 * 
 * PASSENGER ID:
 * - `riderId` is the current standard field name for passengers
 * - `passengerId` is an alias set for legacy code compatibility
 * - Both should be set when creating bookings
 * - Queries should check BOTH fields when searching for user's bookings
 * 
 * LOCATIONS:
 * - `from`/`to` vs `origin`/`destination` - ride locations may use either
 * - Always check for both patterns when accessing location data
 * 
 * DEPARTURE TIME:
 * - `departureTime` (ISO string) is the standard
 * - `departureAt` may exist in some legacy data
 * ============================================================================
 */

import { Ride, Booking } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type ValidationResult = {
    allowed: boolean;
    limitedEdit?: boolean;
    editableFields?: string[];
    reason?: string;
    warning?: string;
};

// ============================================================================
// RIDE VALIDATION
// ============================================================================

/**
 * Check if a ride can be edited
 * 
 * Rules:
 * - Only 'upcoming' rides can be edited
 * - If ride has confirmed bookings, only limited fields can be changed
 */
export function canEditRide(ride: Ride, bookings: Booking[]): ValidationResult {
    // Rule 1: Only upcoming rides can be edited
    if (ride.status !== 'upcoming') {
        return {
            allowed: false,
            reason: `Cannot edit ride - status is "${ride.status}". Only upcoming rides can be edited.`
        };
    }

    // Rule 2: Check for ANY active bookings (pending or confirmed)
    // Once a rider has requested a booking, the driver should NOT be able to change
    // the core ride details (location, date, time, price) as the rider made their
    // decision based on those details.
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
    const pendingBookings = bookings.filter(b => b.status === 'pending_driver');
    const totalActiveBookings = confirmedBookings.length + pendingBookings.length;

    if (totalActiveBookings > 0) {
        let reason = '';
        if (confirmedBookings.length > 0 && pendingBookings.length > 0) {
            reason = `Limited editing - ${confirmedBookings.length} confirmed and ${pendingBookings.length} pending booking(s). Cannot change date, time, route, or price.`;
        } else if (confirmedBookings.length > 0) {
            reason = `Limited editing - ${confirmedBookings.length} passenger(s) have confirmed bookings. Cannot change date, time, route, or price.`;
        } else {
            reason = `Limited editing - ${pendingBookings.length} pending booking request(s). Cannot change date, time, route, or price until requests are resolved.`;
        }

        return {
            allowed: true,
            limitedEdit: true,
            editableFields: ['notes', 'availableSeats'], // Can only increase seats or edit notes
            reason
        };
    }

    return { allowed: true };
}

/**
 * Check if a ride can be deleted
 * 
 * Rules:
 * - Only 'upcoming' rides can be deleted
 * - Cannot delete if there are confirmed bookings (use cancel instead)
 * - If pending bookings exist, they'll be auto-declined
 */
export function canDeleteRide(ride: Ride, bookings: Booking[]): ValidationResult {
    // Rule 1: Only upcoming rides can be deleted
    if (ride.status !== 'upcoming') {
        return {
            allowed: false,
            reason: `Cannot delete ${ride.status} rides. ${ride.status === 'active' ? 'Cancel the ride instead.' :
                ride.status === 'completed' ? 'Completed rides are historical records.' :
                    'This ride has already been cancelled.'
                }`
        };
    }

    // Rule 2: Cannot delete if confirmed bookings exist
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');

    if (confirmedBookings.length > 0) {
        return {
            allowed: false,
            reason: `Cannot delete ride with ${confirmedBookings.length} confirmed passenger(s). Cancel the ride instead to notify them and process refunds.`
        };
    }

    // Rule 3: Pending bookings can be auto-declined
    const pendingBookings = bookings.filter(b => b.status === 'pending_driver');

    if (pendingBookings.length > 0) {
        return {
            allowed: true,
            warning: `This will automatically decline ${pendingBookings.length} pending booking request(s).`
        };
    }

    return { allowed: true };
}

/**
 * Check if a ride can be cancelled
 * 
 * Rules:
 * - Upcoming and active rides can be cancelled
 * - Completed/cancelled rides cannot be cancelled
 * - Warning if within 24 hours of departure
 */
export function canCancelRide(ride: Ride): ValidationResult {
    // Rule 1: Cannot cancel completed or already cancelled rides
    if (ride.status === 'completed') {
        return {
            allowed: false,
            reason: 'Cannot cancel a completed ride.'
        };
    }

    if (ride.status === 'cancelled') {
        return {
            allowed: false,
            reason: 'This ride has already been cancelled.'
        };
    }

    // Rule 2: Check timing for warnings
    const departureTime = new Date(ride.departureTime || ride.departureAt || Date.now());
    const hoursUntilDeparture = (departureTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (ride.status === 'active') {
        return {
            allowed: true,
            warning: 'Cancelling an active ride will issue full refunds to all passengers. This may affect your driver rating.'
        };
    }

    if (hoursUntilDeparture < 24 && hoursUntilDeparture > 0) {
        return {
            allowed: true,
            warning: `Cancelling within 24 hours of departure (${Math.round(hoursUntilDeparture)} hours left) may affect your driver rating. All passengers will receive full refunds.`
        };
    }

    if (hoursUntilDeparture <= 0) {
        return {
            allowed: true,
            warning: 'This ride was scheduled to have already started. All passengers will receive full refunds.'
        };
    }

    return { allowed: true };
}

/**
 * Check if a ride can be started
 */
export function canStartRide(ride: Ride, bookings: Booking[]): ValidationResult {
    if (ride.status !== 'upcoming') {
        return {
            allowed: false,
            reason: `Cannot start ride - status is "${ride.status}".`
        };
    }

    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');

    if (confirmedBookings.length === 0) {
        return {
            allowed: false,
            reason: 'Cannot start ride - no confirmed passengers.'
        };
    }

    return { allowed: true };
}

// ============================================================================
// BOOKING VALIDATION
// ============================================================================

/**
 * Check if a driver can accept a booking
 */
export function canAcceptBooking(booking: Booking): ValidationResult {
    if (booking.status !== 'pending_driver') {
        return {
            allowed: false,
            reason: `Cannot accept booking - status is "${booking.status}".`
        };
    }

    return { allowed: true };
}

/**
 * Check if a driver can decline a booking
 */
export function canDeclineBooking(booking: Booking): ValidationResult {
    if (booking.status !== 'pending_driver') {
        return {
            allowed: false,
            reason: `Cannot decline booking - status is "${booking.status}".`
        };
    }

    return { allowed: true };
}

/**
 * Check if a rider can cancel their booking
 * 
 * Rules:
 * - Pending bookings can always be cancelled (no fee)
 * - Confirmed bookings have tiered cancellation fees
 * - Active/completed bookings cannot be cancelled
 */
export function canCancelBooking(booking: Booking, ride: Ride): ValidationResult & {
    feePercent?: number;
    feeAmount?: number;
} {
    // Cannot cancel completed, refunded, or already cancelled bookings
    if (['completed', 'cancelled', 'cancelled_by_rider', 'cancelled_by_driver', 'declined', 'refunded'].includes(booking.status)) {
        return {
            allowed: false,
            reason: `Cannot cancel booking - status is "${booking.status}".`
        };
    }

    // Pending bookings can always be cancelled with no fee
    if (booking.status === 'pending_driver') {
        return {
            allowed: true,
            feePercent: 0,
            feeAmount: 0
        };
    }

    // Check ride status for confirmed bookings
    if (ride.status === 'active') {
        return {
            allowed: false,
            reason: 'Cannot cancel booking - ride is already in progress.'
        };
    }

    if (ride.status === 'completed') {
        return {
            allowed: false,
            reason: 'Cannot cancel booking - ride has been completed.'
        };
    }

    // Calculate cancellation fee based on time until departure
    const departureTime = new Date(ride.departureTime || ride.departureAt || Date.now());
    const hoursUntilDeparture = (departureTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const totalAmount = booking.amountTotal || 0;

    let feePercent = 0;
    let warning = '';

    if (hoursUntilDeparture > 24) {
        // More than 24 hours: $2 flat fee or 5%
        feePercent = 5;
        warning = 'A 5% cancellation fee will apply.';
    } else if (hoursUntilDeparture > 12) {
        // 12-24 hours: 25% fee
        feePercent = 25;
        warning = 'A 25% cancellation fee will apply (less than 24 hours before departure).';
    } else if (hoursUntilDeparture > 0) {
        // Less than 12 hours: 50% fee
        feePercent = 50;
        warning = 'A 50% cancellation fee will apply (less than 12 hours before departure).';
    } else {
        // Past departure time
        feePercent = 100;
        warning = 'No refund available - the ride was scheduled to have already started.';
    }

    const feeAmount = Math.round(totalAmount * (feePercent / 100));

    return {
        allowed: true,
        warning,
        feePercent,
        feeAmount
    };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get user-friendly status text
 */
export function getRideStatusText(status: string): string {
    const statusMap: Record<string, string> = {
        'upcoming': 'Upcoming',
        'active': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

/**
 * Get user-friendly booking status text
 */
export function getBookingStatusText(status: string): string {
    const statusMap: Record<string, string> = {
        'pending_driver': 'Awaiting Driver Response',
        'confirmed': 'Confirmed',
        'declined': 'Declined by Driver',
        'cancelled': 'Cancelled',
        'cancelled_by_rider': 'Cancelled by You',
        'cancelled_by_driver': 'Cancelled by Driver',
        'completed': 'Completed',
        'no_show': 'No Show'
    };
    return statusMap[status] || status;
}
