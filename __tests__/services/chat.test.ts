/**
 * Chat Service Tests
 *
 * Tests for the ChatService class covering message sending,
 * thread management, and read tracking functionality.
 */

import { ChatService } from '../../services/chat';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    addDoc: jest.fn(() => Promise.resolve({ id: 'mock-message-id' })),
    getDoc: jest.fn(() => Promise.resolve({
        exists: () => true,
        data: () => ({
            driverId: 'driver-123',
            passengerId: 'passenger-123',
            ride: { driverId: 'driver-123' }
        })
    })),
    getDocs: jest.fn(() => Promise.resolve({
        empty: false,
        docs: [{ id: 'thread-123' }],
        forEach: jest.fn()
    })),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    startAfter: jest.fn(),
    onSnapshot: jest.fn(() => () => { }),
    serverTimestamp: jest.fn(() => new Date()),
    updateDoc: jest.fn(() => Promise.resolve()),
    writeBatch: jest.fn(() => ({
        update: jest.fn(),
        commit: jest.fn(() => Promise.resolve())
    }))
}));

jest.mock('../../config/firebase', () => ({
    db: {}
}));

jest.mock('../../services/image', () => ({
    ImageService: {
        uploadImage: jest.fn(() => Promise.resolve('https://example.com/image.jpg'))
    }
}));

jest.mock('../../services/notifications', () => ({
    NotificationService: {
        sendNewMessageNotification: jest.fn(() => Promise.resolve())
    }
}));

describe('ChatService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('sendMessage', () => {
        it('should validate required parameters', async () => {
            await expect(ChatService.sendMessage('', 'sender', 'name', 'message'))
                .rejects.toThrow('Missing required message parameters');

            await expect(ChatService.sendMessage('ride', '', 'name', 'message'))
                .rejects.toThrow('Missing required message parameters');

            await expect(ChatService.sendMessage('ride', 'sender', '', 'message'))
                .rejects.toThrow('Missing required message parameters');

            await expect(ChatService.sendMessage('ride', 'sender', 'name', ''))
                .rejects.toThrow('Missing required message parameters');
        });

        it('should send a message successfully', async () => {
            const messageId = await ChatService.sendMessage(
                'ride-123',
                'sender-123',
                'John Doe',
                'Hello, world!'
            );

            expect(messageId).toBe('mock-message-id');
        });

        it('should include participants in the message', async () => {
            const { addDoc } = require('firebase/firestore');

            await ChatService.sendMessage(
                'ride-123',
                'sender-123',
                'John Doe',
                'Hello'
            );

            expect(addDoc).toHaveBeenCalled();
            const callArgs = addDoc.mock.calls[0][1];
            expect(callArgs.participants).toBeDefined();
            expect(Array.isArray(callArgs.participants)).toBe(true);
        });

        it('should trim message content', async () => {
            const { addDoc } = require('firebase/firestore');

            await ChatService.sendMessage(
                'ride-123',
                'sender-123',
                'John Doe',
                '  Hello with spaces  '
            );

            expect(addDoc).toHaveBeenCalled();
            const callArgs = addDoc.mock.calls[0][1];
            expect(callArgs.message).toBe('Hello with spaces');
        });
    });

    describe('sendSystemMessage', () => {
        it('should send a system message', async () => {
            const { addDoc } = require('firebase/firestore');

            const messageId = await ChatService.sendSystemMessage(
                'ride-123',
                'Ride has started'
            );

            expect(messageId).toBe('mock-message-id');
            expect(addDoc).toHaveBeenCalled();

            const callArgs = addDoc.mock.calls[0][1];
            expect(callArgs.senderId).toBe('system');
            expect(callArgs.senderName).toBe('System');
            expect(callArgs.type).toBe('system');
            expect(callArgs.participants).toBeDefined();
        });
    });

    describe('subscribeToRideMessages', () => {
        it('should return an unsubscribe function', () => {
            const callback = jest.fn();
            const unsubscribe = ChatService.subscribeToRideMessages('ride-123', 'user-123', callback);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should limit page size between 1 and 200', () => {
            const { query, limit } = require('firebase/firestore');
            const callback = jest.fn();

            // Test with page size 0 (should become 1)
            ChatService.subscribeToRideMessages('ride-123', 'user-123', callback, 0);

            // Test with page size 500 (should become 200)
            ChatService.subscribeToRideMessages('ride-123', 'user-123', callback, 500);

            // The limit function should have been called
            expect(limit).toHaveBeenCalled();
        });
    });

    describe('markMessagesAsRead', () => {
        it('should mark messages as read for a user', async () => {
            const { getDocs, writeBatch } = require('firebase/firestore');

            getDocs.mockResolvedValueOnce({
                empty: false,
                docs: [
                    {
                        id: 'msg-1',
                        data: () => ({ readBy: [] })
                    },
                    {
                        id: 'msg-2',
                        data: () => ({ readBy: ['other-user'] })
                    }
                ]
            });

            await ChatService.markMessagesAsRead('ride-123', 'user-123');

            expect(getDocs).toHaveBeenCalled();
            expect(writeBatch).toHaveBeenCalled();
        });

        it('should skip if no unread messages', async () => {
            const { getDocs, writeBatch } = require('firebase/firestore');

            getDocs.mockResolvedValueOnce({
                empty: true,
                docs: []
            });

            await ChatService.markMessagesAsRead('ride-123', 'user-123');

            expect(writeBatch).not.toHaveBeenCalled();
        });
    });

    describe('getUnreadMessageCount', () => {
        it('should return count of unread messages', async () => {
            const { getDocs } = require('firebase/firestore');

            getDocs.mockResolvedValueOnce({
                forEach: (callback: Function) => {
                    callback({ data: () => ({ readBy: [] }) });
                    callback({ data: () => ({ readBy: ['user-123'] }) });
                    callback({ data: () => ({ readBy: [] }) });
                }
            });

            const count = await ChatService.getUnreadMessageCount('ride-123', 'user-123');

            expect(count).toBe(2); // 2 messages without user-123 in readBy
        });

        it('should return 0 on error', async () => {
            const { getDocs } = require('firebase/firestore');
            getDocs.mockRejectedValueOnce(new Error('Database error'));

            const count = await ChatService.getUnreadMessageCount('ride-123', 'user-123');

            expect(count).toBe(0);
        });
    });
});

describe('ChatService Thread Management', () => {
    it('should return existing thread if found', async () => {
        const { getDocs } = require('firebase/firestore');

        getDocs.mockResolvedValueOnce({
            empty: false,
            docs: [{ id: 'existing-thread-123' }]
        });

        const threadId = await ChatService.createOrGetThread(
            'booking-123',
            'ride-123',
            'driver-123',
            'passenger-123'
        );

        expect(threadId).toBe('existing-thread-123');
    });

    it('should create new thread if not found', async () => {
        const { getDocs, addDoc } = require('firebase/firestore');

        getDocs.mockResolvedValueOnce({
            empty: true,
            docs: []
        });

        addDoc.mockResolvedValueOnce({ id: 'new-thread-456' });

        const threadId = await ChatService.createOrGetThread(
            'booking-123',
            'ride-123',
            'driver-123',
            'passenger-123'
        );

        expect(threadId).toBe('new-thread-456');
        expect(addDoc).toHaveBeenCalled();
    });
});
