/**
 * Booking System Validation Tests
 *
 * Tests for the ride and booking validation utility functions.
 * These tests verify the business rules for:
 * - Ride editing permissions
 * - Ride deletion permissions
 * - Ride cancellation rules
 * - Booking lifecycle validation
 * - Cancellation fee calculations
 */

import {
    canEditRide,
    canDeleteRide,
    canCancelRide,
    canStartRide,
    canAcceptBooking,
    canDeclineBooking,
    canCancelBooking,
    getRideStatusText,
    getBookingStatusText,
} from '../../utils/ride-validation';
import { Ride, Booking } from '../../types';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Create a mock ride with sensible defaults
 */
const createMockRide = (overrides: Partial<Ride> = {}): Ride => ({
    id: 'ride-123',
    driverId: 'driver-123',
    status: 'upcoming',
    departureTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
    origin: { name: 'Sydney CBD', lat: -33.8688, lng: 151.2093 },
    destination: { name: 'Bondi Beach', lat: -33.8908, lng: 151.2743 },
    pricePerSeat: 1500, // $15.00
    availableSeats: 3,
    passengers: [],
    createdAt: new Date().toISOString(),
    ...overrides,
} as Ride);

/**
 * Create a mock booking with sensible defaults
 */
const createMockBooking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 'booking-123',
    rideId: 'ride-123',
    riderId: 'rider-123',
    driverId: 'driver-123',
    status: 'pending_driver',
    seats: 1,
    amountTotal: 2000, // $20.00
    createdAt: new Date().toISOString(),
    ...overrides,
} as Booking);

// ============================================================================
// RIDE EDITING TESTS
// ============================================================================

describe('canEditRide', () => {
    it('should allow full editing for upcoming rides with no bookings', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const result = canEditRide(ride, []);

        expect(result.allowed).toBe(true);
        expect(result.limitedEdit).toBeUndefined();
    });

    it('should enforce limited editing when pending bookings exist', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [createMockBooking({ status: 'pending_driver' })];
        const result = canEditRide(ride, bookings);

        expect(result.allowed).toBe(true);
        expect(result.limitedEdit).toBe(true);
        expect(result.editableFields).toEqual(['notes', 'availableSeats']);
        expect(result.reason).toContain('pending');
    });

    it('should enforce limited editing when confirmed bookings exist', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [createMockBooking({ status: 'confirmed' })];
        const result = canEditRide(ride, bookings);

        expect(result.allowed).toBe(true);
        expect(result.limitedEdit).toBe(true);
        expect(result.editableFields).toEqual(['notes', 'availableSeats']);
        expect(result.reason).toContain('confirmed');
    });

    it('should not allow editing active rides', () => {
        const ride = createMockRide({ status: 'active' });
        const result = canEditRide(ride, []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('active');
    });

    it('should not allow editing completed rides', () => {
        const ride = createMockRide({ status: 'completed' });
        const result = canEditRide(ride, []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('completed');
    });

    it('should not allow editing cancelled rides', () => {
        const ride = createMockRide({ status: 'cancelled' });
        const result = canEditRide(ride, []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('cancelled');
    });

    it('should handle mix of pending and confirmed bookings', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [
            createMockBooking({ status: 'pending_driver', id: 'b1' }),
            createMockBooking({ status: 'confirmed', id: 'b2' }),
        ];
        const result = canEditRide(ride, bookings);

        expect(result.allowed).toBe(true);
        expect(result.limitedEdit).toBe(true);
        expect(result.reason).toContain('1 confirmed');
        expect(result.reason).toContain('1 pending');
    });

    it('should ignore cancelled/declined bookings when checking edit permissions', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [
            createMockBooking({ status: 'cancelled' }),
            createMockBooking({ status: 'declined' }),
        ];
        const result = canEditRide(ride, bookings);

        expect(result.allowed).toBe(true);
        expect(result.limitedEdit).toBeUndefined();
    });
});

// ============================================================================
// RIDE DELETION TESTS
// ============================================================================

