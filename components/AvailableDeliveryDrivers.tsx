import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Truck, Star, Package, DollarSign } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Ride } from '@/types';
import { RideFilters, filterRides } from '@/components/RideFilters';
import { RidesService } from '@/services/rides';

interface AvailableDeliveryDriversProps {
  onRequestDelivery: (ride: Ride) => void;
  userLocation?: { latitude: number; longitude: number };
}

export function AvailableDeliveryDrivers({ onRequestDelivery, userLocation }: AvailableDeliveryDriversProps) {
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters] = useState<RideFilters>({});
  const [error, setError] = useState<string | null>(null);

  // Load available rides that are marked as available for delivery
  useEffect(() => {
    const loadAvailableDeliveryRides = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get rides that are specifically available for delivery
        const deliveryRides = await RidesService.getDeliveryAvailableRides();
        
        console.log('Found delivery-available rides:', deliveryRides.length);
        setAvailableRides(deliveryRides);
      } catch (err) {
        console.error('Failed to load delivery-available rides:', err);
        setError('Failed to load available drivers');
      } finally {
        setIsLoading(false);
      }
    };

    loadAvailableDeliveryRides();
  }, []);

  // Apply filters to the available rides
  const filteredRides = useMemo(() => {
    return filterRides(availableRides, filters, userLocation);
  }, [availableRides, filters, userLocation]);

  const renderDriverCard = ({ item: ride }: { item: Ride }) => {
    const fromLocation = ride.from || ride.origin;
    const toLocation = ride.to || ride.destination;
    const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
    
    return (
      <View style={styles.driverCard}>
        <View style={styles.driverHeader}>
          <View style={styles.driverInfo}>
            <Truck size={20} color={Colors.primary} />
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>
                {ride.driver?.name || ride.driver?.displayName || 'Driver'}
              </Text>
              <View style={styles.ratingContainer}>
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.ratingText}>
                  {(ride.driver?.rating || 4.8).toFixed(1)}
                </Text>
                <Text style={styles.ratingCount}>
                  ({ride.driver?.totalRides || 150} rides)
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.availabilityBadge}>
            <Text style={styles.availabilityText}>AVAILABLE</Text>
          </View>
        </View>

        {/* Route Information */}
        <View style={styles.routeSection}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.fromDot]} />
            <Text style={styles.routeText} numberOfLines={2}>
              From: {fromLocation?.name || fromLocation?.address || 'Unknown'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.toDot]} />
            <Text style={styles.routeText} numberOfLines={2}>
              To: {toLocation?.name || toLocation?.address || 'Unknown'}
            </Text>
          </View>
        </View>

        {/* Ride Details */}
        <View style={styles.rideDetails}>
          <View style={styles.detailItem}>
            <Package size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>
              {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
            </Text>
          </View>
          <View style={styles.detailItem}>
            <DollarSign size={16} color={Colors.success} />
            <Text style={styles.priceText}>
              ${ride.pricePerSeat}/seat
            </Text>
          </View>
        </View>

        {/* Departure Time */}
        <View style={styles.timeSection}>
          <Text style={styles.timeLabel}>Departure:</Text>
          <Text style={styles.timeValue}>
            {new Date(ride.departureTime || ride.departureAt || '').toLocaleString()}
          </Text>
        </View>

        {/* Notes */}
        {ride.note && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes:</Text>
            <Text style={styles.notesText}>{ride.note}</Text>
          </View>
        )}

        {/* Request Delivery Button */}
        <TouchableOpacity
          style={styles.requestButton}
          onPress={() => onRequestDelivery(ride)}
          testID={`request-delivery-${ride.id}`}
        >
          <Package size={20} color={Colors.background} />
          <Text style={styles.requestButtonText}>Request Delivery</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading available drivers...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            // Trigger reload by changing loading state
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 100);
          }}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Results Header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>
          {filteredRides.length === availableRides.length
            ? `${availableRides.length} driver${availableRides.length !== 1 ? 's' : ''} available`
            : `${filteredRides.length} of ${availableRides.length} driver${availableRides.length !== 1 ? 's' : ''} shown`
          }
        </Text>
        <Text style={styles.resultsSubtitle}>
          Drivers available for delivery requests
        </Text>
      </View>

      {/* Drivers List */}
      <FlatList
        data={filteredRides}
        renderItem={renderDriverCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Truck size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>
              {availableRides.length === 0 
                ? 'No drivers available' 
                : 'No drivers match your filters'
              }
            </Text>
            <Text style={styles.emptySubtitle}>
              {availableRides.length === 0
                ? 'Check back later for available delivery drivers'
                : 'Try adjusting your filters to see more drivers'
              }
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filtersSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  driverCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverDetails: {
    marginLeft: 12,
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  availabilityBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  availabilityText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  routeSection: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  fromDot: {
    backgroundColor: Colors.primary,
  },
  toDot: {
    backgroundColor: Colors.success,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 4,
    marginBottom: 8,
  },
  routeText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
    marginLeft: 6,
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  timeValue: {
    fontSize: 14,
    color: Colors.text,
  },
  notesSection: {
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    fontStyle: 'italic' as const,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});