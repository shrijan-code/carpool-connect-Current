import { validateRideEditPermissions } from '../../utils/validation';

describe('validateRideEditPermissions', () => {
    describe('Ownership validation', () => {
        it('should allow edit for ride owner', () => {
            const ride = { driverId: 'user123', status: 'upcoming' };
            const result = validateRideEditPermissions(ride, 'user123', false);

            expect(result.canEdit).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should deny edit for non-owner', () => {
            const ride = { driverId: 'user123', status: 'upcoming' };
            const result = validateRideEditPermissions(ride, 'other-user', false);

            expect(result.canEdit).toBe(false);
            expect(result.reason).toBe('You can only edit your own rides');
        });
    });

    describe('Status validation', () => {
        it('should allow edit for upcoming rides', () => {
            const ride = { driverId: 'user123', status: 'upcoming' };
            const result = validateRideEditPermissions(ride, 'user123', false);

            expect(result.canEdit).toBe(true);
        });

        it('should deny edit for active rides', () => {
            const ride = { driverId: 'user123', status: 'active' };
            const result = validateRideEditPermissions(ride, 'user123', false);

            expect(result.canEdit).toBe(false);
            expect(result.reason).toContain('Cannot edit a active ride');
        });

        it('should deny edit for completed rides', () => {
            const ride = { driverId: 'user123', status: 'completed' };
            const result = validateRideEditPermissions(ride, 'user123', false);

            expect(result.canEdit).toBe(false);
            expect(result.reason).toContain('Cannot edit a completed ride');
        });

        it('should deny edit for cancelled rides', () => {
            const ride = { driverId: 'user123', status: 'cancelled' };
            const result = validateRideEditPermissions(ride, 'user123', false);

            expect(result.canEdit).toBe(false);
            expect(result.reason).toContain('Cannot edit a cancelled ride');
        });
    });

    describe('Booking validation', () => {
        it('should allow edit when no confirmed bookings', () => {
            const ride = { driverId: 'user123', status: 'upcoming' };
            const result = validateRideEditPermissions(ride, 'user123', false);

            expect(result.canEdit).toBe(true);
        });

        it('should deny edit when confirmed bookings exist', () => {
            const ride = { driverId: 'user123', status: 'upcoming' };
            const result = validateRideEditPermissions(ride, 'user123', true);

            expect(result.canEdit).toBe(false);
            expect(result.reason).toBe('Cannot edit ride with confirmed bookings');
        });
    });

    describe('Combined validation', () => {
        it('should check ownership before status', () => {
            // Even if status is valid, wrong owner should fail first
            const ride = { driverId: 'user123', status: 'upcoming' };
            const result = validateRideEditPermissions(ride, 'other-user', false);

            expect(result.canEdit).toBe(false);
            expect(result.reason).toBe('You can only edit your own rides');
        });

        it('should check status before bookings', () => {
            // Even if no bookings, wrong status should fail
            const ride = { driverId: 'user123', status: 'active' };
            const result = validateRideEditPermissions(ride, 'user123', false);

            expect(result.canEdit).toBe(false);
            expect(result.reason).toContain('Cannot edit a active ride');
        });

        it('should pass all checks for valid edit scenario', () => {
            const ride = { driverId: 'user123', status: 'upcoming' };
            const result = validateRideEditPermissions(ride, 'user123', false);

            expect(result.canEdit).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should fail when all conditions fail', () => {
            // Wrong owner, wrong status, and has bookings
            const ride = { driverId: 'user123', status: 'completed' };
            const result = validateRideEditPermissions(ride, 'other-user', true);

            expect(result.canEdit).toBe(false);
            // Should fail on ownership first
            expect(result.reason).toBe('You can only edit your own rides');
        });
    });
});
