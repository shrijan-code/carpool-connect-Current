import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Filter, X, MapPin, DollarSign, Navigation, Car } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FilterOptions } from '@/hooks/useRideFilters';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';
import { Location } from '@/types';
import { LocationService } from '@/services/location';

interface UniversalFiltersProps {
  type: 'rides';
  filters: FilterOptions;
  onFiltersChange: (filters: Partial<FilterOptions>) => void;
  onClearFilters: () => void;
  activeFiltersCount: number;
  totalCount: number;
  filteredCount: number;
}

export function UniversalFilters({
  type,
  filters,
  onFiltersChange,
  onClearFilters,
  activeFiltersCount,
  totalCount,
  filteredCount
}: UniversalFiltersProps) {
  const [showModal, setShowModal] = useState(false);
  const [tempFilters, setTempFilters] = useState<FilterOptions>({});

  // Handle modal opening and initialize tempFilters
  const handleOpenModal = useCallback(() => {
    setTempFilters(filters);
    setShowModal(true);
  }, [filters]);

  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const handleApplyFilters = useCallback(() => {
    onFiltersChange(tempFilters);
    setShowModal(false);
  }, [tempFilters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    setTempFilters({});
    onClearFilters();
    setShowModal(false);
  }, [onClearFilters]);

  const handleLocationSelect = useCallback((location: Location) => {
    if (location?.latitude && location?.longitude) {
      setTempFilters(prev => ({
        ...prev,
        userLocation: { latitude: location.latitude, longitude: location.longitude }
      }));
      setShowLocationPicker(false);
    }
  }, []);

  return (
    <>
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={handleOpenModal}
          testID={`${type}-filters-button`}
        >
          <Filter size={20} color={activeFiltersCount > 0 ? Colors.background : Colors.primary} />
          <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Text>
        </TouchableOpacity>

        {activeFiltersCount > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsText}>
              {filteredCount} of {totalCount} {type}
            </Text>
          </View>
        )}
      </View>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Rides</Text>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={styles.closeButton}
              testID="close-filters-modal"
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Location Filters */}
            <View style={styles.filterSection}>
              <View style={styles.sectionHeader}>
                <MapPin size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Location</Text>
              </View>

              <Input
                label="City"
                value={tempFilters.city || ''}
                onChangeText={(text) => setTempFilters(prev => ({ ...prev, city: text || undefined }))}
                placeholder="e.g., Sydney, Melbourne"
                style={styles.input}
              />

              <Input
                label="Suburb"
                value={tempFilters.suburb || ''}
                onChangeText={(text) => setTempFilters(prev => ({ ...prev, suburb: text || undefined }))}
                placeholder="e.g., Bondi, Richmond"
                style={styles.input}
              />

              <Input
                label="Postcode"
                value={tempFilters.postcode || ''}
                onChangeText={(text) => setTempFilters(prev => ({ ...prev, postcode: text || undefined }))}
                placeholder="e.g., 2000, 3000"
                keyboardType="numeric"
                style={styles.input}
              />

              {/* Location Picker for Distance Filter */}
              <TouchableOpacity
                style={styles.locationPickerButton}
                onPress={() => setShowLocationPicker(true)}
              >
                <Navigation size={16} color={Colors.primary} />
                <Text style={styles.locationPickerText}>
                  {tempFilters.userLocation
                    ? 'Location set for distance filter'
                    : 'Set location for distance filter'
                  }
                </Text>
              </TouchableOpacity>

              {tempFilters.userLocation && (
                <Input
                  label="Max Distance (km)"
                  value={tempFilters.maxDistance?.toString() || ''}
                  onChangeText={(text) => {
                    const value = text ? parseFloat(text) : undefined;
                    setTempFilters(prev => ({ ...prev, maxDistance: value }));
                  }}
                  placeholder="e.g., 10, 25"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              )}
            </View>

            {/* Price Filters */}
            <View style={styles.filterSection}>
              <View style={styles.sectionHeader}>
                <DollarSign size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Price Range</Text>
              </View>

              <View style={styles.priceRow}>
                <Input
                  label="Min Price ($)"
                  value={tempFilters.minPrice?.toString() || ''}
                  onChangeText={(text) => {
                    const value = text ? parseFloat(text) : undefined;
                    setTempFilters(prev => ({ ...prev, minPrice: value }));
                  }}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.halfWidth]}
                />

                <Input
                  label="Max Price ($)"
                  value={tempFilters.maxPrice?.toString() || ''}
                  onChangeText={(text) => {
                    const value = text ? parseFloat(text) : undefined;
                    setTempFilters(prev => ({ ...prev, maxPrice: value }));
                  }}
                  placeholder="100"
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.halfWidth]}
                />
              </View>
            </View>

            {/* Ride Options */}
            <View style={styles.filterSection}>
              <View style={styles.sectionHeader}>
                <Car size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Ride Options</Text>
              </View>

              <Input
                label="Minimum Seats"
                value={(tempFilters as FilterOptions).minSeats?.toString() || ''}
                onChangeText={(text) => {
                  const value = text ? parseInt(text, 10) : undefined;
                  setTempFilters(prev => ({ ...prev, minSeats: value }));
                }}
                placeholder="1"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Clear All"
              onPress={handleClearFilters}
              style={styles.clearButton}
              textStyle={styles.clearButtonText}
            />
            <Button
              title="Apply Filters"
              onPress={handleApplyFilters}
              style={styles.applyButton}
            />
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <Modal
          visible={showLocationPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowLocationPicker(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity
                onPress={() => setShowLocationPicker(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.locationPickerContainer}>
              <Text style={styles.locationPickerDescription}>
                Choose a location to filter by distance. This will show {type} within your specified radius.
              </Text>

              <PlacesAutocomplete
                placeholder="Search for a location..."
                onLocationSelect={handleLocationSelect}
                style={styles.placesInput}
              />

              <Button
                title="Use Current Location"
                onPress={async () => {
                  try {
                    const location = await LocationService.getCurrentLocation();
                    if (location) {
                      setTempFilters(prev => ({
                        ...prev,
                        userLocation: {
                          latitude: location.latitude,
                          longitude: location.longitude
                        }
                      }));
                      setShowLocationPicker(false);
                    } else {
                      Alert.alert(
                        'Location Error',
                        'Unable to get your current location. Please check your location permissions and try again.'
                      );
                    }
                  } catch (error) {
                    console.error('Location error:', error);
                    Alert.alert(
                      'Location Error',
                      'Unable to access your location. Please ensure location services are enabled.'
                    );
                  }
                }}
                style={styles.currentLocationButton}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  filterButtonTextActive: {
    color: Colors.background,
  },
  resultsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
  },
  resultsText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    marginVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 8,
  },
  input: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  packageSizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  packageSizeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  packageSizeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  packageSizeButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  packageSizeButtonTextActive: {
    color: Colors.background,
  },
  locationPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginBottom: 12,
  },
  locationPickerText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  locationPickerContainer: {
    flex: 1,
    padding: 20,
  },
  locationPickerDescription: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 20,
    lineHeight: 20,
  },
  placesInput: {
    marginBottom: 20,
  },
  currentLocationButton: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearButtonText: {
    color: Colors.text,
  },
  applyButton: {
    flex: 2,
    backgroundColor: Colors.primary,
  },
});