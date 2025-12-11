import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Play, Square, Users, DollarSign, Clock } from 'lucide-react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

interface RideControlsProps {
  ride: {
    id: string;
    status: 'upcoming' | 'active' | 'completed' | 'cancelled';
    origin: { name: string };
    destination: { name: string };
    departureTime: string;
    seatsTotal: number;
    seatsAvailable: number;
    pricePerSeat: number;
    passengers: Array<{
      id: string;
      seats: number;
      user: { name: string };
    }>;
  };
  onRideUpdated: () => void;
}

export const RideControls: React.FC<RideControlsProps> = ({
  ride,
  onRideUpdated,
}) => {
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const confirmedPassengers = ride.passengers || [];
  const totalPassengerSeats = confirmedPassengers.reduce((sum, p) => sum + p.seats, 0);
  const estimatedRevenue = totalPassengerSeats * ride.pricePerSeat;
  const platformFee = Math.round(estimatedRevenue * 0.1);
  const driverPayout = estimatedRevenue - platformFee;

  const handleStartRide = async () => {
    if (confirmedPassengers.length === 0) {
      Alert.alert(
        'No Passengers',
        'You cannot start a ride without any confirmed passengers.'
      );
      return;
    }

    Alert.alert(
      'Start Ride?',
      `Are you ready to start the ride with ${confirmedPassengers.length} passenger${confirmedPassengers.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Ride',
          onPress: async () => {
            setIsStarting(true);
            
            try {
              console.log('🚗 Starting ride:', ride.id);
              
              const startRide = httpsCallable(functions, 'startRide');
              const result = await startRide({ rideId: ride.id });
              
              const data = result.data as any;
              
              if (data.success) {
                console.log('✅ Ride started successfully');
                
                Alert.alert(
                  'Ride Started! 🚗',
                  data.message,
                  [{ text: 'OK', onPress: onRideUpdated }]
                );
              } else {
                throw new Error(data.message || 'Failed to start ride');
              }
            } catch (error: any) {
              console.error('❌ Error starting ride:', error);
              Alert.alert('Error', error.message || 'Failed to start ride');
            } finally {
              setIsStarting(false);
            }
          },
        },
      ]
    );
  };

  const handleCompleteRide = async () => {
    Alert.alert(
      'Complete Ride?',
      `Are you ready to complete the ride and process payments?\n\nPassengers will be charged and you'll receive your payout of $${(driverPayout / 100).toFixed(2)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Ride',
          style: 'destructive',
          onPress: async () => {
            setIsCompleting(true);
            
            try {
              console.log('🚗 Completing ride and processing charges:', ride.id);
              
              const completeRideAndCharge = httpsCallable(functions, 'completeRideAndCharge');
              const result = await completeRideAndCharge({ rideId: ride.id });
              
              const data = result.data as any;
              
              if (data.success) {
                console.log('✅ Ride completed and payments processed');
                
                const summary = data.summary;
                Alert.alert(
                  'Ride Completed! 🎉',
                  `${data.message}\n\nSummary:\n• ${summary.passengerCount} passenger${summary.passengerCount > 1 ? 's' : ''} charged\n• Total revenue: $${(summary.totalRevenue / 100).toFixed(2)}\n• Platform fees: $${(summary.platformFees / 100).toFixed(2)}\n• Your payout: $${(summary.driverPayout / 100).toFixed(2)}`,
                  [{ text: 'OK', onPress: onRideUpdated }]
                );
              } else {
                throw new Error(data.message || 'Failed to complete ride');
              }
            } catch (error: any) {
              console.error('❌ Error completing ride:', error);
              Alert.alert('Error', error.message || 'Failed to complete ride');
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return '#007AFF';
      case 'active': return '#34C759';
      case 'completed': return '#666';
      case 'cancelled': return '#FF3B30';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'upcoming': return 'Upcoming';
      case 'active': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  return (
    <View style={styles.container}>
      {/* Ride Header */}
      <View style={styles.header}>
        <View style={styles.routeContainer}>
          <Text style={styles.routeText}>
            {ride.origin.name} → {ride.destination.name}
          </Text>
          <View style={styles.timeContainer}>
            <Clock size={16} color="#666" />
            <Text style={styles.timeText}>
              {formatDate(ride.departureTime)} at {formatTime(ride.departureTime)}
            </Text>
          </View>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
          <Text style={styles.statusText}>{getStatusText(ride.status)}</Text>
        </View>
      </View>

      {/* Ride Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Users size={20} color="#007AFF" />
          <Text style={styles.statLabel}>Passengers</Text>
          <Text style={styles.statValue}>
            {confirmedPassengers.length} ({totalPassengerSeats} seats)
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <DollarSign size={20} color="#34C759" />
          <Text style={styles.statLabel}>Est. Payout</Text>
          <Text style={styles.statValue}>
            ${(driverPayout / 100).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Passenger List */}
      {confirmedPassengers.length > 0 && (
        <View style={styles.passengersContainer}>
          <Text style={styles.passengersTitle}>Confirmed Passengers</Text>
          {confirmedPassengers.map((passenger, index) => (
            <View key={passenger.id} style={styles.passengerItem}>
              <Text style={styles.passengerName}>{passenger.user.name}</Text>
              <Text style={styles.passengerSeats}>
                {passenger.seats} seat{passenger.seats > 1 ? 's' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Revenue Breakdown */}
      {ride.status === 'active' && (
        <View style={styles.revenueContainer}>
          <Text style={styles.revenueTitle}>Payment Summary</Text>
          <View style={styles.revenueRow}>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={styles.revenueAmount}>
              ${(estimatedRevenue / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.revenueRow}>
            <Text style={styles.revenueLabel}>Platform Fee (10%)</Text>
            <Text style={styles.revenueAmount}>
              -${(platformFee / 100).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.revenueRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Your Payout</Text>
            <Text style={styles.totalAmount}>
              ${(driverPayout / 100).toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {ride.status === 'upcoming' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartRide}
            disabled={isStarting || confirmedPassengers.length === 0}
          >
            {isStarting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Play size={20} color="#FFF" />
                <Text style={styles.actionButtonText}>Start Ride</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        {ride.status === 'active' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={handleCompleteRide}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Square size={20} color="#FFF" />
                <Text style={styles.actionButtonText}>Complete Ride</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        {ride.status === 'completed' && (
          <View style={styles.completedContainer}>
            <Text style={styles.completedText}>
              ✅ Ride completed successfully!
            </Text>
            <Text style={styles.completedSubtext}>
              Payments have been processed and your payout is scheduled.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  routeContainer: {
    flex: 1,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  passengersContainer: {
    marginBottom: 16,
  },
  passengersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  passengerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    marginBottom: 4,
  },
  passengerName: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  passengerSeats: {
    fontSize: 13,
    color: '#666',
  },
  revenueContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  revenueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  revenueLabel: {
    fontSize: 13,
    color: '#666',
  },
  revenueAmount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  actionContainer: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButton: {
    backgroundColor: '#007AFF',
  },
  completeButton: {
    backgroundColor: '#FF6B35',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  completedContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0F9F0',
    borderRadius: 8,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 4,
  },
  completedSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});