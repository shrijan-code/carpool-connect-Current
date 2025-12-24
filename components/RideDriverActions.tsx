import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Play, Square } from 'lucide-react-native';
import { router } from 'expo-router';
import { Ride } from '@/types';
import { RidesService } from '@/services/rides';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { usePreventDoubleClick } from '@/hooks/usePreventDoubleClick';

interface RideDriverActionsProps {
  ride: Ride;
  isDriver: boolean;
  currentUserId: string | undefined;
  onUpdated?: () => void;
}

export default function RideDriverActions({ ride, isDriver, currentUserId, onUpdated }: RideDriverActionsProps) {
  const [loading, setLoading] = useState<'start' | 'complete' | null>(null);

  const canStart = useMemo(() => isDriver && (ride.status === 'upcoming' || (ride.status as unknown as string) === 'in_progress') && (ride.passengers?.length ?? 0) > 0, [isDriver, ride.status, ride.passengers]);
  const canComplete = useMemo(() => isDriver && (ride.status === 'active' || (ride.status as unknown as string) === 'in_progress'), [isDriver, ride.status]);

  const { wrapAction } = usePreventDoubleClick();

  const handleStart = useCallback(() => {
    wrapAction(async () => {
      if (!currentUserId) return;

      Alert.alert(
        'Start Driving?',
        'This will notify riders that the ride has started.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start',
            onPress: async () => {
              try {
                setLoading('start');
                console.log('[RideDriverActions] Starting ride', ride.id);
                await RidesService.updateRideTrackingStatus(ride.id, 'passengers_onboard', currentUserId);
                Alert.alert('Ride has started ✅');
                if (onUpdated) onUpdated();
              } catch (e: any) {
                console.error('[RideDriverActions] start error', e);
                Alert.alert('Failed to start ride', e?.message ?? 'Please try again');
              } finally {
                setLoading(null);
              }
            }
          }
        ]
      );
    })();
  }, [currentUserId, onUpdated, ride.id, wrapAction]);

  const handleComplete = useCallback(() => {
    wrapAction(async () => {
      if (!currentUserId) return;

      Alert.alert(
        'Complete Ride?',
        'This will process payments and send your payout.',
        [
          { text: 'Not yet', style: 'cancel' },
          {
            text: 'Complete',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading('complete');
                console.log('[RideDriverActions] Completing ride and processing payments', ride.id);

                // Use Cloud Function to properly process payments
                const completeRideAndCharge = httpsCallable(functions, 'completeRideAndCharge');
                const result = await completeRideAndCharge({ rideId: ride.id });
                const data = result.data as any;

                if (data.success) {
                  const summary = data.summary;
                  // Show success with option to rate passengers
                  Alert.alert(
                    'Ride Completed! 🎉',
                    `Great job! Your ride has been completed successfully.\n\n💰 Earnings: $${(summary?.driverPayout || 0).toFixed(2)}\n\nWould you like to rate your passengers now?`,
                    [
                      {
                        text: 'Not Now',
                        style: 'cancel',
                        onPress: () => {
                          // Navigate back to rides list
                          router.replace('/(tabs)/rides');
                        }
                      },
                      {
                        text: 'Rate Passengers',
                        onPress: () => {
                          router.push({
                            pathname: '/ride-review' as any,
                            params: { rideId: ride.id },
                          });
                        },
                      },
                    ]
                  );
                } else {
                  throw new Error(data.message || 'Failed to complete ride');
                }

                if (onUpdated) onUpdated();
              } catch (e: any) {
                console.error('[RideDriverActions] complete error', e);
                Alert.alert('Failed to complete ride', e?.message ?? 'Please try again');
              } finally {
                setLoading(null);
              }
            }
          }
        ]
      );
    })();
  }, [currentUserId, onUpdated, ride.id, wrapAction]);

  if (!isDriver) return null;

  return (
    <View style={styles.container} testID="rideDriverActions">
      {canStart && (
        <TouchableOpacity
          testID="startRideButton"
          style={[styles.actionButton, styles.startButton]}
          onPress={handleStart}
          disabled={loading !== null}
        >
          {loading === 'start' ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Play size={18} color="#FFF" />
              <Text style={styles.btnText}>Start Driving</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {canComplete && (
        <TouchableOpacity
          testID="completeRideButton"
          style={[styles.actionButton, styles.completeButton]}
          onPress={handleComplete}
          disabled={loading !== null}
        >
          {loading === 'complete' ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Square size={18} color="#FFF" />
              <Text style={styles.btnText}>Complete Ride</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startButton: {
    backgroundColor: '#007AFF',
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});