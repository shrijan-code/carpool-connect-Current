// Main configuration exports
export { auth, db, storage, functions, firebaseConfig } from './firebase';
export { stripeConfig, appConfig, googleMapsConfig, initializeStripe } from './stripe';

// Re-export Firebase app as default
export { default as firebaseApp } from './firebase';