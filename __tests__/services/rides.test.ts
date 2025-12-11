import { RidesService } from '../../services/rides';
import { db } from '../../config/firebase';
import { getDocs, getDoc, addDoc, query, where, collection } from 'firebase/firestore';

// Mock Firebase
jest.mock('../../config/firebase');
jest.mock('firebase/firestore');

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
                    departureTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                    from: { name: 'Sydney' },
                    to: { name: 'Melbourne' },
                },
                {
                    id: 'ride2',
                    status: 'upcoming',
                    availableSeats: 0, // Should be filtered out
                    departureTime: new Date(Date.now() + 86400000).toISOString(),
                    from: { name: 'Sydney' },
                    to: { name: 'Brisbane' },
                },
                {
                    id: 'ride3',
                    status: 'upcoming',
                    availableSeats: 2,
                    departureTime: new Date(Date.now() - 86400000).toISOString(), // Past - should be filtered
                    from: { name: 'Sydney' },
                    to: { name: 'Canberra' },
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

            // Should only return ride1 (future + available seats)
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ride1');
            expect(result[0].availableSeats).toBe(3);
        });

        it('should sort rides by departure time', async () => {
            const mockRides = [
                {
                    id: 'ride2',
                    status: 'upcoming',
                    availableSeats: 1,
                    departureTime: new Date(Date.now() + 172800000).toISOString(), // 2 days
                    from: { name: 'A' },
                    to: { name: 'B' },
                },
                {
                    id: 'ride1',
                    status: 'upcoming',
                    availableSeats: 1,
                    departureTime: new Date(Date.now() + 86400000).toISOString(), // 1 day
                    from: { name: 'A' },
                    to: { name: 'B' },
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

            // Should be sorted by departure time (ride1 before ride2)
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('ride1');
            expect(result[1].id).toBe('ride2');
        });

        it('should handle errors gracefully', async () => {
            (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));
            import { RidesService } from '../../services/rides';
            import { db } from '../../config/firebase';
            import { getDocs, query, where, collection } from 'firebase/firestore';

            // Mock Firebase
            jest.mock('../../config/firebase');
            jest.mock('firebase/firestore');

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
                                departureTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                                from: { name: 'Sydney' },
                                to: { name: 'Melbourne' },
                            },
                            {
                                id: 'ride2',
                                status: 'upcoming',
                                availableSeats: 0, // Should be filtered out
                                departureTime: new Date(Date.now() + 86400000).toISOString(),
                                from: { name: 'Sydney' },
                                to: { name: 'Brisbane' },
                            },
                            {
                                id: 'ride3',
                                status: 'upcoming',
                                availableSeats: 2,
                                departureTime: new Date(Date.now() - 86400000).toISOString(), // Past - should be filtered
                                from: { name: 'Sydney' },
                                to: { name: 'Canberra' },
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

                        // Should only return ride1 (future + available seats)
                        expect(result).toHaveLength(1);
                        expect(result[0].id).toBe('ride1');
                        expect(result[0].availableSeats).toBe(3);
                    });

                    it('should sort rides by departure time', async () => {
                        const mockRides = [
                            {
                                id: 'ride2',
                                status: 'upcoming',
                                availableSeats: 1,
                                departureTime: new Date(Date.now() + 172800000).toISOString(), // 2 days
                                from: { name: 'A' },
                                to: { name: 'B' },
                            },
                            {
                                id: 'ride1',
                                status: 'upcoming',
                                availableSeats: 1,
                                departureTime: new Date(Date.now() + 86400000).toISOString(), // 1 day
                                from: { name: 'A' },
                                to: { name: 'B' },
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

                        // Should be sorted by departure time (ride1 before ride2)
                        expect(result).toHaveLength(2);
                        expect(result[0].id).toBe('ride1');
                        expect(result[1].id).toBe('ride2');
                    });

                    it('should handle errors gracefully', async () => {
                        (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

                        await expect(RidesService.getAllAvailableRides()).rejects.toThrow('Failed to get available rides');
                    });
                });

                describe('createBookingRequest', () => {
                    it('should prevent duplicate bookings', async () => {
                        const mockRideData = {
                            id: 'ride123',
                            driverId: 'driver456',
                            pricePerSeat: 5000,
                            availableSeats: 3,
                            status: 'upcoming',
                        };

                        const mockExistingBooking = {
                            id: 'booking789',
                            status: 'pending_driver',
                        };

                        // Mock ride exists
                        (getDoc as jest.Mock).mockResolvedValueOnce({
                            exists: () => true,
                            data: () => mockRideData,
                        });

                        // Mock existing booking found
                        const mockBookingsSnapshot = {
                            forEach: (callback: any) => [mockExistingBooking].forEach((booking) => callback({
                                id: booking.id,
                                data: () => booking,
                            })),
                        };
                        (getDocs as jest.Mock).mockResolvedValue(mockBookingsSnapshot);

                        await expect(
                            RidesService.createBookingRequest('ride123', 'passenger999', 2, {})
                        ).rejects.toThrow('You already have a pending approval booking for this ride');
                    });

                    it('should validate seat availability', async () => {
                        const mockRideData = {
                            id: 'ride123',
                            driverId: 'driver456',
                            pricePerSeat: 5000,
                            availableSeats: 1, // Only 1 seat available
                            status: 'upcoming',
                        };

                        (getDoc as jest.Mock).mockResolvedValueOnce({
                            exists: () => true,
                            data: () => mockRideData,
                        });

                        // No existing bookings
                        (getDocs as jest.Mock).mockResolvedValue({ forEach: () => { } });

                        await expect(
                            RidesService.createBookingRequest('ride123', 'passenger999', 2, {}) // Requesting 2 seats
                        ).rejects.toThrow('Only 1 seats available');
                    });

                    it('should prevent user from booking own ride', async () => {
                        const mockRideData = {
                            id: 'ride123',
                            driverId: 'user999', // Same as passenger
                            pricePerSeat: 5000,
                            availableSeats: 3,
                            status: 'upcoming',
                        };

                        (getDoc as jest.Mock).mockResolvedValueOnce({
                            exists: () => true,
                            data: () => mockRideData,
                        });

                        await expect(
                            RidesService.createBookingRequest('ride123', 'user999', 2, {})
                        ).rejects.toThrow('You cannot book your own ride');
                    });

                    it('should calculate correct booking amount', async () => {
                        const mockRideData = {
                            id: 'ride123',
                            driverId: 'driver456',
                            pricePerSeat: 5000, // $50 in cents
                            availableSeats: 3,
                            status: 'upcoming',
                        };

                        (getDoc as jest.Mock).mockResolvedValueOnce({
                            exists: () => true,
                            data: () => mockRideData,
                        });

                        // No existing bookings
                        (getDocs as jest.Mock).mockResolvedValue({ forEach: () => { } });

                        const mockAddDoc = jest.fn().mockResolvedValue({ id: 'booking123' });
                        (addDoc as any) = mockAddDoc;

                        await RidesService.createBookingRequest('ride123', 'passenger999', 2, {
                            name: 'Test Passenger',
                            email: 'test@example.com',
                        });

                        // Verify booking was created with correct amount
                        expect(mockAddDoc).toHaveBeenCalled();
                        const bookingData = mockAddDoc.mock.calls[0][1];
                        expect(bookingData.amountTotal).toBe(10000); // 5000 * 2 seats
                    });
                });

                describe('getUserRides', () => {
                    it('should return rides for specific driver', async () => {
                        const mockRides = [
                            {
                                id: 'ride1',
                                driverId: 'driver123',
                                from: { name: 'Sydney' },
                                to: { name: 'Melbourne' },
                                createdAt: { toDate: () => new Date('2024-01-02') },
                            },
                            {
                                id: 'ride2',
                                driverId: 'driver123',
                                from: { name: 'Sydney' },
                                to: { name: 'Brisbane' },
                                createdAt: { toDate: () => new Date('2024-01-01') },
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
                        // Should be sorted by createdAt descending
                        expect(result[0].id).toBe('ride1');
                        expect(result[1].id).toBe('ride2');
                    });
                });
            });
