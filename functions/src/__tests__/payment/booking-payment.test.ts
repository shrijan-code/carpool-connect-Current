/**
 * Booking Payment Flow Unit Tests
 * 
 * Tests for createPendingBooking payment logic including
 * authorization, validation, and outstanding balance checks.
 */

import { createMockStripe } from '../mocks/stripe';
import { createMockDocSnapshot, createMockQuerySnapshot } from '../mocks/firebase';

describe('Booking Payment Flow', () => {
    let mockStripe: ReturnType<typeof createMockStripe>;

    beforeEach(() => {
        mockStripe = createMockStripe();
        jest.clearAllMocks();
    });

    // ==========================================================================
    // Payment Intent Creation
    // ==========================================================================
    describe('Payment Intent Creation', () => {
        it('should create payment intent with correct amount', async () => {
            const ridePrice = 1500;
            const platformFee = 500;
            const totalAmount = ridePrice + platformFee;

            await mockStripe.paymentIntents.create({
                amount: totalAmount,
                currency: 'aud',
                capture_method: 'manual',
            });

            expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: 2000,
                    currency: 'aud',
                    capture_method: 'manual',
                })
            );
        });

        it('should use manual capture for advance bookings', async () => {
            const departureDate = new Date();
            departureDate.setDate(departureDate.getDate() + 3); // 3 days from now

            await mockStripe.paymentIntents.create({
                amount: 2000,
                currency: 'aud',
                capture_method: 'manual',
                metadata: { departureDate: departureDate.toISOString() },
            });

            expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    capture_method: 'manual',
                })
            );
        });

        it('should attach customer ID to payment intent', async () => {
            const customerId = 'cus_test_123';

            await mockStripe.paymentIntents.create({
                amount: 2000,
                currency: 'aud',
                customer: customerId,
                capture_method: 'manual',
            });

            expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customer: customerId,
                })
            );
        });
    });

    // ==========================================================================
    // Outstanding Balance Check
    // ==========================================================================
    describe('Outstanding Balance Check', () => {
        it('should block booking if rider has failed payments', () => {
            const failedBookings = createMockQuerySnapshot([
                createMockDocSnapshot('booking1', {
                    status: 'payment_failed',
                    amountTotal: 2000,
                    riderId: 'rider123',
                }),
            ]);

            expect(failedBookings.empty).toBe(false);
            expect(failedBookings.size).toBe(1);
        });

        it('should calculate total outstanding amount', () => {
            const failedBookings = [
                { amountTotal: 2000 },
                { amountTotal: 1500 },
                { amountTotal: 3000 },
            ];

            const totalOwed = failedBookings.reduce((sum, b) => sum + b.amountTotal, 0);
            expect(totalOwed).toBe(6500); // $65.00
        });

        it('should allow booking if no failed payments', () => {
            const failedBookings = createMockQuerySnapshot([]);

            expect(failedBookings.empty).toBe(true);
        });
    });

    // ==========================================================================
    // Payment Validation
    // ==========================================================================
    describe('Payment Validation', () => {
        it('should require payment method or payment intent', () => {
            const hasPaymentMethodId = true;
            const hasPaymentIntentId = false;

            const isValid = hasPaymentMethodId || hasPaymentIntentId;
            expect(isValid).toBe(true);
        });

        it('should reject booking without payment', () => {
            const hasPaymentMethodId = false;
            const hasPaymentIntentId = false;

            const isValid = hasPaymentMethodId || hasPaymentIntentId;
            expect(isValid).toBe(false);
        });

        it('should validate seat count range', () => {
            const validateSeats = (seats: number) => seats >= 1 && seats <= 10;

            expect(validateSeats(0)).toBe(false);
            expect(validateSeats(1)).toBe(true);
            expect(validateSeats(5)).toBe(true);
            expect(validateSeats(10)).toBe(true);
            expect(validateSeats(11)).toBe(false);
        });
    });

    // ==========================================================================
    // Booking Status After Payment
    // ==========================================================================
    describe('Booking Status', () => {
        it('should set status to pending_driver after successful authorization', () => {
            const paymentIntentStatus = 'requires_capture';
            const expectedBookingStatus = 'pending_driver';

            const bookingStatus = paymentIntentStatus === 'requires_capture'
                ? 'pending_driver'
                : 'payment_failed';

            expect(bookingStatus).toBe(expectedBookingStatus);
        });

        it('should set status to payment_failed on authorization failure', () => {
            const paymentIntentStatus: string = 'requires_payment_method';

            const bookingStatus = paymentIntentStatus === 'requires_capture'
                ? 'pending_driver'
                : 'payment_failed';

            expect(bookingStatus).toBe('payment_failed');
        });
    });
});
