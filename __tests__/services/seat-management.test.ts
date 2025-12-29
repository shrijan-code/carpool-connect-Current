/**
 * Seat Management Tests
 * 
 * Comprehensive tests for seat management logic covering fraud prevention,
 * edge cases, and multi-rider scenarios to prevent exploitation.
 */

import { Ride, Booking } from '../../types';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

const createMockRide = (overrides: Partial<Ride> = {}): Ride => ({
    id: 'ride-123',
    driverId: 'driver-123',
    status: 'upcoming',
    departureTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    origin: { name: 'Sydney CBD', lat: -33.8688, lng: 151.2093 },
    destination: { name: 'Bondi Beach', lat: -33.8908, lng: 151.2743 },
    pricePerSeat: 1500,
    seatsTotal: 4,
    availableSeats: 4,
    seatsAvailable: 4,
    passengers: [],
    createdAt: new Date().toISOString(),
    ...overrides,
} as Ride);

const createMockBooking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 'booking-123',
    rideId: 'ride-123',
    riderId: 'rider-123',
    driverId: 'driver-123',
    status: 'pending_driver',
    seats: 1,
    amountTotal: 2000,
    createdAt: new Date().toISOString(),
    payment: { intentId: 'pi_123', status: 'authorized' },
    ...overrides,
} as Booking);

// ============================================================================
// SEAT CALCULATION HELPERS (Mirror production logic)
// ============================================================================

/**
 * Simulates seat decrement when booking is created
 */
function calculateSeatsAfterBooking(currentSeats: number, seatsRequested: number): number {
    return Math.max(0, currentSeats - seatsRequested);
}

/**
 * Simulates seat restoration when booking is rejected/cancelled
 */
function calculateSeatsAfterRejection(currentSeats: number, seatsToRestore: number, originalTotal: number): number {
    // Seats cannot exceed original total
    return Math.min(originalTotal, currentSeats + seatsToRestore);
}

/**
 * Validates if a booking request is allowed
 */
function canCreateBooking(
    ride: Ride,
    seatsRequested: number,
    riderId: string,
    existingBookings: Booking[]
): { allowed: boolean; reason?: string } {
    // Check if ride has enough seats
    const availableSeats = ride.availableSeats ?? ride.seatsAvailable ?? 0;
    if (seatsRequested > availableSeats) {
        return { allowed: false, reason: `Only ${availableSeats} seats available` };
    }

    // Check for zero/negative seats
    if (seatsRequested <= 0) {
        return { allowed: false, reason: 'Must book at least 1 seat' };
    }

    // Check for overbooking (more than ride total)
    if (seatsRequested > (ride.seatsTotal || 4)) {
        return { allowed: false, reason: 'Cannot book more seats than ride capacity' };
    }

    // Check for double-booking
    const existingActiveBooking = existingBookings.find(b =>
        b.riderId === riderId &&
        b.rideId === ride.id &&
        ['pending_driver', 'confirmed', 'pending_payment'].includes(b.status)
    );
    if (existingActiveBooking) {
        return { allowed: false, reason: 'You already have an active booking for this ride' };
    }

    // Cannot book own ride
    if (ride.driverId === riderId) {
        return { allowed: false, reason: 'Cannot book your own ride' };
    }

    return { allowed: true };
}

/**
 * Validates if rejection/cancellation should restore seats
 */
function shouldRestoreSeats(booking: Booking): boolean {
    // Only restore seats for statuses where seats were already decremented
    const restorableStatuses = ['pending_driver', 'confirmed', 'pending_payment'];
    return restorableStatuses.includes(booking.status);
}

/**
 * Validates cancellation is idempotent (can be called multiple times safely)
 */
function isAlreadyCancelled(booking: Booking): boolean {
    const cancelledStatuses = ['cancelled_by_rider', 'cancelled_by_driver', 'declined', 'refunded'];
    return cancelledStatuses.includes(booking.status);
}

// ============================================================================
// BASIC SEAT FLOW TESTS
// ============================================================================

