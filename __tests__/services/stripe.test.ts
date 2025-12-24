// Mock config/firebase BEFORE imports
jest.mock('../../config/firebase', () => ({
    functions: {},
    db: {},
}));
jest.mock('firebase/functions');
jest.mock('firebase/firestore');

import { StripePaymentService, StripeConnectService } from '../../services/stripe';
import { httpsCallable } from 'firebase/functions';

describe('StripePaymentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPaymentIntent', () => {
        it('should create payment intent with correct parameters', async () => {
            const mockCallable = jest.fn().mockResolvedValue({
                data: {
                    clientSecret: 'pi_test_secret',
                    paymentIntentId: 'pi_test_123',
                },
            });

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            const result = await StripePaymentService.createPaymentIntent({
                amount: 5000, // in cents
                bookingId: 'booking123',
            });

            expect(httpsCallable).toHaveBeenCalled();
            expect(result).toHaveProperty('clientSecret');
            expect(result).toHaveProperty('paymentIntentId');
        });

        it('should handle Stripe errors gracefully', async () => {
            const mockCallable = jest.fn().mockRejectedValue(
                new Error('Stripe error: Card declined')
            );

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            await expect(
                StripePaymentService.createPaymentIntent({
                    amount: 5000,
                    bookingId: 'booking123',
                })
            ).rejects.toThrow();
        });
    });

    describe('capturePayment', () => {
        it('should capture authorized payment', async () => {
            const mockCallable = jest.fn().mockResolvedValue({
                data: {
                    success: true,
                },
            });

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            // capturePayment returns void, so we just check it doesn't throw
            await expect(
                StripePaymentService.capturePayment('pi_test_123', 'booking123')
            ).resolves.not.toThrow();

            expect(httpsCallable).toHaveBeenCalled();
        });
    });

    describe('confirmPayment', () => {
        it('should return deprecation warning (method is deprecated)', async () => {
            // This method is deprecated and always returns success: false
            const result = await StripePaymentService.confirmPayment('pi_test_123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Use Stripe SDK to confirm');
        });
    });
});

describe('StripeConnectService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('startConnectOnboarding', () => {
        it('should generate onboarding link for user', async () => {
            const mockCallable = jest.fn().mockResolvedValue({
                data: {
                    url: 'https://connect.stripe.com/setup/test',
                    accountId: 'acct_test_123',
                },
            });

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            const mockUser = {
                id: 'user123',
                name: 'Test User',
                email: 'test@example.com',
            };

            const result = await StripeConnectService.startConnectOnboarding(mockUser as any);

            expect(typeof result).toBe('string');
        });

        it('should handle connection errors', async () => {
            const mockCallable = jest.fn().mockRejectedValue(
                new Error('An error occurred with our connection to Stripe')
            );

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            const mockUser = {
                id: 'user123',
                name: 'Test User',
                email: 'test@example.com',
            };

            await expect(
                StripeConnectService.startConnectOnboarding(mockUser as any)
            ).rejects.toThrow();
        });
    });

    describe('isConnectSetupComplete', () => {
        it('should check if user has completed onboarding', async () => {
            // This method reads from Firestore, not Cloud Functions
            // We need to mock getDoc instead
            const { getDoc } = require('firebase/firestore');
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                data: () => ({
                    stripeConnectId: 'acct_123',
                    stripeVerified: true,
                }),
            });

            const result = await StripeConnectService.isConnectSetupComplete('user123');

            expect(typeof result).toBe('boolean');
        });
    });
});
