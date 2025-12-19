import React, { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useRidesStore } from '@/store/rides-store';
import { useAuthStore } from '@/store/auth-store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RidesService } from '@/services/rides';
import { MapPin, Clock, DollarSign, Users, Car, MessageCircle, Star, Check, X, ChevronLeft, Edit3 } from 'lucide-react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { Booking, Ride, User, RidePassenger } from '@/types';
import { EnhancedRideTracking } from '@/components/EnhancedRideTracking';
import RideDriverActions from '@/components/RideDriverActions';
import { VerificationBadge } from '@/components/VerificationBadge';
import { formatPrice, formatTotalPrice, getBookingPriceBreakdown, PLATFORM_FEE_DISPLAY } from '@/utils/price';

export default function RideDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getRideById,
    fetchRideById,
    bookRide,
    prepareBookingRequest,
    confirmBookingPayment,
    deleteRide,
    refreshRides,
    refreshBookings,
    getUserBookings
  } = useRidesStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuthStore();
  const [isBooking, setIsBooking] = useState(false);
  const [rideBookings, setRideBookings] = useState<Booking[]>([]);
  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoadingRide, setIsLoadingRide] = useState(false);
  const [rideNotFound, setRideNotFound] = useState(false);

  // Subscribe to real-time ride updates
  useEffect(() => {
    if (!id) {
      setRideNotFound(true);
      return;
    }

    setIsLoadingRide(true);
    console.log('🔄 Subscribing to real-time updates for ride:', id);

    // Subscribe to real-time updates for the ride document
    const rideRef = doc(db, 'rides', id);
    const unsubscribe = onSnapshot(
      rideRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const rideData = { id: docSnapshot.id, ...docSnapshot.data() } as Ride;
          console.log('✅ Ride updated in real-time:', rideData.id, 'status:', rideData.status);
          setRide(rideData);
          setRideNotFound(false);
        } else {
          console.log('❌ Ride not found:', id);
          setRideNotFound(true);
        }
        setIsLoadingRide(false);
      },
      (error) => {
        console.error('❌ Error subscribing to ride:', error);
        setRideNotFound(true);
        setIsLoadingRide(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log('🧹 Unsubscribing from ride updates:', id);
      unsubscribe();
    };
  }, [id]);

  // Load bookings for this ride if user is the driver
  useEffect(() => {
    const loadRideBookings = async () => {
      if (ride && user && user.id === ride.driverId) {
        try {
          const bookings = await RidesService.getRideBookings(ride.id, user.id);
          setRideBookings(bookings);
        } catch (error) {
          console.error('Failed to load ride bookings:', error);
        }
      }
    };

    loadRideBookings();
  }, [ride, user]);

  if (isLoadingRide) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (rideNotFound || !ride) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Ride Details' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ride not found</Text>
          <Text style={styles.errorSubtext}>The ride you’re looking for may have been deleted or doesn’t exist.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isDriver = user?.id === ride.driverId;
  const isBooked = ride.passengers?.some((p: RidePassenger) => p.id === user?.id);
  const userBookings = user?.id ? getUserBookings(user.id) : [];
  const hasActiveBooking = !!userBookings.find(b => b.rideId === ride.id && (b.status === 'pending_driver' || b.status === 'confirmed'));
  const canBook = user?.role === 'rider' && !isDriver && !isBooked && !hasActiveBooking && (ride.availableSeats || ride.seatsAvailable || 0) > 0;
  const canMessage = isBooked || isDriver;

  const handleBookRide = async (seats: number) => {
    if (!user || !canBook) return;

    setIsBooking(true);
    try {
      // 1. Prepare booking (create pending_payment booking + payment intent)
      const { bookingId, clientSecret, paymentIntentId } = await prepareBookingRequest(ride.id, seats, user);

      // 2. Initialize Payment Sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "CarpoolConnect",
        paymentIntentClientSecret: clientSecret,
        returnURL: 'carpoolconnect://stripe-redirect',
        defaultBillingDetails: {
          name: user.name,
          email: user.email,
          phone: user.phone
        }
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // 3. Present Payment Sheet
      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        // Retrieve friendly error message
        if (paymentError.code === 'Canceled') {
          // User cancelled, we might want to cancel the pending booking or leave it as abandoned?
          // Ideally cancel it.
          // await cancelBooking(bookingId...);
          throw new Error('Payment cancelled');
        }
        throw new Error(paymentError.message);
      }

      // 4. Confirm Booking (Payment authorized)
      await confirmBookingPayment(bookingId);

      Alert.alert(
        'Booking Requested',
        `Your request for ${seats} seat${seats > 1 ? 's' : ''} has been sent!\n\n• Payment method saved\n• Awaiting driver approval`,
        [
          { text: 'View My Bookings', onPress: () => router.push('/(tabs)/rides') },
          { text: 'Dismiss' }
        ]
      );

      // Refresh data
      await Promise.all([
        refreshRides(),
        refreshBookings(),
        fetchRideById(ride.id)
      ]);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete booking';
      if (errorMessage !== 'Payment cancelled') {
        Alert.alert('Booking Failed', errorMessage);
      }
    } finally {
      setIsBooking(false);
    }
  };

  const handleAcceptBooking = async (booking: Booking) => {
    if (!user || !isDriver) return;

    try {
      await RidesService.acceptBooking(booking.id, user.id);
      Alert.alert('Booking Accepted', 'You can now message the passenger.');

      // Refresh data
      // Force a small delay to ensure Firestore propagation if running locally/slow net
      await new Promise(resolve => setTimeout(resolve, 500));

      const newBookings = await RidesService.getRideBookings(ride.id, user?.id);
      setRideBookings(newBookings);

      // Also refresh the ride details to update seat counts etc
      await refreshRides();
      if (ride.id) {
        const updatedRide = await RidesService.getRideById(ride.id);
        if (updatedRide) setRide(updatedRide);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept booking';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleRejectBooking = async (booking: Booking) => {
    if (!user || !isDriver) return;

    Alert.alert(
      'Reject Booking',
      'Are you sure you want to reject this booking? This will free up the seats.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await RidesService.rejectBooking(
                booking.id,
                booking.rideId,
                booking.seats,
                user.id,
                'Driver declined the booking'
              );
              Alert.alert('Booking Rejected', 'The passenger has been notified.');

              // Refresh data
              await refreshRides();
              const updatedBookings = await RidesService.getRideBookings(ride.id, user?.id);
              setRideBookings(updatedBookings);
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to reject booking';
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  const handleCancelBooking = async (booking: Booking) => {
    if (!user) return;

    const isPassenger = user.id === (booking.riderId || booking.passenger?.id);
    if (!isPassenger) return;

    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? A $1 cancellation fee may apply.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            try {
              await RidesService.cancelBookingByPassenger(
                booking.id,
                booking.rideId,
                booking.seats,
                user.id,
                'Cancelled by passenger'
              );
              Alert.alert('Booking Cancelled', 'Your booking has been cancelled and the driver has been notified.');

              // Refresh data
              await refreshRides();
              await refreshBookings();
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to cancel booking';
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  const showBookingOptions = () => {
    const seatOptions = [];
    const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
    const pricePerSeatInCents = Math.round(ride.pricePerSeat);
    for (let i = 1; i <= Math.min(availableSeats, 4); i++) {
      const breakdown = getBookingPriceBreakdown(pricePerSeatInCents, i);
      seatOptions.push({
        text: `${i} seat${i > 1 ? 's' : ''} - ${breakdown.total} (${breakdown.ridePrice} + ${PLATFORM_FEE_DISPLAY} fee)`,
        onPress: () => handleBookRide(i)
      });
    }
    seatOptions.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert('Request Booking', 'How many seats would you like to request?', seatOptions);
  };

  const handleDeleteRide = async () => {
    if (!user || !isDriver) return;

    // Validate delete permissions
    const { validateRideDeletePermissions } = await import('@/utils/validation');
    const permissions = validateRideDeletePermissions(ride, user.id, rideBookings);

    if (!permissions.canDelete) {
      Alert.alert(
        '❌ Cannot Delete Ride',
        permissions.reason || 'This ride cannot be deleted.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Build the confirmation message
    let message = 'Are you sure you want to delete this ride?\n\n⚠️ This action cannot be undone.';
    if (permissions.warning) {
      message += `\n\n${permissions.warning}`;
    }

    Alert.alert(
      '🗑️ Delete Ride',
      message,
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Delete Ride',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRide(ride.id, user.id);
              Alert.alert(
                '✅ Ride Deleted',
                'Your ride has been deleted successfully.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete ride';
              Alert.alert('Delete Failed', errorMessage);
            }
          }
        }
      ]
    );
  };

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return Colors.warning;
      case 'accepted': return Colors.success;
      case 'rejected': return Colors.error;
      case 'cancelled': return Colors.textLight;
      default: return Colors.textSecondary;
    }
  };

  const getBookingStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending_driver': return 'Awaiting Response';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      case 'cancelled': return 'Cancelled';
      default: return status.replace(/_/g, ' ');
    }
  };

  const renderBookingActions = (booking: Booking) => {
    if (booking.status === 'pending_driver' && isDriver) {
      return (
        <View style={styles.bookingActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptBooking(booking)}
          >
            <Check size={16} color={Colors.background} />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectBooking(booking)}
          >
            <X size={16} color={Colors.background} />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if ((booking.status === 'confirmed') && user?.id === (booking.riderId || booking.passenger?.id)) {
      return (
        <View style={styles.bookingActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => handleCancelBooking(booking)}
          >
            <X size={16} color={Colors.background} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          {booking.status === 'confirmed' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.messageButton]}
              onPress={() => router.push('/(tabs)/chat')}
            >
              <MessageCircle size={16} color={Colors.background} />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        title: 'Ride Details',
        headerBackVisible: false,
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.background,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/rides');
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingRight: 8
            }}
          >
            <ChevronLeft size={28} color={Colors.background} />
            <Text style={{ color: Colors.background, fontSize: 17, marginLeft: -4, fontWeight: '500' }}>Back</Text>
          </TouchableOpacity>
        ),
      }} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Route Information */}
        <Card style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <MapPin size={24} color={Colors.primary} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeTitle}>{ride.from?.name || ride.origin?.name || 'Unknown'}</Text>
              <Text style={styles.routeSubtitle}>Pickup location</Text>
              <Text style={styles.routeAddress}>{ride.from?.address || ride.origin?.address || 'Address not available'}</Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeHeader}>
            <MapPin size={24} color={Colors.secondary} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeTitle}>{ride.to?.name || ride.destination?.name || 'Unknown'}</Text>
              <Text style={styles.routeSubtitle}>Destination</Text>
              <Text style={styles.routeAddress}>{ride.to?.address || ride.destination?.address || 'Address not available'}</Text>
            </View>
          </View>
        </Card>

        {/* Trip Details */}
        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Trip Details</Text>

          <View style={styles.detailRow}>
            <Clock size={20} color={Colors.primary} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Departure</Text>
              <Text style={styles.detailValue}>
                {new Date(ride.departureTime || ride.departureAt || new Date()).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
              <Text style={styles.detailTime}>
                {new Date(ride.departureTime || ride.departureAt || new Date()).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <DollarSign size={20} color={Colors.success} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Price per seat</Text>
              <Text style={styles.priceValue}>{formatPrice(Math.round(ride.pricePerSeat))}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Users size={20} color={Colors.primary} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Available seats</Text>
              <Text style={styles.detailValue}>{ride.availableSeats || ride.seatsAvailable || 0} of {ride.seatsTotal || ride.vehicle?.seats || 4}</Text>
            </View>
          </View>

          {ride.distance && ride.duration && (
            <View style={styles.detailRow}>
              <MapPin size={20} color={Colors.textLight} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Distance & Duration</Text>
                <Text style={styles.detailValue}>{ride.distance} • {ride.duration}</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Driver Information */}
        <Card style={styles.driverCard}>
          <Text style={styles.sectionTitle}>Driver Information</Text>

          <View style={styles.driverHeader}>
            <View style={styles.driverAvatar}>
              {ride.driver?.profilePicture ? (
                <Image
                  source={{ uri: ride.driver.profilePicture }}
                  style={styles.driverAvatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.driverAvatarText}>
                  {ride.driver?.name?.charAt(0) || 'D'}
                </Text>
              )}
            </View>

            <View style={styles.driverInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.driverName}>{ride.driver?.name || 'Unknown Driver'}</Text>
                {ride.driver && (
                  <VerificationBadge user={ride.driver} size="small" showLabel />
                )}
              </View>
              <View style={styles.driverRating}>
                <Star size={16} color={Colors.warning} fill={Colors.warning} />
                <Text style={styles.ratingText}>{ride.driver?.rating || '5.0'} ({ride.driver?.totalReviews || ride.driver?.totalRides || '0'})</Text>
              </View>
              <Text style={styles.driverJoined}>Member since {new Date(ride.driver?.joinedDate || ride.driver?.createdAt || '2023-01-01').getFullYear()}</Text>
              {ride.driver?.phone && (
                <Text style={styles.driverContact}>📞 {ride.driver.phone}</Text>
              )}
            </View>
          </View>

          {/* Vehicle Information */}
          {ride.vehicle && (
            <View style={styles.vehicleInfo}>
              <View style={styles.detailRow}>
                <Car size={20} color={Colors.primary} />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Vehicle</Text>
                  <Text style={styles.detailValue}>
                    {ride.vehicle.make} {ride.vehicle.model} ({ride.vehicle.year})
                  </Text>
                  <Text style={styles.detailSubtext}>
                    {ride.vehicle.color} • {ride.vehicle.licensePlate}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* Ride Tracking Status */}
        {(ride.status === 'active' || ride.status === 'upcoming') && (
          <EnhancedRideTracking
            ride={ride}
            booking={rideBookings.find(b => b.riderId === user?.id && b.status === 'confirmed')}
            isDriver={isDriver}
            onStatusChange={async () => {
              await refreshRides();
              if (isDriver) {
                const updatedBookings = await RidesService.getRideBookings(ride.id, user?.id);
                setRideBookings(updatedBookings);
              }
            }}
          />
        )}

        {/* Additional Notes */}
        {ride.note && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <Text style={styles.notesText}>{ride.note}</Text>
          </Card>
        )}

        {/* Driver-only actions */}
        {isDriver && (
          <Card style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Driver Actions</Text>
            <RideDriverActions
              ride={ride}
              isDriver={isDriver}
              currentUserId={user?.id}
              onUpdated={async () => {
                await refreshRides();
                if (isDriver) {
                  const updatedBookings = await RidesService.getRideBookings(ride.id, user?.id);
                  setRideBookings(updatedBookings);
                }
              }}
            />
          </Card>
        )}

        {/* Booking Requests (for driver view) */}
        {isDriver && rideBookings.length > 0 && (
          <Card style={styles.bookingsCard}>
            <Text style={styles.sectionTitle}>Booking Requests ({rideBookings.length})</Text>
            {rideBookings.map((booking) => (
              <View key={booking.id} style={styles.bookingRow}>
                <View style={styles.bookingAvatar}>
                  <Text style={styles.bookingAvatarText}>
                    {booking.passenger?.name?.charAt(0) || 'P'}
                  </Text>
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingName}>{booking.passenger?.name || 'Passenger'}</Text>
                  <Text style={styles.bookingSeats}>{booking.seats} seat{booking.seats > 1 ? 's' : ''} • {formatPrice(booking.amountTotal)}</Text>
                  <Text style={[styles.bookingStatus, { color: getBookingStatusColor(booking.status) }]}>
                    {getBookingStatusText(booking.status)}
                  </Text>
                </View>
                {renderBookingActions(booking)}
              </View>
            ))}
          </Card>
        )}

        {/* Passengers (confirmed/accepted bookings) */}
        {isDriver && ride.passengers && ride.passengers.length > 0 && (
          <Card style={styles.passengersCard}>
            <Text style={styles.sectionTitle}>Confirmed Passengers ({ride.passengers.length})</Text>
            {ride.passengers.map((passenger: RidePassenger) => (
              <View key={`${passenger.id}-${passenger.bookingId}`} style={styles.passengerRow}>
                <View style={styles.passengerAvatar}>
                  <Text style={styles.passengerAvatarText}>
                    {passenger.user?.name?.charAt(0) || 'P'}
                  </Text>
                </View>
                <View style={styles.passengerInfo}>
                  <Text style={styles.passengerName}>{passenger.user?.name || 'Passenger'}</Text>
                  <Text style={styles.passengerSeats}>{passenger.seats} seat{passenger.seats > 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() => router.push('/(tabs)/chat')}
                >
                  <MessageCircle size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {canMessage && (
          <TouchableOpacity
            style={styles.messageActionButton}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <MessageCircle size={20} color={Colors.primary} />
            <Text style={styles.messageActionText}>Message {isDriver ? 'Passengers' : 'Driver'}</Text>
          </TouchableOpacity>
        )}

        {hasActiveBooking && (
          <View style={styles.bookedContainer}>
            <Text style={styles.bookedText}>You already have an active request for this ride</Text>
          </View>
        )}

        {canBook && (
          <Button
            title={isBooking ? 'Sending Request...' : 'Request Booking'}
            onPress={showBookingOptions}
            disabled={isBooking}
            style={styles.bookButton}
          />
        )}

        {isDriver && ride.status === 'upcoming' && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/edit-ride?id=${ride.id}`)}
          >
            <Edit3 size={20} color={Colors.primary} />
            <Text style={styles.editButtonText}>Edit Ride</Text>
          </TouchableOpacity>
        )}

        {isDriver && ride.status === 'upcoming' && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteRide}
          >
            <X size={20} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Delete Ride</Text>
          </TouchableOpacity>
        )}

        {isBooked && (
          <View style={styles.bookedContainer}>
            <Text style={styles.bookedText}>✅ You have booked this ride</Text>
          </View>
        )}
      </View>
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
    padding: 16,
  },
  routeCard: {
    marginBottom: 16,
    padding: 20,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeInfo: {
    marginLeft: 16,
    flex: 1,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  routeSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  routeAddress: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 4,
    lineHeight: 18,
  },
  routeDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
    marginLeft: 40,
  },
  detailsCard: {
    marginBottom: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailInfo: {
    marginLeft: 16,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  detailTime: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  detailSubtext: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 2,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  driverCard: {
    marginBottom: 16,
    padding: 20,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  driverAvatarImage: {
    width: '100%',
    height: '100%',
  },
  driverAvatarText: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  driverInfo: {
    marginLeft: 16,
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  driverJoined: {
    fontSize: 12,
    color: Colors.textLight,
  },
  driverContact: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600' as const,
  },
  vehicleInfo: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  notesCard: {
    marginBottom: 16,
    padding: 20,
  },
  notesText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  bookingsCard: {
    marginBottom: 16,
    padding: 20,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bookingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingAvatarText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  bookingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  bookingName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  bookingSeats: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  bookingStatus: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  acceptButton: {
    backgroundColor: Colors.success,
  },
  acceptButtonText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  rejectButton: {
    backgroundColor: Colors.error,
  },
  rejectButtonText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  cancelButton: {
    backgroundColor: Colors.error,
  },
  cancelButtonText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  messageButton: {
    backgroundColor: Colors.primary,
    padding: 8,
  },
  messageButtonText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  passengersCard: {
    marginBottom: 16,
    padding: 20,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerAvatarText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  passengerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  passengerSeats: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  actionContainer: {
    padding: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  messageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  messageActionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginLeft: 8,
  },
  bookButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
  },
  bookedContainer: {
    backgroundColor: Colors.success + '20',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookedText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: Colors.error,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    marginTop: 8,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: 8,
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});