describe('canDeleteRide', () => {
    it('should allow deleting upcoming rides with no bookings', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const result = canDeleteRide(ride, []);

        expect(result.allowed).toBe(true);
        expect(result.warning).toBeUndefined();
    });

    it('should warn when deleting a ride with pending bookings', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [
            createMockBooking({ status: 'pending_driver', id: 'b1' }),
            createMockBooking({ status: 'pending_driver', id: 'b2' }),
        ];
        const result = canDeleteRide(ride, bookings);

        expect(result.allowed).toBe(true);
        expect(result.warning).toContain('2 pending');
    });

    it('should NOT allow deleting rides with confirmed bookings', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [createMockBooking({ status: 'confirmed' })];
        const result = canDeleteRide(ride, bookings);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('confirmed');
        expect(result.reason).toContain('Cancel the ride instead');
    });

    it('should not allow deleting active rides', () => {
        const ride = createMockRide({ status: 'active' });
        const result = canDeleteRide(ride, []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Cancel the ride instead');
    });

    it('should not allow deleting completed rides', () => {
        const ride = createMockRide({ status: 'completed' });
        const result = canDeleteRide(ride, []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('historical records');
    });

    it('should not allow deleting already cancelled rides', () => {
        const ride = createMockRide({ status: 'cancelled' });
        const result = canDeleteRide(ride, []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('already been cancelled');
    });
});

// ============================================================================
// RIDE CANCELLATION TESTS
// ============================================================================

describe('canCancelRide', () => {
    it('should allow cancelling upcoming rides without warning if >24h away', () => {
        const ride = createMockRide({
            status: 'upcoming',
            departureTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });
        const result = canCancelRide(ride);

        expect(result.allowed).toBe(true);
        expect(result.warning).toBeUndefined();
    });

    it('should warn when cancelling within 24 hours of departure', () => {
        const ride = createMockRide({
            status: 'upcoming',
            departureTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
        });
        const result = canCancelRide(ride);

        expect(result.allowed).toBe(true);
        expect(result.warning).toContain('24 hours');
        expect(result.warning).toContain('rating');
    });

    it('should allow cancelling active rides with warning', () => {
        const ride = createMockRide({ status: 'active' });
        const result = canCancelRide(ride);

        expect(result.allowed).toBe(true);
        expect(result.warning).toContain('active ride');
        expect(result.warning).toContain('full refunds');
    });

    it('should not allow cancelling completed rides', () => {
        const ride = createMockRide({ status: 'completed' });
        const result = canCancelRide(ride);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('completed');
    });

    it('should not allow cancelling already cancelled rides', () => {
        const ride = createMockRide({ status: 'cancelled' });
        const result = canCancelRide(ride);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('already been cancelled');
    });

    it('should warn when ride departure time has passed', () => {
        const ride = createMockRide({
            status: 'upcoming',
            departureTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        });
        const result = canCancelRide(ride);

        expect(result.allowed).toBe(true);
        expect(result.warning).toContain('already started');
    });
});

// ============================================================================
// RIDE START TESTS
// ============================================================================

describe('canStartRide', () => {
    it('should allow starting upcoming rides with confirmed bookings', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [createMockBooking({ status: 'confirmed' })];
        const result = canStartRide(ride, bookings);

        expect(result.allowed).toBe(true);
    });

    it('should NOT allow starting rides without confirmed bookings', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const result = canStartRide(ride, []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('no confirmed passengers');
    });

    it('should NOT allow starting rides with only pending bookings', () => {
        const ride = createMockRide({ status: 'upcoming' });
        const bookings = [createMockBooking({ status: 'pending_driver' })];
        const result = canStartRide(ride, bookings);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('no confirmed passengers');
    });

    it('should not allow starting active rides', () => {
        const ride = createMockRide({ status: 'active' });
        const bookings = [createMockBooking({ status: 'confirmed' })];
        const result = canStartRide(ride, bookings);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('active');
    });
});

// ============================================================================
// BOOKING ACCEPT/DECLINE TESTS
// ============================================================================

describe('canAcceptBooking', () => {
    it('should allow accepting pending_driver bookings', () => {
        const booking = createMockBooking({ status: 'pending_driver' });
        const result = canAcceptBooking(booking);

        expect(result.allowed).toBe(true);
    });

    it('should not allow accepting already confirmed bookings', () => {
        const booking = createMockBooking({ status: 'confirmed' });
        const result = canAcceptBooking(booking);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('confirmed');
    });

    it('should not allow accepting cancelled bookings', () => {
        const booking = createMockBooking({ status: 'cancelled' });
        const result = canAcceptBooking(booking);

        expect(result.allowed).toBe(false);
    });
});

describe('canDeclineBooking', () => {
    it('should allow declining pending_driver bookings', () => {
        const booking = createMockBooking({ status: 'pending_driver' });
        const result = canDeclineBooking(booking);

        expect(result.allowed).toBe(true);
    });

    it('should not allow declining already confirmed bookings', () => {
        const booking = createMockBooking({ status: 'confirmed' });
        const result = canDeclineBooking(booking);

        expect(result.allowed).toBe(false);
    });
});

