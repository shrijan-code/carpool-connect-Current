/**
 * Stripe SDK mock for testing
 */

export const createMockStripe = () => {
    const mockPaymentIntent = {
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
        status: 'requires_capture',
        amount: 2000,
        currency: 'aud',
        capture: jest.fn(),
    };

    const mockRefund = {
        id: 're_test_123',
        amount: 1000,
        status: 'succeeded',
    };

    const mockTransfer = {
        id: 'tr_test_123',
        amount: 1800,
        destination: 'acct_test_123',
    };

    const mockPaymentMethod = {
        id: 'pm_test_123',
        type: 'card',
        card: { last4: '4242' },
    };

    const mockCustomer = {
        id: 'cus_test_123',
        email: 'test@example.com',
        deleted: false,
    };

    return {
        paymentIntents: {
            create: jest.fn().mockResolvedValue(mockPaymentIntent),
            retrieve: jest.fn().mockResolvedValue(mockPaymentIntent),
            capture: jest.fn().mockResolvedValue({ ...mockPaymentIntent, status: 'succeeded' }),
            cancel: jest.fn().mockResolvedValue({ ...mockPaymentIntent, status: 'canceled' }),
        },
        refunds: {
            create: jest.fn().mockResolvedValue(mockRefund),
        },
        transfers: {
            create: jest.fn().mockResolvedValue(mockTransfer),
        },
        paymentMethods: {
            list: jest.fn().mockResolvedValue({ data: [mockPaymentMethod] }),
            retrieve: jest.fn().mockResolvedValue(mockPaymentMethod),
        },
        customers: {
            retrieve: jest.fn().mockResolvedValue(mockCustomer),
            create: jest.fn().mockResolvedValue(mockCustomer),
        },
        accounts: {
            create: jest.fn().mockResolvedValue({ id: 'acct_test_123' }),
            retrieve: jest.fn().mockResolvedValue({ id: 'acct_test_123', payouts_enabled: true }),
        },
        accountLinks: {
            create: jest.fn().mockResolvedValue({ url: 'https://stripe.com/onboarding' }),
        },
        _mockPaymentIntent: mockPaymentIntent,
        _mockRefund: mockRefund,
        _mockTransfer: mockTransfer,
    };
};

export const mockStripe = createMockStripe();