describe('Basic Seat Flow', () => {
    describe('Single seat booking', () => {
        it('should decrement seats when booking is created', () => {
            const ride = createMockRide({ availableSeats: 4 });
            const newSeats = calculateSeatsAfterBooking(ride.availableSeats!, 1);
            expect(newSeats).toBe(3);
        });

        it('should restore seats when booking is rejected by driver', () => {
            const ride = createMockRide({ availableSeats: 3, seatsTotal: 4 });
            const booking = createMockBooking({ seats: 1, status: 'pending_driver' });

            expect(shouldRestoreSeats(booking)).toBe(true);
            const restoredSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking.seats, ride.seatsTotal!);
            expect(restoredSeats).toBe(4);
        });

        it('should restore seats when rider cancels before driver accepts', () => {
            const ride = createMockRide({ availableSeats: 3, seatsTotal: 4 });
            const booking = createMockBooking({ seats: 1, status: 'pending_driver' });

            expect(shouldRestoreSeats(booking)).toBe(true);
            const restoredSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking.seats, ride.seatsTotal!);
            expect(restoredSeats).toBe(4);
        });

        it('should restore seats when rider cancels after driver accepts', () => {
            const ride = createMockRide({ availableSeats: 3, seatsTotal: 4 });
            const booking = createMockBooking({ seats: 1, status: 'confirmed' });

            expect(shouldRestoreSeats(booking)).toBe(true);
            const restoredSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking.seats, ride.seatsTotal!);
            expect(restoredSeats).toBe(4);
        });
    });
});

// ============================================================================
// MULTIPLE SEATS PER BOOKING
// ============================================================================

describe('Multiple Seats Per Booking', () => {
    it('should decrement correct number of seats for multi-seat booking', () => {
        const ride = createMockRide({ availableSeats: 4 });
        const newSeats = calculateSeatsAfterBooking(ride.availableSeats!, 3);
        expect(newSeats).toBe(1);
    });

    it('should restore all seats when 3-seat booking is rejected', () => {
        const ride = createMockRide({ availableSeats: 1, seatsTotal: 4 });
        const booking = createMockBooking({ seats: 3, status: 'pending_driver' });

        const restoredSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking.seats, ride.seatsTotal!);
        expect(restoredSeats).toBe(4);
    });

    it('should restore all seats when 3-seat booking is cancelled', () => {
        const ride = createMockRide({ availableSeats: 1, seatsTotal: 4 });
        const booking = createMockBooking({ seats: 3, status: 'confirmed' });

        const restoredSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking.seats, ride.seatsTotal!);
        expect(restoredSeats).toBe(4);
    });

    it('should handle booking all available seats', () => {
        const ride = createMockRide({ availableSeats: 4, seatsTotal: 4 });
        const newSeats = calculateSeatsAfterBooking(ride.availableSeats!, 4);
        expect(newSeats).toBe(0);
    });
});

// ============================================================================
// MULTIPLE RIDERS ON SAME RIDE
// ============================================================================

