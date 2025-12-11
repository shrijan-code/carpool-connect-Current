import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, Plus, MapPin, Clock, Users, DollarSign } from 'lucide-react-native';
import { RideCard } from '../components/RideCard';
import { BookingModal } from './BookingModal';
import { useRealtimeRide } from '../hooks/useRealtimeRide';
import { useAuthStore } from '../stores/auth-store';
import { useRidesStore } from '../stores/rides-store';
import { Ride } from '../types';

interface RideListScreenProps {
  mode: 'available' | 'my-rides' | 'my-bookings';
  title: string;
}

export const RideListScreen: React.FC<RideListScreenProps> = ({ mode, title }) => {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    rides,
    bookings,
    searchResults,
    isLoading,
    error,
    loadAvailableRides,
    loadUserRides,
    loadUserBookings,
    refreshRides,
    refreshBookings,
  } = useRidesStore();

  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get appropriate data based on mode
  const getData = useCallback(() => {
    switch (mode) {
      case 'available':
        return searchResults;
      case 'my-rides':
        return user ? rides.filter(ride => ride.driverId === user.id) : [];
      case 'my-bookings':
        return bookings.map(booking => booking.ride).filter(Boolean);
      default:
        return [];
    }
  }, [mode, searchResults, rides, bookings, user]);

  const data = getData();

  // Load initial data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        switch (mode) {
          case 'available':
            await loadAvailableRides();
            break;
          case 'my-rides':
            await loadUserRides(user.id);
            break;
          case 'my-bookings':
            await loadUserBookings(user.id);
            break;
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, [mode, user, loadAvailableRides, loadUserRides, loadUserBookings]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      switch (mode) {
        case 'available':
          await loadAvailableRides();
          break;
        case 'my-rides':
          await refreshRides();
          break;
        case 'my-bookings':
          await refreshBookings();
          break;
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [mode, user, loadAvailableRides, refreshRides, refreshBookings]);

  const handleRidePress = useCallback((ride: Ride) => {
    router.push({
      pathname: '/ride-details',
      params: { rideId: ride.id }
    });
  }, [router]);

  const handleBookRide = useCallback((ride: Ride) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to book a ride.');
      return;
    }

    if (ride.driverId === user.id) {
      Alert.alert('Cannot Book', 'You cannot book your own ride.');
      return;
    }

    setSelectedRide(ride);
    setShowBookingModal(true);
  }, [user]);

  const handleCreateRide = useCallback(() => {
    router.push('/create-ride');
  }, [router]);

  const handleSearch = useCallback(() => {
    router.push('/search-rides');
  }, [router]);

  const renderRideItem = useCallback(({ item: ride }: { item: Ride }) => {
    const isMyRide = user?.id === ride.driverId;
    const hasBooking = mode === 'my-bookings';

    return (
      <RideCard
        ride={ride}
        onPress={() => handleRidePress(ride)}
        onBook={!isMyRide && !hasBooking ? () => handleBookRide(ride) : undefined}
        showBookButton={mode === 'available' && !isMyRide}
        showStatus={mode === 'my-bookings'}
        testID={`ride-card-${ride.id}`}
      />
    );
  }, [user, mode, handleRidePress, handleBookRide]);

  const renderEmptyState = () => {
    let emptyMessage = '';
    let actionButton = null;

    switch (mode) {
      case 'available':
        emptyMessage = 'No rides available. Try searching or create your own ride.';
        actionButton = (
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSearch}>
              <Search size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Search Rides</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleCreateRide}>
              <Plus size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Create Ride</Text>
            </TouchableOpacity>
          </View>
        );
        break;
      case 'my-rides':
        emptyMessage = 'You haven\'t created any rides yet.';
        actionButton = (
          <TouchableOpacity style={styles.actionButton} onPress={handleCreateRide}>
            <Plus size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Create Your First Ride</Text>
          </TouchableOpacity>
        );
        break;
      case 'my-bookings':
        emptyMessage = 'You haven\'t booked any rides yet.';
        actionButton = (
          <TouchableOpacity style={styles.actionButton} onPress={handleSearch}>
            <Search size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Find Rides</Text>
          </TouchableOpacity>
        );
        break;
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        {actionButton}
      </View>
    );
  };

  if (isLoading && data.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading rides...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {mode === 'available' && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handleSearch}>
              <Search size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleCreateRide}>
              <Plus size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={data}
        renderItem={renderRideItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContainer, data.length === 0 && styles.emptyContainer]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        testID={`ride-list-${mode}`}
      />

      {selectedRide && (
        <BookingModal
          visible={showBookingModal}
          ride={selectedRide}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedRide(null);
          }}
          onSuccess={() => {
            setShowBookingModal(false);
            setSelectedRide(null);
            handleRefresh();
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 24,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});