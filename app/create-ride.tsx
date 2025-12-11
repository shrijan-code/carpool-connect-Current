import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Keyboard, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';
import { DateField } from '@/src/components/DateField';
import { TimeField } from '@/src/components/TimeField';

import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { Users, DollarSign, AlertTriangle, CreditCard, CheckCircle, Package } from 'lucide-react-native';
import { Location, Vehicle, Ride } from '@/types';

export default function CreateRideScreen() {
  const { user } = useAuthStore();
  const { createRide, isLoading } = useRidesStore();
  

  const [fromLocation, setFromLocation] = useState<Location | null>(null);
  const [toLocation, setToLocation] = useState<Location | null>(null);
  const [departureDateTime, setDepartureDateTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Default to 5 minutes from now
    return now;
  });
  const [availableSeats, setAvailableSeats] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSeatsPicker, setShowSeatsPicker] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [stripeRequirement, setStripeRequirement] = useState<{ required: boolean; completedRides: number; message: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [availableForDelivery, setAvailableForDelivery] = useState(false);

  // Check Stripe requirement on component mount only
  useEffect(() => {
    const checkStripeStatus = async () => {
      if (user?.id && user?.role === 'driver') {
        try {
          // Mock stripe requirement check for now
          setStripeRequirement({
            required: false,
            completedRides: 0,
            message: 'Complete 10 more rides before Stripe setup becomes mandatory.'
          });
        } catch (error) {
          console.error('Error checking Stripe requirement:', error);
        }
      }
    };
    
    checkStripeStatus();
  }, [user?.id, user?.role]); // Only depend on user ID and role

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Validation helper
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    const now = new Date();
    const minDepartureTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

    if (!fromLocation) {
      errors.fromLocation = 'Origin location is required';
    }
    if (!toLocation) {
      errors.toLocation = 'Destination location is required';
    }
    if (departureDateTime < minDepartureTime) {
      errors.departureDateTime = 'Departure must be at least 5 minutes from now';
    }
    if (!pricePerSeat || parseFloat(pricePerSeat) <= 0) {
      errors.pricePerSeat = 'Valid price per seat is required';
    }
    if (availableSeats < 1 || availableSeats > 8) {
      errors.availableSeats = 'Seats must be between 1 and 8';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Memoized validation check to prevent re-renders
  const isFormValid = React.useMemo(() => {
    const now = new Date();
    const minDepartureTime = new Date(now.getTime() + 5 * 60 * 1000);
    
    return fromLocation && 
           toLocation && 
           departureDateTime >= minDepartureTime &&
           pricePerSeat && 
           parseFloat(pricePerSeat) > 0 &&
           availableSeats >= 1 && 
           availableSeats <= 8;
  }, [fromLocation, toLocation, departureDateTime, pricePerSeat, availableSeats]);

  // Format date and time for display
  const formatDateTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return date.toLocaleDateString('en-US', options);
  };

  const handleCreateRide = async () => {
    dismissKeyboard();
    
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a ride');
      return;
    }

    // Check if driver has exceeded 10 rides and needs Stripe setup
    if (stripeRequirement?.required) {
      Alert.alert(
        '💳 Payment Setup Required',
        'You must complete Stripe Connect setup to post rides after your 10th ride. You won\'t be paid otherwise.',
        [
          { text: 'Cancel' },
          { text: 'Set Up Payments', onPress: () => router.push('/(tabs)/profile') }
        ]
      );
      return;
    }

    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors below and try again.');
      return;
    }

    // Convert price from dollars to cents
    const priceInDollars = parseFloat(pricePerSeat);
    const priceInCents = Math.round(priceInDollars * 100);
    console.log(`Creating ride with price: ${priceInDollars.toFixed(2)} (${priceInCents} cents)`);

    try {
      // Use selected locations with coordinates (already validated)
      const fromLoc: Location = fromLocation!;
      const toLoc: Location = toLocation!;

      // Create vehicle object (simplified)
      const vehicle: Vehicle = {
        id: `vehicle_${user.id}`,
        make: 'Unknown',
        model: 'Unknown',
        year: 2020,
        color: 'Unknown',
        licensePlate: 'Unknown',
        seats: availableSeats + 1, // Driver + passengers
        verified: false
      };

      // Use the combined departure date/time
      const combinedDateTime = departureDateTime;

      const rideData = {
        driverId: user.id,
        driver: user,
        vehicle,
        from: fromLoc,
        to: toLoc,
        departureTime: combinedDateTime.toISOString(),
        availableSeats: availableSeats,
        seatsTotal: availableSeats,
        pricePerSeat: priceInCents,
        distance: '0 km', // In real app, calculate distance
        duration: '0 min', // In real app, calculate duration
        notes: notes?.trim() || '',
        availableForDelivery: availableForDelivery
      };

      console.log('Creating ride with data:', rideData);
      const rideId = await createRide(rideData);
      console.log('Ride created successfully with ID:', rideId);
      
      setShowSuccessScreen(true);
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        router.replace('/(tabs)/home');
      }, 3000);
    } catch (error: any) {
      console.error('Create ride error:', error);
      Alert.alert('Error', error.message || 'Failed to create ride. Please try again.');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDateTime = new Date(departureDateTime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setDepartureDateTime(newDateTime);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDateTime = new Date(departureDateTime);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setDepartureDateTime(newDateTime);
    }
  };

  if (showSuccessScreen) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>🎉 Ride Created Successfully!</Text>
            <Text style={styles.successMessage}>
              Thank you for reducing your carbon footprint and going green!
            </Text>
            <Text style={styles.successSubMessage}>
              Your ride is now available for booking.
            </Text>
            <View style={styles.successDetails}>
              <Text style={styles.successDetailText}>From: {fromLocation?.name}</Text>
              <Text style={styles.successDetailText}>To: {toLocation?.name}</Text>
              <Text style={styles.successDetailText}>
                Departure: {formatDateTime(departureDateTime)}
              </Text>
              <Text style={styles.successDetailText}>Seats: {availableSeats}</Text>
              <Text style={styles.successDetailText}>Price: ${pricePerSeat}/seat</Text>
              <Text style={styles.successDetailText}>
                Deliveries: {availableForDelivery ? 'Available' : 'Not available'}
              </Text>
            </View>
            <Text style={styles.redirectText}>Redirecting to home...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Create Ride',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.background
      }} />
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stripe Requirement Warning */}
        {stripeRequirement?.required ? (
          <Card style={styles.errorCard}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={24} color={Colors.error} />
              <Text style={styles.errorTitle}>Payment Setup Required</Text>
            </View>
            <Text style={styles.errorMessage}>
              You must complete payment setup to post rides after your 10th ride. You won&apos;t be paid otherwise.
            </Text>
            <Button
              title="Set Up Stripe Connect"
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.errorButton}
              leftIcon={<CreditCard size={16} color={Colors.background} />}
            />
          </Card>
        ) : stripeRequirement && !stripeRequirement.required && stripeRequirement.completedRides > 0 ? (
          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <CreditCard size={20} color={Colors.primary} />
              <Text style={styles.infoTitle}>Optional Payment Setup</Text>
            </View>
            <Text style={styles.infoMessage}>
              You can post {10 - stripeRequirement.completedRides} more rides before payment setup becomes required.
            </Text>
            <Button
              title="Set Up Payments (Optional)"
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.infoButton}
              leftIcon={<CreditCard size={16} color={Colors.primary} />}
            />
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Route Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>From Location *</Text>
            <PlacesAutocomplete
              placeholder="Enter pickup location"
              onLocationSelect={setFromLocation}
              value={fromLocation}
            />
            {validationErrors.fromLocation && (
              <Text style={styles.errorText}>{validationErrors.fromLocation}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>To Location *</Text>
            <PlacesAutocomplete
              placeholder="Enter destination"
              onLocationSelect={setToLocation}
              value={toLocation}
            />
            {validationErrors.toLocation && (
              <Text style={styles.errorText}>{validationErrors.toLocation}</Text>
            )}
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          
          <View style={styles.dateTimeRow}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <DateField
                value={departureDateTime}
                onChange={(date) => {
                  const newDateTime = new Date(departureDateTime);
                  newDateTime.setFullYear(date.getFullYear());
                  newDateTime.setMonth(date.getMonth());
                  newDateTime.setDate(date.getDate());
                  setDepartureDateTime(newDateTime);
                  if (validationErrors.departureDateTime) {
                    const newErrors = { ...validationErrors };
                    delete newErrors.departureDateTime;
                    setValidationErrors(newErrors);
                  }
                }}
                label="Departure Date *"
                minimumDate={new Date()}
                error={validationErrors.departureDateTime}
                testID="departure-date-field"
              />
            </View>
            
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <TimeField
                value={departureDateTime}
                onChange={(time) => {
                  const newDateTime = new Date(departureDateTime);
                  newDateTime.setHours(time.getHours());
                  newDateTime.setMinutes(time.getMinutes());
                  setDepartureDateTime(newDateTime);
                  if (validationErrors.departureDateTime) {
                    const newErrors = { ...validationErrors };
                    delete newErrors.departureDateTime;
                    setValidationErrors(newErrors);
                  }
                }}
                label="Departure Time *"
                error={validationErrors.departureDateTime}
                testID="departure-time-field"
              />
            </View>
          </View>
          
          {validationErrors.departureDateTime && (
            <Text style={styles.errorText}>{validationErrors.departureDateTime}</Text>
          )}
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Ride Details</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Users size={20} color={Colors.primary} style={styles.inputIcon} />
              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => setShowSeatsPicker(true)}
              >
                <Text style={styles.dateTimeLabel}>Available Seats *</Text>
                <Text style={styles.dateTimeValue}>
                  {availableSeats} seat{availableSeats !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <DollarSign size={20} color={Colors.primary} style={styles.inputIcon} />
              <Input
                label="Price per Seat *"
                value={pricePerSeat}
                onChangeText={(text) => {
                  setPricePerSeat(text);
                  if (validationErrors.pricePerSeat) {
                    const newErrors = { ...validationErrors };
                    delete newErrors.pricePerSeat;
                    setValidationErrors(newErrors);
                  }
                }}
                placeholder="0.00"
                keyboardType="decimal-pad"
                style={[styles.input, validationErrors.pricePerSeat && styles.errorBorder]}
              />
              {validationErrors.pricePerSeat && (
                <Text style={styles.errorText}>{validationErrors.pricePerSeat}</Text>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Input
              label="Notes (Optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional information..."
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea]}
            />
          </View>

          {/* Delivery Toggle */}
          <View style={styles.inputGroup}>
            <View style={styles.toggleContainer}>
              <View style={styles.toggleHeader}>
                <Package size={20} color={availableForDelivery ? '#059669' : '#6b7280'} />
                <Text style={styles.toggleLabel}>Available for Deliveries</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, availableForDelivery && styles.toggleActive]}
                onPress={() => setAvailableForDelivery(!availableForDelivery)}
                testID="delivery-toggle"
              >
                <View style={[styles.toggleThumb, availableForDelivery && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.toggleDescription}>
              {availableForDelivery 
                ? 'Riders can request deliveries along your route' 
                : 'Only passengers can book this ride'}
            </Text>
          </View>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? "Creating Ride..." : "Create Ride"}
            onPress={handleCreateRide}
            disabled={isLoading || stripeRequirement?.required || !isFormValid}
            style={[
              styles.createButton,
              (stripeRequirement?.required || !isFormValid) && styles.disabledButton
            ]}
            leftIcon={<CheckCircle size={20} color={Colors.background} />}
          />
          {stripeRequirement?.required && (
            <Text style={styles.disabledButtonText}>
              Complete payment setup to create rides
            </Text>
          )}
          {!isFormValid && !stripeRequirement?.required && (
            <Text style={styles.disabledButtonText}>
              Please fill all required fields correctly
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && (
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowDatePicker(false)} />
          <View style={[styles.pickerWrapper, Platform.OS === 'ios' && styles.iosPickerWrapper]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={departureDateTime}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              minimumDate={new Date()}
              textColor={Platform.OS === 'ios' ? Colors.text : undefined}
              themeVariant={Platform.OS === 'ios' ? 'light' : undefined}
            />
          </View>
        </View>
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowTimePicker(false)} />
          <View style={[styles.pickerWrapper, Platform.OS === 'ios' && styles.iosPickerWrapper]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={departureDateTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
              textColor={Platform.OS === 'ios' ? Colors.text : undefined}
              themeVariant={Platform.OS === 'ios' ? 'light' : undefined}
            />
          </View>
        </View>
      )}

      {/* Seats Picker Modal */}
      {showSeatsPicker && (
        <View style={styles.pickerModal}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowSeatsPicker(false)} />
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Available Seats</Text>
              <TouchableOpacity onPress={() => setShowSeatsPicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={availableSeats}
              onValueChange={(itemValue: number) => {
                setAvailableSeats(itemValue);
                if (validationErrors.availableSeats) {
                  const newErrors = { ...validationErrors };
                  delete newErrors.availableSeats;
                  setValidationErrors(newErrors);
                }
              }}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <Picker.Item 
                  key={num} 
                  label={`${num} seat${num !== 1 ? 's' : ''}`} 
                  value={num} 
                  color={Colors.text}
                />
              ))}
            </Picker>
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
  formCard: {
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
  },
  inputIcon: {
    position: 'absolute',
    top: 45,
    left: 12,
    zIndex: 1,
  },
  input: {
    paddingLeft: 40,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  halfWidth: {
    flex: 1,
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  createButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
  },
  dateTimeButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    marginLeft: 40,
  },
  dateTimeLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  dateTimeValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },

  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic' as const,
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
  iosPickerWrapper: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 0,
    margin: 24,
    minWidth: '80%',
    overflow: 'hidden',
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  pickerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 24,
    margin: 24,
    width: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  picker: {
    height: 150,
    color: Colors.text,
  },
  pickerItem: {
    color: Colors.text,
    fontSize: 18,
  },
  pickerDoneButton: {
    marginTop: 16,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 24,
  },
  successCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 18,
    color: Colors.success,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600' as const,
  },
  successSubMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  successDetails: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  successDetailText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  redirectText: {
    fontSize: 14,
    color: Colors.textLight,
    fontStyle: 'italic' as const,
  },
  warningCard: {
    marginBottom: 16,
    backgroundColor: '#fff8e1',
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 12,
  },
  warningMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  warningButton: {
    backgroundColor: Colors.warning,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.error,
    marginLeft: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: Colors.error,
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginLeft: 12,
  },
  infoMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  disabledButton: {
    backgroundColor: Colors.textLight,
    opacity: 0.6,
  },
  disabledButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 8,
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
    backgroundColor: '#059669',
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
  toggleDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
});