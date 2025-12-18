import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Keyboard, Platform, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
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
import { RidesService } from '@/services/rides';
import { Users, DollarSign, CheckCircle, ChevronLeft, Save } from 'lucide-react-native';
import { Location, Ride } from '@/types';
import { validateRideEditPermissions } from '@/utils/validation';

export default function EditRideScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();

    // Loading states
    const [isLoadingRide, setIsLoadingRide] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [originalRide, setOriginalRide] = useState<Ride | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [limitedEdit, setLimitedEdit] = useState(false);
    const [limitedEditReason, setLimitedEditReason] = useState<string | null>(null);
    const [editError, setEditError] = useState<string | null>(null);

    // Form state
    const [fromLocation, setFromLocation] = useState<Location | null>(null);
    const [toLocation, setToLocation] = useState<Location | null>(null);
    const [departureDateTime, setDepartureDateTime] = useState(new Date());
    const [availableSeats, setAvailableSeats] = useState(1);
    const [pricePerSeat, setPricePerSeat] = useState('');
    const [notes, setNotes] = useState('');
    const [showSeatsPicker, setShowSeatsPicker] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    // Load ride data on mount
    useEffect(() => {
        const loadRide = async () => {
            if (!id || !user?.id) {
                setEditError('Invalid ride or user');
                setIsLoadingRide(false);
                return;
            }

            try {
                setIsLoadingRide(true);
                const ride = await RidesService.getRideById(id);

                if (!ride) {
                    setEditError('Ride not found');
                    return;
                }

                // Get all bookings for this ride
                const bookings = await RidesService.getRideBookings(id, user.id);

                // Validate edit permissions - pass full bookings array
                // This will check for BOTH pending and confirmed bookings
                const permissions = validateRideEditPermissions(ride, user.id, bookings);

                if (!permissions.canEdit) {
                    setEditError(permissions.reason || 'Cannot edit this ride');
                    setCanEdit(false);
                    return;
                }

                setCanEdit(true);

                // Handle limited editing mode
                if (permissions.limitedEdit) {
                    setLimitedEdit(true);
                    setLimitedEditReason(permissions.reason || 'Limited editing mode - some fields cannot be changed.');
                }

                setOriginalRide(ride);

                // Populate form with existing data
                const origin = ride.from || ride.origin;
                const destination = ride.to || ride.destination;

                if (origin) {
                    setFromLocation({
                        id: origin.id || `loc_${Date.now()}_from`,
                        name: origin.name,
                        address: origin.address,
                        latitude: origin.latitude,
                        longitude: origin.longitude
                    });
                }

                if (destination) {
                    setToLocation({
                        id: destination.id || `loc_${Date.now()}_to`,
                        name: destination.name,
                        address: destination.address,
                        latitude: destination.latitude,
                        longitude: destination.longitude
                    });
                }

                const depTime = ride.departureTime || ride.departureAt;
                if (depTime) {
                    setDepartureDateTime(new Date(depTime));
                }

                setAvailableSeats(ride.seatsTotal || ride.availableSeats || ride.seatsAvailable || 1);

                // Convert cents to dollars for display
                const priceInDollars = (ride.pricePerSeat / 100).toFixed(2);
                setPricePerSeat(priceInDollars);

                setNotes(ride.note || '');

            } catch (error: any) {
                console.error('Error loading ride:', error);
                setEditError(error.message || 'Failed to load ride');
            } finally {
                setIsLoadingRide(false);
            }
        };

        loadRide();
    }, [id, user?.id]);

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

    // Memoized validation check
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

    const handleSaveChanges = async () => {
        dismissKeyboard();

        if (!user || !id || !originalRide) {
            Alert.alert('Error', 'Unable to save changes');
            return;
        }

        if (!validateForm()) {
            Alert.alert('Validation Error', 'Please fix the errors below and try again.');
            return;
        }

        setIsSaving(true);

        try {
            // Convert price from dollars to cents
            const priceInDollars = parseFloat(pricePerSeat);
            const priceInCents = Math.round(priceInDollars * 100);

            const updates: any = {};

            // Only include fields that have changed
            if (fromLocation) {
                updates.origin = fromLocation;
            }

            if (toLocation) {
                updates.destination = toLocation;
            }

            updates.departureTime = departureDateTime.toISOString();
            updates.pricePerSeat = priceInCents;
            updates.seatsTotal = availableSeats;
            updates.notes = notes.trim();

            console.log('Saving ride updates:', updates);

            await RidesService.updateRide(id, user.id, updates);

            Alert.alert(
                '✅ Ride Updated',
                'Your changes have been saved successfully.',
                [
                    { text: 'View Ride', onPress: () => router.replace(`/ride-details?id=${id}`) },
                    { text: 'OK', onPress: () => router.back() }
                ]
            );

        } catch (error: any) {
            console.error('Save changes error:', error);
            Alert.alert('Error', error.message || 'Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Loading state
    if (isLoadingRide) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ title: 'Edit Ride' }} />
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading ride details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Error state
    if (editError || !canEdit) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{
                    title: 'Edit Ride',
                    headerStyle: { backgroundColor: Colors.primary },
                    headerTintColor: Colors.background,
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}
                        >
                            <ChevronLeft size={28} color={Colors.background} />
                            <Text style={{ color: Colors.background, fontSize: 17, marginLeft: -4, fontWeight: '500' }}>Back</Text>
                        </TouchableOpacity>
                    ),
                }} />
                <View style={styles.centerContainer}>
                    <Text style={styles.errorTitle}>Cannot Edit Ride</Text>
                    <Text style={styles.errorMessage}>{editError}</Text>
                    <Button
                        title="Go Back"
                        onPress={() => router.back()}
                        style={styles.backButton}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{
                title: 'Edit Ride',
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.background,
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}
                    >
                        <ChevronLeft size={28} color={Colors.background} />
                        <Text style={{ color: Colors.background, fontSize: 17, marginLeft: -4, fontWeight: '500' }}>Back</Text>
                    </TouchableOpacity>
                ),
            }} />

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
            >
                <Card style={styles.formCard}>
                    {limitedEdit && (
                        <View style={styles.warningBanner}>
                            <Text style={styles.warningText}>⚠️ {limitedEditReason}</Text>
                        </View>
                    )}
                    <Text style={styles.sectionTitle}>Route Details</Text>

                    <View style={[styles.inputGroup, styles.locationInputFirst, limitedEdit && styles.disabledSection]}>
                        <Text style={styles.inputLabel}>From Location *{limitedEdit && ' (locked)'}</Text>
                        <View pointerEvents={limitedEdit ? 'none' : 'auto'}>
                            <PlacesAutocomplete
                                placeholder="Enter pickup location"
                                onLocationSelect={setFromLocation}
                                value={fromLocation}
                            />
                        </View>
                        {validationErrors.fromLocation && (
                            <Text style={styles.errorText}>{validationErrors.fromLocation}</Text>
                        )}
                    </View>

                    <View style={[styles.inputGroup, styles.locationInputSecond, limitedEdit && styles.disabledSection]}>
                        <Text style={styles.inputLabel}>To Location *{limitedEdit && ' (locked)'}</Text>
                        <View pointerEvents={limitedEdit ? 'none' : 'auto'}>
                            <PlacesAutocomplete
                                placeholder="Enter destination"
                                onLocationSelect={setToLocation}
                                value={toLocation}
                            />
                        </View>
                        {validationErrors.toLocation && (
                            <Text style={styles.errorText}>{validationErrors.toLocation}</Text>
                        )}
                    </View>
                </Card>

                <Card style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Schedule</Text>

                    <View style={[styles.dateTimeRow, limitedEdit && styles.disabledSection]}>
                        {limitedEdit && <Text style={styles.lockedLabel}>(Date/time locked)</Text>}
                        <View style={[styles.inputGroup, styles.halfWidth]} pointerEvents={limitedEdit ? 'none' : 'auto'}>
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
                                testID="edit-departure-date-field"
                            />
                        </View>

                        <View style={[styles.inputGroup, styles.halfWidth]} pointerEvents={limitedEdit ? 'none' : 'auto'}>
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
                                testID="edit-departure-time-field"
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
                        title={isSaving ? "Saving Changes..." : "Save Changes"}
                        onPress={handleSaveChanges}
                        disabled={isSaving || !isFormValid}
                        style={[
                            styles.saveButton,
                            !isFormValid && styles.disabledButton
                        ]}
                        leftIcon={<Save size={20} color={Colors.background} />}
                    />
                    {!isFormValid && (
                        <Text style={styles.disabledButtonText}>
                            Please fill all required fields correctly
                        </Text>
                    )}
                </View>
            </ScrollView>

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
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: Colors.textSecondary,
    },
    errorTitle: {
        fontSize: 22,
        fontWeight: '600' as const,
        color: Colors.error,
        marginBottom: 12,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    backButton: {
        minWidth: 120,
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
    saveButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
    },
    disabledButton: {
        opacity: 0.5,
    },
    disabledButtonText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginTop: 12,
        fontSize: 14,
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
    errorText: {
        fontSize: 12,
        color: Colors.error,
        marginTop: 4,
    },
    errorBorder: {
        borderColor: Colors.error,
        borderWidth: 1,
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
    pickerBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
    pickerDone: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: Colors.primary,
    },
    picker: {
        height: 150,
        color: Colors.text,
    },
    pickerItem: {
        color: Colors.text,
        fontSize: 18,
    },
    warningBanner: {
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    warningText: {
        color: '#92400E',
        fontSize: 14,
        fontWeight: '500' as const,
    },
    disabledSection: {
        opacity: 0.6,
    },
    lockedLabel: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontStyle: 'italic' as const,
        marginBottom: 8,
        width: '100%',
    },
});
