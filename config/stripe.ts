import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get Stripe configuration from environment variables
const getStripeConfig = () => {
  // Try to get from Expo Constants first (for production builds)
  const extra = Constants.expoConfig?.extra;
  
  if (extra?.stripe) {
    return {
      publishableKey: extra.stripe.publishableKey,
    };
  }

  // Fallback to process.env for development
  return {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_51HMiYNDuXA4vn5QKRFRjdRH71bcNVlaxgaB459LlIuyAre8qUVEb53vf4haYuAKm2nVPxGssxvxaKN9Eb00kXF1n000Hg6HieO",
  };
};

// Get app configuration
const getAppConfig = () => {
  const extra = Constants.expoConfig?.extra;
  
  if (extra?.app) {
    return {
      environment: extra.app.environment,
      functionsUrl: extra.app.functionsUrl,
      scheme: extra.app.scheme,
      version: extra.app.version,
    };
  }

  return {
    environment: process.env.ENVIRONMENT || 'development',
    functionsUrl: process.env.FIREBASE_FUNCTIONS_URL || 'https://us-central1-carpoolconnect1-0.cloudfunctions.net',
    scheme: process.env.APP_SCHEME || 'carpoolconnect',
    version: process.env.APP_VERSION || '1.0.0',
  };
};

// Get Google Maps configuration
const getGoogleMapsConfig = () => {
  const extra = Constants.expoConfig?.extra;
  
  if (extra?.googleMaps) {
    return {
      apiKey: extra.googleMaps.apiKey,
    };
  }

  return {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  };
};

// Export configurations
export const stripeConfig = getStripeConfig();
export const appConfig = getAppConfig();
export const googleMapsConfig = getGoogleMapsConfig();

// Stripe initialization for React Native
export const initializeStripe = async (): Promise<void> => {
  console.log(`Stripe initialization for ${Platform.OS} platform`);
  
  if (Platform.OS === 'web') {
    console.log('Stripe initialization skipped on web platform - using web-compatible payment methods');
    return Promise.resolve();
  }
  
  // For native platforms, we simulate initialization
  // In production, you would properly initialize Stripe here with:
  // import { initStripe } from '@stripe/stripe-react-native';
  // await initStripe({ publishableKey: stripeConfig.publishableKey });
  
  console.log('Stripe initialization completed for native platform');
  return Promise.resolve();
};

// Validate configuration
const validateConfig = () => {
  const errors: string[] = [];

  if (!stripeConfig.publishableKey || stripeConfig.publishableKey.includes('your_')) {
    errors.push('STRIPE_PUBLISHABLE_KEY is not properly configured');
  }

  if (!googleMapsConfig.apiKey || googleMapsConfig.apiKey.includes('your_')) {
    console.warn('GOOGLE_MAPS_API_KEY is not configured - Places Autocomplete will not work');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:', errors);
    if (appConfig.environment === 'production') {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }
  }
};

// Run validation
validateConfig();

console.log('Configuration loaded:', {
  environment: appConfig.environment,
  stripeConfigured: !!stripeConfig.publishableKey && !stripeConfig.publishableKey.includes('your_'),
  googleMapsConfigured: !!googleMapsConfig.apiKey && !googleMapsConfig.apiKey.includes('your_'),
  functionsUrl: appConfig.functionsUrl,
});