/**
 * Booking System Edge Case Tests
 *
 * These tests cover edge cases and race condition scenarios for the booking system.
 * They complement the validation tests by testing more complex scenarios.
 */

import {
    canEditRide,
    canDeleteRide,
    canCancelRide,
    canCancelBooking,
    canStartRide,
} from '../../utils/ride-validation';
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
    availableSeats: 3,
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
    ...overrides,
} as Booking);

// ============================================================================
// RACE CONDITION SCENARIOS
// ============================================================================

describe('Race Condition Scenarios', () => {
    describe('Multiple bookings for last seat', () => {
        it('should handle multiple pending bookings correctly', () => {
            const ride = createMockRide({ status: 'upcoming', availableSeats: 1 });

            // Simulate two pending bookings (race condition - both got through)
            const bookings = [
                createMockBooking({ status: 'pending_driver', id: 'b1', seats: 1 }),
                createMockBooking({ status: 'pending_driver', id: 'b2', seats: 1 }),
            ];

            // Both should exist, but validation should flag limited editing
            const editResult = canEditRide(ride, bookings);
            expect(editResult.limitedEdit).toBe(true);
            expect(editResult.reason).toContain('2 pending');
        });

        it('should handle mixed pending and cancelled bookings', () => {
            const ride = createMockRide({ status: 'upcoming' });
            const bookings = [
                createMockBooking({ status: 'pending_driver', id: 'b1' }),
                createMockBooking({ status: 'cancelled', id: 'b2' }),
                createMockBooking({ status: 'declined', id: 'b3' }),
            ];

            const editResult = canEditRide(ride, bookings);
            expect(editResult.limitedEdit).toBe(true);
            // Should only count the 1 pending, not cancelled/declined
            expect(editResult.reason).toContain('1 pending');
        });
    });

    describe('Status transition edge cases', () => {
        it('should handle booking in transitional state', () => {
            // Simulate a booking that might be mid-transition
            const booking = createMockBooking({ status: 'pending_driver' });
            const ride = createMockRide({ status: 'upcoming' });

            const cancelResult = canCancelBooking(booking, ride);
            expect(cancelResult.allowed).toBe(true);
            expect(cancelResult.feePercent).toBe(0); // No fee for pending
        });
    });
});

// ============================================================================
// BOUNDARY CONDITION TESTS
// ============================================================================

describe('Time Boundary Tests', () => {
    describe('Cancellation fee boundaries', () => {
        it('should apply 5% fee at exactly 24 hours 1 minute', () => {
            const booking = createMockBooking({ status: 'confirmed', amountTotal: 10000 });
            const ride = createMockRide({
                departureTime: new Date(Date.now() + (24 * 60 + 1) * 60 * 1000).toISOString(),
            });

            const result = canCancelBooking(booking, ride);
            expect(result.feePercent).toBe(5);
            expect(result.feeAmount).toBe(500); // 5% of $100
        });

        it('should apply 25% fee at exactly 24 hours', () => {
            const booking = createMockBooking({ status: 'confirmed', amountTotal: 10000 });
            const ride = createMockRide({
                departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });

            const result = canCancelBooking(booking, ride);
            // At exactly 24h, it's <=24 so should be 25%
            expect(result.feePercent).toBe(25);
        });

        it('should apply 25% fee at 12 hours 1 minute', () => {
            const booking = createMockBooking({ status: 'confirmed', amountTotal: 10000 });
            const ride = createMockRide({
                departureTime: new Date(Date.now() + (12 * 60 + 1) * 60 * 1000).toISOString(),
            });

            const result = canCancelBooking(booking, ride);
            expect(result.feePercent).toBe(25);
        });

        it('should apply 50% fee at exactly 12 hours', () => {
            const booking = createMockBooking({ status: 'confirmed', amountTotal: 10000 });
            const ride = createMockRide({
                departureTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            });

            const result = canCancelBooking(booking, ride);
            expect(result.feePercent).toBe(50);
        });

        it('should apply 100% fee at 1 minute past departure', () => {
            const booking = createMockBooking({ status: 'confirmed', amountTotal: 10000 });
            const ride = createMockRide({
                departureTime: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute ago
            });

            const result = canCancelBooking(booking, ride);
            expect(result.feePercent).toBe(100);
            expect(result.feeAmount).toBe(10000); // No refund
        });
    });

    describe('Ride cancellation warnings', () => {
        it('should warn at exactly 23 hours 59 minutes', () => {
            const ride = createMockRide({
                departureTime: new Date(Date.now() + (23 * 60 + 59) * 60 * 1000).toISOString(),
            });

            const result = canCancelRide(ride);
            expect(result.warning).toContain('24 hours');
        });

        it('should not warn at 24 hours 1 minute', () => {
            const ride = createMockRide({
                departureTime: new Date(Date.now() + (24 * 60 + 1) * 60 * 1000).toISOString(),
            });

            const result = canCancelRide(ride);
            expect(result.warning).toBeUndefined();
        });
    });
});

// ============================================================================
// MULTI-BOOKING SCENARIOS
// ============================================================================

