// Mock config/firebase before importing RidesService
jest.mock('../../config/firebase', () => ({
    db: {},
    auth: { currentUser: null },
    storage: {},
}));

import { RidesService } from '../../services/rides';
import { getDoc, updateDoc, getDocs } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore');

describe('RidesService.updateRide', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockDriver = {
        id: 'driver123',
        name: 'John Driver',
        email: 'driver@example.com',
    };

    const mockRide = {
        id: 'ride123',
        driverId: 'driver123',
        status: 'upcoming',
        from: { id: 'loc1', name: 'Sydney', address: '123 Street', latitude: -33.8688, longitude: 151.2093 },
        to: { id: 'loc2', name: 'Melbourne', address: '456 Road', latitude: -37.8136, longitude: 144.9631 },
        departureTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        pricePerSeat: 5000, // $50 in cents
        seatsTotal: 4,
        availableSeats: 4,
    };

    describe('Authorization', () => {
        it('should reject update for non-existent ride', async () => {
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => false,
                data: () => null,
            });

            await expect(
                RidesService.updateRide('nonexistent-ride', 'driver123', { pricePerSeat: 6000 })
            ).rejects.toThrow('Ride not found');
        });

        it('should reject update when user is not the driver', async () => {
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockRide,
            });

            await expect(
                RidesService.updateRide('ride123', 'other-user', { pricePerSeat: 6000 })
            ).rejects.toThrow('You can only edit your own rides');
        });
    });

    describe('Status validation', () => {
        it('should reject update for active rides', async () => {
            const activeRide = { ...mockRide, status: 'active' };
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => activeRide,
            });

            await expect(
                RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 6000 })
            ).rejects.toThrow('Cannot edit a ride that is active');
        });

        it('should reject update for completed rides', async () => {
            const completedRide = { ...mockRide, status: 'completed' };
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => completedRide,
            });

            await expect(
                RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 6000 })
            ).rejects.toThrow('Cannot edit a ride that is completed');
        });

        it('should reject update for cancelled rides', async () => {
            const cancelledRide = { ...mockRide, status: 'cancelled' };
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => cancelledRide,
            });

            await expect(
                RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 6000 })
            ).rejects.toThrow('Cannot edit a ride that is cancelled');
        });
    });

    describe('Booking validation', () => {
        it('should reject update when confirmed bookings exist', async () => {
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockRide,
            });

            // Mock getRideBookings with confirmed booking
            // The function uses forEach to iterate the docs
            const mockBookingData = {
                rideId: 'ride123',
                driverId: 'driver123',
                status: 'confirmed',
                seats: 2,
            };

            const mockBookingsSnapshot = {
                empty: false,
                docs: [{
                    id: 'booking1',
                    data: () => mockBookingData,
                }],
                forEach: (callback: (doc: any) => void) => {
                    callback({
                        id: 'booking1',
                        data: () => mockBookingData,
                    });
                },
            };
            (getDocs as jest.Mock).mockResolvedValue(mockBookingsSnapshot);

            await expect(
                RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 6000 })
            ).rejects.toThrow('Cannot edit ride with pending or confirmed bookings');
        });
    });

    describe('Field validation', () => {
        beforeEach(() => {
            // Setup for successful ride fetch
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockRide,
            });

            // No bookings
            (getDocs as jest.Mock).mockResolvedValue({
                empty: true,
                docs: [],
                forEach: () => { },
            });

            (updateDoc as jest.Mock).mockResolvedValue(undefined);
        });

        it('should reject price less than or equal to zero', async () => {
            await expect(
                RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 0 })
            ).rejects.toThrow('Price must be greater than zero');

            // Reset mocks for second assertion
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockRide,
            });
            (getDocs as jest.Mock).mockResolvedValueOnce({
                empty: true,
                docs: [],
                forEach: () => { },
            });

            await expect(
                RidesService.updateRide('ride123', 'driver123', { pricePerSeat: -100 })
            ).rejects.toThrow('Price must be greater than zero');
        });

        it('should reject price exceeding maximum ($1000)', async () => {
            await expect(
                RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 100001 })
            ).rejects.toThrow('Price cannot exceed $1,000');
        });

        it('should reject seats outside valid range (1-8)', async () => {
            // Reset mocks for first assertion
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockRide,
            });
            (getDocs as jest.Mock).mockResolvedValueOnce({
                empty: true,
                docs: [],
                forEach: () => { },
            });

            await expect(
                RidesService.updateRide('ride123', 'driver123', { seatsTotal: 0 })
            ).rejects.toThrow('Available seats must be between 1 and 8');

            // Reset mocks for second assertion
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockRide,
            });
            (getDocs as jest.Mock).mockResolvedValueOnce({
                empty: true,
                docs: [],
                forEach: () => { },
            });

            await expect(
                RidesService.updateRide('ride123', 'driver123', { seatsTotal: 9 })
            ).rejects.toThrow('Available seats must be between 1 and 8');
        });

        it('should reject departure time in the past', async () => {
            const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

            await expect(
                RidesService.updateRide('ride123', 'driver123', { departureTime: pastTime })
            ).rejects.toThrow('Departure time must be at least 5 minutes in the future');
        });

        it('should reject invalid origin location data', async () => {
            const invalidOrigin = { id: 'loc', name: '', address: '', latitude: 0, longitude: 0 };

            await expect(
                RidesService.updateRide('ride123', 'driver123', { origin: invalidOrigin as any })
            ).rejects.toThrow('Invalid origin location data');
        });

        it('should reject invalid destination location data', async () => {
            const invalidDest = { id: 'loc', name: 'Test', address: '', latitude: 'invalid', longitude: 0 };

            await expect(
                RidesService.updateRide('ride123', 'driver123', { destination: invalidDest as any })
            ).rejects.toThrow('Invalid destination location data');
        });
    });

    describe('Successful updates', () => {
        beforeEach(() => {
            // Setup for successful ride fetch
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockRide,
            });

            // No bookings
            (getDocs as jest.Mock).mockResolvedValue({
                empty: true,
                docs: [],
                forEach: () => { },
            });

            (updateDoc as jest.Mock).mockResolvedValue(undefined);
        });

        it('should update price successfully', async () => {
            await expect(
                RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 7500 })
            ).resolves.toBeUndefined();

            expect(updateDoc).toHaveBeenCalled();
            const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
            expect(updateCall.pricePerSeat).toBe(7500);
        });

        it('should round price to cents', async () => {
            await RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 5555.6 });

            const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
            expect(updateCall.pricePerSeat).toBe(5556); // Rounded
        });

        it('should update seats successfully', async () => {
            await RidesService.updateRide('ride123', 'driver123', { seatsTotal: 3 });

            const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
            expect(updateCall.seatsTotal).toBe(3);
            expect(updateCall.availableSeats).toBe(3);
            expect(updateCall.seatsAvailable).toBe(3);
        });

        it('should update notes with trimming and max length', async () => {
            const longNote = 'A'.repeat(600); // 600 chars
            await RidesService.updateRide('ride123', 'driver123', { notes: longNote });

            const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
            expect(updateCall.note.length).toBe(500); // Truncated
        });

        it('should include updatedAt timestamp', async () => {
            await RidesService.updateRide('ride123', 'driver123', { pricePerSeat: 6000 });

            const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
            expect(updateCall.updatedAt).toBeDefined();
        });

        it('should update origin location', async () => {
            const newOrigin = {
                id: 'loc3',
                name: 'Brisbane',
                address: '789 Ave',
                latitude: -27.4698,
                longitude: 153.0251,
            };

            await RidesService.updateRide('ride123', 'driver123', { origin: newOrigin });

            const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
            expect(updateCall.from).toEqual(newOrigin);
            expect(updateCall.origin).toEqual(newOrigin);
        });

        it('should update destination location', async () => {
            const newDest = {
                id: 'loc4',
                name: 'Perth',
                address: '101 Way',
                latitude: -31.9505,
                longitude: 115.8605,
            };

            await RidesService.updateRide('ride123', 'driver123', { destination: newDest });

            const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
            expect(updateCall.to).toEqual(newDest);
            expect(updateCall.destination).toEqual(newDest);
        });

        it('should update departure time', async () => {
            const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

            await RidesService.updateRide('ride123', 'driver123', { departureTime: futureTime });

            const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
            expect(updateCall.departureTime).toBe(futureTime);
            expect(updateCall.departureAt).toBe(futureTime);
        });
    });
});
