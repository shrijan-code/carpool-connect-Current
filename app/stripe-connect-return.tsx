import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { StripeConnectService } from '@/services/stripe';
import { logger } from '@/utils/logger';

export default function StripeConnectReturnScreen() {
  const { user } = useAuthStore();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleConnectReturn = async () => {
      try {
        if (!user?.id) {
          console.error('No user found for Stripe Connect return');
          router.replace('/(tabs)/profile');
          return;
        }

        // Get the full URL from params
        const code = params.code as string;
        const state = params.state as string;
        const error = params.error as string;

        if (error) {
          console.error('Stripe Connect error:', error);
          router.replace('/(tabs)/profile');
          return;
        }

        if (code && state) {
          // Construct the return URL for processing
          const returnUrl = `rideshare://stripe-connect-return?code=${code}&state=${state}`;

          const success = await StripeConnectService.handleConnectReturn(returnUrl, user.id);

          if (success) {
            logger.payment.succeeded('stripe_connect_setup');
          }
        }

        // Navigate back to profile or home
        router.replace('/(tabs)/profile');

      } catch (error) {
        console.error('Error handling Stripe Connect return:', error);
        router.replace('/(tabs)/profile');
      }
    };

    handleConnectReturn();
  }, [user?.id, params]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.title}>Setting up your payments...</Text>
        <Text style={styles.subtitle}>
          Please wait while we complete your Stripe Connect setup.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});