import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get Firebase configuration from environment variables
const getFirebaseConfig = () => {
  // Debug: Log environment variable status
  if (__DEV__) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [Firebase Config] Checking environment variables...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const envVars = {
      'FIREBASE_API_KEY': process.env.FIREBASE_API_KEY,
      'EXPO_PUBLIC_FIREBASE_API_KEY': process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID,
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID': process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    };

    Object.entries(envVars).forEach(([key, value]) => {
      const status = value ? '✓ Loaded' : '✗ Missing';
      const preview = value ? `(${String(value).substring(0, 20)}...)` : '';
      console.log(`  ${status} ${key} ${preview}`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  // Try to get from Expo Constants first (for production builds)
  const extra = Constants.expoConfig?.extra;

  if (extra?.firebase) {
    console.log('✓ [Firebase Config] Using configuration from Expo Constants');
    return {
      apiKey: extra.firebase.apiKey,
      authDomain: extra.firebase.authDomain,
      projectId: extra.firebase.projectId,
      storageBucket: extra.firebase.storageBucket,
      messagingSenderId: extra.firebase.messagingSenderId,
      appId: extra.firebase.appId,
      measurementId: extra.firebase.measurementId,
    };
  }

  console.log('ℹ️  [Firebase Config] Using configuration from environment variables');

  // Use environment variables - no hardcoded fallbacks for security
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  // Validate required fields are present
  if (!config.apiKey || !config.projectId) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [Firebase Config] CRITICAL ERROR: Missing required configuration!');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Missing fields:');
    if (!config.apiKey) console.error('  ✗ FIREBASE_API_KEY or EXPO_PUBLIC_FIREBASE_API_KEY');
    if (!config.projectId) console.error('  ✗ FIREBASE_PROJECT_ID or EXPO_PUBLIC_FIREBASE_PROJECT_ID');
    console.error('');
    console.error('📋 Solution:');
    console.error('  1. Ensure your .env file exists in the project root');
    console.error('  2. Verify it contains the required Firebase variables');
    console.error('  3. Restart the Metro bundler (npx expo start --clear)');
    console.error('  4. Check .env.example for the correct format');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // In development, provide helpful error; in production this would fail
    if (__DEV__) {
      throw new Error(
        '🔥 Firebase configuration not found!\n\n' +
        'Your .env file is either missing or not being loaded correctly.\n' +
        'Check the console logs above for details.\n\n' +
        'Required variables:\n' +
        '  - FIREBASE_API_KEY\n' +
        '  - FIREBASE_PROJECT_ID\n' +
        '  - (and other Firebase config variables)\n\n' +
        'See .env.example for the correct format.'
      );
    }
  }

  return config;
};

// Initialize Firebase
const firebaseConfig = getFirebaseConfig();
console.log('Initializing Firebase with config:', {
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  authDomain: firebaseConfig.authDomain
});

// Check if Firebase app is already initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
  console.log('Firebase app already initialized, using existing instance');
}

// Initialize Firebase services
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;

try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app);
}

// Initialize Firestore - check if already initialized
try {
  db = getFirestore(app);
  console.log('Firestore already initialized, using existing instance');
} catch {
  // Initialize Firestore with robust connectivity and persistence settings
  // Use persistent cache for all platforms to reduce network reads
  const baseSettings = {
    // Persistent cache for both web and mobile to reduce reads
    localCache: persistentLocalCache({
      // Default cache size (40MB) is fine for most apps
      // cacheSizeBytes: 50 * 1024 * 1024, // 50MB
    }),
  };

  const connectivitySettings: Partial<import('firebase/firestore').FirestoreSettings> = {
    experimentalAutoDetectLongPolling: true,
  };

  db = initializeFirestore(
    app,
    { ...(baseSettings as object), ...(connectivitySettings as object) } as import('firebase/firestore').FirestoreSettings,
  );
  console.log('Firestore initialized with persistent cache enabled for offline support');
}

const storage = getStorage(app);
const functions = getFunctions(app);

if (__DEV__) {
  console.log('[Firebase] Firestore settings applied', {
    platform: Platform.OS,
    cache: Platform.OS === 'web' ? 'persistentSingleTab' : 'memory',
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false,
  });
}

// Export Firebase services
export { auth, db, storage, functions, firebaseConfig };
export default app;