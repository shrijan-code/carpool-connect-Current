import { create } from 'zustand';
import { User, AuditLogData } from '@/types';
import { AuthService } from '@/services/auth';
import { NotificationService } from '@/services/notifications';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { listenerManager } from '@/utils/listener-manager';
import { dataCache } from '@/utils/cache';
import { logger } from '@/utils/logger';

// Audit log service for auth actions
class AuthAuditService {
  static async logAction(action: string, userId: string, data?: AuditLogData) {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action,
        entityType: 'user',
        entityId: userId,
        userId,
        data: data || null,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      logger.error('Auth audit log error', error);
    }
  }
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (userData: Partial<User> & { password: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}



export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isOnboarded: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      const user = await AuthService.signInWithEmail(email, password);
      set({ user, isAuthenticated: true, isOnboarded: true });

      // Initialize in-app and push notifications
      await NotificationService.initializeForUser(user.id);
      await NotificationService.initializePushNotifications(user.id);
    } catch (error) {
      throw error;
    }
  },

  loginWithGoogle: async () => {
    try {
      const user = await AuthService.signInWithGoogle();
      set({ user, isAuthenticated: true, isOnboarded: true });

      // Initialize in-app and push notifications
      await NotificationService.initializeForUser(user.id);
      await NotificationService.initializePushNotifications(user.id);
    } catch (error) {
      throw error;
    }
  },

  register: async (userData: Partial<User> & { password: string }) => {
    try {
      if (!userData.email || !userData.password) {
        throw new Error('Email and password are required');
      }

      const user = await AuthService.signUpWithEmail(
        userData.email,
        userData.password,
        userData
      );

      set({ user, isAuthenticated: true, isOnboarded: true });

      // Initialize in-app and push notifications
      await NotificationService.initializeForUser(user.id);
      await NotificationService.initializePushNotifications(user.id);
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      const currentUser = get().user;
      logger.info('Logging out user');

      // Clean up push notifications
      if (currentUser) {
        await NotificationService.cleanupPushNotifications(currentUser.id);
        NotificationService.clearCache(currentUser.id);
      }

      // Clean up all Firestore listeners to prevent memory leaks
      logger.debug('[Optimization] Cleaning up all Firestore listeners and cache on logout');
      listenerManager.unregisterAll();
      dataCache.clear();

      await AuthService.signOut();
      set({ user: null, isAuthenticated: false, isOnboarded: false });
      logger.info('User logged out successfully');
    } catch (error: unknown) {
      logger.error('Logout error', error);
      // Force logout even if there's an error - still clean up
      listenerManager.unregisterAll();
      dataCache.clear();
      set({ user: null, isAuthenticated: false, isOnboarded: false });
    }
  },

  deleteAccount: async () => {
    try {
      const currentUser = get().user;
      if (!currentUser) {
        throw new Error('No user logged in');
      }

      logger.info('Starting account deletion');

      // Call the Cloud Function to delete all user data
      const deleteUserAccountFn = httpsCallable(functions, 'deleteUserAccount');
      await deleteUserAccountFn();

      // Clean up local state (same as logout)
      logger.debug('[Optimization] Cleaning up all Firestore listeners and cache on account deletion');
      listenerManager.unregisterAll();
      dataCache.clear();
      NotificationService.clearCache(currentUser.id);

      set({ user: null, isAuthenticated: false, isOnboarded: false });
      logger.info('Account deleted successfully');
    } catch (error: unknown) {
      logger.error('Account deletion error', error);
      throw error;
    }
  },

  updateUser: async (userData: Partial<User>) => {
    try {
      const currentUser = get().user;
      if (currentUser) {
        await AuthService.updateUserProfile(currentUser.id, userData);
        const updatedUser = { ...currentUser, ...userData };
        set({ user: updatedUser });

        // Log profile update
        await AuthAuditService.logAction('UPDATE_PROFILE', currentUser.id, {
          updatedFields: Object.keys(userData),
          hasProfilePicture: !!userData.profilePicture,
          hasCarDetails: !!userData.carDetails
        });
      }
    } catch (error) {
      throw error;
    }
  },

  completeOnboarding: async () => {
    try {
      set({ isOnboarded: true });
    } catch (error: unknown) {
      logger.error('Onboarding completion error', error);
    }
  },

  initializeAuth: async () => {
    try {
      // Set up auth state listener
      AuthService.onAuthStateChanged((user) => {
        set({
          user,
          isAuthenticated: !!user,
          isOnboarded: !!user,
          isLoading: false
        });
      });
    } catch (error: unknown) {
      logger.error('Auth initialization error', error);
      set({ isLoading: false });
    }
  },

  sendPasswordReset: async (email: string) => {
    try {
      if (!email || !email.trim()) {
        throw new Error('Email address is required');
      }

      const trimmedEmail = email.trim().toLowerCase();

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Please enter a valid email address');
      }

      logger.info('Sending password reset email', { emailDomain: trimmedEmail.split('@')[1] });
      await AuthService.sendPasswordResetEmail(trimmedEmail);
      logger.info('Password reset email sent successfully');

      // Log password reset attempt (without storing email for privacy)
      await AuthAuditService.logAction('PASSWORD_RESET_REQUEST', 'anonymous', {
        emailDomain: trimmedEmail.split('@')[1],
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      logger.error('Password reset error', error);
      throw error;
    }
  },
}));