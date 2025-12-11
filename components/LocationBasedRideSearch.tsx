import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RideCard } from '@/components/RideCard';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { 
  Search, 
  MapPin, 
  Navigation, 
  Filter,
  Loader,
  AlertCircle,
  Map,
  List
} from 'lucide-react-native';
import { Ride } from '@/types';
import { 
  calculateLocationDistance, 
  formatDistance,
  formatWalkingTime 
} from '@/utils/haversine';
import * as ExpoLocation from 'expo-location';
import { router } from 'expo-router';
import RidesMapView from '@/components/RidesMapView';

interface LocationSearchFilters {
  searchQuery: string;
  maxDistance: number; // in km
  sortBy: 'distance' | 'price' | 'departure' | 'rating';
  minSeats: number;
  maxPrice?: number;
  availableForDelivery?: boolean;
}

interface LocationBasedRideSearchProps {
  onRideSelect?: (ride: Ride) => void;
  showBookButton?: boolean;
}

/**
 * Parse search query to extract location components
 */
function parseLocationQuery(query: string): {
  postcode?: string;
  city?: string;
  suburb?: string;
  fullAddress?: string;
} {
  const trimmedQuery = query.trim();
  
  // Check if it's a postcode (4 digits)
  const postcodeMatch = trimmedQuery.match(/^\d{4}$/);
  if (postcodeMatch) {
    return { postcode: postcodeMatch[0] };
  }
  
  // Check if it contains a postcode
  const postcodeInText = trimmedQuery.match(/\b\d{4}\b/);
  
  // If it's a short query (likely city/suburb)
  if (trimmedQuery.length <= 30 && !trimmedQuery.includes(',')) {
    return { 
      city: trimmedQuery,
      suburb: trimmedQuery,
      postcode: postcodeInText?.[0]
    };
  }
  
  // Otherwise treat as full address
  return { 
    fullAddress: trimmedQuery,
    postcode: postcodeInText?.[0]
  };
}

/**
 * Check if a ride matches the location search query
 */
function doesRideMatchLocation(ride: Ride, query: string): boolean {
  if (!ride) return false;
  if (!query.trim()) return true;
  
  const parsed = parseLocationQuery(query);
  const queryLower = query.toLowerCase();
  
  // Get ride locations
  const fromLocation = ride.from || ride.origin;
  const toLocation = ride.to || ride.destination;
  
  if (!fromLocation || !toLocation) return false;
  
  // Check both pickup and destination locations
  const locations = [fromLocation, toLocation];
  
  return locations.some(location => {
    const addressLower = location.address.toLowerCase();
    const nameLower = location.name.toLowerCase();
    
    // If searching by postcode
    if (parsed.postcode) {
      if (addressLower.includes(parsed.postcode)) return true;
    }
    
    // If searching by city/suburb
    if (parsed.city || parsed.suburb) {
      const searchTerm = (parsed.city || parsed.suburb)!.toLowerCase();
      if (addressLower.includes(searchTerm) || nameLower.includes(searchTerm)) {
        return true;
      }
    }
    
    // If searching by full address
    if (parsed.fullAddress) {
      if (addressLower.includes(queryLower) || nameLower.includes(queryLower)) {
        return true;
      }
    }
    
    // Fallback: general text search
    return addressLower.includes(queryLower) || nameLower.includes(queryLower);
  });
}

/**
 * Calculate distance from user location to ride (pickup or destination, whichever is closer)
 */
function calculateRideDistance(
  ride: Ride, 
  userLocation: { latitude: number; longitude: number }
): number {
  if (!ride) return Infinity;
  
  const fromLocation = ride.from || ride.origin;
  const toLocation = ride.to || ride.destination;
  
  if (!fromLocation || !toLocation) return Infinity;
  
  const fromDistance = calculateLocationDistance(
    userLocation,
    fromLocation
  );
  
  const toDistance = calculateLocationDistance(
    userLocation,
    toLocation
  );
  
  // Return the shorter distance (closer location)
  return Math.min(fromDistance, toDistance);
}

/**
 * Sort rides based on the selected criteria
 */
