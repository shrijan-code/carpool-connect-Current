/**
 * Verification Service Tests
 *
 * Tests for the VerificationService class covering user verification
 * status checks, criteria validation, and verification levels.
 */

import { VerificationService, VerificationStatus } from '../../services/verification';
import { User } from '../../types';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(() => Promise.resolve({
        exists: () => true,
        data: () => ({
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            phone: '0412345678',
            role: 'rider',
            profilePicture: 'https://example.com/pic.jpg'
        })
    })),
    getDocs: jest.fn(() => Promise.resolve({
        docs: [
            { id: 'user-1', data: () => ({ name: 'User 1' }) },
            { id: 'user-2', data: () => ({ name: 'User 2' }) }
        ]
    })),
    updateDoc: jest.fn(() => Promise.resolve())
}));

jest.mock('../../config/firebase', () => ({
    db: {}
}));

describe('VerificationService', () => {
    describe('checkVerificationStatus - Rider', () => {
        it('should return premium verification for complete rider profile', async () => {
            const user: Partial<User> = {
                id: 'user-123',
                name: 'John Doe',
                email: 'john@example.com',
                phone: '0412345678',
                profilePicture: 'https://example.com/profile.jpg',
                role: 'rider'
            };

            const status = await VerificationService.checkVerificationStatus(user as User);

            expect(status.isVerified).toBe(true);
            expect(status.verificationLevel).toBe('premium');
            expect(status.missingCriteria).toHaveLength(0);
            expect(status.criteria.emailVerified).toBe(true);
            expect(status.criteria.phoneVerified).toBe(true);
            expect(status.criteria.profileComplete).toBe(true);
        });

        it('should return none verification for incomplete rider', async () => {
            const user: Partial<User> = {
                id: 'user-123',
                name: 'John Doe',
                email: 'john@example.com',
                phone: '', // Missing phone
                profilePicture: '', // Missing profile pic
                role: 'rider'
            };

            const status = await VerificationService.checkVerificationStatus(user as User);

            expect(status.isVerified).toBe(false);
            expect(status.verificationLevel).toBe('none');
            expect(status.missingCriteria).toContain('Phone verification');
            expect(status.missingCriteria).toContain('Complete profile');
        });

        it('should identify missing email verification', async () => {
            const user: Partial<User> = {
                id: 'user-123',
                name: 'John Doe',
                email: '', // Missing email
                phone: '0412345678',
                profilePicture: 'https://example.com/pic.jpg',
                role: 'rider'
            };

            const status = await VerificationService.checkVerificationStatus(user as User);

            expect(status.criteria.emailVerified).toBe(false);
            expect(status.missingCriteria).toContain('Email verification');
        });
    });

    describe('checkVerificationStatus - Driver', () => {
        it('should require Stripe for driver verification', async () => {
            const driver: Partial<User> = {
                id: 'driver-123',
                name: 'Jane Driver',
                email: 'jane@example.com',
                phone: '0412345678',
                profilePicture: 'https://example.com/profile.jpg',
                role: 'driver',
                carDetails: {
                    id: 'vehicle-123',
                    make: 'Toyota',
                    model: 'Camry',
                    year: 2020,
                    color: 'White',
                    licensePlate: 'ABC123',
                    seats: 5,
                    verified: false,
                    registrationDocument: 'https://example.com/rego.pdf',
                    insuranceDocument: 'https://example.com/insurance.pdf'
                },
                stripeAccountId: undefined, // Missing Stripe
                stripeConnectCompleted: false
            };

            const status = await VerificationService.checkVerificationStatus(driver as User);

            expect(status.isVerified).toBe(false);
            expect(status.verificationLevel).toBe('none');
            expect(status.missingCriteria).toContain('Connect Stripe account');
        });

        it('should require documents for driver verification', async () => {
            const driver: Partial<User> = {
                id: 'driver-123',
                name: 'Jane Driver',
                email: 'jane@example.com',
                phone: '0412345678',
                profilePicture: 'https://example.com/profile.jpg',
                role: 'driver',
                carDetails: {
                    id: 'vehicle-123',
                    make: 'Toyota',
                    model: 'Camry',
                    year: 2020,
                    color: 'White',
                    licensePlate: 'ABC123',
                    seats: 5,
                    verified: false,
                    // Missing registrationDocument and insuranceDocument
                }, // Missing documents
                stripeAccountId: 'acct_123',
                stripeConnectCompleted: true
            };

            const status = await VerificationService.checkVerificationStatus(driver as User);

            expect(status.isVerified).toBe(false);
            expect(status.missingCriteria).toContain('Upload vehicle documents');
        });

        it('should return premium for fully verified driver', async () => {
            const driver: Partial<User> = {
                id: 'driver-123',
                name: 'Jane Driver',
                email: 'jane@example.com',
                phone: '0412345678',
                profilePicture: 'https://example.com/profile.jpg',
                role: 'driver',
                carDetails: {
                    id: 'vehicle-123',
                    make: 'Toyota',
                    model: 'Camry',
                    year: 2020,
                    color: 'White',
                    licensePlate: 'ABC123',
                    seats: 5,
                    verified: true,
                    registrationDocument: 'https://example.com/rego.pdf',
                    insuranceDocument: 'https://example.com/insurance.pdf'
                },
                stripeAccountId: 'acct_123',
                stripeConnectCompleted: true
            };

            const status = await VerificationService.checkVerificationStatus(driver as User);

            expect(status.isVerified).toBe(true);
            expect(status.verificationLevel).toBe('premium');
            expect(status.missingCriteria).toHaveLength(0);
        });
    });

    describe('updateUserVerificationStatus', () => {
        it('should update user verification in Firestore', async () => {
            const { updateDoc } = require('firebase/firestore');

            await VerificationService.updateUserVerificationStatus('user-123');

            expect(updateDoc).toHaveBeenCalled();
        });

        it('should throw error if user not found', async () => {
            const { getDoc } = require('firebase/firestore');
            getDoc.mockResolvedValueOnce({
                exists: () => false
            });

            await expect(VerificationService.updateUserVerificationStatus('nonexistent'))
                .rejects.toThrow('User not found');
        });
    });

    describe('Badge utilities', () => {
        it('should return gold color for premium badge', () => {
            const color = VerificationService.getVerificationBadgeColor('premium');
            expect(color).toBe('#FFD700');
        });

        it('should return gray color for none badge', () => {
            const color = VerificationService.getVerificationBadgeColor('none');
            expect(color).toBe('#9E9E9E');
        });

        it('should return correct label for premium', () => {
            const label = VerificationService.getVerificationBadgeLabel('premium');
            expect(label).toBe('Verified');
        });

        it('should return correct label for none', () => {
            const label = VerificationService.getVerificationBadgeLabel('none');
            expect(label).toBe('Not Verified');
        });

        it('should show badge for verified user', () => {
            const user = { verified: true } as User;
            expect(VerificationService.shouldShowVerificationBadge(user)).toBe(true);
        });

        it('should not show badge for unverified user', () => {
            const user = { verified: false } as User;
            expect(VerificationService.shouldShowVerificationBadge(user)).toBe(false);
        });
    });
});

