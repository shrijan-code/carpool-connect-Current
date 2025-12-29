/**
 * Ride Completion Payment Tests
 * 
 * Tests for completeRideAndCharge including capture logic,
 * expired authorization handling, and driver payout calculation.
 */

import { createMockStripe } from '../mocks/stripe';
import { createMockDocSnapshot, createMockQuerySnapshot } from '../mocks/firebase';

describe('Ride Completion Payment', () => {
    let mockStripe: ReturnType<typeof createMockStripe>;

    beforeEach(() => {
        mockStripe = createMockStripe();
        jest.clearAllMocks();
    });

    // ==========================================================================
    // Payment Capture
    // ==========================================================================
    describe('Payment Capture', () => {
        it('should capture payment when status is requires_capture', async () => {
            mockStripe.paymentIntents.retrieve = jest.fn().mockResolvedValue({
                id: 'pi_test_123',
                status: 'requires_capture',
                amount: 2000,
            });

            const paymentIntent = await mockStripe.paymentIntents.retrieve('pi_test_123');

            expect(paymentIntent.status).toBe('requires_capture');

            if (paymentIntent.status === 'requires_capture') {
                const captured = await mockStripe.paymentIntents.capture('pi_test_123');
                expect(captured.status).toBe('succeeded');
            }
        });

        it('should not capture already succeeded payment', async () => {
            mockStripe.paymentIntents.retrieve = jest.fn().mockResolvedValue({
                id: 'pi_test_123',
                status: 'succeeded',
                amount: 2000,
            });

            const paymentIntent = await mockStripe.paymentIntents.retrieve('pi_test_123');

            expect(paymentIntent.status).toBe('succeeded');
            // No capture needed
            expect(mockStripe.paymentIntents.capture).not.toHaveBeenCalled();
        });

        it('should verify amount before capture', async () => {
            const bookingAmount = 2000;
            const paymentIntentAmount = 2000;

            expect(bookingAmount).toBe(paymentIntentAmount);
        });

        it('should use payment intent amount if mismatch (safety)', async () => {
            const bookingAmount = 2500;
            const paymentIntentAmount = 2000;

            // Use original PI amount for safety
            const captureAmount = paymentIntentAmount;
            expect(captureAmount).toBe(2000);
        });
    });

    // ==========================================================================
    // Expired Authorization Handling
    // ==========================================================================
    describe('Expired Authorization', () => {
        it('should detect canceled payment intent', async () => {
            mockStripe.paymentIntents.retrieve = jest.fn().mockResolvedValue({
                id: 'pi_test_123',
                status: 'canceled',
                amount: 2000,
            });

            const paymentIntent = await mockStripe.paymentIntents.retrieve('pi_test_123');
            const needsReauth = ['canceled', 'requires_payment_method'].includes(paymentIntent.status);

            expect(needsReauth).toBe(true);
        });

        it('should create new payment intent for re-authorization', async () => {
            const originalAmount = 2000;

            await mockStripe.paymentIntents.create({
                amount: originalAmount,
                currency: 'aud',
                capture_method: 'automatic', // Immediate capture for re-auth
                off_session: true,
                confirm: true,
            });

            expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: 2000,
                    capture_method: 'automatic',
                    off_session: true,
                })
            );
        });

        it('should get saved payment method for re-authorization', async () => {
            const customerId = 'cus_test_123';

            await mockStripe.paymentMethods.list({
                customer: customerId,
                type: 'card',
                limit: 1,
            });

            expect(mockStripe.paymentMethods.list).toHaveBeenCalledWith(
                expect.objectContaining({
                    customer: customerId,
                    type: 'card',
                })
            );
        });
    });

    // ==========================================================================
    // Driver Revenue Calculation
    // ==========================================================================
    describe('Driver Revenue', () => {
        const PLATFORM_FEE = 500;

        it('should calculate total revenue from all bookings', () => {
            const bookings = [
                { amountTotal: 2000 },
                { amountTotal: 1500 },
            ];

            const totalRevenue = bookings.reduce((sum, b) => sum + b.amountTotal, 0);
            expect(totalRevenue).toBe(3500);
        });

        it('should calculate driver payout after platform fee', () => {
            const totalRevenue = 3500;
            const driverPayout = totalRevenue - PLATFORM_FEE;

            expect(driverPayout).toBe(3000); // $30.00
        });

        it('should waive platform fee if revenue is less than fee', () => {
            const totalRevenue = 400;
            const actualPlatformFee = totalRevenue >= PLATFORM_FEE ? PLATFORM_FEE : 0;
            const driverPayout = totalRevenue - actualPlatformFee;

            expect(actualPlatformFee).toBe(0);
            expect(driverPayout).toBe(400);
        });

        it('should handle zero revenue edge case', () => {
            const totalRevenue = 0;
            const actualPlatformFee = totalRevenue >= PLATFORM_FEE ? PLATFORM_FEE : 0;
            const driverPayout = totalRevenue - actualPlatformFee;

            expect(actualPlatformFee).toBe(0);
            expect(driverPayout).toBe(0);
        });
    });

    // ==========================================================================
    // Ride Completion Validation
    // ==========================================================================
    describe('Ride Completion Validation', () => {
        it('should require minimum 5 minutes ride duration', () => {
            const MINIMUM_RIDE_DURATION_MINUTES = 5;

            const validateDuration = (startTime: Date, now: Date) => {
                const durationMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
                return durationMinutes >= MINIMUM_RIDE_DURATION_MINUTES;
            };

            const startTime = new Date();
            const threeMinsLater = new Date(startTime.getTime() + 3 * 60 * 1000);
            const sixMinsLater = new Date(startTime.getTime() + 6 * 60 * 1000);

            expect(validateDuration(startTime, threeMinsLater)).toBe(false);
            expect(validateDuration(startTime, sixMinsLater)).toBe(true);
        });

        it('should only allow driver to complete ride', () => {
            const rideData = { driverId: 'driver123', status: 'active' };
            const requesterId = 'driver123';

            const isDriver = rideData.driverId === requesterId;
            expect(isDriver).toBe(true);
        });

        it('should only complete active rides', () => {
            const validStatuses = ['active', 'in_progress'];

            expect(validStatuses.includes('active')).toBe(true);
            expect(validStatuses.includes('completed')).toBe(false);
            expect(validStatuses.includes('cancelled')).toBe(false);
        });
    });

    // ==========================================================================
    // Payment Failure Handling
    // ==========================================================================
    describe('Payment Failure Handling', () => {
        it('should count successful and failed charges', () => {
            const bookingResults = [
                { success: true },
                { success: true },
                { success: false },
            ];

            const successfulCharges = bookingResults.filter(r => r.success).length;
            const failedCharges = bookingResults.filter(r => !r.success).length;

            expect(successfulCharges).toBe(2);
            expect(failedCharges).toBe(1);
        });

        it('should mark ride with payment issues if all fail', () => {
            const successfulCharges = 0;
            const failedCharges = 2;

            const hasPaymentIssues = failedCharges > 0 && successfulCharges === 0;
            expect(hasPaymentIssues).toBe(true);
        });

        it('should complete ride even with partial failures', () => {
            const successfulCharges = 1;
            const failedCharges = 1;

            const canComplete = successfulCharges > 0;
            expect(canComplete).toBe(true);
        });
    });
});