describe('Multiple Riders on Same Ride', () => {
    it('should correctly track seats with two concurrent bookings', () => {
        let ride = createMockRide({ availableSeats: 4, seatsTotal: 4 });

        // Rider 1 books 2 seats
        ride.availableSeats = calculateSeatsAfterBooking(ride.availableSeats!, 2);
        expect(ride.availableSeats).toBe(2);

        // Rider 2 books 1 seat
        ride.availableSeats = calculateSeatsAfterBooking(ride.availableSeats!, 1);
        expect(ride.availableSeats).toBe(1);
    });

    it('should restore only rejected booking seats, not all seats', () => {
        let ride = createMockRide({ availableSeats: 1, seatsTotal: 4 });
        // State: 2 bookings made (3 seats used), 1 available

        const booking1 = createMockBooking({ id: 'b1', seats: 2, status: 'confirmed' });
        const booking2 = createMockBooking({ id: 'b2', seats: 1, status: 'pending_driver' });

        // Reject booking 2 (1 seat)
        ride.availableSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking2.seats, ride.seatsTotal!);
        expect(ride.availableSeats).toBe(2); // Only 1 seat restored, not all 3
    });

    it('should handle mixed reject and cancel scenario', () => {
        let ride = createMockRide({ availableSeats: 0, seatsTotal: 4 });
        // State: All 4 seats booked by 2 riders

        const booking1 = createMockBooking({ id: 'b1', seats: 2, status: 'confirmed' });
        const booking2 = createMockBooking({ id: 'b2', seats: 2, status: 'pending_driver' });

        // Driver rejects booking2
        ride.availableSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking2.seats, ride.seatsTotal!);
        expect(ride.availableSeats).toBe(2);

        // Rider1 cancels booking1
        ride.availableSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking1.seats, ride.seatsTotal!);
        expect(ride.availableSeats).toBe(4);
    });

    it('should correctly handle partial seat restoration', () => {
        let ride = createMockRide({ availableSeats: 1, seatsTotal: 4 });

        // 3 seats currently booked across 2 bookings
        const booking1 = createMockBooking({ id: 'b1', seats: 1, status: 'confirmed' });
        const booking2 = createMockBooking({ id: 'b2', seats: 2, status: 'confirmed' });

        // Cancel only booking1
        ride.availableSeats = calculateSeatsAfterRejection(ride.availableSeats!, booking1.seats, ride.seatsTotal!);
        expect(ride.availableSeats).toBe(2);

        // booking2 still exists, so only 2 seats available
    });
});

// ============================================================================
// FRAUD PREVENTION - OVERBOOKING
// ============================================================================

