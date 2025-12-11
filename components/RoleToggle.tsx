import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/auth-store';
import { StripeConnectService } from '@/services/stripe';
import { Car, User } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

type UserRole = 'rider' | 'driver';

interface RoleToggleProps {
  style?: any;
}

export const RoleToggle: React.FC<RoleToggleProps> = ({ style }) => {
  const { user, updateUser } = useAuthStore();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stripeSetupComplete, setStripeSetupComplete] = useState<boolean>(false);

  // Check Stripe Connect setup status
  useEffect(() => {
    const checkStripeSetup = async () => {
      if (user?.id) {
        try {
          const isComplete = await StripeConnectService.isConnectSetupComplete(user.id);
          setStripeSetupComplete(isComplete);
        } catch (error) {
          console.error('Error checking Stripe setup:', error);
        }
      }
    };

    checkStripeSetup();
  }, [user?.id]);

  // Handle deep linking for Stripe Connect return
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (url.includes('/stripe-connect-return') && user?.id) {
        try {
          setIsLoading(true);
          const success = await StripeConnectService.handleConnectReturn(url, user.id);
          if (success) {
            setStripeSetupComplete(true);
            Alert.alert(
              '🎉 Stripe Connect Setup Complete!',
              'You can now receive payments as a driver. Your earnings will be transferred to your connected account.'
            );
          }
        } catch (error) {
          console.error('Error handling Stripe Connect return:', error);
          Alert.alert(
            'Setup Error',
            'There was an issue completing your Stripe Connect setup. Please try again.'
          );
        } finally {
          setIsLoading(false);
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [user?.id]);

  const handleRoleToggle = async (newRole: UserRole) => {
    if (!user || isLoading) return;

    try {
      setIsLoading(true);

      // Check if user has completed 10 rides as driver
      const completedRides = user.totalRides || 0;
      const needsStripeSetup = completedRides >= 10 && !stripeSetupComplete;

      // If switching to driver and has 10+ rides but no Stripe setup
      if (newRole === 'driver' && needsStripeSetup) {
        Alert.alert(
          '💳 Payment Setup Required',
          `You have completed ${completedRides} rides. Stripe Connect setup is now mandatory to continue offering rides and receive payments.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Set Up Payments Now',
              onPress: async () => {
                try {
                  const connectUrl = await StripeConnectService.startConnectOnboarding(user);
                  console.log('Opening Stripe Connect URL:', connectUrl);
                  
                  // Open Stripe Connect onboarding
                  const result = await WebBrowser.openBrowserAsync(connectUrl, {
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
                    controlsColor: colors.primary,
                  });

                  console.log('WebBrowser result:', result);
                  
                  if (result.type === 'cancel') {
                    Alert.alert(
                      'Setup Required',
                      'Payment setup is mandatory after 10 rides. You cannot post new rides until setup is complete.'
                    );
                  }
                } catch (error) {
                  console.error('Error starting Stripe Connect:', error);
                  Alert.alert(
                    'Setup Error',
                    'Unable to start payment setup. Please try again later.'
                  );
                }
              },
            },
            {
              text: 'Set Up Later',
              style: 'default',
              onPress: async () => {
                // Allow role switch but show warning
                await updateUser({ role: newRole });
                Alert.alert(
                  '⚠️ Payment Setup Pending',
                  'You can browse as a driver but cannot post new rides until payment setup is complete.'
                );
              }
            }
          ]
        );
        return;
      }

      // If switching to driver for first time (under 10 rides), offer optional setup
      if (newRole === 'driver' && !stripeSetupComplete && completedRides < 10) {
        Alert.alert(
          '🚗 Welcome Driver!',
          `You can post up to ${10 - completedRides} more rides before payment setup becomes required. Would you like to set up payments now?`,
          [
            {
              text: 'Set Up Later',
              style: 'default',
              onPress: async () => {
                await updateUser({ role: newRole });
                Alert.alert(
                  '✅ Role Updated',
                  `You can now create rides! Payment setup will be required after ${10 - completedRides} more rides.`
                );
              }
            },
            {
              text: 'Set Up Now',
              onPress: async () => {
                try {
                  const connectUrl = await StripeConnectService.startConnectOnboarding(user);
                  await WebBrowser.openBrowserAsync(connectUrl, {
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
                    controlsColor: colors.primary,
                  });
                  await updateUser({ role: newRole });
                } catch (error) {
                  console.error('Error starting Stripe Connect:', error);
                  // Still allow role switch
                  await updateUser({ role: newRole });
                }
              }
            }
          ]
        );
        return;
      }

      // Regular role switch (to rider or driver with Stripe already set up)
      await updateUser({ role: newRole });
      
      console.log(`Role switched to: ${newRole}`);
      
      // Show success message
      Alert.alert(
        '✅ Role Updated',
        `You are now using the app as a ${newRole}. ${
          newRole === 'driver' 
            ? 'You can create rides and earn money!' 
            : 'You can book rides from available drivers!'
        }`
      );
    } catch (error) {
      console.error('Error updating role:', error);
      Alert.alert(
        'Update Failed',
        'Unable to update your role. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const currentRole = user?.role || 'rider';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.roleButton,
            styles.leftButton,
            currentRole === 'rider' && styles.activeButton,
          ]}
          onPress={() => handleRoleToggle('rider')}
          disabled={isLoading}
        >
          <User 
            size={16} 
            color={currentRole === 'rider' ? colors.background : colors.textSecondary} 
          />
          <Text
            style={[
              styles.roleText,
              currentRole === 'rider' && styles.activeText,
            ]}
          >
            Rider
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleButton,
            styles.rightButton,
            currentRole === 'driver' && styles.activeButton,
          ]}
          onPress={() => handleRoleToggle('driver')}
          disabled={isLoading}
        >
          <Car 
            size={16} 
            color={currentRole === 'driver' ? colors.background : colors.textSecondary} 
          />
          <Text
            style={[
              styles.roleText,
              currentRole === 'driver' && styles.activeText,
            ]}
          >
            Driver
          </Text>
          {currentRole === 'driver' && !stripeSetupComplete && (
            <View style={styles.setupBadge}>
              <Text style={styles.setupBadgeText}>!</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {currentRole === 'driver' && !stripeSetupComplete && (
        <TouchableOpacity
          style={styles.setupPrompt}
          onPress={() => handleRoleToggle('driver')}
          disabled={isLoading}
        >
          <Text style={styles.setupPromptText}>
            💳 Complete payment setup to receive earnings
          </Text>
        </TouchableOpacity>
      )}

      {isLoading && (
        <Text style={styles.loadingText}>Updating...</Text>
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    position: 'relative',
  },
  leftButton: {
    marginRight: 2,
  },
  rightButton: {
    marginLeft: 2,
  },
  activeButton: {
    backgroundColor: colors.primary,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  activeText: {
    color: colors.background,
  },
  setupBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupBadgeText: {
    fontSize: 10,
    fontWeight: 'bold' as const,
    color: colors.background,
  },
  setupPrompt: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.warning,
    borderRadius: 8,
  },
  setupPromptText: {
    fontSize: 12,
    color: colors.background,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
});