// ============================================================================
// BOOKING CANCELLATION & FEE TESTS
// ============================================================================

describe('canCancelBooking', () => {
    it('should allow cancelling pending bookings with no fee', () => {
        const booking = createMockBooking({ status: 'pending_driver' });
        const ride = createMockRide({ status: 'upcoming' });
        const result = canCancelBooking(booking, ride);

        expect(result.allowed).toBe(true);
        expect(result.feePercent).toBe(0);
        expect(result.feeAmount).toBe(0);
    });

    it('should calculate 5% fee for confirmed bookings >24h before departure', () => {
        const booking = createMockBooking({ status: 'confirmed', amountTotal: 2000 });
        const ride = createMockRide({
            status: 'upcoming',
            departureTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h
        });
        const result = canCancelBooking(booking, ride);

        expect(result.allowed).toBe(true);
        expect(result.feePercent).toBe(5);
        expect(result.feeAmount).toBe(100); // 5% of $20 = $1
    });

    it('should calculate 25% fee for cancellations 12-24h before departure', () => {
        const booking = createMockBooking({ status: 'confirmed', amountTotal: 2000 });
        const ride = createMockRide({
            status: 'upcoming',
            departureTime: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), // 18h
        });
        const result = canCancelBooking(booking, ride);

        expect(result.allowed).toBe(true);
        expect(result.feePercent).toBe(25);
        expect(result.feeAmount).toBe(500); // 25% of $20 = $5
    });

    it('should calculate 50% fee for cancellations <12h before departure', () => {
        const booking = createMockBooking({ status: 'confirmed', amountTotal: 2000 });
        const ride = createMockRide({
            status: 'upcoming',
            departureTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6h
        });
        const result = canCancelBooking(booking, ride);

        expect(result.allowed).toBe(true);
        expect(result.feePercent).toBe(50);
        expect(result.feeAmount).toBe(1000); // 50% of $20 = $10
    });

    it('should calculate 100% fee (no refund) for past departure time', () => {
        const booking = createMockBooking({ status: 'confirmed', amountTotal: 2000 });
        const ride = createMockRide({
            status: 'upcoming',
            departureTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
        });
        const result = canCancelBooking(booking, ride);

        expect(result.allowed).toBe(true);
        expect(result.feePercent).toBe(100);
        expect(result.feeAmount).toBe(2000); // 100% = no refund
    });

    it('should not allow cancelling bookings for active rides', () => {
        const booking = createMockBooking({ status: 'confirmed' });
        const ride = createMockRide({ status: 'active' });
        const result = canCancelBooking(booking, ride);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('in progress');
    });

    it('should not allow cancelling completed bookings', () => {
        const booking = createMockBooking({ status: 'completed' });
        const ride = createMockRide({ status: 'completed' });
        const result = canCancelBooking(booking, ride);

        expect(result.allowed).toBe(false);
    });

    it('should not allow cancelling already cancelled bookings', () => {
        const booking = createMockBooking({ status: 'cancelled' });
        const ride = createMockRide({ status: 'upcoming' });
        const result = canCancelBooking(booking, ride);

        expect(result.allowed).toBe(false);
    });
});

// ============================================================================
// STATUS TEXT TESTS
// ============================================================================

describe('getRideStatusText', () => {
    it('should return correct text for all ride statuses', () => {
        expect(getRideStatusText('upcoming')).toBe('Upcoming');
        expect(getRideStatusText('active')).toBe('In Progress');
        expect(getRideStatusText('completed')).toBe('Completed');
        expect(getRideStatusText('cancelled')).toBe('Cancelled');
    });

    it('should return raw status for unknown values', () => {
        expect(getRideStatusText('unknown_status')).toBe('unknown_status');
    });
});

describe('getBookingStatusText', () => {
    it('should return correct text for all booking statuses', () => {
        expect(getBookingStatusText('pending_driver')).toBe('Awaiting Driver Response');
        expect(getBookingStatusText('confirmed')).toBe('Confirmed');
        expect(getBookingStatusText('declined')).toBe('Declined by Driver');
        expect(getBookingStatusText('cancelled')).toBe('Cancelled');
        expect(getBookingStatusText('cancelled_by_rider')).toBe('Cancelled by You');
        expect(getBookingStatusText('cancelled_by_driver')).toBe('Cancelled by Driver');
        expect(getBookingStatusText('completed')).toBe('Completed');
        expect(getBookingStatusText('no_show')).toBe('No Show');
    });

    it('should return raw status for unknown values', () => {
        expect(getBookingStatusText('unknown_status')).toBe('unknown_status');
    });
});
