import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Keyboard, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';
import { DateField } from '@/src/components/DateField';
import { TimeField } from '@/src/components/TimeField';

import { Colors } from '@/constants/colors';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { Users, DollarSign, AlertTriangle, CreditCard, CheckCircle, Car, FileText, XCircle, Clock } from 'lucide-react-native';
import { Location, Vehicle, Ride } from '@/types';
import { validatePrice, validateSeats, validateLocation, validateFutureDate } from '@/utils/validation';
import { useMemo } from 'react';
import { logger } from '@/utils/logger';

// Driver verification requirements check result
interface DriverVerificationStatus {
  canCreateRide: boolean;
  missingVehicleDetails: boolean;
  missingRegistration: boolean;
  missingInsurance: boolean;
  pendingApproval: boolean;
  rejected: boolean;
  rejectionReason?: string;
  isGrandfathered: boolean; // Existing drivers without documents
}

export default function CreateRideScreen() {
  const { user } = useAuthStore();
  const { createRide, isLoading } = useRidesStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  // Check driver verification status
  const driverVerificationStatus = useMemo<DriverVerificationStatus>(() => {
    if (!user) {
      return {
        canCreateRide: false,
        missingVehicleDetails: true,
        missingRegistration: true,
        missingInsurance: true,
        pendingApproval: false,
        rejected: false,
        isGrandfathered: false,
      };
    }

    const carDetails = user.carDetails;
    const driverApproval = user.driverApproval;

    // Check if this is a grandfathered driver (has completed rides but no documents)
    // Grandfathered drivers can continue to post but should be encouraged to upload documents
    const hasCompletedRides = (user.totalRides || 0) > 0;
    const hasDocuments = !!carDetails?.registrationDocument && !!carDetails?.insuranceDocument;
    const isGrandfathered = hasCompletedRides && !hasDocuments && !driverApproval;

    // Vehicle details check
    const hasVehicleDetails = !!(
      carDetails?.make &&
      carDetails?.model &&
      carDetails?.year &&
      carDetails?.licensePlate
    );

    // Document checks
    const hasRegistration = !!carDetails?.registrationDocument;
    const hasInsurance = !!carDetails?.insuranceDocument;

    // Approval status check
    const approvalStatus = driverApproval?.status;
    const isPending = approvalStatus === 'pending';
    const isRejected = approvalStatus === 'rejected';
    const isApproved = approvalStatus === 'approved';

    // Can create ride if:
    // 1. Grandfathered driver (has rides, no documents required yet)
    // 2. Fully verified: has vehicle details, documents, and approved status
    const canCreateRide = isGrandfathered || (hasVehicleDetails && hasRegistration && hasInsurance && isApproved);

    return {
      canCreateRide,
      missingVehicleDetails: !hasVehicleDetails,
      missingRegistration: !hasRegistration,
      missingInsurance: !hasInsurance,
      pendingApproval: isPending,
      rejected: isRejected,
      rejectionReason: driverApproval?.rejectionReason,
      isGrandfathered,
    };
  }, [user]);

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

  // Validation using shared validators
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    // Location validation using shared validator
    if (!validateLocation(fromLocation)) {
      errors.fromLocation = 'Origin location is required with valid coordinates';
    }
    if (!validateLocation(toLocation)) {
      errors.toLocation = 'Destination location is required with valid coordinates';
    }

    // Date validation using shared validator
    const dateValidation = validateFutureDate(departureDateTime, 5);
    if (!dateValidation.valid) {
      errors.departureDateTime = dateValidation.error || 'Invalid departure date';
    }

    // Price validation using shared validator
    const priceValidation = validatePrice(pricePerSeat);
    if (!priceValidation.valid) {
      errors.pricePerSeat = priceValidation.error || 'Invalid price';
    }

    // Seats validation using shared validator
    const seatsValidation = validateSeats(availableSeats);
    if (!seatsValidation.valid) {
      errors.availableSeats = seatsValidation.error || 'Invalid number of seats';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Memoized validation check using shared validators
  const isFormValid = React.useMemo(() => {
    return validateLocation(fromLocation) &&
      validateLocation(toLocation) &&
      validateFutureDate(departureDateTime, 5).valid &&
      validatePrice(pricePerSeat).valid &&
      validateSeats(availableSeats).valid;
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
      Alert.alert(
        'Authentication Required',
        'Please log in to create a ride. Your session may have expired.',
        [
          { text: 'Go to Login', onPress: () => router.push('/auth') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
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
      Alert.alert(
        'Missing Information',
        'Please complete all required fields:\n\n• Origin and destination locations\n• Departure date and time\n• Price per seat\n• Number of seats',
        [{ text: 'OK' }]
      );
      return;
    }

    // Convert price from dollars to cents
    const priceInDollars = parseFloat(pricePerSeat);
    const priceInCents = Math.round(priceInDollars * 100);
    logger.debug('Creating ride', { priceInDollars: priceInDollars.toFixed(2), priceInCents });

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
      };

      const rideId = await createRide(rideData);
      logger.ride.created(rideId, user.id);

      setShowSuccessScreen(true);

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        router.replace('/(tabs)/home');
      }, 3000);
    } catch (error: unknown) {
      console.error('Create ride error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Provide specific guidance based on error type
      let title = 'Ride Creation Failed';
      let message = 'Unable to create your ride. Please try again.';

      if (errorMessage.includes('network') || errorMessage.includes('internet')) {
        title = 'Connection Error';
        message = 'Please check your internet connection and try again.';
      } else if (errorMessage.includes('permission')) {
        title = 'Permission Denied';
        message = 'You may not have permission to create rides. Please ensure your account is fully set up.';
      }

      Alert.alert(
        title,
        message,
        [
          { text: 'Retry', onPress: handleCreateRide },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDateTime = new Date(departureDateTime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setDepartureDateTime(newDateTime);
    }
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
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
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.background
      }} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Driver Verification Requirements */}
        {!driverVerificationStatus.canCreateRide && (
          <Card style={[styles.errorCard, { marginBottom: 16 }]}>
            <View style={styles.warningHeader}>
              {driverVerificationStatus.rejected ? (
                <XCircle size={24} color={colors.error} />
              ) : driverVerificationStatus.pendingApproval ? (
                <Clock size={24} color={colors.warning} />
              ) : (
                <AlertTriangle size={24} color={colors.warning} />
              )}
              <Text style={styles.errorTitle}>
                {driverVerificationStatus.rejected
                  ? 'Driver Application Rejected'
                  : driverVerificationStatus.pendingApproval
                    ? 'Awaiting Admin Approval'
                    : 'Complete Driver Setup'}
              </Text>
            </View>
            <Text style={styles.errorMessage}>
              {driverVerificationStatus.rejected
                ? `Your driver application was rejected: ${driverVerificationStatus.rejectionReason || 'Please contact support for details.'}`
                : driverVerificationStatus.pendingApproval
                  ? 'Your driver application is under review. We\'ll notify you once approved.'
                  : 'Complete the following to post rides:'}
            </Text>

            {!driverVerificationStatus.pendingApproval && !driverVerificationStatus.rejected && (
              <View style={{ marginTop: 12 }}>
                <View style={styles.requirementItem}>
                  {driverVerificationStatus.missingVehicleDetails ? (
                    <XCircle size={18} color={colors.error} />
                  ) : (
                    <CheckCircle size={18} color={colors.success} />
                  )}
                  <Text style={[
                    styles.requirementText,
                    !driverVerificationStatus.missingVehicleDetails && styles.requirementComplete
                  ]}>Vehicle details (make, model, year, license plate)</Text>
                </View>
                <View style={styles.requirementItem}>
                  {driverVerificationStatus.missingRegistration ? (
                    <XCircle size={18} color={colors.error} />
                  ) : (
                    <CheckCircle size={18} color={colors.success} />
                  )}
                  <Text style={[
                    styles.requirementText,
                    !driverVerificationStatus.missingRegistration && styles.requirementComplete
                  ]}>Vehicle registration document</Text>
                </View>
                <View style={styles.requirementItem}>
                  {driverVerificationStatus.missingInsurance ? (
                    <XCircle size={18} color={colors.error} />
                  ) : (
                    <CheckCircle size={18} color={colors.success} />
                  )}
                  <Text style={[
                    styles.requirementText,
                    !driverVerificationStatus.missingInsurance && styles.requirementComplete
                  ]}>Vehicle insurance document</Text>
                </View>
              </View>
            )}

            {!driverVerificationStatus.pendingApproval && (
              <Button
                title={driverVerificationStatus.rejected ? 'Update Documents' : 'Complete Setup'}
                onPress={() => router.push('/(tabs)/profile')}
                style={[styles.errorButton, { marginTop: 16 }]}
                leftIcon={<Car size={16} color={colors.background} />}
              />
            )}
          </Card>
        )}

        {/* Grandfathered Driver Notice */}
        {driverVerificationStatus.isGrandfathered && (
          <Card style={[styles.infoCard, { marginBottom: 16 }]}>
            <View style={styles.infoHeader}>
              <FileText size={20} color={colors.primary} />
              <Text style={styles.infoTitle}>Upload Documents (Recommended)</Text>
            </View>
            <Text style={styles.infoMessage}>
              You can post rides, but we recommend uploading registration and insurance for trust and safety.
            </Text>
            <Button
              title="Add Documents"
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.infoButton}
              leftIcon={<FileText size={16} color={Colors.primary} />}
            />
          </Card>
        )}

        {/* Stripe Requirement Warning */}
        {stripeRequirement?.required ? (
          <Card style={styles.errorCard}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={24} color={colors.error} />
              <Text style={styles.errorTitle}>Payment Setup Required</Text>
            </View>
            <Text style={styles.errorMessage}>
              You must complete payment setup to post rides after your 10th ride. You won&apos;t be paid otherwise.
            </Text>
            <Button
              title="Set Up Stripe Connect"
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.errorButton}
              leftIcon={<CreditCard size={16} color={colors.background} />}
            />
          </Card>
        ) : stripeRequirement && !stripeRequirement.required && stripeRequirement.completedRides > 0 ? (
          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <CreditCard size={20} color={colors.primary} />
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

          <View style={[styles.inputGroup, styles.locationInputFirst]}>
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

          <View style={[styles.inputGroup, styles.locationInputSecond]}>
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


        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? "Creating Ride..." : "Create Ride"}
            onPress={handleCreateRide}
            disabled={isLoading || stripeRequirement?.required || !isFormValid || !driverVerificationStatus.canCreateRide}
            style={[
              styles.createButton,
              (stripeRequirement?.required || !isFormValid || !driverVerificationStatus.canCreateRide) && styles.disabledButton
            ]}
            leftIcon={<CheckCircle size={20} color={colors.background} />}
          />
          {!driverVerificationStatus.canCreateRide && !driverVerificationStatus.pendingApproval && (
            <Text style={styles.disabledButtonText}>
              Complete driver setup to create rides
            </Text>
          )}
          {driverVerificationStatus.pendingApproval && (
            <Text style={styles.disabledButtonText}>
              Awaiting admin approval
            </Text>
          )}
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
                  color={colors.text}
                />
              ))}
            </Picker>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
    color: colors.text,
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
    color: colors.text,
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
    backgroundColor: colors.primary,
    paddingVertical: 16,
  },
  dateTimeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    marginLeft: 40,
  },
  dateTimeLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  },
  dateTimeValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500' as const,
  },

  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  errorBorder: {
    borderColor: colors.error,
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
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    margin: 24,
    minWidth: '80%',
  },
  iosPickerWrapper: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 0,
    margin: 24,
    minWidth: '80%',
    overflow: 'hidden',
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
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
    backgroundColor: colors.card,
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
    color: colors.text,
  },
  picker: {
    height: 150,
    color: colors.text,
  },
  pickerItem: {
    color: colors.text,
    fontSize: 18,
  },
  pickerDoneButton: {
    marginTop: 16,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 24,
  },
  successCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 18,
    color: colors.success,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600' as const,
  },
  successSubMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  successDetails: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  successDetailText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  redirectText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic' as const,
  },
  warningCard: {
    marginBottom: 16,
    backgroundColor: colors.warningLight + '20',
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginLeft: 12,
  },
  warningMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  warningButton: {
    backgroundColor: colors.warning,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: colors.errorLight + '20',
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.error,
    marginLeft: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: colors.error,
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: colors.infoLight + '20',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
    marginLeft: 12,
  },
  infoMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disabledButton: {
    backgroundColor: colors.textLight,
    opacity: 0.6,
  },
  disabledButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
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
    color: colors.text,
    marginLeft: 8,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.success,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    shadowColor: colors.shadow.color,
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
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  requirementItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
    gap: 8,
  },
  requirementText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  requirementComplete: {
    color: colors.success,
    textDecorationLine: 'line-through' as const,
  },
});