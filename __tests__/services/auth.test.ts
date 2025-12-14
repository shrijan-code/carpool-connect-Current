// Mock config/firebase BEFORE imports
jest.mock('../../config/firebase', () => ({
    auth: {},
    db: {},
    storage: {},
}));
jest.mock('firebase/auth');
jest.mock('firebase/firestore');

import { AuthService } from '../../services/auth';
import { auth } from '../../config/firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('signInWithEmail', () => {
        it('should sign in user with valid credentials', async () => {
            const mockFirebaseUser = {
                uid: 'user123',
                email: 'test@example.com',
            };

            const mockUserData = {
                id: 'user123',
                name: 'Test User',
                email: 'test@example.com',
            };

            (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
                user: mockFirebaseUser,
            });

            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                data: () => mockUserData,
            });

            const result = await AuthService.signInWithEmail('test@example.com', 'password123');

            expect(signInWithEmailAndPassword).toHaveBeenCalled();
            expect(result.id).toBe('user123');
        });

        it('should handle invalid credentials', async () => {
            const error = new Error('auth/wrong-password');
            (error as any).code = 'auth/wrong-password';

            (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

            await expect(
                AuthService.signInWithEmail('test@example.com', 'wrongpassword')
            ).rejects.toThrow();
        });
    });

    describe('signUpWithEmail', () => {
        it('should create new user account and profile', async () => {
            const mockFirebaseUser = {
                uid: 'newuser123',
                email: 'newuser@example.com',
            };

            (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
                user: mockFirebaseUser,
            });

            (setDoc as jest.Mock).mockResolvedValue(undefined);

            const result = await AuthService.signUpWithEmail(
                'newuser@example.com',
                'password123',
                { name: 'John Doe', phone: '+61412345678' }
            );

            expect(createUserWithEmailAndPassword).toHaveBeenCalled();
            expect(setDoc).toHaveBeenCalled();
            expect(result.id).toBe('newuser123');
        });

        it('should handle duplicate email', async () => {
            const error = new Error('auth/email-already-in-use');
            (error as any).code = 'auth/email-already-in-use';

            (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

            await expect(
                AuthService.signUpWithEmail('existing@example.com', 'password123', { name: 'John' })
            ).rejects.toThrow();
        });
    });

    describe('signOut', () => {
        it('should sign out current user', async () => {
            (signOut as jest.Mock).mockResolvedValue(undefined);

            await AuthService.signOut();

            expect(signOut).toHaveBeenCalledWith(auth);
        });
    });

    describe('getUserProfile', () => {
        it('should return user profile data', async () => {
            const mockProfile = {
                id: 'user123',
                name: 'John Doe',
                email: 'john@example.com',
                phone: '+61412345678',
                role: 'passenger',
            };

            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                data: () => mockProfile,
                id: 'user123',
            });

            const result = await AuthService.getUserProfile('user123');

            expect(result).toBeTruthy();
            expect(result?.name).toBe('John Doe');
        });

        it('should return null for non-existent user', async () => {
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => false,
            });

            const result = await AuthService.getUserProfile('nonexistent');

            expect(result).toBeNull();
        });
    });
});