describe('VerificationService Edge Cases', () => {
    it('should handle undefined carDetails for driver', async () => {
        const driver: Partial<User> = {
            id: 'driver-123',
            name: 'Test Driver',
            email: 'test@example.com',
            phone: '0412345678',
            profilePicture: 'https://example.com/pic.jpg',
            role: 'driver',
            carDetails: undefined,
            stripeAccountId: 'acct_123',
            stripeConnectCompleted: true
        };

        const status = await VerificationService.checkVerificationStatus(driver as User);

        expect(status.criteria.documentsUploaded).toBe(false);
    });

    it('should handle null values gracefully', async () => {
        const user: Partial<User> = {
            id: 'user-123',
            name: null as any,
            email: null as any,
            phone: null as any,
            role: 'rider'
        };

        const status = await VerificationService.checkVerificationStatus(user as User);

        expect(status.isVerified).toBe(false);
        expect(status.verificationLevel).toBe('none');
    });

    it('should not require Stripe for riders', async () => {
        const rider: Partial<User> = {
            id: 'rider-123',
            name: 'Test Rider',
            email: 'test@example.com',
            phone: '0412345678',
            profilePicture: 'https://example.com/pic.jpg',
            role: 'rider',
            stripeAccountId: undefined // Should not matter for riders
        };

        const status = await VerificationService.checkVerificationStatus(rider as User);

        expect(status.isVerified).toBe(true);
        expect(status.criteria.stripeConnected).toBe(true); // Defaults to true for non-drivers
    });
});
