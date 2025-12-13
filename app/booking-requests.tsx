import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { Booking } from '@/types';
import { Clock, User, DollarSign, Check, X } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

export default function BookingRequestsScreen() {
  const { user } = useAuthStore();
  const { acceptBooking, declineBooking, getPendingBookingRequests, isLoading } = useRidesStore();
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const loadPendingBookings = useCallback(async () => {
    if (!user?.id || user.role !== 'driver') return;

    setLoadingBookings(true);
    try {
      const bookings = await getPendingBookingRequests(user.id);
      setPendingBookings(bookings);
      console.log('Loaded pending bookings:', bookings.length);
    } catch (error) {
      console.error('Error loading pending bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  }, [user?.id, user?.role, getPendingBookingRequests]);

  useEffect(() => {
    loadPendingBookings();
  }, [loadPendingBookings]);



  const handleAcceptBooking = async (booking: Booking) => {
    Alert.alert(
      '✅ Accept Booking',
      `Accept booking from ${booking.passenger?.name || 'Passenger'}?\n\n• ${booking.seats} seat(s)\n• $${(booking.amountTotal / 100).toFixed(2)} total\n• Payment will be captured immediately`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await acceptBooking(booking.id, user!.id);

              Alert.alert(
                '🎉 Booking Accepted!',
                `You've accepted ${booking.passenger?.name || 'the passenger'}'s booking.\n\n• Payment has been captured\n• Chat is now enabled\n• Passenger has been notified`,
                [{ text: 'OK', onPress: loadPendingBookings }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to accept booking');
            }
          }
        }
      ]
    );
  };

  const handleDeclineBooking = async (booking: Booking) => {
    Alert.alert(
      '❌ Decline Booking',
      `Decline booking from ${booking.passenger?.name || 'Passenger'}?\n\n• Payment authorization will be cancelled\n• Passenger will be notified`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineBooking(booking.id, booking.rideId, booking.seats, user!.id, 'Declined by driver');

              Alert.alert(
                'Booking Declined',
                `You've declined ${booking.passenger?.name || 'the passenger'}'s booking.\n\n• Payment authorization cancelled\n• Passenger has been notified`,
                [{ text: 'OK', onPress: loadPendingBookings }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to decline booking');
            }
          }
        }
      ]
    );
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const requestTime = new Date(dateString);
    const diffMs = now.getTime() - requestTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        title: 'Booking Requests',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.background
      }} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Pending Requests</Text>
          <Text style={styles.subtitle}>
            {pendingBookings.length} booking request{pendingBookings.length !== 1 ? 's' : ''} waiting for your response
          </Text>
        </View>

        {loadingBookings ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Loading booking requests...</Text>
          </Card>
        ) : pendingBookings.length > 0 ? (
          pendingBookings.map((booking) => (
            <Card key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.passengerInfo}>
                  <View style={styles.passengerAvatar}>
                    <Text style={styles.passengerAvatarText}>
                      {(booking.passenger?.name || 'P').charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.passengerDetails}>
                    <Text style={styles.passengerName}>{booking.passenger?.name || 'Unknown Passenger'}</Text>
                    <View style={styles.passengerRating}>
                      <Text style={styles.ratingText}>⭐ {booking.passenger?.rating ?? 'N/A'}</Text>
                      <Text style={styles.ridesCount}>• {booking.passenger?.totalRides ?? 0} rides</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.requestTime}>
                  <Text style={styles.timeAgo}>{getTimeAgo(booking.createdAt)}</Text>
                </View>
              </View>

              <View style={styles.rideInfo}>
                <View style={styles.routeContainer}>
                  <View style={styles.routePoint}>
                    <View style={[styles.dot, styles.fromDot]} />
                    <Text style={[
                      styles.locationText,
                      isSmallScreen && styles.smallScreenLocationText
                    ]} numberOfLines={isSmallScreen ? 2 : 1}>{booking.ride?.origin?.name || booking.ride?.from?.name || 'Unknown'}</Text>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routePoint}>
                    <View style={[styles.dot, styles.toDot]} />
                    <Text style={[
                      styles.locationText,
                      isSmallScreen && styles.smallScreenLocationText
                    ]} numberOfLines={isSmallScreen ? 2 : 1}>{booking.ride?.destination?.name || booking.ride?.to?.name || 'Unknown'}</Text>
                  </View>
                </View>

                <View style={[styles.bookingDetails, isSmallScreen && styles.smallScreenDetails]}>
                  <View style={[styles.detailItem, isSmallScreen && styles.smallScreenDetailItem]}>
                    <Clock size={isSmallScreen ? 14 : 16} color={Colors.textSecondary} />
                    <Text style={[
                      styles.detailText,
                      isSmallScreen && styles.smallScreenDetailText
                    ]} numberOfLines={isSmallScreen ? 2 : 1}>
                      {formatDate(booking.ride?.departureAt || booking.ride?.departureTime || '')} at {formatTime(booking.ride?.departureAt || booking.ride?.departureTime || '')}
                    </Text>
                  </View>
                  <View style={[styles.detailItem, isSmallScreen && styles.smallScreenDetailItem]}>
                    <User size={isSmallScreen ? 14 : 16} color={Colors.textSecondary} />
                    <Text style={[
                      styles.detailText,
                      isSmallScreen && styles.smallScreenDetailText
                    ]}>
                      {booking.seats} seat{booking.seats !== 1 ? 's' : ''} requested
                    </Text>
                  </View>
                  <View style={[styles.detailItem, isSmallScreen && styles.smallScreenDetailItem]}>
                    <DollarSign size={isSmallScreen ? 14 : 16} color={Colors.textSecondary} />
                    <Text style={[
                      styles.detailText,
                      isSmallScreen && styles.smallScreenDetailText
                    ]}>
                      ${(booking.amountTotal / 100).toFixed(2)} total
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.actionButtons, isSmallScreen && styles.smallScreenActionButtons]}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.declineButton, isSmallScreen && styles.smallScreenActionButton]}
                  onPress={() => handleDeclineBooking(booking)}
                  disabled={isLoading}
                >
                  <X size={isSmallScreen ? 14 : 16} color={Colors.error} />
                  <Text style={[styles.actionButtonText, styles.declineButtonText, isSmallScreen && styles.smallScreenActionButtonText]}>Decline Request</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton, isSmallScreen && styles.smallScreenActionButton]}
                  onPress={() => handleAcceptBooking(booking)}
                  disabled={isLoading}
                >
                  <Check size={isSmallScreen ? 14 : 16} color={Colors.background} />
                  <Text style={[styles.actionButtonText, styles.acceptButtonText, isSmallScreen && styles.smallScreenActionButtonText]}>Accept Request</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Clock size={48} color={Colors.textLight} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No pending requests</Text>
            <Text style={styles.emptySubtext}>
              Booking requests from riders will appear here
            </Text>
          </Card>
        )}
      </ScrollView>
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
    padding: isSmallScreen ? 16 : 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  bookingCard: {
    marginBottom: 16,
    padding: isSmallScreen ? 16 : 20,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  passengerAvatarText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  passengerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  ridesCount: {
    fontSize: 14,
    color: Colors.textLight,
    marginLeft: 4,
  },
  requestTime: {
    alignItems: 'flex-end',
  },
  timeAgo: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500' as const,
  },
  rideInfo: {
    marginBottom: 20,
  },
  routeContainer: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  fromDot: {
    backgroundColor: Colors.secondary,
  },
  toDot: {
    backgroundColor: Colors.primary,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.borderLight,
    marginLeft: 5,
    marginVertical: 4,
  },
  locationText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  smallScreenLocationText: {
    fontSize: 12,
    lineHeight: 16,
  },
  bookingDetails: {
    gap: isSmallScreen ? 6 : 8,
  },
  smallScreenDetails: {
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: isSmallScreen ? 'flex-start' : 'center',
    flexWrap: isSmallScreen ? 'wrap' : 'nowrap',
  },
  smallScreenDetailItem: {
    alignItems: 'flex-start',
  },
  detailText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: Colors.textSecondary,
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  smallScreenDetailText: {
    fontSize: 11,
    lineHeight: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: isSmallScreen ? 8 : 12,
  },
  smallScreenActionButtons: {
    gap: 6,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isSmallScreen ? 8 : 12,
    paddingHorizontal: isSmallScreen ? 8 : 12,
    borderRadius: 8,
    gap: 6,
  },
  smallScreenActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
  },
  acceptButton: {
    backgroundColor: Colors.success,
  },
  declineButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  actionButtonText: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '600' as const,
  },
  smallScreenActionButtonText: {
    fontSize: 10,
  },
  acceptButtonText: {
    color: Colors.background,
  },
  declineButtonText: {
    color: Colors.error,
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
});