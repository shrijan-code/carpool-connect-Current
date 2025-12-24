import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RideCard } from '@/components/RideCard';
import { Card } from '@/components/ui/Card';

import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { router } from 'expo-router';
import { Clock, MessageCircle, X, Users, Star, Car, MapPin, Check, Bell } from 'lucide-react-native';
import { Booking } from '@/types';
import { UniversalFilters } from '@/components/UniversalFilters';
import { useRideFilters } from '@/hooks/useRideFilters';
import { RatingSystem, StarDisplay } from '@/components/RatingSystem';
import { RatingService } from '@/services/rating';
import { useTheme } from '@/hooks/useTheme';
import { Skeleton } from '@/components/ui/Skeleton';
import RidesMapView from '@/components/RidesMapView';
import { formatPrice } from '@/utils/price';
import { logger } from '@/utils/logger';


type RideFilter = 'upcoming' | 'completed' | 'cancelled';
type BookingFilter = 'pending' | 'confirmed' | 'declined' | 'all';

export default function RidesScreen() {
  const { user } = useAuthStore();
  const {
    isLoading,
    error,
    getUserRides,
    getUserBookings,
    loadUserRides,
    loadUserBookings,
    subscribeToUserRides,
    subscribeToUserBookings,
    cancelBooking,
    acceptBooking,
    declineBooking,
    getPendingBookingRequests
  } = useRidesStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeFilter, setActiveFilter] = useState<RideFilter>('upcoming');
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all');

  const [activeTab, setActiveTab] = useState<'rides' | 'bookings'>('bookings');
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [ratingTarget, setRatingTarget] = useState<{ rideId: string; recipientId: string; recipientName: string; type: 'driver' | 'rider'; bookingId?: string } | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [driverPendingRequests, setDriverPendingRequests] = useState<Booking[]>([]); // Driver's pending booking requests

  const userRides = getUserRides(user?.id || '', (user?.role === 'driver' || user?.role === 'rider') ? user.role : 'rider');
  const userBookings = getUserBookings(user?.id || '');

  const {
    filters,
    filteredRides: clientFilteredRides,
    updateFilters,
    clearFilters,
    activeFiltersCount,
    totalRides,
    filteredCount
  } = useRideFilters(userRides);

  const filteredRides = useMemo(() => {
    const now = new Date();

    const statusFiltered = userRides.filter(ride => {
      // For upcoming rides, also check if they're actually in the future
      if (activeFilter === 'upcoming') {
        const isUpcomingStatus = ride.status === 'upcoming' || ride.status === 'active';
        if (!isUpcomingStatus) return false;

        // Check if ride is actually in the future
        const departureTime = new Date(ride.departureTime || ride.departureAt || now);
        const isFutureRide = departureTime.getTime() > now.getTime();
        return isFutureRide;
      }

      if (activeFilter === 'completed') return ride.status === 'completed';
      if (activeFilter === 'cancelled') return ride.status === 'cancelled';
      return true;
    });

    return activeFiltersCount > 0 ? clientFilteredRides.filter(ride => {
      if (activeFilter === 'upcoming') {
        const isUpcomingStatus = ride.status === 'upcoming' || ride.status === 'active';
        if (!isUpcomingStatus) return false;

        // Check if ride is actually in the future
        const departureTime = new Date(ride.departureTime || ride.departureAt || now);
        const isFutureRide = departureTime.getTime() > now.getTime();
        return isFutureRide;
      }

      if (activeFilter === 'completed') return ride.status === 'completed';
      if (activeFilter === 'cancelled') return ride.status === 'cancelled';
      return true;
    }) : statusFiltered;
  }, [userRides, activeFilter, clientFilteredRides, activeFiltersCount]);

  const filteredBookings = userBookings.filter(booking => {
    if (bookingFilter === 'pending') return booking.status === 'pending_driver';
    if (bookingFilter === 'confirmed') return booking.status === 'confirmed';
    if (bookingFilter === 'declined') return booking.status === 'declined';
    return true;
  });

  const pendingBookingsCount = userBookings.filter(b => b.status === 'pending_driver').length;

  const loadData = useCallback(async () => {
    if (user?.id) {
      try {
        logger.debug('Loading data for user', { userId: user.id, role: user.role });
        // Always load both rides and bookings for all users
        // This ensures data is available for both tabs
        await Promise.all([
          loadUserRides(user.id),
          loadUserBookings(user.id)
        ]);

        // For drivers, also load pending booking requests
        if (user.role === 'driver') {
          const pendingRequests = await getPendingBookingRequests(user.id);
          setDriverPendingRequests(pendingRequests);
        }

        logger.debug('Data loaded successfully');
      } catch (err) {
        console.error('❌ Error loading data:', err);
      }
    }
  }, [user?.id, user?.role, loadUserRides, loadUserBookings, getPendingBookingRequests]);



  const subscribeToData = useCallback(() => {
    if (user?.id) {
      // Subscribe to both rides and bookings for all users
      const unsubscribeRides = subscribeToUserRides(user.id);
      const unsubscribeBookings = subscribeToUserBookings(user.id);

      // Return a function that unsubscribes from both
      return () => {
        unsubscribeRides();
        unsubscribeBookings();
      };
    }
    return () => { };
  }, [user?.id, subscribeToUserRides, subscribeToUserBookings]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToData();
    return unsubscribe;
  }, [loadData, subscribeToData]);

  const handleRidePress = (rideId: string) => {
    router.push({ pathname: '/ride-details', params: { id: rideId } });
  };

  const getFilterCount = (filter: RideFilter) => {
    const now = new Date();

    return userRides.filter(ride => {
      if (filter === 'upcoming') {
        const isUpcomingStatus = ride.status === 'upcoming' || ride.status === 'active';
        if (!isUpcomingStatus) return false;

        // Check if ride is actually in the future
        const departureTime = new Date(ride.departureTime || ride.departureAt || now);
        const isFutureRide = departureTime.getTime() > now.getTime();
        return isFutureRide;
      }

      if (filter === 'completed') return ride.status === 'completed';
      if (filter === 'cancelled') return ride.status === 'cancelled';
      return true;
    }).length;
  };

  const getBookingFilterCount = (filter: BookingFilter) => {
    if (filter === 'all') return userBookings.length;
    return userBookings.filter(booking => {
      if (filter === 'pending') return booking.status === 'pending_driver';
      if (filter === 'confirmed') return booking.status === 'confirmed';
      if (filter === 'declined') return booking.status === 'declined';
      return true;
    }).length;
  };

  const handleRateUser = (rideId: string, recipientId: string, recipientName: string, type: 'driver' | 'rider', bookingId?: string) => {
    setRatingTarget({ rideId, recipientId, recipientName, type, bookingId });
    setShowRatingModal(true);
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    if (!ratingTarget || !user) return;

    setIsSubmittingRating(true);
    try {
      // Use the new role-specific review functions
      if (ratingTarget.type === 'driver') {
        // User is a rider rating a driver
        await RatingService.submitDriverReview({
          rideId: ratingTarget.rideId,
          bookingId: ratingTarget.bookingId || '',
          driverId: ratingTarget.recipientId,
          riderId: user.id,
          rating,
          comment,
        });
      } else {
        // User is a driver rating a rider
        await RatingService.submitRiderReview({
          rideId: ratingTarget.rideId,
          bookingId: ratingTarget.bookingId || '',
          driverId: user.id,
          riderId: ratingTarget.recipientId,
          rating,
          comment,
        });
      }

      Alert.alert(
        'Rating Submitted',
        `Thank you for rating ${ratingTarget.recipientName}! Your feedback helps improve our community.`,
        [{ text: 'OK' }]
      );

      setShowRatingModal(false);
      setRatingTarget(null);
      await loadData();
    } catch (err) {
      console.error('Error submitting rating:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit rating. Please try again.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleCancelBooking = (booking: Booking) => {
    Alert.alert(
      '❌ Cancel Booking',
      `Cancel your booking for this ride?\n\n• ${booking.seats} seat(s)\n• ${(booking.amountTotal / 100).toFixed(2)}\n• Status: ${booking.status}\n\nThis action cannot be undone.`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBooking(booking.id, booking.rideId, booking.seats, 'Cancelled by rider');
              Alert.alert('✅ Booking Cancelled', 'Your booking has been cancelled successfully.');
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel booking');
            }
          }
        }
      ]
    );
  };

  // Driver accept booking request
  const handleAcceptBookingRequest = (booking: Booking) => {
    Alert.alert(
      '✅ Accept Booking',
      `Accept booking from ${booking.passenger?.name || 'Passenger'}?\n\n• ${booking.seats} seat(s)\n• $${(booking.amountTotal / 100).toFixed(2)} total\n• Payment will be captured immediately`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await acceptBooking(booking.id, user!.id);
              Alert.alert(
                '🎉 Booking Accepted!',
                `You've accepted ${booking.passenger?.name || 'the passenger'}'s booking.\n\n• Payment has been captured\n• Chat is now enabled\n• Passenger has been notified`,
                [{ text: 'OK' }]
              );
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to accept booking');
            }
          }
        }
      ]
    );
  };

  // Driver decline booking request
  const handleDeclineBookingRequest = (booking: Booking) => {
    Alert.alert(
      '❌ Decline Booking',
      `Decline booking from ${booking.passenger?.name || 'Passenger'}?\n\n• Payment authorization will be cancelled\n• Passenger will be notified`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineBooking(booking.id, booking.rideId, booking.seats, user!.id, 'Declined by driver');
              Alert.alert(
                'Booking Declined',
                `You've declined ${booking.passenger?.name || 'the passenger'}'s booking.\n\n• Payment authorization cancelled\n• Passenger has been notified`,
                [{ text: 'OK' }]
              );
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to decline booking');
            }
          }
        }
      ]
    );
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_driver': return colors.warning;
      case 'confirmed': return colors.success;
      case 'declined': return colors.error;
      default: return colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="rides-safe-area">
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>
              {user?.role === 'driver' ? 'My Rides' : 'My Bookings'}
            </Text>
            <Text style={styles.title} testID="rides-title">
              {user?.role === 'driver' ? 'Driver Dashboard' : 'Rider Dashboard'}
            </Text>
            <Text style={styles.subtitle} testID="rides-subtitle">
              {user?.role === 'driver' ? "Manage your rides and bookings" : 'Track your bookings and rides'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer} testID="rides-tabs">
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookings' && styles.activeTab]}
          onPress={() => setActiveTab('bookings')}
          accessibilityRole="button"
          testID="tab-bookings"
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'bookings' && styles.activeTabText]}>
            {user?.role === 'driver' ? 'Booking Requests' : 'My Bookings'}
          </Text>
          {pendingBookingsCount > 0 && (
            <View style={styles.modernBadge} testID="rides-pending-badge">
              <Text style={styles.modernBadgeText}>{pendingBookingsCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rides' && styles.activeTab]}
          onPress={() => setActiveTab('rides')}
          accessibilityRole="button"
          testID="tab-rides"
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'rides' && styles.activeTabText]}>
            {user?.role === 'driver' ? 'My Rides' : 'Booked Rides'}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'rides' && (
        <UniversalFilters
          type="rides"
          filters={filters}
          onFiltersChange={updateFilters}
          onClearFilters={clearFilters}
          activeFiltersCount={activeFiltersCount}
          totalCount={totalRides}
          filteredCount={filteredCount}
        />
      )}

      {activeTab === 'rides' ? (
        <View style={styles.filterPillsContainer} testID="rides-filter-pills">
          {(['upcoming', 'completed', 'cancelled'] as RideFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={styles.modernFilterPill}
              onPress={() => setActiveFilter(filter)}
              accessibilityRole="button"
              testID={`rides-filter-${filter}`}
              activeOpacity={0.8}
            >
              {activeFilter === filter ? (
                <LinearGradient
                  colors={colors.gradient.cyberpunk}
                  style={styles.modernFilterPillGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.modernActiveFilterText}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                  {getFilterCount(filter) > 0 && (
                    <View style={styles.modernActiveFilterCount}>
                      <Text style={styles.modernActiveFilterCountText}>
                        {getFilterCount(filter)}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              ) : (
                <View style={styles.modernInactiveFilterPill}>
                  <Text style={styles.modernFilterText}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                  {getFilterCount(filter) > 0 && (
                    <View style={styles.modernFilterCount}>
                      <Text style={styles.modernFilterCountText}>
                        {getFilterCount(filter)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        /* Only show booking filter pills for RIDERS - drivers only see pending requests */
        user?.role !== 'driver' ? (
          <View style={styles.filterPillsContainer} testID="bookings-filter-pills">
            {(['pending', 'confirmed', 'declined', 'all'] as BookingFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={styles.modernFilterPill}
                onPress={() => setBookingFilter(filter)}
                accessibilityRole="button"
                testID={`bookings-filter-${filter}`}
                activeOpacity={0.8}
              >
                {bookingFilter === filter ? (
                  <LinearGradient
                    colors={colors.gradient.cyberpunk}
                    style={styles.modernFilterPillGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.modernActiveFilterText}>
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                    {getBookingFilterCount(filter) > 0 && (
                      <View style={styles.modernActiveFilterCount}>
                        <Text style={styles.modernActiveFilterCountText}>
                          {getBookingFilterCount(filter)}
                        </Text>
                      </View>
                    )}
                  </LinearGradient>
                ) : (
                  <View style={styles.modernInactiveFilterPill}>
                    <Text style={styles.modernFilterText}>
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                    {getBookingFilterCount(filter) > 0 && (
                      <View style={styles.modernFilterCount}>
                        <Text style={styles.modernFilterCountText}>
                          {getBookingFilterCount(filter)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* For drivers, show a simple header indicating pending requests count */
          <View style={styles.filterPillsContainer} testID="driver-pending-header">
            <View style={[styles.modernFilterPill]}>
              <LinearGradient
                colors={colors.gradient.cyberpunk}
                style={styles.modernFilterPillGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.modernActiveFilterText}>
                  Pending Requests
                </Text>
                {driverPendingRequests.length > 0 && (
                  <View style={styles.modernActiveFilterCount}>
                    <Text style={styles.modernActiveFilterCountText}>
                      {driverPendingRequests.length}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>
          </View>
        )
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <Card style={[styles.errorCard, { backgroundColor: '#fee', borderColor: '#fcc' }]} testID="rides-error-card">
            <Text style={[styles.errorText, { color: '#c33' }]}>{error}</Text>
          </Card>
        )}

        {activeTab === 'rides' && (
          <>
            <View style={styles.mapToggleContainer}>
              <TouchableOpacity
                style={styles.mapToggleButton}
                onPress={() => setShowMap(!showMap)}
                activeOpacity={0.8}
                testID="map-toggle-button"
              >
                <MapPin size={16} color={colors.primary} />
                <Text style={styles.mapToggleText}>
                  {showMap ? 'Hide Map' : 'Show Map'}
                </Text>
              </TouchableOpacity>
            </View>

            {showMap && (
              <View style={styles.mapContainer}>
                <RidesMapView rides={filteredRides} />
              </View>
            )}

            {isLoading ? (
              <View style={styles.loadingContainer}>
                {[1, 2, 3].map((index) => (
                  <View key={index} style={styles.skeletonCard}>
                    <View style={styles.skeletonHeader}>
                      <Skeleton width={48} height={48} borderRadius={24} />
                      <View style={styles.skeletonHeaderText}>
                        <Skeleton width={120} height={16} />
                        <Skeleton width={80} height={12} style={{ marginTop: 4 }} />
                      </View>
                      <Skeleton width={60} height={20} />
                    </View>
                    <View style={styles.skeletonRoute}>
                      <Skeleton width="100%" height={16} />
                      <Skeleton width="80%" height={12} style={{ marginTop: 4 }} />
                      <Skeleton width="100%" height={16} style={{ marginTop: 8 }} />
                      <Skeleton width="70%" height={12} style={{ marginTop: 4 }} />
                    </View>
                    <View style={styles.skeletonDetails}>
                      <Skeleton width={150} height={12} />
                      <Skeleton width={120} height={12} style={{ marginTop: 4 }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : filteredRides.length > 0 ? (
              filteredRides.map((ride, index) => {
                const rideKey = ride.id
                  ? `ride-${activeFilter}-${ride.id}`
                  : `ride-temp-${activeFilter}-${index}-${ride.driverId || 'unknown'}-${new Date(ride.departureTime || ride.departureAt || Date.now()).getTime()}`;
                return (
                  <View key={rideKey}>
                    <RideCard
                      ride={ride}
                      onPress={() => handleRidePress(ride.id)}
                    />
                    {ride.status === 'completed' && user && (
                      <View style={[styles.ratingPrompt, { backgroundColor: colors.warning + '10' }]}>
                        <Text style={[styles.ratingPromptTitle, { color: colors.text }]}>Rate your experience</Text>
                        <View style={styles.ratingActions}>
                          {user.role === 'driver' && ride.passengers.map((passenger) => (
                            <TouchableOpacity
                              key={passenger.id}
                              style={[styles.rateButton, { backgroundColor: colors.background, borderColor: colors.warning }]}
                              onPress={() => handleRateUser(
                                ride.id,
                                passenger.user.id,
                                passenger.user.name || passenger.user.displayName,
                                'rider',
                                passenger.bookingId
                              )}
                            >
                              <Star size={16} color={colors.warning} />
                              <Text style={[styles.rateButtonText, { color: colors.warning }]}>
                                Rate {passenger.user.name || passenger.user.displayName}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          {user.role === 'rider' && ride.driver && (
                            <TouchableOpacity
                              style={[styles.rateButton, { backgroundColor: colors.background, borderColor: colors.warning }]}
                              onPress={() => {
                                // Find the booking for this ride to get the bookingId
                                const booking = userBookings.find(b => b.rideId === ride.id);
                                handleRateUser(
                                  ride.id,
                                  ride.driverId,
                                  ride.driver?.name || ride.driver?.displayName || 'Driver',
                                  'driver',
                                  booking?.id
                                );
                              }}
                            >
                              <Star size={16} color={colors.warning} />
                              <Text style={[styles.rateButtonText, { color: colors.warning }]}>
                                Rate {ride.driver?.name || ride.driver?.displayName || 'Driver'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.modernEmptyState}>
                <View style={styles.modernEmptyIcon}>
                  <Car size={64} color={colors.textLight} />
                </View>
                <Text style={styles.modernEmptyTitle}>
                  {userRides.length === 0
                    ? `No ${activeFilter} rides`
                    : 'No rides match your filters'}
                </Text>
                <Text style={styles.modernEmptySubtext}>
                  {userRides.length === 0
                    ? (activeFilter === 'upcoming'
                      ? user?.role === 'driver'
                        ? 'Create a ride to start offering rides'
                        : 'Book a ride to see it here'
                      : `You don't have any ${activeFilter} rides yet`
                    )
                    : 'Try adjusting your filters to see more rides'}
                </Text>
                {userRides.length === 0 && activeFilter === 'upcoming' && user?.role === 'driver' && (
                  <TouchableOpacity
                    style={styles.modernEmptyActionButton}
                    onPress={() => router.push('/create-ride')}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={colors.gradient.cyberpunk}
                      style={styles.modernEmptyActionGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.modernEmptyActionText}>Create Ride</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {activeTab === 'bookings' && (
          <>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                {[1, 2].map((index) => (
                  <View key={index} style={styles.skeletonBookingCard}>
                    <View style={styles.skeletonBookingHeader}>
                      <Skeleton width={80} height={20} borderRadius={10} />
                    </View>
                    <View style={styles.skeletonBookingContent}>
                      <Skeleton width="100%" height={16} />
                      <Skeleton width="60%" height={12} style={{ marginTop: 4 }} />
                      <View style={styles.skeletonBookingInfo}>
                        <Skeleton width={100} height={12} />
                        <Skeleton width={80} height={12} />
                        <Skeleton width={60} height={12} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : user?.role === 'driver' ? (
              /* Driver view - show pending booking requests with Accept/Decline */
              driverPendingRequests.length > 0 ? (
                driverPendingRequests.map((booking, index) => {
                  const bookingKey = booking.id ? `driver-request-${booking.id}` : `driver-request-temp-${index}`;
                  const originName = booking.ride?.origin?.name || booking.ride?.from?.name || 'Unknown';
                  const destinationName = booking.ride?.destination?.name || booking.ride?.to?.name || 'Unknown';
                  const departureISO = booking.ride?.departureAt || booking.ride?.departureTime || '';
                  return (
                    <View key={bookingKey} style={styles.bookingCard}>
                      <View style={[styles.statusBadge, { backgroundColor: colors.warning }]}>
                        <Text style={styles.statusBadgeText}>Pending Request</Text>
                      </View>

                      <View style={styles.bookingContent}>
                        {/* Passenger Info */}
                        <View style={styles.passengerInfoRow}>
                          <View style={styles.passengerAvatar}>
                            <Text style={styles.passengerAvatarText}>
                              {(booking.passenger?.name || 'P').charAt(0)}
                            </Text>
                          </View>
                          <View style={styles.passengerDetails}>
                            <Text style={styles.passengerName}>{booking.passenger?.name || 'Unknown Passenger'}</Text>
                            <Text style={styles.passengerRating}>
                              ⭐ {booking.passenger?.rating ?? 'N/A'} • {booking.passenger?.totalRides ?? 0} rides
                            </Text>
                          </View>
                        </View>

                        <View style={styles.routeSummary}>
                          <Text style={styles.routeText} numberOfLines={1}>
                            {originName}
                          </Text>
                          <Text style={styles.routeArrow}>→</Text>
                          <Text style={styles.routeText} numberOfLines={1}>
                            {destinationName}
                          </Text>
                        </View>

                        <View style={styles.dateTimeRow}>
                          <Clock size={14} color={colors.textSecondary} />
                          <Text style={styles.dateTimeText}>
                            {departureISO ? `${formatDate(departureISO)}, ${formatTime(departureISO)}` : 'Date TBA'}
                          </Text>
                        </View>

                        <View style={styles.quickInfo}>
                          <View style={styles.infoChip}>
                            <Users size={12} color={colors.textSecondary} />
                            <Text style={styles.chipText}>{booking.seats} seat{booking.seats > 1 ? 's' : ''}</Text>
                          </View>
                          <View style={styles.infoChip}>
                            <Text style={styles.priceText}>${(booking.amountTotal / 100).toFixed(2)}</Text>
                          </View>
                        </View>

                        {/* Driver Accept/Decline Actions */}
                        <View style={styles.modernCompactActions}>
                          <TouchableOpacity
                            style={[styles.modernActionButton, { backgroundColor: colors.success + '20' }]}
                            onPress={() => handleAcceptBookingRequest(booking)}
                            activeOpacity={0.8}
                          >
                            <Check size={16} color={colors.success} />
                            <Text style={[styles.modernActionText, { color: colors.success }]}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.modernCancelButton}
                            onPress={() => handleDeclineBookingRequest(booking)}
                            activeOpacity={0.8}
                          >
                            <X size={16} color={colors.error} />
                            <Text style={styles.modernCancelText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.modernEmptyState} testID="bookings-empty-card">
                  <View style={styles.modernEmptyIcon}>
                    <Bell size={64} color={colors.textLight} />
                  </View>
                  <Text style={styles.modernEmptyTitle}>No pending booking requests</Text>
                  <Text style={styles.modernEmptySubtext}>
                    When riders book your rides, their requests will appear here for you to accept or decline.
                  </Text>
                </View>
              )
            ) : (
              /* Rider view - show their bookings */
              filteredBookings.length > 0 ? (
                filteredBookings.map((booking, index) => {
                  const bookingKey = booking.id ? `booking-${bookingFilter}-${booking.id}` : `booking-temp-${bookingFilter}-${index}`;
                  const originName = booking.ride?.origin?.name || booking.ride?.from?.name || 'Unknown';
                  const destinationName = booking.ride?.destination?.name || booking.ride?.to?.name || 'Unknown';
                  const departureISO = booking.ride?.departureAt || booking.ride?.departureTime || '';
                  return (
                    <TouchableOpacity
                      key={bookingKey}
                      style={styles.bookingCard}
                      onPress={() => booking.rideId ? handleRidePress(booking.rideId) : null}
                      activeOpacity={0.7}
                      testID={`booking-card-${booking.id}`}
                    >
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                        <Text style={styles.statusBadgeText}>
                          {booking.status === 'pending_driver' ? 'Pending' :
                            booking.status === 'confirmed' ? 'Confirmed' :
                              booking.status === 'declined' ? 'Declined' : booking.status}
                        </Text>
                      </View>

                      <View style={styles.bookingContent}>
                        <View style={styles.routeSummary}>
                          <Text style={styles.routeText} numberOfLines={1}>
                            {formatDate(departureISO)} {originName}
                          </Text>
                          <Text style={styles.routeArrow}>→</Text>
                          <Text style={styles.routeText} numberOfLines={1}>
                            {formatDate(departureISO)} {destinationName}
                          </Text>
                        </View>

                        <View style={styles.dateTimeRow}>
                          <Clock size={14} color={colors.textSecondary} />
                          <Text style={styles.dateTimeText}>
                            {departureISO ? `${formatDate(departureISO)}, ${formatTime(departureISO)}` : 'Date TBA'}
                          </Text>
                        </View>

                        <View style={styles.quickInfo}>
                          <View style={styles.infoChip}>
                            <Users size={12} color={colors.textSecondary} />
                            <Text style={styles.chipText}>{booking.seats} seat{booking.seats > 1 ? 's' : ''}</Text>
                          </View>
                          <View style={styles.infoChip}>
                            <Text style={styles.priceText}>${(booking.amountTotal / 100).toFixed(2)}</Text>
                          </View>
                          {booking.ride?.driver?.name && (
                            <View style={styles.infoChip}>
                              <Text style={styles.chipText}>rider</Text>
                              <StarDisplay
                                rating={booking.ride?.driver?.rating || 0}
                                size={12}
                                showNumber={true}
                                totalRatings={booking.ride?.driver?.totalReviews || 0}
                                recentRatingsCount={booking.ride?.driver?.recentRatingCount}
                              />
                            </View>
                          )}
                        </View>

                        {(booking.status === 'confirmed' || booking.status === 'pending_driver') && (
                          <View style={styles.modernCompactActions}>
                            {booking.status === 'confirmed' && (
                              <TouchableOpacity
                                style={styles.modernActionButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  router.push('/(tabs)/chat');
                                }}
                                activeOpacity={0.8}
                              >
                                <MessageCircle size={16} color={colors.primary} />
                                <Text style={styles.modernActionText}>Message</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.modernCancelButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleCancelBooking(booking);
                              }}
                              activeOpacity={0.8}
                            >
                              <X size={16} color={colors.error} />
                              <Text style={styles.modernCancelText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {!booking.ride && (
                          <Text style={styles.loadingText}>Loading ride details...</Text>
                        )}
                      </View>

                      <View style={styles.chevronContainer}>
                        <Text style={styles.chevron}>›</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.modernEmptyState} testID="bookings-empty-card">
                  <View style={styles.modernEmptyIcon}>
                    <MapPin size={64} color={colors.textLight} />
                  </View>
                  <Text style={styles.modernEmptyTitle}>
                    No {bookingFilter === 'all' ? '' : `${bookingFilter} `}bookings
                  </Text>
                  <Text style={styles.modernEmptySubtext}>
                    {bookingFilter === 'pending'
                      ? 'No pending booking requests. Book a ride to see requests here.'
                      : bookingFilter === 'confirmed'
                        ? 'No confirmed bookings yet.'
                        : bookingFilter === 'declined'
                          ? 'No declined bookings.'
                          : "You haven't made any booking requests yet. Search for rides to get started!"
                    }
                  </Text>
                  {bookingFilter === 'all' && (
                    <TouchableOpacity
                      style={styles.modernEmptyActionButton}
                      onPress={() => router.push('/search-rides')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modernEmptyActionText}>Find Rides</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
          </>
        )}

      </ScrollView>

      <RatingSystem
        visible={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          setRatingTarget(null);
        }}
        onSubmit={handleSubmitRating}
        title={`Rate ${ratingTarget?.type === 'driver' ? 'Driver' : 'Rider'}`}
        subtitle={`How was your ride experience?`}
        recipientName={ratingTarget?.recipientName}
        isLoading={isSubmittingRating}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 16,
    color: colors.textInverse,
    opacity: 0.9,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.textInverse,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textInverse,
    opacity: 0.9,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  modernFilterPill: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  modernFilterPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  modernInactiveFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    gap: 8,
  },
  modernActiveFilterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.background,
  },
  modernFilterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  modernActiveFilterCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  modernFilterCount: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  modernActiveFilterCountText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.background,
  },
  modernFilterCountText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  modernEmptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  modernEmptyIcon: {
    marginBottom: 24,
    opacity: 0.6,
  },
  modernEmptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modernEmptySubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  modernEmptyActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  modernEmptyActionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernEmptyActionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 24,
    marginBottom: 16,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.shadow.opacity,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    flexDirection: 'row',
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  activeTabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textInverse,
  },
  modernBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    marginLeft: 8,
  },
  modernBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textInverse,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  bookingCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.shadow.opacity,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textInverse,
  },
  bookingContent: {
    flex: 1,
    paddingRight: 40,
  },
  routeSummary: {
    marginBottom: 8,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  routeArrow: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  dateTimeText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  quickInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: 4,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  modernCompactActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modernActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  modernCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.error,
    borderRadius: 20,
  },
  modernActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textInverse,
  },
  modernCancelText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textInverse,
  },
  chevronContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  chevron: {
    fontSize: 20,
    color: colors.textLight,
  },
  findRidesButton: {
    marginTop: 16,
  },
  errorCard: {
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  ratingPrompt: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  ratingPromptTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  ratingActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  rateButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Skeleton loading styles
  loadingContainer: {
    paddingVertical: 8,
  },
  skeletonCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.shadow.opacity,
    shadowRadius: 4,
    elevation: 3,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  skeletonHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonRoute: {
    marginBottom: 16,
  },
  skeletonDetails: {
    gap: 4,
  },
  skeletonBookingCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.shadow.opacity,
    shadowRadius: 4,
    elevation: 3,
  },
  skeletonBookingHeader: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  skeletonBookingContent: {
    gap: 8,
  },
  skeletonBookingInfo: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  mapToggleContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  mapToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.shadow.opacity,
    shadowRadius: 4,
    elevation: 3,
  },
  mapToggleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  mapContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  // Passenger info styles for driver view
  passengerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  passengerAvatarText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 2,
  },
  passengerRating: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});