describe('Multi-Booking Scenarios', () => {
    it('should handle ride with many bookings in mixed states', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [
            createMockBooking({ status: 'confirmed', id: 'b1' }),
            createMockBooking({ status: 'confirmed', id: 'b2' }),
            createMockBooking({ status: 'pending_driver', id: 'b3' }),
            createMockBooking({ status: 'cancelled', id: 'b4' }),
            createMockBooking({ status: 'declined', id: 'b5' }),
            createMockBooking({ status: 'completed', id: 'b6' }),
        ];

        const editResult = canEditRide(ride, bookings);
        expect(editResult.limitedEdit).toBe(true);
        expect(editResult.reason).toContain('2 confirmed');
        expect(editResult.reason).toContain('1 pending');
    });

    it('should correctly count seats for deletion check', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [
            createMockBooking({ status: 'confirmed', id: 'b1', seats: 2 }),
            createMockBooking({ status: 'confirmed', id: 'b2', seats: 1 }),
        ];

        const deleteResult = canDeleteRide(ride, bookings);
        expect(deleteResult.allowed).toBe(false);
        expect(deleteResult.reason).toContain('2 confirmed');
    });

    it('should allow starting ride with at least one confirmed booking', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [
            createMockBooking({ status: 'pending_driver', id: 'b1' }),
            createMockBooking({ status: 'confirmed', id: 'b2' }),
            createMockBooking({ status: 'cancelled', id: 'b3' }),
        ];

        const startResult = canStartRide(ride, bookings);
        expect(startResult.allowed).toBe(true);
    });
});

// ============================================================================
// PAYMENT EDGE CASES
// ============================================================================

describe('Payment Amount Edge Cases', () => {
    it('should handle zero amount booking', () => {
        const booking = createMockBooking({ status: 'confirmed', amountTotal: 0 });
        const ride = createMockRide();

        const result = canCancelBooking(booking, ride);
        expect(result.feeAmount).toBe(0);
    });

    it('should handle very large amount booking', () => {
        const booking = createMockBooking({ status: 'confirmed', amountTotal: 1000000 }); // $10,000
        const ride = createMockRide({
            departureTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6h
        });

        const result = canCancelBooking(booking, ride);
        expect(result.feePercent).toBe(50);
        expect(result.feeAmount).toBe(500000); // 50% = $5,000
    });

    it('should round fee amounts correctly', () => {
        const booking = createMockBooking({ status: 'confirmed', amountTotal: 1999 }); // $19.99
        const ride = createMockRide({
            departureTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });

        const result = canCancelBooking(booking, ride);
        expect(result.feePercent).toBe(5);
        // 5% of 1999 = 99.95, should round to 100
        expect(result.feeAmount).toBe(100);
    });
});

// ============================================================================
// DATE/TIME EDGE CASES
// ============================================================================

describe('Date/Time Edge Cases', () => {
    it('should handle ride with missing departureTime gracefully', () => {
        const ride = createMockRide({ status: 'upcoming' });
        delete (ride as any).departureTime;

        const result = canCancelRide(ride);
        // Should still work, using fallback to current time
        expect(result.allowed).toBe(true);
    });

    it('should handle ride with departureAt field instead of departureTime', () => {
        const ride = createMockRide({ status: 'upcoming' });
        delete (ride as any).departureTime;
        (ride as any).departureAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        const result = canCancelRide(ride);
        expect(result.allowed).toBe(true);
        expect(result.warning).toBeUndefined();
    });

    it('should handle ride departing right now', () => {
        const ride = createMockRide({
            departureTime: new Date().toISOString(), // Right now
        });

        const result = canCancelRide(ride);
        expect(result.allowed).toBe(true);
        expect(result.warning).toContain('already started');
    });
});

// ============================================================================
// STATUS COMBINATION TESTS
// ============================================================================

describe('Status Combination Tests', () => {
    const statuses = ['upcoming', 'active', 'completed', 'cancelled'];

    statuses.forEach(status => {
        it(`should handle ${status} rides for edit check`, () => {
            const ride = createMockRide({ status: status as any });
            const result = canEditRide(ride, []);

            if (status === 'upcoming') {
                expect(result.allowed).toBe(true);
            } else {
                expect(result.allowed).toBe(false);
            }
        });

        it(`should handle ${status} rides for delete check`, () => {
            const ride = createMockRide({ status: status as any });
            const result = canDeleteRide(ride, []);

            if (status === 'upcoming') {
                expect(result.allowed).toBe(true);
            } else {
                expect(result.allowed).toBe(false);
            }
        });
    });

    const bookingStatuses = ['pending_driver', 'confirmed', 'declined', 'cancelled', 'completed'];

    bookingStatuses.forEach(status => {
        it(`should correctly validate ${status} booking for cancellation`, () => {
            const booking = createMockBooking({ status: status as any });
            const ride = createMockRide();
            const result = canCancelBooking(booking, ride);

            if (status === 'pending_driver' || status === 'confirmed') {
                expect(result.allowed).toBe(true);
            } else {
                expect(result.allowed).toBe(false);
            }
        });
    });
});
