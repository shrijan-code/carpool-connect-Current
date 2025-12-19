import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, Component, ReactNode } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/store/auth-store";
import { useRidesStore } from "@/store/rides-store";
import { useSettingsStore } from "@/store/settings-store";

import { initializeStripe, STRIPE_PUBLISHABLE_KEY } from "@/services/stripe";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StripeProvider } from "@stripe/stripe-react-native";
import { NotificationService } from "@/services/notifications";
import { useRouter } from "expo-router";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";

SplashScreen.preventAutoHideAsync();

// Global error handler for unhandled JSON parse errors
if (typeof global !== 'undefined') {
  const originalJsonParse = JSON.parse;
  JSON.parse = function (text: string, reviver?: any) {
    try {
      return originalJsonParse.call(this, text, reviver);
    } catch (error) {
      console.warn('JSON.parse error caught globally:', error);
      console.warn('Problematic JSON text:', text?.substring(0, 100));
      throw error;
    }
  };
}

const queryClient = new QueryClient();

// Utility functions for storage cleanup
async function cleanCorruptedStorageOnStartup() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const keysToCheck = ['app_settings', 'security_data', 'user_data', 'auth_token'];

    for (const key of keysToCheck) {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored && stored.trim()) {
          JSON.parse(stored); // Test if it's valid JSON
        }
      } catch (parseError) {
        console.warn(`Removing corrupted storage key on startup: ${key}`);
        await AsyncStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Failed to clean corrupted storage on startup:', error);
  }
}

async function clearAllStorage() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys);
    console.log('All storage cleared due to JSON errors');
  } catch (error) {
    console.error('Failed to clear all storage:', error);
  }
}

// Simple Error Boundary
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Check if it's a JSON parse error and clear potentially corrupted storage
    if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      console.warn('JSON parse error detected, clearing potentially corrupted storage');
      this.clearCorruptedStorage();
    }
  }

  private async clearCorruptedStorage() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const keysToCheck = ['app_settings', 'security_data'];

      for (const key of keysToCheck) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            JSON.parse(stored); // Test if it's valid JSON
          }
        } catch (parseError) {
          console.warn(`Removing corrupted storage key: ${key}`);
          await AsyncStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Failed to clear corrupted storage:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>Please restart the app</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
});

const createStyles = (colors: any) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  rootContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="ride-details" options={{ title: "Ride Details" }} />
      <Stack.Screen name="create-ride" options={{ title: "Create Ride" }} />
      <Stack.Screen name="search-rides" options={{ title: "Search Rides" }} />
      <Stack.Screen name="location-search" options={{ title: "Find Nearby Rides" }} />
      <Stack.Screen name="booking-requests" options={{ title: "Booking Requests" }} />
      <Stack.Screen name="booking-management" options={{ title: "Booking Management" }} />
      <Stack.Screen name="live-dashboard" options={{ title: "Live Dashboard" }} />
      <Stack.Screen name="stripe-connect-return" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const { initializeAuth, isLoading } = useAuthStore();
  const { initializeRides } = useRidesStore();
  const { loadSettings, settings } = useSettingsStore();
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Use fallback colors during initialization
  const { colors } = useTheme();
  const router = useRouter();
  const fallbackColors = {
    primary: '#007AFF',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#000000'
  };
  const safeColors = colors || fallbackColors;
  const styles = createStyles(safeColors);

  useEffect(() => {
    // Notification Listeners
    let notificationListener: any;
    let responseListener: any;

    const setupNotifications = async () => {
      // Listener for when a notification is received (foreground)
      notificationListener = NotificationService.addNotificationReceivedListener(notification => {
        console.log('[Notification] Received in foreground:', notification);
        // We could show a custom in-app toast here if we want
      });

      // Listener for when a user taps on a notification
      responseListener = NotificationService.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        console.log('[Notification] Response received:', data);

        // Handle navigation based on notification data
        if (data?.bookingId) {
          router.push(`/booking-management?bookingId=${data.bookingId}` as any);
        } else if (data?.rideId) {
          router.push(`/ride-details?id=${data.rideId}` as any);
        }
      });

      // Handle the case where the app was opened by a notification tap
      const lastResponse = await NotificationService.getLastNotificationResponse();
      if (lastResponse) {
        const data = lastResponse.notification.request.content.data;
        console.log('[Notification] App opened from:', data);
        if (data?.bookingId) {
          router.push(`/booking-management?bookingId=${data.bookingId}` as any);
        } else if (data?.rideId) {
          router.push(`/ride-details?id=${data.rideId}` as any);
        }
      }
    };

    if (isInitialized) {
      setupNotifications();
    }

    return () => {
      if (notificationListener) {
        notificationListener.remove();
      }
      if (responseListener) {
        responseListener.remove();
      }
    };
  }, [isInitialized, router]);

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('[RootLayout] Starting initialization...');
        console.log('[RootLayout] Checking environment variables...');

        // Debug: Check if env variables are accessible at runtime
        if (__DEV__) {
          const envCheck = {
            'EXPO_PUBLIC_FIREBASE_API_KEY': process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
            'EXPO_PUBLIC_FIREBASE_PROJECT_ID': process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY': process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
          };

          console.log('[RootLayout] Environment variable status:');
          Object.entries(envCheck).forEach(([key, value]) => {
            console.log(`  ${value ? '✓' : '✗'} ${key}: ${value ? 'Loaded' : 'Missing'}`);
          });
        }

        // First, check and clean any corrupted storage
        await cleanCorruptedStorageOnStartup();

        // Initialize settings first (required for theme)
        await loadSettings();
        console.log('[RootLayout] Settings loaded');

        // Initialize Stripe
        await initializeStripe();
        console.log('[RootLayout] Stripe initialized');

        // Then initialize auth and rides
        await initializeAuth();
        console.log('[RootLayout] Auth initialized');

        await initializeRides();
        console.log('[RootLayout] Rides initialized');

        setIsInitialized(true);
      } catch (error) {
        console.error('[RootLayout] Initialization error:', error);
        // If there's still an error, try clearing all storage and retry once
        if (error instanceof Error && (error.message.includes('JSON') || error.message.includes('parse'))) {
          console.warn('[RootLayout] JSON error during initialization, clearing all storage and retrying...');
          try {
            await clearAllStorage();
            await loadSettings();
            await initializeAuth();
            await initializeRides();
            setIsInitialized(true);
          } catch (retryError) {
            console.error('[RootLayout] Retry after clearing storage also failed:', retryError);
            // Still set initialized to true to prevent infinite loading
            setIsInitialized(true);
          }
        } else {
          // For non-JSON errors, still allow the app to continue
          setIsInitialized(true);
        }
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    initialize();
  }, [initializeAuth, initializeRides, loadSettings]);

  // Show loading screen until both auth loading is done AND settings are initialized
  if (isLoading || !isInitialized || !settings.isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={safeColors.primary} />
      </View>
    );
  }

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier="merchant.com.carpoolconnect" // Optional: for Apple Pay
        >
          <GestureHandlerRootView style={styles.rootContainer}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </StripeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}