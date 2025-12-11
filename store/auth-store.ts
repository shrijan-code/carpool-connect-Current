import { create } from 'zustand';
import { User } from '@/types';
import { AuthService } from '@/services/auth';
import { NotificationService } from '@/services/notifications';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Audit log service for auth actions
class AuthAuditService {
  static async logAction(action: string, userId: string, data?: any) {
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
      console.error('Auth audit log error:', error);
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
      
      // Initialize notifications
      await NotificationService.initializeForUser(user.id);
    } catch (error) {
      throw error;
    }
  },

  loginWithGoogle: async () => {
    try {
      const user = await AuthService.signInWithGoogle();
      set({ user, isAuthenticated: true, isOnboarded: true });
      
      // Initialize notifications
      await NotificationService.initializeForUser(user.id);
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
      
      // Initialize notifications
      await NotificationService.initializeForUser(user.id);
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      console.log('Logging out user...');
      await AuthService.signOut();
      set({ user: null, isAuthenticated: false, isOnboarded: false });
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      set({ user: null, isAuthenticated: false, isOnboarded: false });
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
    } catch (error) {
      console.error('Onboarding completion error:', error);
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
    } catch (error) {
      console.error('Auth initialization error:', error);
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
      
      console.log('Sending password reset email to:', trimmedEmail);
      await AuthService.sendPasswordResetEmail(trimmedEmail);
      console.log('Password reset email sent successfully');
      
      // Log password reset attempt (without storing email for privacy)
      await AuthAuditService.logAction('PASSWORD_RESET_REQUEST', 'anonymous', {
        emailDomain: trimmedEmail.split('@')[1],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  },
}));