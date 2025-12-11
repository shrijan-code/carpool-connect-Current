import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { Ride } from '@/types';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { MapPin, Clock, Users, Car } from 'lucide-react-native';
import { StarDisplay } from '@/components/RatingSystem';
import { router } from 'expo-router';
import { VerificationBadge } from '@/components/VerificationBadge';
import { formatPrice as formatPriceCents, formatDate, formatTime } from '@/utils/formatters';
import { BookingModal } from './BookingModal';

interface RideCardProps {
  ride: Ride;
  onPress?: () => void;
  showBookButton?: boolean;
  onBook?: (rideId: string, seats: number) => void;
}

export const RideCard = React.memo<RideCardProps>(({
  ride,
  onPress,
  showBookButton = false,
  onBook,
}) => {
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { bookRide, isLoading, getUserBookings } = useRidesStore();
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [lastBookingAttempt, setLastBookingAttempt] = useState<number>(0);

  // Check if user already has a booking for this ride (from store)
  const userBookings = getUserBookings(user?.id || '');
  const existingBooking = userBookings.find(booking => {
    const isMatchingRide = booking.rideId === ride.id;
    const isActiveBooking = booking.status === 'pending_driver' || booking.status === 'confirmed';
    return isMatchingRide && isActiveBooking;
  });

  const hasExistingBooking = !!existingBooking;

  // Debug logging with more details
  console.log(`RideCard ${ride.id}: User ${user?.id} has ${userBookings.length} total bookings`);
  console.log(`Existing booking for ride ${ride.id}:`, existingBooking ? {
    id: existingBooking.id,
    status: existingBooking.status,
    seats: existingBooking.seats
  } : 'none');

  // Additional check for all bookings for this ride to help debug
  const allRideBookings = userBookings.filter(b => b.rideId === ride.id);
  if (allRideBookings.length > 0) {
    console.log(`All bookings for ride ${ride.id}:`, allRideBookings.map(b => ({
      id: b.id,
      status: b.status,
      seats: b.seats
    })));
  }
  const pricePerSeatInCents = React.useMemo(() => {
    // Price is stored in cents in the database - ensure it's an integer
    const priceInCents = Math.round(ride.pricePerSeat || 0);
    // Validate that price is reasonable (between $0.01 and $999.99)
    if (priceInCents < 1 || priceInCents > 99999) {
      console.warn(`RideCard ${ride.id}: Invalid price ${priceInCents} cents, defaulting to 0`);
      return 0;
    }
    console.log(`RideCard ${ride.id}: pricePerSeat = ${priceInCents} cents (${(priceInCents / 100).toFixed(2)})`);
    return priceInCents;
  }, [ride.pricePerSeat, ride.id]);

  // Memoize formatted date/time to avoid recalculating on every render
  const formattedDateTime = useMemo(() => {
    const dateStr = ride.departureTime || ride.departureAt || new Date().toISOString();
    return {
      date: formatDate(dateStr),
      time: formatTime(dateStr)
    };
  }, [ride.departureTime, ride.departureAt]);

  const handleBookRide = useCallback(async () => {
    // Enhanced input validation
    if (!user?.id?.trim()) {
      Alert.alert('Authentication Error', 'Please log in to book a ride');
      return;
    }

    if (!ride?.id?.trim()) {
      Alert.alert('Error', 'Invalid ride information');
      return;
    }

    if (selectedSeats < 1 || selectedSeats > 4) {
      Alert.alert('Invalid Selection', 'Please select between 1-4 seats');
      return;
    }

    // Prevent rapid duplicate requests (within 5 seconds)
    const now = Date.now();
    if (now - lastBookingAttempt < 5000) {
      Alert.alert('Please Wait', 'Please wait a moment before making another booking request.');
      return;
    }

    // Check for existing booking before proceeding
    if (hasExistingBooking) {
      const statusText = existingBooking?.status === 'pending_driver' ? 'pending approval' : 'confirmed';
      const statusEmoji = existingBooking?.status === 'pending_driver' ? '⏳' : '✅';
      Alert.alert(
        `${statusEmoji} Booking Already Exists`,
        `You already have a ${statusText} booking for this ride.\n\n• Booking ID: ${existingBooking?.id?.slice(-6) || 'Unknown'}\n• Seats: ${existingBooking?.seats || 0}\n• Status: ${statusText}\n• Amount: ${formatPriceCents(existingBooking?.amountTotal || 0)}\n\nPlease check your bookings tab to manage this booking.`,
        [
          { text: 'OK' },
          { text: 'View My Bookings', onPress: () => router.push('/(tabs)/rides') }
        ]
      );
      return;
    }

    const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
    if (selectedSeats > availableSeats) {
      Alert.alert('Insufficient Seats', `Only ${availableSeats} seats available`);
      return;
    }

    // Validate ride data integrity
    if (!ride.pricePerSeat || ride.pricePerSeat < 0) {
      Alert.alert('Error', 'Invalid ride pricing information');
      return;
    }

    // Open Booking Modal directly - it handles payment confirmation
    setShowBookingModal(true);
  }, [user?.id, ride?.id, ride.pricePerSeat, selectedSeats, ride.availableSeats, ride.seatsAvailable, lastBookingAttempt, hasExistingBooking, existingBooking, isBookingInProgress, onBook, bookRide, pricePerSeatInCents]);

  const handleCardPress = useCallback(() => {
    // Validate ride ID before navigation
    if (!ride?.id?.trim()) {
      Alert.alert('Error', 'Unable to view ride details');
      return;
    }

    if (onPress) {
      onPress();
    }
  }, [ride?.id, onPress]);

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.driverInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {ride.driver?.name?.charAt(0) || 'D'}
              </Text>
            </View>
            <View style={styles.driverDetails}>
              <View style={styles.driverNameRow}>
                <Text style={styles.driverName}>{ride.driver?.name || 'Driver'}</Text>
                {ride.driver && <VerificationBadge user={ride.driver} size="small" />}
              </View>
              <View style={styles.rating}>
                <StarDisplay
                  rating={ride.driver?.rating || 0}
                  size={14}
                  showNumber={true}
                  totalRatings={ride.driver?.totalReviews || 0}
                  recentRatingsCount={ride.driver?.recentRatingCount}
                />
              </View>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{formatPriceCents(pricePerSeatInCents)}</Text>
            <Text style={styles.priceLabel}>per seat</Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, styles.fromDot]} />
            <View style={styles.routeInfo}>
              <Text style={styles.locationName}>{ride.from?.name || ride.origin?.name || 'Unknown'}</Text>
              <Text style={styles.locationAddress} numberOfLines={2} ellipsizeMode="tail">
                {ride.from?.address || ride.origin?.address || 'Address not available'}
              </Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routePoint}>
            <View style={[styles.dot, styles.toDot]} />
            <View style={styles.routeInfo}>
              <Text style={styles.locationName}>{ride.to?.name || ride.destination?.name || 'Unknown'}</Text>
              <Text style={styles.locationAddress} numberOfLines={2} ellipsizeMode="tail">
                {ride.to?.address || ride.destination?.address || 'Address not available'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Clock size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {formattedDateTime.date} at {formattedDateTime.time}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Users size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {ride.availableSeats || ride.seatsAvailable || 0} seats available
            </Text>
          </View>
          {ride.distance && ride.duration && (
            <View style={styles.detailItem}>
              <MapPin size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>
                {ride.distance} • {ride.duration}
              </Text>
            </View>
          )}
        </View>

        {ride.vehicle && (
          <View style={styles.vehicleInfo}>
            <View style={styles.vehicleHeader}>
              <Car size={16} color={colors.textSecondary} />
              <Text style={styles.vehicleLabel}>Vehicle Details</Text>
            </View>
            <Text style={styles.vehicleText}>
              {ride.vehicle.color} {ride.vehicle.make} {ride.vehicle.model} ({ride.vehicle.year || 'N/A'})
            </Text>
            <Text style={styles.licensePlateText}>
              License Plate: {ride.vehicle.licensePlate}
            </Text>
          </View>
        )}

        {showBookButton && (ride.availableSeats || ride.seatsAvailable || 0) > 0 && (
          <View style={styles.bookingSection}>
            {hasExistingBooking ? (
              <View style={styles.existingBookingSection}>
                <Text style={styles.existingBookingText}>
                  {existingBooking?.status === 'pending_driver' ? '⏳ Pending approval' : '✅ Booking confirmed'}
                </Text>
                <Text style={styles.existingBookingDetails}>
                  {existingBooking?.seats || 0} seat{(existingBooking?.seats || 0) > 1 ? 's' : ''} • {formatPriceCents(existingBooking?.amountTotal || 0)}
                </Text>
                <Button
                  title="View My Bookings"
                  onPress={() => router.push('/(tabs)/rides')}
                  style={styles.viewBookingButton}
                />
              </View>
            ) : (
              <>
                <View style={styles.seatSelector}>
                  <Text style={styles.seatLabel}>Seats:</Text>
                  <View style={styles.seatButtons}>
                    {[1, 2, 3, 4].map((seats) => {
                      // Create stable unique key using ride ID and seats number
                      const stableKey = `seat-selector-${ride.id || 'fallback'}-${seats}`;
                      return (
                        <TouchableOpacity
                          key={stableKey}
                          style={[
                            styles.seatButton,
                            selectedSeats === seats && styles.selectedSeatButton,
                            seats > (ride.availableSeats || ride.seatsAvailable || 0) && styles.disabledSeatButton,
                          ]}
                          onPress={() => setSelectedSeats(seats)}
                          disabled={seats > (ride.availableSeats || ride.seatsAvailable || 0)}
                        >
                          <Text
                            style={[
                              styles.seatButtonText,
                              selectedSeats === seats && styles.selectedSeatButtonText,
                              seats > (ride.availableSeats || ride.seatsAvailable || 0) && styles.disabledSeatButtonText,
                            ]}
                          >
                            {seats}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <Button
                  title={`Request ${selectedSeats} seat${selectedSeats > 1 ? 's' : ''} - ${formatPriceCents((pricePerSeatInCents * selectedSeats) + 100)}`}
                  onPress={handleBookRide}
                  disabled={isLoading || isBookingInProgress || (ride.availableSeats || ride.seatsAvailable || 0) === 0}
                  style={[styles.bookButton, (ride.availableSeats || ride.seatsAvailable || 0) === 0 && styles.disabledButton]}
                />
              </>
            )}
          </View>
        )}

        <TouchableOpacity onPress={handleCardPress} style={styles.cardPressable}>
          <Text style={styles.viewDetailsText}>View Details</Text>
        </TouchableOpacity>
      </Card>

      <BookingModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        ride={{
          ...ride,
          // Ensure required fields exist with fallbacks
          departureTime: ride.departureTime || ride.departureAt || new Date().toISOString(),
          origin: ride.origin || ride.from || { name: 'Unknown', address: '' },
          destination: ride.destination || ride.to || { name: 'Unknown', address: '' },
          driver: ride.driver || { name: 'Unknown Driver' },
          pricePerSeat: ride.pricePerSeat || 0,
          seatsAvailable: ride.availableSeats || ride.seatsAvailable || 0,
          id: ride.id || '',
        }}
        seats={selectedSeats}
        onBookingSuccess={(bookingId) => {
          setShowBookingModal(false);
          // Optional: Show success feedback or navigate
          if (onBook) {
            onBook(bookingId, selectedSeats);
          } else {
            // Refresh bookings or navigate
            router.push('/(tabs)/rides');
          }
        }}
      />
    </>
  );


}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.ride.id === nextProps.ride.id &&
    prevProps.ride.status === nextProps.ride.status &&
    prevProps.ride.availableSeats === nextProps.ride.availableSeats &&
    prevProps.ride.seatsAvailable === nextProps.ride.seatsAvailable &&
    prevProps.showBookButton === nextProps.showBookButton
  );
});

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  driverDetails: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  ridesCount: {
    fontSize: 14,
    color: colors.textLight,
    marginLeft: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  priceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  routeContainer: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 4,
  },
  fromDot: {
    backgroundColor: colors.secondary,
  },
  toDot: {
    backgroundColor: colors.primary,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.borderLight,
    marginLeft: 5,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  details: {
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  vehicleInfo: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  vehicleLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  },
  vehicleText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  licensePlateText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  bookingSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  seatLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  seatButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  seatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSeatButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  disabledSeatButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  seatButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  selectedSeatButtonText: {
    color: colors.background,
  },
  disabledSeatButtonText: {
    color: colors.textLight,
  },
  bookButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
  },
  disabledButton: {
    backgroundColor: colors.textLight,
    opacity: 0.6,
  },
  cardPressable: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  existingBookingSection: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  existingBookingText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 12,
  },
  viewBookingButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
  },
  existingBookingDetails: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },

});