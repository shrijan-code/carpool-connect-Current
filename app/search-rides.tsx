import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform, Pressable, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RideCard } from '@/components/RideCard';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';
import { WalkingDistanceSelector } from '@/components/WalkingDistanceSelector';
import { RideFiltersComponent, RideFilters, filterRides } from '@/components/RideFilters';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { Calendar, Search, Filter, Navigation, Clock, MapPin, Map as MapIcon, List } from 'lucide-react-native';
import { Location, Ride } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RidesMapView from '@/components/RidesMapView';
import { logger } from '@/utils/logger';

export default function SearchRidesScreen() {
  const { user } = useAuthStore();
  const { searchResults, isLoading, searchRides, requestBooking } = useRidesStore();

  const [fromLocation, setFromLocation] = useState<Location | null>(null);
  const [toLocation, setToLocation] = useState<Location | null>(null);
  const [searchDate, setSearchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [walkingDistance, setWalkingDistance] = useState<number>(800); // Default 10 min walk
  const [showFilters, setShowFilters] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [rideFilters, setRideFilters] = useState<RideFilters>({});
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Validation helper
  const validateSearch = () => {
    const errors: { [key: string]: string } = {};

    if (!fromLocation) {
      errors.fromLocation = 'Pickup location is required';
    }
    if (!toLocation) {
      errors.toLocation = 'Destination is required';
    }
    if (searchDate < new Date()) {
      errors.searchDate = 'Date cannot be in the past';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSearch = async () => {
    Keyboard.dismiss();

    if (!validateSearch()) {
      Alert.alert('Missing Information', 'Please fill in all required fields correctly.');
      return;
    }

    try {
      logger.debug('Searching rides', { from: fromLocation!.name, to: toLocation!.name, walkingDistance });
      await searchRides(fromLocation!, toLocation!, searchDate.toISOString(), walkingDistance);
      setHasSearched(true);

      // Save user's walking distance preference
      if (user?.id) {
        await AsyncStorage.setItem(`walking_distance_${user.id}`, walkingDistance.toString());
      }

      if (searchResults.length === 0) {
        Alert.alert(
          'No Rides Found',
          'No rides match your search criteria. Try adjusting your locations, date, or walking distance.',
          [
            { text: 'Adjust Search', style: 'default' },
            {
              text: 'Create Ride Alert', onPress: () => {
                Alert.alert('Feature Coming Soon', 'Ride alerts will be available in a future update.');
              }
            }
          ]
        );
      }
    } catch (error: unknown) {
      console.error('Search rides error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to search rides';
      Alert.alert('Error', errorMessage);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  };

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
    const rideToBook = searchResults?.find((r: Ride) => r.id === rideId);
    if (!rideToBook) {
      Alert.alert('Error', 'Ride not found');
      return;
    }

    const pricePerSeatInCents = Math.round(rideToBook.pricePerSeat);

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

  const processBooking = async (ride: Ride, seats: number) => {
    try {
      logger.info('Starting booking request', { rideId: ride.id, seats });

      // Show processing alert
      Alert.alert(
        '💳 Processing...',
        'Creating booking request and authorizing payment...',
        [{ text: 'Please wait...', style: 'default' }]
      );

      // Use the new requestBooking method that creates a pending booking
      await requestBooking(ride.id, seats, user!);

      // Show success with correct flow explanation
      Alert.alert(
        '✅ Booking Request Sent!',
        `Your booking request has been sent to the driver!\n\n📋 What happens next:\n• Driver will receive your request\n• You'll be notified when they respond\n• Payment will only be processed if accepted\n• Chat will be enabled once confirmed`,
        [
          { text: 'View My Bookings', onPress: () => router.push('/(tabs)/rides') },
          { text: 'OK' }
        ]
      );
    } catch (error: unknown) {
      console.error('❌ Booking request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send booking request. Please try again.';
      Alert.alert(
        '❌ Booking Request Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };

  const handleRidePress = (rideId: string) => {
    router.push({ pathname: '/ride-details', params: { id: rideId } });
  };



  // Load user's walking distance preference on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (user?.id) {
        try {
          const savedDistance = await AsyncStorage.getItem(`walking_distance_${user.id}`);
          if (savedDistance) {
            setWalkingDistance(parseInt(savedDistance, 10));
          }
        } catch (error) {
          console.error('Error loading walking distance preference:', error);
        }
      }
    };

    loadPreferences();
  }, [user?.id]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        title: 'Search Rides',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.background
      }} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Card style={styles.searchCard}>
          <Text style={styles.sectionTitle}>Find Your Ride</Text>

          <View style={[styles.inputGroup, styles.locationInputFirst]}>
            <Text style={styles.inputLabel}>From Location *</Text>
            <PlacesAutocomplete
              placeholder="Enter pickup location"
              onLocationSelect={(location) => {
                setFromLocation(location);
                if (validationErrors.fromLocation) {
                  const newErrors = { ...validationErrors };
                  delete newErrors.fromLocation;
                  setValidationErrors(newErrors);
                }
              }}
              value={fromLocation}
            />
            {validationErrors.fromLocation && (
              <Text style={styles.errorText}>{validationErrors.fromLocation}</Text>
            )}
          </View>

          <View style={[styles.inputGroup, styles.locationInputSecond]}>
            <Text style={styles.inputLabel}>To Location *</Text>
            <PlacesAutocomplete
              placeholder="Enter destination"
              onLocationSelect={(location) => {
                setToLocation(location);
                if (validationErrors.toLocation) {
                  const newErrors = { ...validationErrors };
                  delete newErrors.toLocation;
                  setValidationErrors(newErrors);
                }
              }}
              value={toLocation}
            />
            {validationErrors.toLocation && (
              <Text style={styles.errorText}>{validationErrors.toLocation}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Travel Date *</Text>
            <TouchableOpacity
              style={[styles.dateButton, validationErrors.searchDate && styles.errorBorder]}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={20} color={Colors.primary} />
              <View style={styles.dateContent}>
                <Text style={styles.dateValue}>
                  {formatDate(searchDate)}
                </Text>
                <Text style={styles.dateSubValue}>
                  {searchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <Clock size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            {validationErrors.searchDate && (
              <Text style={styles.errorText}>{validationErrors.searchDate}</Text>
            )}
          </View>

          <View style={styles.buttonRow}>
            <Button
              title={isLoading ? "Searching..." : "Search Rides"}
              onPress={handleSearch}
              disabled={isLoading || !fromLocation || !toLocation}
              style={[styles.searchButton, { flex: 1, marginRight: 8 }]}
              leftIcon={<Search size={20} color={Colors.background} />}
            />
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.alternativeSearch}>
            <Text style={styles.alternativeText}>Or search by location:</Text>
            <Button
              title="Find Rides Near Me"
              onPress={() => router.push('/location-search')}
              style={styles.locationSearchButton}
              leftIcon={<MapPin size={18} color={Colors.primary} />}
              variant="outline"
            />
          </View>

          {showFilters && (
            <View style={styles.filtersContainer}>
              <WalkingDistanceSelector
                selectedDistance={walkingDistance}
                onDistanceSelect={setWalkingDistance}
                style={styles.walkingSelector}
              />
              <View style={styles.advancedFilters}>
                <RideFiltersComponent
                  filters={rideFilters}
                  onFiltersChange={setRideFilters}
                  rides={searchResults || []}
                />
              </View>
            </View>
          )}
        </Card>

        {hasSearched && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {searchResults && searchResults.length > 0
                  ? (() => {
                    const filteredCount = filterRides(searchResults, rideFilters).length;
                    const totalCount = searchResults.length;
                    return filteredCount === totalCount
                      ? `${totalCount} ride${totalCount === 1 ? '' : 's'} found`
                      : `${filteredCount} of ${totalCount} ride${totalCount === 1 ? '' : 's'} shown`;
                  })()
                  : 'No rides found'
                }
              </Text>
              {searchResults && searchResults.length > 0 && (
                <View style={styles.resultsToolbar}>
                  <View style={styles.walkingInfo}>
                    <Navigation size={16} color={Colors.primary} />
                    <Text style={styles.walkingInfoText}>
                      Walking tolerance: {Math.round(walkingDistance / 80)} min
                    </Text>
                  </View>
                  <View style={styles.viewToggle}>
                    <TouchableOpacity
                      testID="toggle-list"
                      style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
                      onPress={() => setViewMode('list')}
                      activeOpacity={0.8}
                    >
                      <List size={16} color={viewMode === 'list' ? Colors.background : Colors.textSecondary} />
                      <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="toggle-map"
                      style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
                      onPress={() => setViewMode('map')}
                      activeOpacity={0.8}
                    >
                      <MapIcon size={16} color={viewMode === 'map' ? Colors.background : Colors.textSecondary} />
                      <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {searchResults && searchResults.length > 0 ? (
              viewMode === 'map' ? (
                <View style={styles.mapWrapper}>
                  <RidesMapView rides={filterRides(searchResults, rideFilters)} />
                </View>
              ) : (
                filterRides(searchResults, rideFilters).map((ride, index) => {
                  const rideKey = ride.id
                    ? `search-result-${ride.id}`
                    : `search-result-fallback-${index}-${ride.driverId || 'unknown'}-${Date.now()}`;
                  return (
                    <RideCard
                      key={rideKey}
                      ride={ride}
                      onPress={() => handleRidePress(ride.id)}
                      showBookButton={user?.role === 'rider'}
                    />
                  );
                })
              )
            ) : hasSearched && !isLoading ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {searchResults && searchResults.length > 0 ? 'No rides match your filters' : 'No rides found'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchResults && searchResults.length > 0
                    ? 'Try adjusting your filters or search criteria'
                    : 'Try adjusting your search criteria or check back later'
                  }
                </Text>
              </Card>
            ) : null}
          </View>
        )}

        {!hasSearched && (
          <Card style={styles.emptyCard}>
            <Search size={48} color={Colors.textLight} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>Search for rides</Text>
            <Text style={styles.emptySubtext}>
              Enter your pickup and destination to find available rides
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && (
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowDatePicker(false)} />
          <View style={[styles.pickerWrapper, Platform.OS === 'ios' && styles.iosPickerWrapper]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Travel Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={searchDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setSearchDate(selectedDate);
                  if (validationErrors.searchDate) {
                    const newErrors = { ...validationErrors };
                    delete newErrors.searchDate;
                    setValidationErrors(newErrors);
                  }
                }
              }}
              minimumDate={new Date()}
              textColor={Platform.OS === 'ios' ? Colors.text : undefined}
              themeVariant={Platform.OS === 'ios' ? 'light' : undefined}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  searchCard: {
    marginBottom: 24,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  // Higher z-index for first location input to ensure its dropdown appears above the second input
  locationInputFirst: {
    zIndex: 10000,
  },
  // Lower z-index for second location input
  locationInputSecond: {
    zIndex: 9000,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  walkingSelector: {
    marginBottom: 16,
  },
  advancedFilters: {
    alignItems: 'flex-start',
  },
  searchButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsHeader: {
    marginBottom: 8,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  resultsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  walkingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  toggleTextActive: {
    color: Colors.background,
  },
  mapWrapper: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  walkingInfoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500' as const,
  },
  walkingDetails: {
    backgroundColor: Colors.surface,
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  walkingDetailsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  showAllButton: {
    backgroundColor: Colors.secondary,
    marginTop: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  alternativeSearch: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    alignItems: 'center',
  },
  alternativeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  locationSearchButton: {
    backgroundColor: Colors.background,
    borderColor: Colors.primary,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },

  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
  errorBorder: {
    borderColor: Colors.error,
    borderWidth: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  dateContent: {
    marginLeft: 12,
    flex: 1,
  },
  dateValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  dateSubValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  iosPickerWrapper: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 0,
    margin: 24,
    minWidth: '80%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerWrapper: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    margin: 24,
    minWidth: '80%',
  },
});