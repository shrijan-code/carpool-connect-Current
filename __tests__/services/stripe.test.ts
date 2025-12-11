import { StripePaymentService } from '../../services/stripe';
import { functions } from '../../config/firebase';
import { httpsCallable } from 'firebase/functions';

jest.mock('../../config/firebase');
jest.mock('firebase/functions');

describe('StripePaymentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPaymentIntent', () => {
        it('should create payment intent with correct amount in cents', async () => {
            const mockCallable = jest.fn().mockResolvedValue({
                data: {
                    clientSecret: 'pi_test_secret',
                    paymentIntentId: 'pi_test_123',
                },
            });

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            const result = await StripePaymentService.createPaymentIntent(
                'booking123',
                50.00, // $50
                'user123'
            );

            expect(mockCallable).toHaveBeenCalledWith({
                bookingId: 'booking123',
                amount: 50.00,
                userId: 'user123',
            });

            expect(result).toHaveProperty('clientSecret');
            expect(result).toHaveProperty('paymentIntentId');
        });

        it('should handle Stripe errors gracefully', async () => {
            const mockCallable = jest.fn().mockRejectedValue(
                new Error('Stripe error: Card declined')
            );

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            await expect(
                StripePaymentService.createPaymentIntent('booking123', 50.00, 'user123')
            ).rejects.toThrow();
        });
    });

    describe('capturePayment', () => {
        it('should capture authorized payment', async () => {
            const mockCallable = jest.fn().mockResolvedValue({
                data: {
                    success: true,
                    status: 'succeeded',
                },
            });

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            const result = await StripePaymentService.capturePayment(
                'pi_test_123',
                'booking123'
            );

            expect(mockCallable).toHaveBeenCalledWith({
                paymentIntentId: 'pi_test_123',
                bookingId: 'booking123',
            });

            expect(result.success).toBe(true);
        });
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

            const result = await StripePaymentService.startConnectOnboarding('user123');

            expect(result).toHaveProperty('url');
            expect(result).toHaveProperty('accountId');
            expect(result.url).toContain('stripe.com');
        });

        it('should handle connection errors', async () => {
            const mockCallable = jest.fn().mockRejectedValue(
                new Error('An error occurred with our connection to Stripe')
            );

            (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

            await expect(
                StripePaymentService.startConnectOnboarding('user123')
            ).rejects.toThrow('Stripe');
        });
    });
});
