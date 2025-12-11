import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { 
  Navigation, 
  CheckCircle, 
  Users, 
  MapPin, 
  Clock,
  Car,
  UserCheck,
  AlertCircle,
  User,
  Phone,
  MessageCircle
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Ride, Booking } from '@/types';
import { RidesService } from '@/services/rides';
import { useAuthStore } from '@/store/auth-store';
import RideDriverActions from '@/components/RideDriverActions';

interface EnhancedRideTrackingProps {
  ride: Ride;
  booking?: Booking;
  isDriver: boolean;
  onStatusChange?: () => void;
}

type TrackingStatus = 'waiting' | 'driver_assigned' | 'pickup_confirmed' | 'passengers_onboard' | 'in_transit' | 'arrived' | 'completed';
type PassengerStatus = 'waiting' | 'ready' | 'onboard' | 'dropped_off';

export const EnhancedRideTracking: React.FC<EnhancedRideTrackingProps> = ({ 
  ride, 
  booking,
  isDriver, 
  onStatusChange 
}) => {
  const { user } = useAuthStore();
  const [currentStatus, setCurrentStatus] = useState<TrackingStatus>(ride.trackingStatus || 'waiting');
  const [passengerStatus, setPassengerStatus] = useState<PassengerStatus>(booking?.passengerStatus || 'waiting');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (ride.trackingStatus) {
      setCurrentStatus(ride.trackingStatus);
    }
    if (booking?.passengerStatus) {
      setPassengerStatus(booking.passengerStatus);
    }
  }, [ride.trackingStatus, booking?.passengerStatus]);

  useEffect(() => {
    if (isDriver) {
      loadBookings();
    }
  }, [ride.id, isDriver]);

  const loadBookings = async () => {
    try {
      const rideBookings = await RidesService.getRideBookings(ride.id);
      setBookings(rideBookings.filter(b => b.status === 'confirmed'));
    } catch (error) {
      console.error('Failed to load bookings:', error);
    }
  };

  const updateRideStatus = async (newStatus: TrackingStatus) => {
    setIsProcessing(true);
    try {
      const statusMessages: Record<TrackingStatus, { title: string; message: string }> = {
        'driver_assigned': { title: 'Mark as Ready', message: 'Are you ready to start heading to the pickup location?' },
        'pickup_confirmed': { title: 'Confirm Arrival', message: 'Have you arrived at the pickup location?' },
        'passengers_onboard': { title: 'Start Ride', message: 'Are all passengers onboard and ready to go?' },
        'in_transit': { title: 'In Transit', message: 'Confirm that you are now on the way to the destination.' },
        'arrived': { title: 'Arrived', message: 'Have you arrived at the destination?' },
        'completed': { title: 'Complete Ride', message: 'Have all passengers exited safely? This will complete the ride and process payments.' },
        'waiting': { title: '', message: '' },
      };

      const { title, message } = statusMessages[newStatus];

      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsProcessing(false) },
          {
            text: 'Confirm',
            onPress: async () => {
              try {
                await RidesService.updateRideTrackingStatus(ride.id, newStatus, user?.id || '');
                setCurrentStatus(newStatus);
                onStatusChange?.();
                Alert.alert('Success', `Status updated to ${newStatus.replace(/_/g, ' ')}`);
              } catch (error) {
                Alert.alert('Error', 'Failed to update status. Please try again.');
              } finally {
                setIsProcessing(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      setIsProcessing(false);
      Alert.alert('Error', 'An error occurred. Please try again.');
    }
  };

  const updatePassengerStatus = async (newStatus: PassengerStatus) => {
    if (!booking) return;
    setIsProcessing(true);
    try {
      const statusMessages: Record<PassengerStatus, { title: string; message: string }> = {
        'ready': { title: 'Mark as Ready', message: 'Are you ready for pickup at the designated location?' },
        'onboard': { title: 'Confirm Boarding', message: 'Have you boarded the vehicle?' },
        'dropped_off': { title: 'Confirm Drop-off', message: 'Have you been dropped off at your destination?' },
        'waiting': { title: '', message: '' },
      };

      const { title, message } = statusMessages[newStatus];

      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsProcessing(false) },
          {
            text: 'Confirm',
            onPress: async () => {
              try {
                await RidesService.updatePassengerStatus(booking.id, newStatus, user?.id || '');
                setPassengerStatus(newStatus);
                onStatusChange?.();
                Alert.alert('Success', `Status updated`);
              } catch (error) {
                Alert.alert('Error', 'Failed to update status. Please try again.');
              } finally {
                setIsProcessing(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      setIsProcessing(false);
      Alert.alert('Error', 'An error occurred. Please try again.');
    }
  };

  const getStatusIcon = (status: TrackingStatus | PassengerStatus) => {
    const iconMap: Record<string, React.ReactElement> = {
      'waiting': <Clock size={24} color="#fff" />,
      'driver_assigned': <Car size={24} color="#fff" />,
      'pickup_confirmed': <MapPin size={24} color="#fff" />,
      'passengers_onboard': <Users size={24} color="#fff" />,
      'in_transit': <Navigation size={24} color="#fff" />,
      'arrived': <MapPin size={24} color="#fff" />,
      'completed': <CheckCircle size={24} color="#fff" />,
      'ready': <UserCheck size={24} color="#fff" />,
      'onboard': <Users size={24} color="#fff" />,
      'dropped_off': <CheckCircle size={24} color="#fff" />
    };
    return iconMap[status] || <AlertCircle size={24} color="#fff" />;
  };


  const renderStatusTimeline = () => {
    const statuses: TrackingStatus[] = ['waiting', 'driver_assigned', 'pickup_confirmed', 'passengers_onboard', 'in_transit', 'arrived', 'completed'];
    const currentIndex = statuses.indexOf(currentStatus);

    return (
      <View style={styles.timeline}>
        {statuses.map((status, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <View key={status} style={styles.timelineItem}>
              <View style={[
                styles.timelineNode,
                isActive && styles.timelineNodeActive,
                isCurrent && styles.timelineNodeCurrent
              ]}>
                {isActive && <CheckCircle size={16} color="#fff" />}
              </View>
              {index < statuses.length - 1 && (
                <View style={[
                  styles.timelineLine,
                  isActive && styles.timelineLineActive
                ]} />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderPassengerList = () => {
    if (!isDriver || bookings.length === 0) return null;

    return (
      <View style={styles.passengerSection}>
        <Text style={styles.sectionTitle}>Passengers ({bookings.length})</Text>
        {bookings.map((booking) => (
          <View key={booking.id} style={styles.passengerCard}>
            <View style={styles.passengerInfo}>
              <User size={20} color={Colors.textSecondary} />
              <View style={styles.passengerDetails}>
                <Text style={styles.passengerName}>
                  {booking.passenger?.name || 'Unknown'}
                </Text>
                <Text style={styles.passengerStatus}>
                  {booking.passengerStatus ? booking.passengerStatus.replace(/_/g, ' ') : 'waiting'} • {booking.seats} seat{booking.seats > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <View style={styles.passengerActions}>
              <TouchableOpacity style={styles.actionButton}>
                <Phone size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <MessageCircle size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (isProcessing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Updating status...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isDriver ? 'Ride Management' : 'Trip Status'}
        </Text>
        <Text style={styles.subtitle}>
          {ride.origin?.name || ride.from?.name} → {ride.destination?.name || ride.to?.name}
        </Text>
      </View>

      {renderStatusTimeline()}

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          {getStatusIcon(isDriver ? currentStatus : passengerStatus)}
          <Text style={styles.statusTitle}>
            {isDriver 
              ? currentStatus.replace(/_/g, ' ').toUpperCase()
              : passengerStatus.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        
        {ride.trackingStatus && (
          <View style={styles.statusDetails}>
            {ride.driverAssignedAt && (
              <Text style={styles.statusTime}>
                Driver assigned: {new Date(ride.driverAssignedAt).toLocaleTimeString()}
              </Text>
            )}
            {ride.pickupConfirmedAt && (
              <Text style={styles.statusTime}>
                Pickup confirmed: {new Date(ride.pickupConfirmedAt).toLocaleTimeString()}
              </Text>
            )}
            {ride.passengersOnboardAt && (
              <Text style={styles.statusTime}>
                Ride started: {new Date(ride.passengersOnboardAt).toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}
      </View>

      {renderPassengerList()}

      {isDriver && (
        <View style={styles.actionsContainer}>
          <RideDriverActions
            ride={ride}
            isDriver={isDriver}
            currentUserId={user?.id}
            onUpdated={onStatusChange}
          />
        </View>
      )}

      {(currentStatus === 'completed' || passengerStatus === 'dropped_off') && (
        <View style={styles.completedContainer}>
          <CheckCircle size={48} color={Colors.success} />
          <Text style={styles.completedTitle}>
            {isDriver ? 'Ride Completed Successfully' : 'Trip Completed'}
          </Text>
          <Text style={styles.completedSubtitle}>
            {isDriver 
              ? 'All passengers have been charged and payments are being processed.'
              : 'Thank you for riding with us! Your payment has been processed.'}
          </Text>
        </View>
      )}

      <View style={styles.rideDetails}>
        <View style={styles.detailRow}>
          <MapPin size={16} color={Colors.textSecondary} />
          <Text style={styles.detailLabel}>Pickup:</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {ride.origin?.address || ride.from?.address}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <MapPin size={16} color={Colors.textSecondary} />
          <Text style={styles.detailLabel}>Dropoff:</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {ride.destination?.address || ride.to?.address}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Users size={16} color={Colors.textSecondary} />
          <Text style={styles.detailLabel}>Capacity:</Text>
          <Text style={styles.detailValue}>
            {ride.seatsTotal - (ride.seatsAvailable || 0)} / {ride.seatsTotal} seats filled
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Clock size={16} color={Colors.textSecondary} />
          <Text style={styles.detailLabel}>Departure:</Text>
          <Text style={styles.detailValue}>
            {new Date(ride.departureAt || ride.departureTime || '').toLocaleString()}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  timeline: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  timelineItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineNodeActive: {
    backgroundColor: Colors.primary,
  },
  timelineNodeCurrent: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  timelineLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  timelineLineActive: {
    backgroundColor: Colors.primary,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 12,
  },
  statusDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statusTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  passengerSection: {
    marginHorizontal: 20,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  passengerCard: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  passengerStatus: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  passengerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  actionsContainer: {
    marginHorizontal: 20,
    marginVertical: 12,
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
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
  },
  rideDetails: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
    marginRight: 8,
    minWidth: 60,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
});