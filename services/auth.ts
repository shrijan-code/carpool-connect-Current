import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  sendPasswordResetEmail
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

// Configure WebBrowser for auth session
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export class AuthService {
  // Password Reset
  static async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      console.log('AuthService: Attempting to send password reset email to:', email);
      console.log('AuthService: Firebase auth instance:', !!auth);
      console.log('AuthService: Firebase config:', {
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain
      });
      
      await sendPasswordResetEmail(auth, email);
      console.log('AuthService: Password reset email sent successfully');
    } catch (error: any) {
      console.error('AuthService: Password reset error:', error);
      console.error('AuthService: Error code:', error.code);
      console.error('AuthService: Error message:', error.message);
      
      // Handle specific Firebase Auth errors
      switch (error.code) {
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
          throw new Error(error.message || 'Failed to send password reset email. Please try again.');
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
      
      // Record successful login
      await SecurityManager.recordSuccessfulLogin(sanitizedEmail);
      
      let user = await this.getUserProfile(userCredential.user.uid);
      if (!user) {
        console.log('User profile not found after sign-in. Creating default profile...');
        user = await this.createUserFromFirebaseUser(userCredential.user);
      }
      
      return user;
    } catch (error: any) {
      console.error('Sign in error:', error);
      
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save user profile to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return newUser;
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to create account');
    }
  }

  // Google Sign In
  static async signInWithGoogle(): Promise<User> {
    try {
      if (Platform.OS === 'web') {
        // Check if current domain is authorized
        const currentDomain = window.location.hostname;
        console.log('Current domain:', currentDomain);
        
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
        console.log('Redirect URI:', redirectUri);

        const request = new AuthSession.AuthRequest({
          clientId: Platform.select({
            ios: '889604849863-your-ios-client-id.apps.googleusercontent.com', 
            android: '889604849863-your-android-client-id.apps.googleusercontent.com',
            default: '889604849863-web:8734c34781342a92197ee2.apps.googleusercontent.com',
          }),
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
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      // Provide specific error messages for common issues
      if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = Platform.OS === 'web' ? window.location.hostname : 'mobile';
        throw new Error(
          `Domain '${currentDomain}' is not authorized for Google Sign-In. ` +
          'Please add this domain to Firebase Authentication authorized domains in the Firebase Console.'
        );
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by browser. Please allow popups and try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled.');
      }
      
      throw new Error(error.message || 'Failed to sign in with Google');
    }
  }

  // Sign Out
  static async signOut(): Promise<void> {
    try {
      // Clear notification cache before signing out
      NotificationService.clearCache();
      await signOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
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
      console.error('Get user profile error:', error);
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
    } catch (error: any) {
      console.error('Update user profile error:', error);
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
          console.log('Auth state changed: profile missing. Creating default profile...');
          user = await this.createUserFromFirebaseUser(firebaseUser);
        }
        callback(user);
      } else {
        callback(null);
      }
    });
  }
}