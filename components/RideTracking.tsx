import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation, CheckCircle, XCircle, ChevronRight, Users, MapPin, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Ride } from '@/types';
import { RidesService } from '@/services/rides';
import { PaymentService } from '@/services/payment';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.7;

interface RideTrackingProps {
  ride: Ride;
  isDriver: boolean;
  onRideStatusChange?: (status: string) => void;
}

export const RideTracking: React.FC<RideTrackingProps> = ({ ride, isDriver, onRideStatusChange }) => {
  const [rideStatus, setRideStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');
  const [isProcessing, setIsProcessing] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const [swipeDirection, setSwipeDirection] = useState<'start' | 'end'>('start');

  useEffect(() => {
    // Check current ride status
    if (ride.status === 'active') {
      setRideStatus('in_progress');
      setSwipeDirection('end');
    } else if (ride.status === 'completed') {
      setRideStatus('completed');
    }
  }, [ride.status]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isProcessing && rideStatus !== 'completed',
      onMoveShouldSetPanResponder: () => !isProcessing && rideStatus !== 'completed',
      onPanResponderGrant: () => {
        // Start gesture
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx <= SWIPE_THRESHOLD + 50) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          handleSwipeComplete();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const handleSwipeComplete = async () => {
    setIsProcessing(true);

    try {
      if (rideStatus === 'not_started') {
        // Start ride
        Alert.alert(
          'Start Ride',
          'Are you ready to start this ride? Make sure all passengers are on board.',
          [
            {
              text: 'Cancel',
              onPress: () => {
                setIsProcessing(false);
                Animated.spring(translateX, {
                  toValue: 0,
                  useNativeDriver: true,
                }).start();
              },
              style: 'cancel',
            },
            {
              text: 'Start',
              onPress: async () => {
                try {
                  await RidesService.updateRideStatus(ride.id, 'active');
                  setRideStatus('in_progress');
                  setSwipeDirection('end');
                  onRideStatusChange?.('in_progress');

                  Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                  }).start();

                  Alert.alert('Ride Started', 'The ride has been started. Drive safely!');
                } catch (error) {
                  Alert.alert('Error', 'Failed to start ride. Please try again.');
                } finally {
                  setIsProcessing(false);
                }
              },
            },
          ]
        );
      } else if (rideStatus === 'in_progress') {
        // End ride
        Alert.alert(
          'End Ride',
          'Have you reached the destination and all passengers have exited?',
          [
            {
              text: 'Cancel',
              onPress: () => {
                setIsProcessing(false);
                Animated.spring(translateX, {
                  toValue: 0,
                  useNativeDriver: true,
                }).start();
              },
              style: 'cancel',
            },
            {
              text: 'End Ride',
              onPress: async () => {
                try {
                  await RidesService.updateRideStatus(ride.id, 'completed');

                  // Process payments for all passengers
                  if (ride.passengers && ride.passengers.length > 0) {
                    for (const passenger of ride.passengers) {
                      if (passenger.bookingId) {
                        // Process payment using ride price per seat
                        await PaymentService.processRidePayment(
                          ride.id,
                          ride.pricePerSeat * passenger.seats || 0,
                          'default_payment_method',
                          passenger.id,
                          ride.driverId
                        );
                      }
                    }
                  }

                  setRideStatus('completed');
                  onRideStatusChange?.('completed');

                  Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                  }).start();

                  Alert.alert(
                    'Ride Completed! 🎉',
                    'Great job! All passengers have arrived safely. Your earnings will be processed shortly.'
                  );
                } catch (error) {
                  Alert.alert('Error', 'Failed to end ride. Please try again.');
                } finally {
                  setIsProcessing(false);
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      setIsProcessing(false);
      Alert.alert('Error', 'An error occurred. Please try again.');
    }
  };

  const getSwipeText = () => {
    if (rideStatus === 'not_started') return 'Swipe to Start Ride';
    if (rideStatus === 'in_progress') return 'Swipe to End Ride';
    return 'Ride Completed';
  };

  const getSwipeColor = () => {
    if (rideStatus === 'not_started') return [Colors.success, '#10b981'];
    if (rideStatus === 'in_progress') return [Colors.error, '#ef4444'];
    return [Colors.textSecondary, Colors.textLight];
  };

  const getStatusIcon = () => {
    if (rideStatus === 'not_started') return <Navigation size={24} color="#fff" />;
    if (rideStatus === 'in_progress') return <CheckCircle size={24} color="#fff" />;
    return <CheckCircle size={24} color={Colors.success} />;
  };

  if (!isDriver) {
    // Passenger view - show ride status only
    return (
      <View style={styles.passengerContainer}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            {rideStatus === 'not_started' && <Clock size={20} color={Colors.warning} />}
            {rideStatus === 'in_progress' && <Navigation size={20} color={Colors.primary} />}
            {rideStatus === 'completed' && <CheckCircle size={20} color={Colors.success} />}
            <Text style={styles.statusTitle}>
              {rideStatus === 'not_started' && 'Waiting for ride to start'}
              {rideStatus === 'in_progress' && 'Ride in progress'}
              {rideStatus === 'completed' && 'Ride completed'}
            </Text>
          </View>

          {rideStatus === 'in_progress' && (
            <View style={styles.progressInfo}>
              <View style={styles.infoRow}>
                <MapPin size={16} color={Colors.textSecondary} />
                <Text style={styles.infoText}>
                  En route to {ride.destination?.name || ride.to?.name}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Users size={16} color={Colors.textSecondary} />
                <Text style={styles.infoText}>
                  {ride.passengers?.length || 0} passengers on board
                </Text>
              </View>
            </View>
          )}

          {rideStatus === 'completed' && (
            <Text style={styles.completedText}>
              Ride complete! 🎉 Thank you for riding with us. Your payment has been processed.
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Driver view - swipe controls
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride Control</Text>
        <Text style={styles.subtitle}>
          {rideStatus === 'not_started' && 'Swipe to begin the journey'}
          {rideStatus === 'in_progress' && 'Swipe when you reach the destination'}
          {rideStatus === 'completed' && 'This ride has been completed'}
        </Text>
      </View>

      {rideStatus !== 'completed' && (
        <View style={styles.swipeContainer}>
          <LinearGradient
            colors={getSwipeColor() as [string, string, ...string[]]}
            style={styles.swipeTrack}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.swipeText}>{getSwipeText()}</Text>
            <ChevronRight size={20} color="#fff" style={styles.chevron1} />
            <ChevronRight size={20} color="#fff" style={styles.chevron2} />
            <ChevronRight size={20} color="#fff" style={styles.chevron3} />
          </LinearGradient>

          <Animated.View
            style={[
              styles.swipeButton,
              {
                transform: [{ translateX }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.swipeButtonInner}>
              {getStatusIcon()}
            </View>
          </Animated.View>
        </View>
      )}

      {rideStatus === 'completed' && (
        <View style={styles.completedContainer}>
          <CheckCircle size={48} color={Colors.success} />
          <Text style={styles.completedTitle}>Ride Completed Successfully</Text>
          <Text style={styles.completedSubtitle}>
            Payments have been processed. Your earnings will be deposited within 7 business days.
          </Text>
        </View>
      )}

      <View style={styles.rideInfo}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MapPin size={16} color={Colors.textSecondary} />
            <Text style={styles.infoLabel}>From:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {ride.origin?.address || ride.from?.address}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={16} color={Colors.textSecondary} />
            <Text style={styles.infoLabel}>To:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {ride.destination?.address || ride.to?.address}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Users size={16} color={Colors.textSecondary} />
            <Text style={styles.infoLabel}>Passengers:</Text>
            <Text style={styles.infoValue}>
              {ride.passengers?.length || 0} / {ride.seatsTotal || ride.seatsAvailable || 0}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  swipeContainer: {
    height: 64,
    marginBottom: 24,
    position: 'relative',
  },
  swipeTrack: {
    flex: 1,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  swipeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  chevron1: {
    position: 'absolute',
    right: 100,
    opacity: 0.3,
  },
  chevron2: {
    position: 'absolute',
    right: 70,
    opacity: 0.5,
  },
  chevron3: {
    position: 'absolute',
    right: 40,
    opacity: 0.7,
  },
  swipeButton: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  swipeButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  completedSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  rideInfo: {
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
    marginRight: 8,
    minWidth: 40,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  passengerContainer: {
    marginVertical: 16,
  },
  statusCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 12,
  },
  progressInfo: {
    marginTop: 8,
  },
  completedText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});