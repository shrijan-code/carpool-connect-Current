/**
 * Jest setup file
 * Mocks Firebase Admin and Stripe before tests run
 */

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    credential: {
        applicationDefault: jest.fn(),
    },
    firestore: jest.fn(() => ({
        collection: jest.fn(),
        doc: jest.fn(),
        runTransaction: jest.fn(),
    })),
    auth: jest.fn(() => ({
        getUser: jest.fn(),
        deleteUser: jest.fn(),
    })),
}));

// Mock firebase-admin/firestore
jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(() => ({
        collection: jest.fn(),
        doc: jest.fn(),
        runTransaction: jest.fn(),
    })),
    FieldValue: {
        serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
        increment: jest.fn((n) => `INCREMENT_${n}`),
        delete: jest.fn(() => 'DELETE'),
    },
    Timestamp: {
        now: jest.fn(() => ({ toDate: () => new Date() })),
        fromDate: jest.fn((date) => ({ toDate: () => date })),
    },
}));

// Clear all mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
});
