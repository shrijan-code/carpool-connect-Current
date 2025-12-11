import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Check, X, User, MapPin, Clock, DollarSign } from 'lucide-react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { useAuthStore } from '@/store/auth-store';

interface BookingRequest {
  id: string;
  rideId: string;
  riderId: string;
  seats: number;
  amountTotal: number;
  status: string;
  createdAt: string;
  ride: {
    id: string;
    origin: { name: string };
    destination: { name: string };
    departureTime: string;
    pricePerSeat: number;
  };
  rider: {
    id: string;
    name: string;
    displayName: string;
    rating: number;
    totalRides: number;
    photoURL?: string;
  };
  payment: {
    intentId: string;
    amount: number;
    platformFee: number;
  };
}

export const DriverBookingRequests: React.FC = () => {
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingBookings, setProcessingBookings] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();

  const loadBookingRequests = async (showRefreshing = false) => {
    if (!user) return;

    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      console.log('📱 Loading booking requests for driver:', user.id);
      
      const getDriverBookingRequests = httpsCallable(functions, 'getDriverBookingRequests');
      const result = await getDriverBookingRequests({});
      
      const data = result.data as any;
      
      if (data.success) {
        setBookingRequests(data.bookingRequests || []);
        console.log('✅ Loaded', data.bookingRequests?.length || 0, 'booking requests');
      } else {
        throw new Error(data.message || 'Failed to load booking requests');
      }
    } catch (error: any) {
      console.error('❌ Error loading booking requests:', error);
      Alert.alert('Error', 'Failed to load booking requests');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookingRequests();
  }, [user]);

  const handleBookingResponse = async (bookingId: string, action: 'accept' | 'decline') => {
    // Prevent multiple simultaneous responses to the same booking
    if (processingBookings.has(bookingId)) {
      console.log(`⚠️ Booking ${bookingId} is already being processed, ignoring duplicate ${action} request`);
      return;
    }

    setProcessingBookings(prev => new Set(prev).add(bookingId));

    try {
      console.log(`🚗 Driver ${action}ing booking:`, bookingId);
      
      const driverRespondBooking = httpsCallable(functions, 'driverRespondBooking');
      const result = await driverRespondBooking({
        bookingId,
        action,
      });

      const data = result.data as any;
      
      if (data.success) {
        console.log(`✅ Booking ${action}ed successfully`);
        
        Alert.alert(
          action === 'accept' ? 'Booking Accepted! 🎉' : 'Booking Declined',
          data.message,
          [
            {
              text: 'OK',
              onPress: () => loadBookingRequests(),
            },
          ]
        );
      } else {
        throw new Error(data.message || `Failed to ${action} booking`);
      }
    } catch (error: any) {
      console.error(`❌ Error ${action}ing booking:`, error);
      
      let errorMessage = `Failed to ${action} booking`;
      if (error.message) {
        // Handle specific race condition errors
        if (error.message.includes('Not enough seats available') || error.message.includes('seats remaining')) {
          errorMessage = 'This booking is no longer available - another booking may have been accepted first.';
        } else if (error.message.includes('not pending driver response')) {
          errorMessage = 'This booking has already been responded to.';
        } else {
          errorMessage = error.message;
        }
      } else if (error.code === 'functions/internal') {
        errorMessage = 'Booking service temporarily unavailable. Please try again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setProcessingBookings(prev => {
        const newSet = new Set(prev);
        newSet.delete(bookingId);
        return newSet;
      });
    }
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

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const renderBookingRequest = ({ item }: { item: BookingRequest }) => {
    const isProcessing = processingBookings.has(item.id);
    
    return (
      <View style={styles.requestCard}>
        {/* Header */}
        <View style={styles.requestHeader}>
          <View style={styles.riderInfo}>
            <View style={styles.riderAvatar}>
              <User size={20} color="#666" />
            </View>
            <View style={styles.riderDetails}>
              <Text style={styles.riderName}>
                {item.rider.displayName || item.rider.name}
              </Text>
              <Text style={styles.riderStats}>
                ⭐ {item.rider.rating.toFixed(1)} • {item.rider.totalRides} rides
              </Text>
            </View>
          </View>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
        </View>

        {/* Ride Details */}
        <View style={styles.rideInfo}>
          <View style={styles.routeContainer}>
            <MapPin size={16} color="#666" />
            <Text style={styles.routeText}>
              {item.ride.origin.name} → {item.ride.destination.name}
            </Text>
          </View>
          
          <View style={styles.timeContainer}>
            <Clock size={16} color="#666" />
            <Text style={styles.timeText}>
              {formatDate(item.ride.departureTime)} at {formatTime(item.ride.departureTime)}
            </Text>
          </View>
        </View>

        {/* Booking Details */}
        <View style={styles.bookingInfo}>
          <View style={styles.seatsContainer}>
            <Text style={styles.seatsText}>
              {item.seats} seat{item.seats > 1 ? 's' : ''} requested
            </Text>
          </View>
          
          <View style={styles.amountContainer}>
            <DollarSign size={16} color="#007AFF" />
            <Text style={styles.amountText}>
              ${(item.amountTotal / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.declineButton, isProcessing && styles.disabledButton]}
            onPress={() => handleBookingResponse(item.id, 'decline')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <>
                <X size={18} color="#FF3B30" />
                <Text style={styles.declineButtonText}>Decline</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.acceptButton, isProcessing && styles.disabledButton]}
            onPress={() => handleBookingResponse(item.id, 'accept')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Check size={18} color="#FFF" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading booking requests...</Text>
      </View>
    );
  }

  if (bookingRequests.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Booking Requests</Text>
        <Text style={styles.emptyText}>
          You don't have any pending booking requests at the moment.
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadBookingRequests()}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookingRequests}
        renderItem={renderBookingRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadBookingRequests(true)}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  refreshButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
  },
  listContainer: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  riderStats: {
    fontSize: 13,
    color: '#666',
  },
  timeAgo: {
    fontSize: 13,
    color: '#666',
  },
  rideInfo: {
    marginBottom: 12,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginLeft: 8,
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  bookingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  seatsContainer: {
    flex: 1,
  },
  seatsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF3B30',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
});