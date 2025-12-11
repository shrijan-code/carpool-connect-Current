import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { Colors } from '@/constants/colors';

export default function IndexScreen() {
  const { isAuthenticated, isOnboarded, isLoading } = useAuthStore();

  useEffect(() => {
    // Wait for auth to be fully initialized before navigating
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (!isOnboarded) {
          router.replace('/onboarding');
        } else if (!isAuthenticated) {
          router.replace('/auth');
        } else {
          router.replace('/(tabs)/home');
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, isOnboarded]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});