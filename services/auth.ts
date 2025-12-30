import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { User } from '@/types';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { NotificationService } from './notifications';
import SecurityManager from '@/security/SecurityManager';
import { logger } from '@/utils/logger';

// Configure WebBrowser for auth session
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export class AuthService {
  // Password Reset
  static async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      logger.debug('Attempting to send password reset email', { email });

      await sendPasswordResetEmail(auth, email);
      logger.info('Password reset email sent successfully', { email });
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      logger.error('Password reset error', error, { code: firebaseError.code });

      // Handle specific Firebase Auth errors
      switch (firebaseError.code) {
        case 'auth/user-not-found':
          throw new Error('No account found with this email address. Please check your email or create a new account.');
        case 'auth/invalid-email':
          throw new Error('Invalid email address format. Please enter a valid email.');
        case 'auth/too-many-requests':
          throw new Error('Too many password reset attempts. Please wait a few minutes before trying again.');
        case 'auth/network-request-failed':
          throw new Error('Network error. Please check your internet connection and try again.');
        case 'auth/app-not-authorized':
          throw new Error('App not authorized to use Firebase Authentication. Please contact support.');
        case 'auth/invalid-api-key':
          throw new Error('Invalid API key. Please contact support.');
        case 'auth/operation-not-allowed':
          throw new Error('Password reset is not enabled. Please contact support.');
        default:
          throw new Error(firebaseError.message || 'Failed to send password reset email. Please try again.');
      }
    }
  }
  // Email/Password Authentication
  static async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Sanitize and validate email
      const sanitizedEmail = SecurityManager.sanitizeInput(email.toLowerCase().trim());
      if (!SecurityManager.validateEmail(sanitizedEmail)) {
        throw new Error('Invalid email format');
      }

      // Check brute force protection
      const bruteForceCheck = await SecurityManager.checkBruteForce(sanitizedEmail);
      if (!bruteForceCheck.allowed) {
        const retryMinutes = Math.ceil((bruteForceCheck.retryAfter || 0) / 60);
        throw new Error(`Account temporarily locked due to multiple failed attempts. Try again in ${retryMinutes} minutes.`);
      }

      // Add progressive delay if needed
      if (bruteForceCheck.delay) {
        await new Promise(resolve => setTimeout(resolve, bruteForceCheck.delay));
      }

      // Check rate limiting
      const rateLimitCheck = await SecurityManager.checkRateLimit(sanitizedEmail, 'login');
      if (!rateLimitCheck.allowed) {
        const retryMinutes = Math.ceil((rateLimitCheck.retryAfter || 0) / 60);
        throw new Error(`Too many login attempts. Please try again in ${retryMinutes} minutes.`);
      }

      const userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, password);

      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        // Send another verification email in case they didn't receive it
        await sendEmailVerification(userCredential.user);
        // Sign out the unverified user
        await signOut(auth);
        throw new Error('Please verify your email before logging in. A new verification email has been sent.');
      }

      // Record successful login
      await SecurityManager.recordSuccessfulLogin(sanitizedEmail);

      let user = await this.getUserProfile(userCredential.user.uid);
      if (!user) {
        logger.debug('User profile not found after sign-in, creating default profile');
        user = await this.createUserFromFirebaseUser(userCredential.user);
      }

      return user;
    } catch (error: any) {
      logger.error('Sign in error', error);

      // Record failed login attempt for brute force protection
      if (email) {
        const sanitizedEmail = SecurityManager.sanitizeInput(email.toLowerCase().trim());
        await SecurityManager.recordFailedLogin(sanitizedEmail);
      }

      // Handle specific Firebase Auth errors with security context
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          throw new Error('Invalid email or password. Please check your credentials.');
        case 'auth/too-many-requests':
          throw new Error('Account temporarily disabled due to many failed login attempts. Reset your password or try again later.');
        case 'auth/user-disabled':
          throw new Error('This account has been disabled. Please contact support.');
        default:
          throw new Error(error.message || 'Failed to sign in');
      }
    }
  }

  static async signUpWithEmail(
    email: string,
    password: string,
    userData: Partial<User>
  ): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Send email verification
      await sendEmailVerification(userCredential.user);

      const newUser: User = {
        id: userCredential.user.uid,
        displayName: userData.name || '',
        name: userData.name || '',
        email: email,
        phone: userData.phone || '',
        role: userData.role || 'rider',
        canBeDriver: userData.role === 'driver' || userData.role === 'both',
        canBeRider: userData.role === 'rider' || userData.role === 'both',
        rating: 5.0,
        totalRides: 0,
        joinedDate: new Date().toISOString().split('T')[0],
        verified: false,
        emailVerified: false, // Track email verification status
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save user profile to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Sign out immediately after registration - user must verify email first
      await signOut(auth);

      return newUser;
    } catch (error: unknown) {
      logger.error('Sign up error', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
      throw new Error(errorMessage);
    }
  }

  // Google Sign In
  static async signInWithGoogle(): Promise<User> {
    try {
      if (Platform.OS === 'web') {
        // Check if current domain is authorized
        const currentDomain = window.location.hostname;
        logger.debug('Google sign-in from web', { domain: currentDomain });

        // Web implementation using popup
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');

        const userCredential = await signInWithPopup(auth, provider);

        // Check if user profile exists, create if not
        let user = await this.getUserProfile(userCredential.user.uid);
        if (!user) {
          user = await this.createUserFromFirebaseUser(userCredential.user);
        }

        return user;
      } else {
        // Mobile implementation using AuthSession
        const redirectUri = AuthSession.makeRedirectUri();
        logger.debug('Google sign-in redirect URI', { redirectUri });

        // Get OAuth client IDs from environment variables
        const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
        const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;

        const clientId = Platform.select({
          ios: iosClientId,
          android: androidClientId,
          default: webClientId,
        });

        if (!clientId) {
          throw new Error(
            `Google Sign-In not configured for ${Platform.OS}. ` +
            `Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID_${Platform.OS.toUpperCase()} environment variable.`
          );
        }

        const request = new AuthSession.AuthRequest({
          clientId,
          scopes: ['openid', 'profile', 'email'],
          redirectUri,
          responseType: AuthSession.ResponseType.IdToken,
        });

        const result = await request.promptAsync({
          authorizationEndpoint: 'https://accounts.google.com/oauth/authorize',
        });

        if (result.type === 'success' && result.params.id_token) {
          const credential = GoogleAuthProvider.credential(result.params.id_token);
          const userCredential = await signInWithCredential(auth, credential);

          // Check if user profile exists, create if not
          let user = await this.getUserProfile(userCredential.user.uid);
          if (!user) {
            user = await this.createUserFromFirebaseUser(userCredential.user);
          }

          return user;
        } else {
          throw new Error('Google sign in was cancelled');
        }
      }
    } catch (error: unknown) {
      logger.error('Google sign in error', error);

      // Provide specific error messages for common issues
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === 'auth/unauthorized-domain') {
        const currentDomain = Platform.OS === 'web' ? window.location.hostname : 'mobile';
        throw new Error(
          `Domain '${currentDomain}' is not authorized for Google Sign-In. ` +
          'Please add this domain to Firebase Authentication authorized domains in the Firebase Console.'
        );
      } else if (firebaseError.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by browser. Please allow popups and try again.');
      } else if (firebaseError.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled.');
      }

      throw new Error(firebaseError.message || 'Failed to sign in with Google');
    }
  }

  // Sign Out
  static async signOut(): Promise<void> {
    try {
      // Clear notification cache before signing out
      NotificationService.clearCache();
      await signOut(auth);
    } catch (error: unknown) {
      logger.error('Sign out error', error);
      throw new Error('Failed to sign out');
    }
  }

  // Get User Profile
  static async getUserProfile(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      return null;
    } catch (error) {
      logger.error('Get user profile error', error);
      return null;
    }
  }

  // Update User Profile
  static async updateUserProfile(uid: string, userData: Partial<User>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...userData,
        updatedAt: serverTimestamp()
      });
    } catch (error: unknown) {
      logger.error('Update user profile error', error);
      throw new Error('Failed to update profile');
    }
  }

  // Create user from Firebase User (for Google sign in)
  private static async createUserFromFirebaseUser(firebaseUser: FirebaseUser): Promise<User> {
    const newUser: User = {
      id: firebaseUser.uid,
      displayName: firebaseUser.displayName || '',
      name: firebaseUser.displayName || '',
      email: firebaseUser.email || '',
      phone: firebaseUser.phoneNumber || '',
      role: 'rider', // Default role
      canBeDriver: false, // Default to rider only
      canBeRider: true,
      rating: 5.0,
      totalRides: 0,
      joinedDate: new Date().toISOString().split('T')[0],
      verified: firebaseUser.emailVerified,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), {
      ...newUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return newUser;
  }

  // Auth State Listener
  static onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let user = await this.getUserProfile(firebaseUser.uid);
        if (!user) {
          logger.debug('Auth state changed: profile missing, creating default profile');
          user = await this.createUserFromFirebaseUser(firebaseUser);
        }
        callback(user);
      } else {
        callback(null);
      }
    });
  }
}