function sortRides(
  rides: Ride[], 
  sortBy: LocationSearchFilters['sortBy'],
  userLocation?: { latitude: number; longitude: number }
): Ride[] {
  return [...rides].sort((a, b) => {
    switch (sortBy) {
      case 'distance':
        if (!userLocation) return 0;
        const distanceA = calculateRideDistance(a, userLocation);
        const distanceB = calculateRideDistance(b, userLocation);
        return distanceA - distanceB;
        
      case 'price':
        return (a.pricePerSeat || 0) - (b.pricePerSeat || 0);
        
      case 'departure':
        const timeA = new Date(a.departureTime || a.departureAt || 0).getTime();
        const timeB = new Date(b.departureTime || b.departureAt || 0).getTime();
        return timeA - timeB;
        
      case 'rating':
        const ratingA = a.driver?.rating || 0;
        const ratingB = b.driver?.rating || 0;
        return ratingB - ratingA; // Higher rating first
        
      default:
        return 0;
    }
  });
}

export function LocationBasedRideSearch({ 
  onRideSelect, 
  showBookButton = true 
}: LocationBasedRideSearchProps) {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { getAllAvailableRides, requestBooking } = useRidesStore();
  
  const [filters, setFilters] = useState<LocationSearchFilters>({
    searchQuery: '',
    maxDistance: 50, // 50km default
    sortBy: 'distance',
    minSeats: 1,
    maxPrice: undefined,
    availableForDelivery: false,
  });
  
  const [allRides, setAllRides] = useState<Ride[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // Get user's current location with better mobile support
  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoadingLocation(true);
      
      if (Platform.OS === 'web') {
        // Web geolocation API
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported by this browser');
        }
        
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            reject, 
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 300000
            }
          );
        });
        
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      } else {
        // Mobile location using expo-location with better error handling
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          // Don't show alert immediately, just continue without location
          console.warn('Location permission denied');
          return;
        }
        
        const location = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
          timeInterval: 10000, // Increased timeout for mobile
          distanceInterval: 0,
        });
        
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      }
    } catch (error: any) {
      console.error('Location error:', error);
      // Don't show error alerts on mobile, just continue without location
      if (Platform.OS === 'web') {
        Alert.alert(
          'Location Error',
          'Unable to access your location. Distance sorting will not be available.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);
  
  // Load all available rides with better error handling
  const loadRides = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const rides = await getAllAvailableRides(50); // Reduced for better mobile performance
      
      // Ensure rides have proper structure for mobile compatibility
      const processedRides = rides.map(ride => ({
        ...ride,
        from: ride.from || ride.origin,
        to: ride.to || ride.destination,
        availableSeats: ride.availableSeats || ride.seatsAvailable || 0,
        departureTime: ride.departureTime || ride.departureAt
      }));
      
      setAllRides(processedRides);
      setHasSearched(true);
    } catch (error: any) {
      console.error('Failed to load rides:', error);
      // Simplified error handling for mobile
      Alert.alert(
        'Error', 
        'Failed to load rides. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [getAllAvailableRides]);
  
  // Filter and sort rides based on current filters
  const filteredRides = useMemo(() => {
    // Filter out null/undefined rides first
    let filtered = allRides.filter(ride => ride != null);
    
    // Apply location filter
    if (filters.searchQuery.trim()) {
      filtered = filtered.filter(ride => 
        doesRideMatchLocation(ride, filters.searchQuery)
      );
    }
    
    // Apply distance filter (if user location is available)
    if (userLocation && filters.maxDistance > 0) {
      filtered = filtered.filter(ride => {
        const distance = calculateRideDistance(ride, userLocation) / 1000; // Convert to km
        return distance <= filters.maxDistance;
      });
    }
    
    // Apply other filters
    filtered = filtered.filter(ride => {
      const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
      
      if (availableSeats < filters.minSeats) return false;
      if (filters.maxPrice && ride.pricePerSeat > filters.maxPrice) return false;
      if (filters.availableForDelivery && !ride.availableForDelivery) return false;
      
      return true;
    });
    
    // Sort rides
    return sortRides(filtered, filters.sortBy, userLocation || undefined);
  }, [allRides, filters, userLocation]);
  
  // Handle search
  const handleSearch = useCallback(async () => {
    if (!filters.searchQuery.trim()) {
      Alert.alert('Search Required', 'Please enter a location to search for rides.');
      return;
    }
    
    console.log('[LocationBasedRideSearch] Manual search triggered');
    await loadRides();
  }, [filters.searchQuery, loadRides]);
  
  // Handle search without location filter (show all rides)
  const handleSearchAll = useCallback(async () => {
    console.log('[LocationBasedRideSearch] Search all rides triggered');
    await loadRides();
  }, [loadRides]);
  
  // Process booking function defined first
  const processBooking = useCallback(async (ride: Ride, seats: number) => {
    try {
      if (!user) {
        Alert.alert('Error', 'You must be logged in to book a ride');
        return;
      }
      
      await requestBooking(ride.id, seats, user);
      
      Alert.alert(
        '✅ Booking Request Sent!',
        'Your booking request has been sent to the driver. You will be notified when they respond.',
        [
          { text: 'View My Bookings', onPress: () => router.push('/(tabs)/rides') },
          { text: 'OK' }
        ]
      );
    } catch (error: any) {
      console.error('Booking error:', error);
      Alert.alert('Booking Failed', error?.message || 'Failed to send booking request.');
    }
  }, [user, requestBooking]);

  // Handle ride booking with proper dependency order
  const handleBookRide = useCallback(async (rideId: string, availableSeats: number) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to book a ride');
      return;
    }

    if (user.role !== 'rider') {
      Alert.alert('Error', 'Only riders can book rides');
      return;
    }

    const rideToBook = filteredRides.find(r => r.id === rideId);
    if (!rideToBook) {
      Alert.alert('Error', 'Ride not found');
      return;
    }

    const seatOptions: { text: string; onPress?: () => void; style?: 'cancel' }[] = []; 
    for (let i = 1; i <= Math.min(availableSeats, 4); i++) {
      const totalPrice = (rideToBook.pricePerSeat * i).toFixed(2);
      seatOptions.push({
        text: `${i} seat${i > 1 ? 's' : ''} - ${totalPrice}`,
        onPress: () => processBooking(rideToBook, i)
      });
    }
    
    seatOptions.push({ text: 'Cancel', style: 'cancel' });
    
    Alert.alert(
      '🚗 Book This Ride',
      `From: ${rideToBook.from?.name || rideToBook.origin?.name}\nTo: ${rideToBook.to?.name || rideToBook.destination?.name}\nDriver: ${rideToBook.driver?.name || 'Unknown'}\n\nAvailable: ${availableSeats} seats\nPrice: ${rideToBook.pricePerSeat}/seat`,
      seatOptions as any
    );
  }, [user, filteredRides, processBooking]);
  
  const handleRidePress = useCallback((rideId: string) => {
    if (onRideSelect) {
      const ride = filteredRides.find(r => r.id === rideId);
      if (ride) onRideSelect(ride);
    } else {
      router.push({ pathname: '/ride-details', params: { id: rideId } });
    }
  }, [filteredRides, onRideSelect]);
  
  // Initialize component with better mobile support
  useEffect(() => {
    const initializeData = async () => {
      try {
        console.log('[LocationBasedRideSearch] Initializing data...');
        
        // Load rides first (essential functionality)
        await loadRides();
        
        // Then try to get location (optional enhancement) with delay for mobile
        if (Platform.OS !== 'web') {
          // On mobile, delay location request to avoid blocking UI
          const timeoutId = setTimeout(() => {
            getCurrentLocation().catch(err => {
              console.log('[LocationBasedRideSearch] Location request failed (non-critical):', err.message);
            });
          }, 2000);
          
          return () => clearTimeout(timeoutId);
        } else {
          // On web, get location immediately
          getCurrentLocation().catch(err => {
            console.log('[LocationBasedRideSearch] Location request failed (non-critical):', err.message);
          });
        }
      } catch (error) {
        console.error('[LocationBasedRideSearch] Initialization error:', error);
      }
    };
    
    initializeData();
  }, [getCurrentLocation, loadRides]);
  
  // Early return with loading state if colors are not available (mobile initialization)
  if (!colors || !colors.surface || !colors.gradient) {
    return (
      <SafeAreaView style={fallbackStyles.container}>
        <View style={fallbackStyles.loadingContainer}>
          <Text style={fallbackStyles.text}>Loading search...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const styles = createStyles(colors);
  
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={colors.gradient?.cyberpunk || ['#667eea', '#764ba2']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.title}>Find Rides Near You</Text>
          <Text style={styles.subtitle}>
            Search by postcode, city, or address
          </Text>
        </View>
      </LinearGradient>
      
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Section */}
        <Card style={styles.searchCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Input
                value={filters.searchQuery}
                onChangeText={(text) => setFilters(prev => ({ ...prev, searchQuery: text }))}
                placeholder="Enter postcode, city, or address"
                style={styles.searchInput}
                leftIcon={<MapPin size={20} color={colors.textSecondary} />}
              />
            </View>
            <TouchableOpacity
              style={[styles.filterToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {showFilters && (
            <View style={styles.filtersContainer}>
              <View style={styles.filterRow}>
                <View style={styles.filterItem}>
                  <Text style={[styles.filterLabel, { color: colors.text }]}>Max Distance</Text>
                  <Input
                    value={filters.maxDistance.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setFilters(prev => ({ ...prev, maxDistance: value }));
                    }}
                    placeholder="50"
                    keyboardType="numeric"
                    style={styles.filterInput}
                    rightText="km"
                  />
                </View>
                <View style={styles.filterItem}>
                  <Text style={[styles.filterLabel, { color: colors.text }]}>Min Seats</Text>
                  <Input
                    value={filters.minSeats.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 1;
                      setFilters(prev => ({ ...prev, minSeats: value }));
                    }}
                    placeholder="1"
                    keyboardType="numeric"
                    style={styles.filterInput}
                  />
                </View>
              </View>
              
              <View style={styles.filterRow}>
                <View style={styles.filterItem}>
                  <Text style={[styles.filterLabel, { color: colors.text }]}>Max Price</Text>
                  <Input
                    value={filters.maxPrice?.toString() || ''}
                    onChangeText={(text) => {
                      const value = text ? parseFloat(text) : undefined;
                      setFilters(prev => ({ ...prev, maxPrice: value }));
                    }}
                    placeholder="No limit"
                    keyboardType="decimal-pad"
                    style={styles.filterInput}
                    leftText="$"
                  />
                </View>
                <View style={styles.filterItem}>
                  <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
                  <View style={styles.sortButtons}>
                    {(['distance', 'price', 'departure', 'rating'] as const).map((sort) => (
                      <TouchableOpacity
                        key={sort}
                        style={[
                          styles.sortButton,
                          { 
                            backgroundColor: filters.sortBy === sort ? colors.primary : colors.surface,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={() => setFilters(prev => ({ ...prev, sortBy: sort }))}
                      >
                        <Text style={[
                          styles.sortButtonText,
                          { color: filters.sortBy === sort ? colors.background : colors.textSecondary }
                        ]}>
                          {sort.charAt(0).toUpperCase() + sort.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}
          
          <View style={styles.searchActions}>
            <Button
              title={isLoading ? "Searching..." : filters.searchQuery.trim() ? "Search Rides" : "Show All Rides"}
              onPress={filters.searchQuery.trim() ? handleSearch : handleSearchAll}
              disabled={isLoading}
              style={styles.searchButton}
              leftIcon={isLoading ? <Loader size={20} color={colors.background} /> : <Search size={20} color={colors.background} />}
            />
            
            {!userLocation && (
              <TouchableOpacity
                style={[styles.locationButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={getCurrentLocation}
                disabled={isLoadingLocation}
              >
                {isLoadingLocation ? (
                  <Loader size={16} color={colors.primary} />
                ) : (
                  <Navigation size={16} color={colors.primary} />
                )}
                <Text style={[styles.locationButtonText, { color: colors.primary }]}>
                  {isLoadingLocation ? 'Getting...' : 'Get Location'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {userLocation && (
            <View style={[styles.locationStatus, { backgroundColor: colors.success + '20' }]}>
              <Navigation size={16} color={colors.success} />
              <Text style={[styles.locationStatusText, { color: colors.success }]}>
                Location enabled - rides sorted by distance
              </Text>
            </View>
          )}
          
          <View style={[styles.disclaimerBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
            <AlertCircle size={16} color={colors.primary} />
            <Text style={[styles.disclaimerText, { color: colors.text }]}>
              Showing rides within {filters.maxDistance}km. Not seeing enough results? Tap the filter icon and increase the distance for more options.
            </Text>
          </View>
        </Card>
        
        {/* Results Section */}
        {hasSearched && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsHeaderLeft}>
                <Text style={[styles.resultsTitle, { color: colors.text }]}>
                  {filteredRides.length > 0 
                    ? `${filteredRides.length} ride${filteredRides.length === 1 ? '' : 's'} found`
                    : 'No rides found'
                  }
                </Text>
                {filteredRides.length > 0 && filters.searchQuery && (
                  <Text style={[styles.resultsSubtitle, { color: colors.textSecondary }]}>
                    Near &quot;{filters.searchQuery}&quot;
                  </Text>
                )}
              </View>
              
              {filteredRides.length > 0 && (
                <View style={styles.viewToggle}>
                  <TouchableOpacity
                    style={[
                      styles.viewToggleButton,
                      { 
                        backgroundColor: viewMode === 'list' ? colors.primary : colors.surface,
                        borderColor: colors.border
                      }
                    ]}
                    onPress={() => setViewMode('list')}
                  >
                    <List size={18} color={viewMode === 'list' ? colors.background : colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.viewToggleButton,
                      { 
                        backgroundColor: viewMode === 'map' ? colors.primary : colors.surface,
                        borderColor: colors.border
                      }
                    ]}
                    onPress={() => setViewMode('map')}
                  >
                    <Map size={18} color={viewMode === 'map' ? colors.background : colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {filteredRides.length > 0 ? (
              viewMode === 'list' ? (
                filteredRides.map((ride, index) => {
                  // Skip if ride is null/undefined
                  if (!ride || !ride.id) return null;
                  
                  const distance = userLocation 
                    ? calculateRideDistance(ride, userLocation)
                    : null;
                    
                  return (
                    <View key={ride.id || `ride-${index}`} style={styles.rideContainer}>
                      <RideCard
                        ride={ride}
                        onPress={() => handleRidePress(ride.id)}
                        showBookButton={showBookButton && user?.role === 'rider'}
                        onBook={() => handleBookRide(ride.id, ride.availableSeats || ride.seatsAvailable || 0)}
                      />
                      {distance && (
                        <View style={[styles.distanceInfo, { backgroundColor: colors.surface }]}>
                          <Navigation size={12} color={colors.textSecondary} />
                          <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                            {formatDistance(distance)} away • {formatWalkingTime(distance)}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={styles.mapContainer}>
                  <RidesMapView
                    rides={filteredRides}
                    userLocation={userLocation}
                    onRideSelect={handleRidePress}
                  />
                </View>
              )
            ) : (
              <Card style={styles.emptyCard}>
                <AlertCircle size={48} color={colors.textLight} style={styles.emptyIcon} />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No rides found
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  {filters.searchQuery 
                    ? `No rides found near &quot;${filters.searchQuery}&quot;. Try expanding your search area or adjusting filters.`
                    : 'Enter a location to search for available rides.'
                  }
                </Text>
              </Card>
            )}
          </View>
        )}
        
        {!hasSearched && !isLoading && (
          <Card style={styles.emptyCard}>
            <Search size={48} color={colors.textLight} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Search for rides near you
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Enter a postcode, city name, or full address to find available rides sorted by distance from your location.
            </Text>

            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={handleSearchAll}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradient?.cyberpunk || ['#667eea', '#764ba2']}
                style={styles.emptyActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.emptyActionText, { color: colors.background }]}>Show All Available Rides</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Card>
        )}
        
        {isLoading && (
          <Card style={styles.emptyCard}>
            <Loader size={48} color={colors.primary} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Loading rides...
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {userLocation ? 'Finding rides near your location' : 'Loading available rides'}
            </Text>
          </Card>
        )}
      </ScrollView>
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
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginBottom: 4,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  searchCard: {
    marginTop: 16,
    marginBottom: 16,
    padding: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterToggle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  filterInput: {
    marginBottom: 0,
  },
  sortButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  searchActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchButton: {
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  locationButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  locationStatusText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  resultsHeaderLeft: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  viewToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    height: 500,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  rideContainer: {
    marginBottom: 12,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -8,
    marginHorizontal: 4,
    gap: 6,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionButton: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyActionGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
});

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
});
