import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Filter, X, MapPin, DollarSign, Package } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Ride } from '@/types';
import { calculateLocationDistance } from '@/utils/haversine';

export interface RideFilters {
  city?: string;
  suburb?: string;
  postcode?: string;
  maxDistance?: number; // in km
  minPrice?: number;
  maxPrice?: number;
  availableForDelivery?: boolean;
  minSeats?: number;
}

interface RideFiltersProps {
  filters: RideFilters;
  onFiltersChange: (filters: RideFilters) => void;
  rides: Ride[];
  userLocation?: { latitude: number; longitude: number };
}

/**
 * Parse address to extract city, suburb, and postcode
 * This is a simplified parser - in production, use a proper address parsing service
 */
function parseAddress(address: string): { city?: string; suburb?: string; postcode?: string } {
  const parts = address.split(',').map(part => part.trim());
  const result: { city?: string; suburb?: string; postcode?: string } = {};
  
  // Look for postcode (4 digits in Australia)
  const postcodeMatch = address.match(/\b\d{4}\b/);
  if (postcodeMatch) {
    result.postcode = postcodeMatch[0];
  }
  
  // Simple heuristic: last non-postcode part is usually the city/state
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    
    // If last part contains postcode, city is second last
    if (postcodeMatch && lastPart.includes(postcodeMatch[0])) {
      result.city = secondLastPart;
    } else {
      result.city = lastPart;
    }
  }
  
  // Suburb is typically the first part
  if (parts.length >= 1) {
    result.suburb = parts[0];
  }
  
  return result;
}

/**
 * Filter rides based on the provided filters
 */
export function filterRides(
  rides: Ride[],
  filters: RideFilters,
  userLocation?: { latitude: number; longitude: number }
): Ride[] {
  return rides.filter(ride => {
    const fromLocation = ride.from || ride.origin;
    const toLocation = ride.to || ride.destination;
    
    if (!fromLocation || !toLocation) return false;
    
    // Parse addresses for filtering
    const fromParsed = parseAddress(fromLocation.address);
    const toParsed = parseAddress(toLocation.address);
    
    // City filter - check both from and to locations
    if (filters.city) {
      const cityLower = filters.city.toLowerCase();
      const fromCityMatch = fromParsed.city?.toLowerCase().includes(cityLower);
      const toCityMatch = toParsed.city?.toLowerCase().includes(cityLower);
      if (!fromCityMatch && !toCityMatch) return false;
    }
    
    // Suburb filter - check both from and to locations
    if (filters.suburb) {
      const suburbLower = filters.suburb.toLowerCase();
      const fromSuburbMatch = fromParsed.suburb?.toLowerCase().includes(suburbLower);
      const toSuburbMatch = toParsed.suburb?.toLowerCase().includes(suburbLower);
      if (!fromSuburbMatch && !toSuburbMatch) return false;
    }
    
    // Postcode filter - check both from and to locations
    if (filters.postcode) {
      const fromPostcodeMatch = fromParsed.postcode?.includes(filters.postcode);
      const toPostcodeMatch = toParsed.postcode?.includes(filters.postcode);
      if (!fromPostcodeMatch && !toPostcodeMatch) return false;
    }
    
    // Distance filter (if user location is provided)
    // Check if user is within distance of either pickup or destination
    if (filters.maxDistance && userLocation) {
      const fromDistance = calculateLocationDistance(
        userLocation,
        fromLocation
      ) / 1000; // Convert to km
      const toDistance = calculateLocationDistance(
        userLocation,
        toLocation
      ) / 1000; // Convert to km
      
      // Return false if user is NOT within distance of either pickup OR destination
      if (fromDistance > filters.maxDistance && toDistance > filters.maxDistance) {
        return false;
      }
    }
    
    // Price filters
    if (filters.minPrice && ride.pricePerSeat < filters.minPrice) return false;
    if (filters.maxPrice && ride.pricePerSeat > filters.maxPrice) return false;
    
    // Delivery availability filter
    if (filters.availableForDelivery && !ride.availableForDelivery) return false;
    
    // Minimum seats filter
    const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
    if (filters.minSeats && availableSeats < filters.minSeats) return false;
    
    return true;
  });
}

export function RideFiltersComponent({ filters, onFiltersChange, rides }: RideFiltersProps) {
  const [showModal, setShowModal] = useState(false);
  const [tempFilters, setTempFilters] = useState<RideFilters>(filters);
  
  const handleApplyFilters = useCallback(() => {
    onFiltersChange(tempFilters);
    setShowModal(false);
  }, [tempFilters, onFiltersChange]);
  
  const handleClearFilters = useCallback(() => {
    const emptyFilters: RideFilters = {};
    setTempFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    setShowModal(false);
  }, [onFiltersChange]);
  
  const activeFiltersCount = Object.values(filters).filter(value => 
    value !== undefined && value !== '' && value !== 0
  ).length;
  
  return (
    <>
      <TouchableOpacity
        style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
        onPress={() => setShowModal(true)}
        testID="ride-filters-button"
      >
        <Filter size={20} color={activeFiltersCount > 0 ? Colors.background : Colors.primary} />
        <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>
          Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
        </Text>
      </TouchableOpacity>
      
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
                <Package size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Ride Options</Text>
              </View>
              
              <Input
                label="Minimum Seats"
                value={tempFilters.minSeats?.toString() || ''}
                onChangeText={(text) => {
                  const value = text ? parseInt(text, 10) : undefined;
                  setTempFilters(prev => ({ ...prev, minSeats: value }));
                }}
                placeholder="1"
                keyboardType="numeric"
                style={styles.input}
              />
              
              {/* Delivery Toggle */}
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleLabel}>Available for Deliveries</Text>
                <TouchableOpacity
                  style={[styles.toggle, tempFilters.availableForDelivery && styles.toggleActive]}
                  onPress={() => setTempFilters(prev => ({ 
                    ...prev, 
                    availableForDelivery: prev.availableForDelivery ? undefined : true 
                  }))}
                  testID="delivery-filter-toggle"
                >
                  <View style={[styles.toggleThumb, tempFilters.availableForDelivery && styles.toggleThumbActive]} />
                </TouchableOpacity>
              </View>
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
    </>
  );
}

const styles = StyleSheet.create({
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