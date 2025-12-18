require('dotenv').config();

module.exports = ({ config }) => {
    // Load environment variables
    const env = {
        // Firebase config (non-public, loaded via extra)
        firebase: {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            measurementId: process.env.FIREBASE_MEASUREMENT_ID,
        },
        // Public env vars (accessible via process.env at runtime)
        EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
        EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        EXPO_PUBLIC_FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
        EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
        EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
        EXPO_PUBLIC_FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
        EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
    };

    console.log('[app.config.js] Loading environment variables...');
    console.log('[app.config.js] Google Places API Key:', env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ? 'Loaded ✓' : 'Missing ✗');
    console.log('[app.config.js] Stripe Key:', env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'Loaded ✓' : 'Missing ✗');
    console.log('[app.config.js] Firebase Project:', env.firebase.projectId || 'Missing ✗');

    return {
        ...config,
        extra: {
            ...config.extra,
            firebase: env.firebase,
            googlePlacesApiKey: env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
            stripePublishableKey: env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        },
        // These env vars will be available as process.env.EXPO_PUBLIC_* at runtime
        env: {
            EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
            EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
            EXPO_PUBLIC_FIREBASE_API_KEY: env.EXPO_PUBLIC_FIREBASE_API_KEY,
            EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
            EXPO_PUBLIC_FIREBASE_PROJECT_ID: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
            EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            EXPO_PUBLIC_FIREBASE_APP_ID: env.EXPO_PUBLIC_FIREBASE_APP_ID,
            EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
        },
    };
};
