import { AuthService } from '../../services/auth';
import { auth, db } from '../../config/firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

jest.mock('../../config/firebase');
jest.mock('firebase/auth');
jest.mock('firebase/firestore');

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should login user with valid credentials', async () => {
            const mockUser = {
                uid: 'user123',
                email: 'test@example.com',
            };

            (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
                user: mockUser,
            });

            const result = await AuthService.login('test@example.com', 'password123');

            expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
                auth,
                'test@example.com',
                'password123'
            );
            expect(result.uid).toBe('user123');
        });

        it('should handle invalid credentials', async () => {
            (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(
                new Error('auth/wrong-password')
            );

            await expect(
                AuthService.login('test@example.com', 'wrongpassword')
            ).rejects.toThrow();
        });
    });

    describe('signup', () => {
        it('should create new user account and profile', async () => {
            const mockUser = {
                uid: 'newuser123',
                email: 'newuser@example.com',
            };

            (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
                user: mockUser,
            });

            (setDoc as jest.Mock).mockResolvedValue(undefined);

            const result = await AuthService.signup(
                'newuser@example.com',
                'password123',
                'John Doe',
                '+61412345678'
            );

            expect(createUserWithEmailAndPassword).toHaveBeenCalled();
            expect(setDoc).toHaveBeenCalled();
            expect(result.uid).toBe('newuser123');
        });

        it('should handle duplicate email', async () => {
            (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(
                new Error('auth/email-already-in-use')
            );

            await expect(
                AuthService.signup('existing@example.com', 'password123', 'John', '+61')
            ).rejects.toThrow();
        });
    });

    describe('logout', () => {
        it('should logout current user', async () => {
            (signOut as jest.Mock).mockResolvedValue(undefined);

            await AuthService.logout();

            expect(signOut).toHaveBeenCalledWith(auth);
        });
    });

    describe('getUserProfile', () => {
        it('should return user profile data', async () => {
            const mockProfile = {
                name: 'John Doe',
                email: 'john@example.com',
                phone: '+61412345678',
                role: 'passenger',
            };

            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                data: () => mockProfile,
            });

            const result = await AuthService.getUserProfile('user123');

            expect(result).toEqual(mockProfile);
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
