import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ride } from '@/types';

import { Card } from '@/components/ui/Card';
import { GradientText } from '@/components/ui/GradientText';
import { RideCard } from '@/components/RideCard';
import { NotificationBell } from '@/components/NotificationBell';
import { RoleToggle } from '@/components/RoleToggle';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { useMemoryOptimization } from '@/hooks/useMemoryOptimization';
import { useToast } from '@/components/ui/Toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Plus, Search, MapPin, Clock, Bell, CheckCircle, Activity, Users, Star, Car, Eye, Map } from 'lucide-react-native';
import RidesMapView from '@/components/RidesMapView';
import { SmartRideRecommendations } from '@/components/SmartRideRecommendations';
import { useStripe } from '@stripe/stripe-react-native';
import { logger } from '@/utils/logger';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { success, error: showError, ToastContainer } = useToast();
  const { setCache, getCache } = useMemoryOptimization({
    maxCacheSize: 50,
    clearOnBackground: true
  });

  const {
    rides,
    searchResults,
    isLoading,
    error,
    loadUserRides,
    loadUserBookings,
    loadAvailableRides,
    subscribeToUserRides,
    subscribeToUserBookings,
    subscribeToAvailableRides,
    requestBooking,
    confirmBookingPayment,
    getUserBookings
  } = useRidesStore();
  const [activeTab, setActiveTab] = useState<'nearby' | 'recent'>('nearby');
  const [showMap, setShowMap] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Memoize expensive computations
  const userRides = useMemo(() => {
    if (!user?.id) return [];
    const cacheKey = `userRides_${user.id}_${rides.length}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const filtered = rides.filter(ride => ride.driverId === user.id);
    setCache(cacheKey, filtered);
    return filtered;
  }, [rides, user?.id, getCache, setCache]);

  const nearbyRides = useMemo(() => {
    if (!user?.id) return [];
    const cacheKey = `nearbyRides_${user.id}_${searchResults.length}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const filtered = searchResults.filter(ride => ride.driverId !== user.id);
    setCache(cacheKey, filtered);
    return filtered;
  }, [searchResults, user?.id, getCache, setCache]);

  const loadData = useCallback(async () => {
    if (user?.id) {
      if (user.role === 'driver') {
        await loadUserRides(user.id);
      } else {
        await loadUserBookings(user.id);
      }
      await loadAvailableRides();
    }
  }, [user?.id, user?.role, loadUserRides, loadUserBookings, loadAvailableRides]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
      success('Rides Updated', 'Latest rides loaded successfully');
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, success]);

  const subscribeToData = useCallback(() => {
    if (user?.id) {
      const unsubscribes: (() => void)[] = [];

      logger.debug(`Setting up subscriptions for user ${user.id} (${user.role})`);

      if (user.role === 'driver') {
        const ridesSub = subscribeToUserRides(user.id);
        if (ridesSub) unsubscribes.push(ridesSub);
      } else {
        const bookingsSub = subscribeToUserBookings(user.id);
        if (bookingsSub) unsubscribes.push(bookingsSub);
      }

      // Always subscribe to available rides for real-time updates
      const availableRidesSub = subscribeToAvailableRides();
      if (availableRidesSub) unsubscribes.push(availableRidesSub);

      logger.debug(`${unsubscribes.length} subscriptions active`);

      return () => {
        logger.debug(`Cleaning up ${unsubscribes.length} subscriptions`);
        unsubscribes.forEach((unsub, index) => {
          try {
            unsub();
          } catch (error) {
            console.error(`Failed to unsubscribe subscription ${index}:`, error);
          }
        });
      };
    }
    return () => { };
  }, [user?.id, user?.role, subscribeToUserRides, subscribeToUserBookings, subscribeToAvailableRides]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToData();

    // Cleanup function to ensure subscriptions are properly removed
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadData, subscribeToData]);

  const handleCreateRide = () => {
    router.push('/create-ride');
  };

  const handleSearchRides = () => {
    router.push('/search-rides');
  };

  const handleRidePress = (rideId: string) => {
    router.push({ pathname: '/ride-details', params: { id: rideId } });
  };

  // Memoized render function for driver rides
  const renderDriverRide = useCallback(({ item }: { item: Ride }) => (
    <RideCard
      ride={item}
      onPress={() => handleRidePress(item.id)}
    />
  ), [handleRidePress]);

  // Memoized key extractor for driver rides
  const driverRideKeyExtractor = useCallback((item: Ride, index: number) => {
    return item.id || `driver-ride-${index}-${item.driverId}-${item.departureTime}`;
  }, []);

  const handleBookRide = async (rideId: string, availableSeats: number) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to book a ride');
      return;
    }

    if (user.role !== 'rider') {
      Alert.alert('Error', 'Only riders can book rides');
      return;
    }

    // Get ride details for price calculation
    const rideToBook = searchResults.find(r => r.id === rideId);
    if (!rideToBook) {
      Alert.alert('Error', 'Ride not found');
      return;
    }

    // Price is already stored in cents in the database
    const pricePerSeatInCents = Math.round(rideToBook.pricePerSeat);
    logger.debug('Booking ride', { rideId, priceInCents: pricePerSeatInCents, priceInDollars: (pricePerSeatInCents / 100).toFixed(2) });

    // Show seat selection dialog with pricing
    const seatOptions = [];
    for (let i = 1; i <= Math.min(availableSeats, 4); i++) {
      const totalPrice = ((pricePerSeatInCents / 100) * i).toFixed(2);
      const platformFee = '5.00';
      seatOptions.push({
        text: `${i} seat${i > 1 ? 's' : ''} - ${totalPrice} (+ ${platformFee} fee)`,
        onPress: () => showBookingConfirmation(rideToBook, i, pricePerSeatInCents)
      });
    }

    seatOptions.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert(
      '🚗 Book This Ride',
      `From: ${rideToBook.from?.name || rideToBook.origin?.name}\nTo: ${rideToBook.to?.name || rideToBook.destination?.name}\nDriver: ${rideToBook.driver?.name || 'Unknown'}\n\nAvailable: ${availableSeats} seats\nPrice: ${(pricePerSeatInCents / 100).toFixed(2)}/seat`,
      seatOptions
    );
  };

  const showBookingConfirmation = (ride: Ride, seats: number, pricePerSeatInCents: number) => {
    const totalAmount = (pricePerSeatInCents / 100) * seats;
    const platformFee = 5.00;
    const grandTotal = totalAmount + platformFee;

    Alert.alert(
      '💳 Confirm Booking',
      `Book this ride for ${totalAmount.toFixed(2)}?\n\nPayment method: Visa ****1234\nSeats: ${seats}\nSubtotal: ${totalAmount.toFixed(2)}\nPlatform fee: ${platformFee.toFixed(2)}\nTotal: ${grandTotal.toFixed(2)}\n\n⚠️ Payment will be authorized now and captured when driver accepts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Booking',
          onPress: () => processBooking(ride, seats)
        }
      ]
    );
  };

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const processBooking = async (ride: Ride, seats: number) => {
    try {
      logger.info('Starting booking process', { rideId: ride.id, seats });

      // Show processing alert
      Alert.alert(
        '💳 Processing...',
        'Preparing payment...',
        [{ text: 'Please wait...', style: 'default' }]
      );

      // 1. Create Booking & Payment Intent
      const { bookingId, clientSecret } = await requestBooking(ride.id, seats, user!);
      logger.debug('Booking created, preparing payment sheet');

      if (!clientSecret) {
        throw new Error('Failed to Initialize Payment: No Client Secret');
      }

      // 2. Initialize Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'CarpoolConnect',
        returnURL: 'myapp://payment-complete', // Deep link for redirect-based payments
        defaultBillingDetails: {
          email: user?.email,
          name: user?.name,
        }
      });

      if (initError) {
        console.error('Payment Sheet Init Error:', initError);
        throw new Error(initError.message);
      }

      // 3. Present Payment Sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        console.error('Payment Sheet Present Error:', presentError);
        if (presentError.code === 'Canceled') {
          // User cancelled, we might want to cancel the pending booking or just leave it as pending_payment (unpaid)
          // For now, let's just let them know.
          Alert.alert('Payment Cancelled', 'You can retry payment from your bookings.');
          return;
        }
        throw new Error(presentError.message);
      }

      // 4. Confirm Booking on Server (Update Status)
      await confirmBookingPayment(bookingId);

      // Show success with correct flow explanation
      success(
        'Booking Confirmed!',
        'Payment successful. Your ride is booked and waiting for driver approval.'
      );

      // Refresh data
      loadAvailableRides();
      loadUserBookings(user!.id); // tailored refresh

    } catch (error: any) {
      console.error('❌ Book ride error:', error);

      // Handle duplicate booking errors with better messaging
      if (error.message?.includes('already have a') || error.message?.includes('pending approval')) {
        Alert.alert(
          '⚠️ Booking Already Exists',
          `You already have a booking for this ride. Please check your bookings to see the status.`,
          [
            { text: 'View My Bookings', onPress: () => router.push('/rides') },
            { text: 'OK' }
          ]
        );
      } else {
        showError(
          'Booking Failed',
          error.message || 'Failed to create booking. Please try again.'
        );
      }
    }
  };

  // Memoized render function for nearby rides
  const renderNearbyRide = useCallback(({ item }: { item: Ride }) => (
    <RideCard
      ride={item}
      onPress={() => handleRidePress(item.id)}
      showBookButton
    />
  ), [handleRidePress, handleBookRide]);

  // Memoized key extractor for nearby rides
  const nearbyRideKeyExtractor = useCallback((item: Ride, index: number) => {
    return item.id || `nearby-ride-${index}-${item.driverId}-${item.departureTime}`;
  }, []);

  // List header component for nearby rides
  const renderNearbyRidesHeader = useCallback(() => (
    <TouchableOpacity style={styles.quickActionButton} onPress={handleSearchRides} activeOpacity={0.8}>
      <LinearGradient
        colors={colors.gradient.cyberpunk}
        style={styles.quickActionGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <MapPin size={20} color={colors.background} />
        <Text style={styles.quickActionText}>Search Routes</Text>
      </LinearGradient>
    </TouchableOpacity>
  ), [handleSearchRides, colors]);


  const renderDriverHome = () => (
    <View style={styles.content}>
      <LinearGradient
        colors={colors.gradient.cyberpunk}
        style={styles.actionCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.actionHeader}>
          <Text style={styles.actionTitle}>Ready to drive?</Text>
          <Text style={styles.actionSubtitle}>
            Create a ride and start earning
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateRide}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.8)']}
            style={styles.createButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Plus size={20} color={colors.primary} />
            <Text style={styles.createButtonText}>Create New Ride</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => router.push('/booking-requests')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={colors.gradient.cyberpunk}
          style={styles.quickActionGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Bell size={20} color={colors.background} />
          <Text style={styles.quickActionText}>Booking Requests</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.section}>
        <GradientText style={styles.sectionTitle}>Your Rides</GradientText>
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}
        {isLoading ? (
          <LoadingSpinner text="Loading your rides..." />
        ) : userRides.length > 0 ? (
          <FlatList
            data={userRides}
            renderItem={renderDriverRide}
            keyExtractor={driverRideKeyExtractor}
            scrollEnabled={false}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
          />
        ) : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIcon}>
              <Car size={48} color={colors.textLight} />
            </View>
            <Text style={styles.emptyText}>No rides created yet</Text>
            <Text style={styles.emptySubtext}>Create your first ride to start earning</Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={handleCreateRide}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradient.cyberpunk}
                style={styles.emptyActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.emptyActionText}>Create Ride</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderRiderHome = () => {
    const userBookings = getUserBookings(user?.id || '');
    const pendingBookings = userBookings.filter(b => b.status === 'pending_driver');
    const confirmedBookings = userBookings.filter(b => b.status === 'confirmed');

    return (
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.searchCard}
          onPress={handleSearchRides}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={colors.gradient.cyberpunk}
            style={styles.searchButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.searchContent}>
              <Search size={24} color={colors.background} />
              <View style={styles.searchText}>
                <Text style={styles.searchTitle}>Where are you going?</Text>
                <Text style={styles.searchSubtitle}>Find rides near you</Text>
              </View>
              <MapPin size={20} color={colors.background} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/location-search')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primary + '20' }]}>
              <MapPin size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Find Nearby</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              // Navigate to rides tab and set it to show bookings
              router.push('/(tabs)/rides');
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.success + '20' }]}>
              <Activity size={20} color={colors.success} />
            </View>
            <Text style={styles.quickActionLabel}>My Bookings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/chat')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.warning + '20' }]}>
              <Bell size={20} color={colors.warning} />
            </View>
            <Text style={styles.quickActionLabel}>Messages</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Bookings Section */}
        {pendingBookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <GradientText style={styles.sectionTitle}>Pending Requests</GradientText>
              <TouchableOpacity onPress={() => router.push('/rides')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {pendingBookings.slice(0, 2).map((booking, index) => {
              const bookingKey = booking.id ? `pending-${booking.id}` : `pending-temp-${index}`;
              return (
                <Card key={bookingKey} style={styles.pendingBookingCard}>
                  <View style={styles.pendingBookingHeader}>
                    <View style={styles.pendingStatus}>
                      <Clock size={16} color={colors.warning} />
                      <Text style={styles.pendingStatusText}>Waiting for driver approval</Text>
                    </View>
                  </View>
                  <View style={styles.pendingBookingDetails}>
                    <View style={styles.routeContainer}>
                      <View style={styles.routePoint}>
                        <View style={[styles.dot, styles.fromDot]} />
                        <View style={styles.routeInfo}>
                          <Text style={styles.locationName}>{booking.ride?.origin?.name || booking.ride?.from?.name || 'Unknown'}</Text>
                          <Text style={styles.locationAddress}>{booking.ride?.origin?.address || booking.ride?.from?.address || 'Address not available'}</Text>
                        </View>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routePoint}>
                        <View style={[styles.dot, styles.toDot]} />
                        <View style={styles.routeInfo}>
                          <Text style={styles.locationName}>{booking.ride?.destination?.name || booking.ride?.to?.name || 'Unknown'}</Text>
                          <Text style={styles.locationAddress}>{booking.ride?.destination?.address || booking.ride?.to?.address || 'Address not available'}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.pendingInfo}>
                      {booking.seats} seat(s) • ${(booking.amountTotal / 100).toFixed(2)}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Confirmed Bookings Section */}
        {confirmedBookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <GradientText style={styles.sectionTitle}>Upcoming Rides</GradientText>
              <TouchableOpacity onPress={() => router.push('/rides')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {confirmedBookings.slice(0, 2).map((booking, index) => {
              const bookingKey = booking.id ? `confirmed-${booking.id}` : `confirmed-temp-${index}`;
              return (
                <Card key={bookingKey} style={styles.confirmedBookingCard}>
                  <View style={styles.confirmedBookingHeader}>
                    <View style={styles.confirmedStatus}>
                      <CheckCircle size={16} color={colors.success} />
                      <Text style={styles.confirmedStatusText}>Confirmed</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.detailsButton}
                      onPress={() => handleRidePress(booking.rideId)}
                    >
                      <Eye size={14} color={colors.primary} />
                      <Text style={styles.buttonText}>Details</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.confirmedBookingDetails}>
                    <View style={styles.routeContainer}>
                      <View style={styles.routePoint}>
                        <View style={[styles.dot, styles.fromDot]} />
                        <View style={styles.routeInfo}>
                          <Text style={styles.locationName}>{booking.ride?.origin?.name || booking.ride?.from?.name || 'Unknown'}</Text>
                          <Text style={styles.locationAddress}>{booking.ride?.origin?.address || booking.ride?.from?.address || 'Address not available'}</Text>
                        </View>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routePoint}>
                        <View style={[styles.dot, styles.toDot]} />
                        <View style={styles.routeInfo}>
                          <Text style={styles.locationName}>{booking.ride?.destination?.name || booking.ride?.to?.name || 'Unknown'}</Text>
                          <Text style={styles.locationAddress}>{booking.ride?.destination?.address || booking.ride?.to?.address || 'Address not available'}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.bookingDetails}>
                      <View style={styles.detailRow}>
                        <Clock size={14} color={colors.textSecondary} />
                        <Text style={styles.detailText}>
                          {new Date(booking.ride?.departureAt || booking.ride?.departureTime || '').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })} at {new Date(booking.ride?.departureAt || booking.ride?.departureTime || '').toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Users size={14} color={colors.textSecondary} />
                        <Text style={styles.detailText}>{booking.seats} seat{booking.seats > 1 ? 's' : ''} • ${((booking.amountTotal || 0) / 100).toFixed(2)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Star size={14} color={colors.warning} />
                        <Text style={styles.detailText}>Driver: {booking.ride?.driver?.name || 'Unknown'} ({booking.ride?.driver?.rating || '5.0'}⭐)</Text>
                      </View>
                      {booking.ride?.vehicle && (
                        <View style={styles.detailRow}>
                          <Car size={14} color={colors.textSecondary} />
                          <Text style={styles.detailText}>
                            {booking.ride.vehicle.color} {booking.ride.vehicle.make} {booking.ride.vehicle.model} • {booking.ride.vehicle.licensePlate}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {nearbyRides.length > 0 && (
          <SmartRideRecommendations
            onRidePress={handleRidePress}
            onBookRide={handleBookRide}
          />
        )}

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('nearby')}
            activeOpacity={0.8}
          >
            {activeTab === 'nearby' ? (
              <LinearGradient
                colors={colors.gradient.cyberpunk}
                style={styles.activeTabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.activeTabText}>Nearby Rides</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.tabText}>Nearby Rides</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('recent')}
            activeOpacity={0.8}
          >
            {activeTab === 'recent' ? (
              <LinearGradient
                colors={colors.gradient.cyberpunk}
                style={styles.activeTabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.activeTabText}>Recent Routes</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.tabText}>Recent Routes</Text>
            )}
          </TouchableOpacity>
        </View>

        {activeTab === 'nearby' && nearbyRides.length > 0 && (
          <View style={styles.mapToggleContainer}>
            <TouchableOpacity
              style={styles.mapToggleButton}
              onPress={() => setShowMap(!showMap)}
              activeOpacity={0.8}
              testID="map-toggle-button"
            >
              <Map size={16} color={colors.primary} />
              <Text style={styles.mapToggleText}>
                {showMap ? 'Hide Map View' : 'Show Map View'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'nearby' && showMap && nearbyRides.length > 0 && (
          <View style={styles.mapContainer}>
            <RidesMapView rides={nearbyRides} />
          </View>
        )}

        <View style={styles.section}>
          {error && (
            <Card style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          )}
          {activeTab === 'nearby' ? (
            isLoading ? (
              <LoadingSpinner text="Loading nearby rides..." />
            ) : nearbyRides.length > 0 ? (
              <FlatList
                data={nearbyRides}
                renderItem={renderNearbyRide}
                keyExtractor={nearbyRideKeyExtractor}
                ListHeaderComponent={renderNearbyRidesHeader}
                scrollEnabled={false}
                initialNumToRender={5}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                updateCellsBatchingPeriod={50}
              />
            ) : (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIcon}>
                  <MapPin size={48} color={colors.textLight} />
                </View>
                <Text style={styles.emptyText}>No rides nearby</Text>
                <Text style={styles.emptySubtext}>Try searching for rides to your destination</Text>
                <TouchableOpacity
                  style={styles.emptyActionButton}
                  onPress={handleSearchRides}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={colors.gradient.cyberpunk}
                    style={styles.emptyActionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.emptyActionText}>Search Routes</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIcon}>
                <Clock size={48} color={colors.textLight} />
              </View>
              <Text style={styles.emptyText}>No recent routes</Text>
              <Text style={styles.emptySubtext}>Your recent searches will appear here</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={colors.gradient.cyberpunk}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>
              Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}
            </Text>
            <GradientText style={styles.userName}>{user?.name}</GradientText>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/live-dashboard')}
            >
              <Activity size={24} color={colors.background} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleSearchRides}
            >
              <Search size={24} color={colors.background} />
            </TouchableOpacity>
            <NotificationBell />
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push('/profile')}
            >
              {user?.profilePicture ? (
                <Image
                  source={{ uri: user.profilePicture }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0) || 'U'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Role Toggle moved here for better UX */}
        <View style={styles.roleToggleContainer}>
          <RoleToggle />
        </View>

        {user?.role === 'driver' ? renderDriverHome() : renderRiderHome()}
      </ScrollView>
      <ToastContainer />
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: colors.background,
    opacity: 0.9,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.background,
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleToggleContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  actionCard: {
    marginBottom: 24,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
  },
  actionHeader: {
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.background,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: colors.background,
    opacity: 0.9,
  },
  createButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  searchCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  searchButton: {
    padding: 24,
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchText: {
    marginLeft: 16,
    flex: 1,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.background,
    marginBottom: 2,
  },
  searchSubtitle: {
    fontSize: 14,
    color: colors.background,
    opacity: 0.9,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeTabGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.background,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#fee',
    borderColor: '#fcc',
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickActionButton: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  pendingBookingCard: {
    marginBottom: 12,
    backgroundColor: '#fff8e1',
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  pendingBookingHeader: {
    marginBottom: 8,
  },
  pendingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingStatusText: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '600' as const,
  },
  pendingBookingDetails: {
    gap: 4,
  },
  routeContainer: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 6,
  },
  fromDot: {
    backgroundColor: colors.secondary,
  },
  toDot: {
    backgroundColor: colors.primary,
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: colors.borderLight,
    marginLeft: 3,
    marginBottom: 4,
  },
  routeInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  pendingInfo: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  confirmedBookingCard: {
    marginBottom: 12,
    backgroundColor: '#e8f5e8',
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  confirmedBookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmedStatusText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600' as const,
  },

  confirmedBookingDetails: {
    gap: 4,
  },
  bookingDetails: {
    gap: 6,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },

  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 4,
  },
  buttonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyActionButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyActionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.background,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text,
    textAlign: 'center',
  },
  mapToggleContainer: {
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
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
});