// Mock config/firebase BEFORE imports
jest.mock('../../config/firebase', () => ({
    db: {},
}));
jest.mock('firebase/firestore');

import { RidesService } from '../../services/rides';
import { getDocs, getDoc, addDoc } from 'firebase/firestore';

describe('RidesService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAllAvailableRides', () => {
        it('should return only future rides with available seats', async () => {
            const mockRides = [
                {
                    id: 'ride1',
                    status: 'upcoming',
                    availableSeats: 3,
                    departureTime: new Date(Date.now() + 86400000).toISOString(),
                    origin: { name: 'Sydney' },
                    destination: { name: 'Melbourne' },
                },
                {
                    id: 'ride2',
                    status: 'upcoming',
                    availableSeats: 0, // Should be filtered out
                    departureTime: new Date(Date.now() + 86400000).toISOString(),
                    origin: { name: 'Sydney' },
                    destination: { name: 'Brisbane' },
                },
            ];

            const mockQuerySnapshot = {
                forEach: (callback: any) => mockRides.forEach((ride) => callback({
                    id: ride.id,
                    data: () => ({ ...ride }),
                })),
            };

            (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

            const result = await RidesService.getAllAvailableRides();

            // Should filter only rides with available seats
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ride1');
        });

        it('should handle errors gracefully', async () => {
            (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

            await expect(RidesService.getAllAvailableRides()).rejects.toThrow();
        });
    });

    describe('getRideById', () => {
        it('should return ride by ID', async () => {
            const mockRide = {
                id: 'ride123',
                driverId: 'driver456',
                origin: { name: 'Sydney' },
                destination: { name: 'Melbourne' },
                status: 'upcoming',
            };

            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                id: 'ride123',
                data: () => mockRide,
            });

            const result = await RidesService.getRideById('ride123');

            expect(result).toBeTruthy();
            expect(result?.id).toBe('ride123');
        });

        it('should return null for non-existent ride', async () => {
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => false,
            });

            const result = await RidesService.getRideById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('getUserRides', () => {
        it('should return rides for specific driver', async () => {
            const mockRides = [
                {
                    id: 'ride1',
                    driverId: 'driver123',
                    origin: { name: 'Sydney' },
                    destination: { name: 'Melbourne' },
                },
                {
                    id: 'ride2',
                    driverId: 'driver123',
                    origin: { name: 'Sydney' },
                    destination: { name: 'Brisbane' },
                },
            ];

            const mockQuerySnapshot = {
                forEach: (callback: any) => mockRides.forEach((ride) => callback({
                    id: ride.id,
                    data: () => ride,
                })),
            };

            (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

            const result = await RidesService.getUserRides('driver123');

            expect(result).toHaveLength(2);
        });
    });

    describe('createBookingRequest', () => {
        it('should create booking when valid', async () => {
            const mockRideData = {
                id: 'ride123',
                driverId: 'driver456',
                pricePerSeat: 5000,
                availableSeats: 3,
                status: 'upcoming',
            };

            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                data: () => mockRideData,
            });

            // No existing bookings
            (getDocs as jest.Mock).mockResolvedValue({
                forEach: () => { },
                docs: [],
            });

            const mockAddDoc = jest.fn().mockResolvedValue({ id: 'booking123' });
            (addDoc as jest.Mock).mockImplementation(mockAddDoc);

            const result = await RidesService.createBookingRequest(
                'ride123',
                'passenger999',
                2,
                { name: 'Test Passenger', email: 'test@example.com' }
            );

            expect(result).toBe('booking123');
            expect(addDoc).toHaveBeenCalled();
        });

        it('should reject booking for own ride', async () => {
            const mockRideData = {
                id: 'ride123',
                driverId: 'user999', // Same as passenger
                pricePerSeat: 5000,
                availableSeats: 3,
                status: 'upcoming',
            };

            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                data: () => mockRideData,
            });

            await expect(
                RidesService.createBookingRequest('ride123', 'user999', 2, {})
            ).rejects.toThrow();
        });

        it('should reject when not enough seats', async () => {
            const mockRideData = {
                id: 'ride123',
                driverId: 'driver456',
                pricePerSeat: 5000,
                availableSeats: 1, // Only 1 available
                status: 'upcoming',
            };

            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                data: () => mockRideData,
            });

            (getDocs as jest.Mock).mockResolvedValue({
                forEach: () => { },
                docs: [],
            });

            await expect(
                RidesService.createBookingRequest('ride123', 'passenger999', 2, {})
            ).rejects.toThrow();
        });
    });
});
