/**
 * Payment Service Tests
 *
 * Tests for the PaymentService class covering fee calculations,
 * earnings tracking, and payment history functionality.
 */

import { PaymentService } from '../../services/payment';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    setDoc: jest.fn(() => Promise.resolve()),
    getDoc: jest.fn(() => Promise.resolve({
        exists: () => true,
        data: () => ({})
    })),
    getDocs: jest.fn(() => Promise.resolve({
        empty: false,
        docs: [],
        forEach: jest.fn()
    })),
    addDoc: jest.fn(() => Promise.resolve({ id: 'mock-payment-id' })),
    updateDoc: jest.fn(() => Promise.resolve()),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    serverTimestamp: jest.fn(() => new Date())
}));

jest.mock('../../config/firebase', () => ({
    auth: {
        currentUser: {
            uid: 'test-user-123',
            getIdToken: jest.fn(() => Promise.resolve('mock-token'))
        }
    },
    db: {}
}));

// Mock fetch for API calls
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
            clientSecret: 'mock_client_secret',
            paymentIntentId: 'pi_mock_123',
            paymentMethods: []
        }),
    })
) as jest.Mock;

describe('PaymentService Fee Calculations', () => {
    describe('calculatePlatformFee', () => {
        it('should return flat $5 platform fee', () => {
            expect(PaymentService.calculatePlatformFee(100)).toBe(5);
            expect(PaymentService.calculatePlatformFee(50)).toBe(5);
            expect(PaymentService.calculatePlatformFee(25)).toBe(5);
        });

        it('should return $5 regardless of amount', () => {
            expect(PaymentService.calculatePlatformFee(0)).toBe(5);
            expect(PaymentService.calculatePlatformFee(1000)).toBe(5);
        });
    });

    describe('calculateTotalAmount', () => {
        it('should add $5 platform fee to base amount', () => {
            expect(PaymentService.calculateTotalAmount(100)).toBe(105);
            expect(PaymentService.calculateTotalAmount(50)).toBe(55);
        });

        it('should add $5 even to zero amount', () => {
            expect(PaymentService.calculateTotalAmount(0)).toBe(5);
        });
    });

    describe('calculateDriverPayout', () => {
        it('should subtract $5 platform fee from amount', () => {
            expect(PaymentService.calculateDriverPayout(100)).toBe(95);
            expect(PaymentService.calculateDriverPayout(50)).toBe(45);
        });

        it('should result in negative for small amounts', () => {
            expect(PaymentService.calculateDriverPayout(3)).toBe(-2);
        });
    });
});

describe('PaymentService Payment Operations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockClear();
    });

    describe('createPaymentIntent', () => {
        it('should create payment intent and return client secret', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    clientSecret: 'cs_test_123',
                    paymentIntentId: 'pi_test_123'
                })
            });

            const result = await PaymentService.createPaymentIntent(50.00, 'usd');

            expect(result.clientSecret).toBe('cs_test_123');
            expect(result.paymentIntentId).toBe('pi_test_123');
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('create-payment-intent'),
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        });

        it('should convert amount to cents', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    clientSecret: 'cs_test',
                    paymentIntentId: 'pi_test'
                })
            });

            await PaymentService.createPaymentIntent(25.50, 'usd');

            const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
            expect(callBody.amount).toBe(2550); // 25.50 * 100
        });

        it('should throw error on failed response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ error: 'Payment failed' })
            });

            await expect(PaymentService.createPaymentIntent(50.00))
                .rejects.toThrow('Failed to create payment intent');
        });
    });

    describe('processRefund', () => {
        it('should return true on successful refund', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

            const result = await PaymentService.processRefund('pi_test_123');

            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('process-refund'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should return false on failed refund', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

            const result = await PaymentService.processRefund('pi_test_123');

            expect(result).toBe(false);
        });

        it('should handle partial refund amount', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

            await PaymentService.processRefund('pi_test_123', 25.00);

            const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
            expect(callBody.amount).toBe(2500); // 25.00 * 100
        });
    });

    describe('deletePaymentMethod', () => {
        it('should return true on successful deletion', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

            const result = await PaymentService.deletePaymentMethod('pm_test_123');

            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('pm_test_123'),
                { method: 'DELETE' }
            );
        });

        it('should return false on failed deletion', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

            const result = await PaymentService.deletePaymentMethod('pm_test_123');

            expect(result).toBe(false);
        });
    });
});

describe('PaymentService Earnings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should calculate driver earnings correctly', async () => {
        const { getDocs } = require('firebase/firestore');

        const now = Date.now();
        const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
        const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

        getDocs.mockResolvedValueOnce({
            forEach: (callback: Function) => {
                // Payment from 8 days ago (available)
                callback({
                    data: () => ({
                        driverPayout: 45.00,
                        completedAt: eightDaysAgo,
                        createdAt: eightDaysAgo
                    })
                });
                // Payment from 3 days ago (pending)
                callback({
                    data: () => ({
                        driverPayout: 27.00,
                        completedAt: threeDaysAgo,
                        createdAt: threeDaysAgo
                    })
                });
            }
        });

        const earnings = await PaymentService.getDriverEarnings('driver-123');

        expect(earnings.total).toBe(72.00);
        expect(earnings.available).toBe(45.00);
        expect(earnings.pending).toBe(27.00);
    });

    it('should return zeros on error', async () => {
        const { getDocs } = require('firebase/firestore');
        getDocs.mockRejectedValueOnce(new Error('Database error'));

        const earnings = await PaymentService.getDriverEarnings('driver-123');

        expect(earnings).toEqual({ total: 0, pending: 0, available: 0 });
    });
});

describe('PaymentService Payment History', () => {
    it('should return empty array when no payments found', async () => {
        const { getDocs } = require('firebase/firestore');

        getDocs.mockResolvedValueOnce({
            forEach: jest.fn()
        });

        const history = await PaymentService.getPaymentHistory('user-123');

        expect(history).toEqual([]);
    });

    it('should return payment transactions', async () => {
        const { getDocs } = require('firebase/firestore');

        getDocs.mockResolvedValueOnce({
            forEach: (callback: Function) => {
                callback({
                    id: 'payment-1',
                    data: () => ({
                        rideId: 'ride-1',
                        amount: 50,
                        status: 'completed'
                    })
                });
                callback({
                    id: 'payment-2',
                    data: () => ({
                        rideId: 'ride-2',
                        amount: 30,
                        status: 'completed'
                    })
                });
            }
        });

        const history = await PaymentService.getPaymentHistory('user-123');

        expect(history.length).toBe(2);
        expect(history[0].id).toBe('payment-1');
        expect(history[1].id).toBe('payment-2');
    });
});
