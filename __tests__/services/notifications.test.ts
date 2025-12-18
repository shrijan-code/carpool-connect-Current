/**
 * Notification Service Tests
 *
 * Tests for the NotificationService class covering in-app notifications,
 * push notifications, caching, and real-time updates.
 */

import { NotificationService, InAppNotification } from '../../services/notifications';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    addDoc: jest.fn(() => Promise.resolve({ id: 'mock-notification-id' })),
    getDoc: jest.fn(() => Promise.resolve({
        exists: () => true,
        data: () => ({})
    })),
    getDocs: jest.fn(() => Promise.resolve({
        empty: false,
        docs: [],
        forEach: jest.fn()
    })),
    updateDoc: jest.fn(() => Promise.resolve()),
    query: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    orderBy: jest.fn(),
    onSnapshot: jest.fn((_, callback) => {
        // Simulate snapshot callback
        callback({
            forEach: jest.fn()
        });
        return () => { };
    }),
    Timestamp: {
        now: jest.fn(() => ({
            toMillis: () => Date.now(),
            seconds: Math.floor(Date.now() / 1000)
        }))
    },
    arrayUnion: jest.fn((val) => val),
    arrayRemove: jest.fn((val) => val)
}));

jest.mock('../../config/firebase', () => ({
    db: {}
}));

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[mock]' })),
    setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
    dismissAllNotificationsAsync: jest.fn(() => Promise.resolve()),
    setBadgeCountAsync: jest.fn(() => Promise.resolve()),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
    AndroidImportance: { HIGH: 4 }
}));

jest.mock('expo-constants', () => ({
    expoConfig: {
        extra: {
            eas: { projectId: 'mock-project-id' }
        }
    }
}));

// Mock Platform
jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    Alert: { alert: jest.fn() }
}));

describe('NotificationService In-App Notifications', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        NotificationService.clearCache();
    });

    describe('sendInAppNotification', () => {
        it('should create notification in Firestore', async () => {
            const { addDoc } = require('firebase/firestore');

            await NotificationService.sendInAppNotification(
                'user-123',
                'Test Title',
                'Test Body',
                'general',
                { rideId: 'ride-456' }
            );

            expect(addDoc).toHaveBeenCalled();
            const callArgs = addDoc.mock.calls[0][1];
            expect(callArgs.userId).toBe('user-123');
            expect(callArgs.title).toBe('Test Title');
            expect(callArgs.body).toBe('Test Body');
            expect(callArgs.type).toBe('general');
            expect(callArgs.read).toBe(false);
        });
    });

    describe('markAsRead', () => {
        it('should update notification read status', async () => {
            const { updateDoc } = require('firebase/firestore');

            await NotificationService.markAsRead('notification-123', 'user-123');

            expect(updateDoc).toHaveBeenCalled();
            const callArgs = updateDoc.mock.calls[0][1];
            expect(callArgs.read).toBe(true);
        });
    });

    describe('Specialized notification methods', () => {
        it('should send ride booking notification', async () => {
            const { addDoc } = require('firebase/firestore');

            await NotificationService.sendRideBookingNotification(
                'driver-123',
                'John Doe',
                'Sydney CBD',
                'Bondi Beach',
                'ride-456',
                'booking-789'
            );

            expect(addDoc).toHaveBeenCalled();
            const callArgs = addDoc.mock.calls[0][1];
            expect(callArgs.type).toBe('ride_booked');
            expect(callArgs.title).toBe('New Ride Request');
            expect(callArgs.body).toContain('John Doe');
        });

        it('should send ride confirmation notification', async () => {
            const { addDoc } = require('firebase/firestore');

            await NotificationService.sendRideConfirmationNotification(
                'rider-123',
                'Jane Driver',
                'Sydney CBD',
                'ride-456',
                'booking-789'
            );

            expect(addDoc).toHaveBeenCalled();
            const callArgs = addDoc.mock.calls[0][1];
            expect(callArgs.type).toBe('ride_confirmed');
            expect(callArgs.title).toBe('Ride Confirmed');
        });

        it('should send ride cancellation notification', async () => {
            const { addDoc } = require('firebase/firestore');

            await NotificationService.sendRideCancellationNotification(
                'user-123',
                'Driver unavailable',
                'ride-456',
                'booking-789'
            );

            expect(addDoc).toHaveBeenCalled();
            const callArgs = addDoc.mock.calls[0][1];
            expect(callArgs.type).toBe('ride_cancelled');
            expect(callArgs.body).toContain('Driver unavailable');
        });

        it('should send new message notification with truncation', async () => {
            const { addDoc } = require('firebase/firestore');
            const longMessage = 'This is a very long message that should be truncated because it exceeds fifty characters';

            await NotificationService.sendNewMessageNotification(
                'user-123',
                'Sender Name',
                longMessage,
                'ride-456'
            );

            expect(addDoc).toHaveBeenCalled();
            const callArgs = addDoc.mock.calls[0][1];
            expect(callArgs.type).toBe('message');
            expect(callArgs.body.length).toBeLessThanOrEqual(53); // 50 + '...'
        });
    });
});

describe('NotificationService Caching', () => {
    beforeEach(() => {
        NotificationService.clearCache();
    });

    it('should clear cache correctly', () => {
        // This is a smoke test - cache is internal
        NotificationService.clearCache();
        NotificationService.clearCache('specific-user');
        // Should not throw
        expect(true).toBe(true);
    });
});

describe('NotificationService Listeners', () => {
    it('should add and remove notification listeners', () => {
        const listener = jest.fn();

        const unsubscribe = NotificationService.addNotificationListener(listener);

        expect(typeof unsubscribe).toBe('function');

        // Unsubscribe should not throw
        unsubscribe();
    });

    it('should trigger listeners on new notifications', () => {
        const listener = jest.fn();
        NotificationService.addNotificationListener(listener);

        const mockNotification: InAppNotification = {
            id: 'test-1',
            userId: 'user-123',
            title: 'Test',
            body: 'Test body',
            read: false,
            type: 'general',
            createdAt: { toMillis: () => Date.now() } as Timestamp
        };

        NotificationService.triggerListeners(mockNotification);

        expect(listener).toHaveBeenCalledWith(mockNotification);
    });
});

describe('NotificationService Push Notifications', () => {
    it('should get current push token (initially null)', () => {
        const token = NotificationService.getCurrentPushToken();
        expect(token).toBeNull();
    });

    it('should add notification received listener', () => {
        const callback = jest.fn();
        const subscription = NotificationService.addNotificationReceivedListener(callback);

        expect(subscription).toBeDefined();
        expect(typeof subscription.remove).toBe('function');
    });

    it('should add notification response listener', () => {
        const callback = jest.fn();
        const subscription = NotificationService.addNotificationResponseReceivedListener(callback);

        expect(subscription).toBeDefined();
        expect(typeof subscription.remove).toBe('function');
    });
});