describe('Fraud Prevention - Overbooking', () => {
    it('should prevent booking more seats than available', () => {
        const ride = createMockRide({ availableSeats: 2 });
        const result = canCreateBooking(ride, 3, 'rider-123', []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Only 2 seats available');
    });

    it('should prevent booking when no seats available', () => {
        const ride = createMockRide({ availableSeats: 0 });
        const result = canCreateBooking(ride, 1, 'rider-123', []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Only 0 seats available');
    });

    it('should prevent booking more than ride capacity', () => {
        // When availableSeats >= seatsTotal but request exceeds total capacity
        // Use a scenario where available = 6 but total = 4 (inconsistent data edge case)
        const ride = createMockRide({ availableSeats: 6, seatsTotal: 4 });
        const result = canCreateBooking(ride, 5, 'rider-123', []);

        expect(result.allowed).toBe(false);
        // Gets caught by capacity check (5 > 4 seatsTotal)
        expect(result.reason).toContain('Cannot book more seats than ride capacity');
    });
});

// ============================================================================
// FRAUD PREVENTION - SEATS CANNOT GO NEGATIVE
// ============================================================================

describe('Fraud Prevention - Seats Cannot Go Negative', () => {
    it('should not allow seats to go below zero', () => {
        const newSeats = calculateSeatsAfterBooking(1, 3);
        expect(newSeats).toBe(0); // Capped at 0, not -2
    });

    it('should protect against malformed booking with negative seats requested', () => {
        const ride = createMockRide({ availableSeats: 4 });
        const result = canCreateBooking(ride, -1, 'rider-123', []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('at least 1 seat');
    });

    it('should protect against zero seat booking', () => {
        const ride = createMockRide({ availableSeats: 4 });
        const result = canCreateBooking(ride, 0, 'rider-123', []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('at least 1 seat');
    });
});

// ============================================================================
// FRAUD PREVENTION - SEATS CANNOT EXCEED ORIGINAL
// ============================================================================

describe('Fraud Prevention - Seats Cannot Exceed Original Total', () => {
    it('should not restore more seats than original total', () => {
        const ride = createMockRide({ availableSeats: 3, seatsTotal: 4 });

        // Try to restore 5 seats (exploit attempt)
        const restoredSeats = calculateSeatsAfterRejection(ride.availableSeats!, 5, ride.seatsTotal!);
        expect(restoredSeats).toBe(4); // Capped at original total
    });

    it('should cap seats at original total even after multiple restorations', () => {
        let ride = createMockRide({ availableSeats: 2, seatsTotal: 4 });

        // Simulate "double restoration" exploit attempt
        ride.availableSeats = calculateSeatsAfterRejection(ride.availableSeats!, 2, ride.seatsTotal!);
        expect(ride.availableSeats).toBe(4);

        // Try to restore again (already at max)
        ride.availableSeats = calculateSeatsAfterRejection(ride.availableSeats!, 2, ride.seatsTotal!);
        expect(ride.availableSeats).toBe(4); // Still capped
    });

    it('should handle restoration for booking that was already cancelled', () => {
        const booking = createMockBooking({ status: 'cancelled_by_rider' });

        // Already cancelled, should not restore again
        expect(shouldRestoreSeats(booking)).toBe(false);
    });
});

// ============================================================================
// FRAUD PREVENTION - DOUBLE BOOKING
// ============================================================================

describe('Fraud Prevention - Double Booking', () => {
    it('should prevent same rider from booking same ride twice', () => {
        const ride = createMockRide({ availableSeats: 4 });
        const existingBookings = [
            createMockBooking({ riderId: 'rider-123', rideId: 'ride-123', status: 'pending_driver' })
        ];

        const result = canCreateBooking(ride, 1, 'rider-123', existingBookings);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('already have an active booking');
    });

    it('should allow booking after previous one was cancelled', () => {
        const ride = createMockRide({ availableSeats: 4 });
        const existingBookings = [
            createMockBooking({ riderId: 'rider-123', rideId: 'ride-123', status: 'cancelled_by_rider' })
        ];

        const result = canCreateBooking(ride, 1, 'rider-123', existingBookings);
        expect(result.allowed).toBe(true);
    });

    it('should allow booking after previous one was declined', () => {
        const ride = createMockRide({ availableSeats: 4 });
        const existingBookings = [
            createMockBooking({ riderId: 'rider-123', rideId: 'ride-123', status: 'declined' })
        ];

        const result = canCreateBooking(ride, 1, 'rider-123', existingBookings);
        expect(result.allowed).toBe(true);
    });

    it('should prevent booking if confirmed booking exists', () => {
        const ride = createMockRide({ availableSeats: 4 });
        const existingBookings = [
            createMockBooking({ riderId: 'rider-123', rideId: 'ride-123', status: 'confirmed' })
        ];

        const result = canCreateBooking(ride, 1, 'rider-123', existingBookings);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('already have an active booking');
    });

    it('should prevent driver from booking own ride', () => {
        const ride = createMockRide({ driverId: 'user-123', availableSeats: 4 });

        const result = canCreateBooking(ride, 1, 'user-123', []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Cannot book your own ride');
    });
});

// ============================================================================
// IDEMPOTENCY - MULTIPLE CANCEL/REJECT ATTEMPTS
// ============================================================================

describe('Idempotency - Safe Multiple Operations', () => {
    it('should safely identify already cancelled bookings', () => {
        const cancelledBooking = createMockBooking({ status: 'cancelled_by_rider' });
        expect(isAlreadyCancelled(cancelledBooking)).toBe(true);
    });

    it('should safely identify already declined bookings', () => {
        const declinedBooking = createMockBooking({ status: 'declined' });
        expect(isAlreadyCancelled(declinedBooking)).toBe(true);
    });

    it('should not flag active bookings as cancelled', () => {
        const pendingBooking = createMockBooking({ status: 'pending_driver' });
        expect(isAlreadyCancelled(pendingBooking)).toBe(false);

        const confirmedBooking = createMockBooking({ status: 'confirmed' });
        expect(isAlreadyCancelled(confirmedBooking)).toBe(false);
    });

    it('should not restore seats for already cancelled booking', () => {
        const cancelledBooking = createMockBooking({ status: 'cancelled_by_rider', seats: 2 });

        // Should not restore because already cancelled
        expect(shouldRestoreSeats(cancelledBooking)).toBe(false);
    });

    it('should not restore seats for already declined booking', () => {
        const declinedBooking = createMockBooking({ status: 'declined', seats: 2 });

        // Should not restore because already declined
        expect(shouldRestoreSeats(declinedBooking)).toBe(false);
    });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
    it('should handle ride with undefined availableSeats', () => {
        const ride = createMockRide();
        delete (ride as any).availableSeats;
        (ride as any).seatsAvailable = 3;

        const effectiveSeats = ride.availableSeats ?? ride.seatsAvailable ?? 0;
        expect(effectiveSeats).toBe(3);
    });

    it('should handle ride with both seat fields', () => {
        const ride = createMockRide({ availableSeats: 2, seatsAvailable: 3 });

        // Should prefer availableSeats
        const effectiveSeats = ride.availableSeats ?? ride.seatsAvailable ?? 0;
        expect(effectiveSeats).toBe(2);
    });

    it('should handle booking with missing seats field defaulting to 1', () => {
        const booking = createMockBooking();
        delete (booking as any).seats;

        const seatsToRestore = booking.seats || 1;
        expect(seatsToRestore).toBe(1);
    });

    it('should handle very large seat numbers gracefully', () => {
        const ride = createMockRide({ availableSeats: 100, seatsTotal: 100 });
        const result = canCreateBooking(ride, 50, 'rider-123', []);

        expect(result.allowed).toBe(true);

        const newSeats = calculateSeatsAfterBooking(ride.availableSeats!, 50);
        expect(newSeats).toBe(50);
    });

    it('should handle booking for different ride correctly', () => {
        const ride = createMockRide({ id: 'ride-456', availableSeats: 4 });
        const existingBookings = [
            createMockBooking({ riderId: 'rider-123', rideId: 'ride-123', status: 'confirmed' })
        ];

        // Different ride, should be allowed
        const result = canCreateBooking(ride, 1, 'rider-123', existingBookings);
        expect(result.allowed).toBe(true);
    });
});

// ============================================================================
// CONCURRENT BOOKING SCENARIOS (Race Condition Prevention)
// ============================================================================

describe('Concurrent Booking Scenarios', () => {
    it('should handle race condition where two bookings try last seat', () => {
        const ride = createMockRide({ availableSeats: 1 });

        // First booking succeeds
        const result1 = canCreateBooking(ride, 1, 'rider-1', []);
        expect(result1.allowed).toBe(true);

        // Simulate first booking being processed
        ride.availableSeats = calculateSeatsAfterBooking(ride.availableSeats!, 1);

        // Second booking should fail (no seats left)
        const result2 = canCreateBooking(ride, 1, 'rider-2', []);
        expect(result2.allowed).toBe(false);
        expect(result2.reason).toContain('Only 0 seats available');
    });

    it('should correctly calculate final seats after multiple operations', () => {
        let ride = createMockRide({ availableSeats: 4, seatsTotal: 4 });

        // Booking 1: 2 seats
        ride.availableSeats = calculateSeatsAfterBooking(ride.availableSeats!, 2);
        expect(ride.availableSeats).toBe(2);

        // Booking 2: 1 seat
        ride.availableSeats = calculateSeatsAfterBooking(ride.availableSeats!, 1);
        expect(ride.availableSeats).toBe(1);

        // Cancel booking 1 (2 seats restored)
        ride.availableSeats = calculateSeatsAfterRejection(ride.availableSeats!, 2, ride.seatsTotal!);
        expect(ride.availableSeats).toBe(3);

        // Booking 3: 2 seats
        ride.availableSeats = calculateSeatsAfterBooking(ride.availableSeats!, 2);
        expect(ride.availableSeats).toBe(1);

        // Final state: 1 seat available (booking 2 + booking 3 = 3 seats booked)
    });
});
