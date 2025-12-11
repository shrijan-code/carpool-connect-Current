import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Play, Square } from 'lucide-react-native';
import { Ride } from '@/types';
import { RidesService } from '@/services/rides';

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

  const handleStart = useCallback(() => {
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
  }, [currentUserId, onUpdated, ride.id]);



  const handleComplete = useCallback(() => {
    if (!currentUserId) return;
    Alert.alert(
      'Complete Ride?',
      'This will notify riders and process mock payment.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading('complete');
              console.log('[RideDriverActions] Completing ride', ride.id);
              await RidesService.updateRideTrackingStatus(ride.id, 'completed', currentUserId);
              Alert.alert('Ride completed 🎉', 'Your ride is complete.');
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
  }, [currentUserId, onUpdated, ride.id]);

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