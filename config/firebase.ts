import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get Firebase configuration from environment variables
const getFirebaseConfig = () => {
  // Try to get from Expo Constants first (for production builds)
  const extra = Constants.expoConfig?.extra;

  if (extra?.firebase) {
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

  // Fallback to process.env for development
  return {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCxwV_Va0voJxTdc8aAcqqphKIQp3FnAIo",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "carpoolconnect1-0.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "carpoolconnect1-0",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "carpoolconnect1-0.appspot.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "889604849863",
    appId: process.env.FIREBASE_APP_ID || "1:889604849863:web:8734c34781342a92197ee2",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-VMLT612MQN",
  };
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
let auth;
let db;

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