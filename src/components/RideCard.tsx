import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MapPin, Clock, Users, DollarSign } from 'lucide-react-native';
import { Ride } from '../types';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';

interface RideCardProps {
  ride: Ride;
  onPress: () => void;
  onBook?: () => void;
  showBookButton?: boolean;
  showStatus?: boolean;
  testID?: string;
}

export const RideCard: React.FC<RideCardProps> = ({
  ride,
  onPress,
  onBook,
  showBookButton = false,
  showStatus = false,
  testID,
}) => {
  const availableSeats = ride.seatsAvailable || ride.availableSeats || 0;
  const pricePerSeat = ride.pricePerSeatCents || ride.pricePerSeat || 0;
  const originName = ride.origin?.name || ride.from?.name || 'Unknown';
  const destinationName = ride.destination?.name || ride.to?.name || 'Unknown';
  const departureTime = ride.departureAt || ride.departureTime || '';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      testID={testID}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.route}>
          <View style={styles.locationRow}>
            <MapPin size={14} color="#28a745" />
            <Text style={styles.locationText} numberOfLines={1}>
              {originName}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationRow}>
            <MapPin size={14} color="#dc3545" />
            <Text style={styles.locationText} numberOfLines={1}>
              {destinationName}
            </Text>
          </View>
        </View>
        
        {showStatus && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {ride.status === 'active' ? 'Active' : 
               ride.status === 'completed' ? 'Completed' : 
               ride.status === 'cancelled' ? 'Cancelled' : 
               ride.status === 'draft' ? 'Draft' : 
               'Upcoming'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Clock size={16} color="#6c757d" />
          <Text style={styles.detailText}>
            {formatDate(departureTime)} at {formatTime(departureTime)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Users size={16} color="#6c757d" />
          <Text style={styles.detailText}>
            {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
          </Text>
        </View>

        <View style={styles.detailRow}>
          <DollarSign size={16} color="#28a745" />
          <Text style={styles.priceText}>
            {formatCurrency(pricePerSeat)} per seat
          </Text>
        </View>
      </View>

      {showBookButton && onBook && availableSeats > 0 && (
        <TouchableOpacity
          style={styles.bookButton}
          onPress={(e) => {
            e.stopPropagation();
            onBook();
          }}
          testID={`${testID}-book-button`}
        >
          <Text style={styles.bookButtonText}>Request Seat</Text>
        </TouchableOpacity>
      )}

      {showBookButton && availableSeats === 0 && (
        <View style={styles.fullButton}>
          <Text style={styles.fullButtonText}>Fully Booked</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  route: {
    flex: 1,
    marginRight: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: '#dee2e6',
    marginLeft: 7,
    marginVertical: 2,
  },
  statusBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
    minWidth: 70,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
    textTransform: 'capitalize',
    flexShrink: 1,
    minWidth: 60,
  },
  details: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
    marginLeft: 8,
  },
  bookButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  fullButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500',
  },
});