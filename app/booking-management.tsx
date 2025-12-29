import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { Booking } from '@/types';
import { Clock, User, DollarSign, AlertTriangle, CheckCircle, XCircle, RefreshCw, Eye, MessageCircle, AlertCircle, CreditCard } from 'lucide-react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CancellationModal } from '@/src/components/CancellationModal';
import { router } from 'expo-router';
import { logger } from '@/utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

export default function BookingManagementScreen() {
  const { user } = useAuthStore();
  const { getUserBookings, cancelBooking, isLoading } = useRidesStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'confirmed' | 'declined' | 'failed'>('all');
  const [retryingPayment, setRetryingPayment] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!user?.id) return;

    setLoadingBookings(true);
    try {
      // Get bookings from store
      const userBookings = getUserBookings(user.id);
      setBookings(userBookings);
      logger.debug('Loaded user bookings', { count: userBookings.length });
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  }, [user?.id, getUserBookings]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleCancelBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowCancellationModal(true);
  };

  const handleConfirmCancellation = async (reason: string, cancellationType?: 'passenger_cancel' | 'driver_cancel' | 'no_show') => {
    if (!selectedBooking) return;

    try {
      await cancelBooking(selectedBooking.id, selectedBooking.rideId, selectedBooking.seats, reason);

      Alert.alert(
        'Booking Cancelled',
        'Your booking has been cancelled successfully. Refund details will be sent to your email.',
        [{ text: 'OK', onPress: loadBookings }]
      );
    } catch (error: any) {
      throw error; // Let the modal handle the error display
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'confirmed':
        return Colors.success;
      case 'pending_driver':
      case 'requested':
        return Colors.warning;
      case 'declined':
      case 'cancelled_rider':
      case 'cancelled_driver':
      case 'payment_failed':
        return Colors.error;
      case 'completed':
        return Colors.primary;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'confirmed':
        return <CheckCircle size={16} color={Colors.success} />;
      case 'pending_driver':
      case 'requested':
        return <Clock size={16} color={Colors.warning} />;
      case 'declined':
      case 'cancelled_rider':
      case 'cancelled_driver':
        return <XCircle size={16} color={Colors.error} />;
      case 'payment_failed':
        return <AlertCircle size={16} color={Colors.error} />;
      case 'completed':
        return <CheckCircle size={16} color={Colors.primary} />;
      default:
        return <Clock size={16} color={Colors.textSecondary} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_driver':
        return 'Waiting for Driver';
      case 'requested':
        return 'Requested';
      case 'accepted':
        return 'Confirmed';
      case 'declined':
        return 'Declined';
      case 'cancelled_rider':
        return 'Cancelled by You';
      case 'cancelled_driver':
        return 'Cancelled by Driver';
      case 'payment_failed':
        return 'Payment Failed';
      case 'completed':
        return 'Completed';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const handleRetryPayment = async (booking: Booking) => {
    if (retryingPayment) return; // Prevent double-clicks

    setRetryingPayment(booking.id);
    try {
      const functions = getFunctions();
      const retryPayment = httpsCallable(functions, 'retryPaymentForCompletedRide');

      const result = await retryPayment({ bookingId: booking.id });
      const data = result.data as { success: boolean; message: string; requiresAction?: boolean };

      if (data.success) {
        Alert.alert(
          'Payment Successful! ✅',
          data.message,
          [{ text: 'OK', onPress: loadBookings }]
        );
      } else if (data.requiresAction) {
        Alert.alert(
          'Additional Verification Required',
          'Please try again or contact support if the issue persists.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Retry payment error:', error);
      Alert.alert(
        'Payment Failed',
        error.message || 'Failed to process payment. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRetryingPayment(null);
    }
  };

  // Allow cancelling for pending_driver, confirmed (modern), and accepted (legacy) statuses
  const canCancelBooking = (booking: Booking) => {
    return ['pending_driver', 'requested', 'accepted', 'confirmed'].includes(booking.status);
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

  const getTimeUntilDeparture = (departureTime: string) => {
    const now = new Date();
    const departure = new Date(departureTime);
    const diffMs = departure.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMs < 0) return 'Departed';
    if (diffHours < 1) return 'Less than 1 hour';
    if (diffHours < 24) return `${diffHours} hours`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days`;
  };

  // Cancellation fee structure - matches utils/ride-validation.ts
  const getCancellationPolicy = (booking: Booking) => {
    if (!booking.ride?.departureAt) return null;

    const now = new Date();
    const departure = new Date(booking.ride.departureAt);
    const hoursUntilDeparture = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Pending bookings have no fee
    if (booking.status === 'pending_driver') {
      return {
        type: 'full',
        message: 'Full refund (no fee for pending bookings)',
        color: Colors.success
      };
    }

    // Tiered fee structure for confirmed bookings
    if (hoursUntilDeparture > 24) {
      return {
        type: 'full',
        message: '5% cancellation fee applies',
        color: Colors.success
      };
    } else if (hoursUntilDeparture > 12) {
      return {
        type: 'partial',
        message: '25% cancellation fee applies',
        color: Colors.warning
      };
    } else if (hoursUntilDeparture > 0) {
      return {
        type: 'partial',
        message: '50% cancellation fee applies',
        color: Colors.warning
      };
    } else {
      return {
        type: 'none',
        message: 'No refund available (past departure time)',
        color: Colors.error
      };
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['pending_driver', 'requested'].includes(booking.status);
    if (activeTab === 'confirmed') return ['accepted', 'confirmed'].includes(booking.status);
    if (activeTab === 'declined') return ['declined', 'cancelled_rider', 'cancelled_driver'].includes(booking.status);
    if (activeTab === 'failed') return booking.status === 'payment_failed';
    return true;
  });

  const getTabCount = (tab: string) => {
    if (tab === 'all') return bookings.length;
    if (tab === 'pending') return bookings.filter(b => ['pending_driver', 'requested'].includes(b.status)).length;
    if (tab === 'confirmed') return bookings.filter(b => ['accepted', 'confirmed'].includes(b.status)).length;
    if (tab === 'declined') return bookings.filter(b => ['declined', 'cancelled_rider', 'cancelled_driver'].includes(b.status)).length;
    if (tab === 'failed') return bookings.filter(b => b.status === 'payment_failed').length;
    return 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        title: 'My Bookings',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.background,
        headerRight: () => (
          <TouchableOpacity onPress={loadBookings} disabled={loadingBookings}>
            <RefreshCw size={20} color={Colors.background} />
          </TouchableOpacity>
        )
      }} />

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'declined', label: 'Declined' },
            { key: 'failed', label: 'Failed' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.activeTab,
                isSmallScreen && styles.smallScreenTab
              ]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
                isSmallScreen && styles.smallScreenTabText
              ]}>
                {tab.label}
              </Text>
              <View style={[
                styles.tabBadge,
                activeTab === tab.key && styles.activeTabBadge
              ]}>
                <Text style={[
                  styles.tabBadgeText,
                  activeTab === tab.key && styles.activeTabBadgeText,
                  isSmallScreen && styles.smallScreenBadgeText
                ]}>
                  {getTabCount(tab.key)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, isSmallScreen && styles.smallScreenTitle]}>Your Bookings</Text>
          <Text style={[styles.subtitle, isSmallScreen && styles.smallScreenSubtitle]}>
            {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        {loadingBookings ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Loading your bookings...</Text>
          </Card>
        ) : filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => {
            const policy = getCancellationPolicy(booking);

            return (
              <Card key={booking.id} style={[styles.bookingCard, isSmallScreen && styles.smallScreenCard]}>
                <View style={[styles.bookingHeader, isSmallScreen && styles.smallScreenHeader]}>
                  <View style={styles.statusContainer}>
                    {getStatusIcon(booking.status)}
                    <Text style={[
                      styles.statusText,
                      { color: getStatusColor(booking.status) },
                      isSmallScreen && styles.smallScreenStatusText
                    ]}>
                      {getStatusText(booking.status)}
                    </Text>
                  </View>
                  <Text style={[styles.bookingId, isSmallScreen && styles.smallScreenBookingId]}>#{booking.id.slice(-6)}</Text>
                </View>

                <View style={styles.rideInfo}>
                  <View style={styles.routeContainer}>
                    <View style={styles.routePoint}>
                      <View style={[styles.dot, styles.fromDot]} />
                      <Text style={[
                        styles.locationText,
                        isSmallScreen && styles.smallScreenLocationText
                      ]} numberOfLines={isSmallScreen ? 2 : 1}>
                        {booking.ride?.origin?.name || 'Unknown'}
                      </Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routePoint}>
                      <View style={[styles.dot, styles.toDot]} />
                      <Text style={[
                        styles.locationText,
                        isSmallScreen && styles.smallScreenLocationText
                      ]} numberOfLines={isSmallScreen ? 2 : 1}>
                        {booking.ride?.destination?.name || 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.bookingDetails, isSmallScreen && styles.smallScreenDetails]}>
                    <View style={[styles.detailItem, isSmallScreen && styles.smallScreenDetailItem]}>
                      <Clock size={isSmallScreen ? 14 : 16} color={Colors.textSecondary} />
                      <Text style={[
                        styles.detailText,
                        isSmallScreen && styles.smallScreenDetailText
                      ]} numberOfLines={isSmallScreen ? 2 : 1}>
                        {formatDate(booking.ride?.departureAt || '')} at {formatTime(booking.ride?.departureAt || '')}
                      </Text>
                    </View>
                    <View style={[styles.detailItem, isSmallScreen && styles.smallScreenDetailItem]}>
                      <User size={isSmallScreen ? 14 : 16} color={Colors.textSecondary} />
                      <Text style={[
                        styles.detailText,
                        isSmallScreen && styles.smallScreenDetailText
                      ]}>
                        {booking.seats} seat{booking.seats !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={[styles.detailItem, isSmallScreen && styles.smallScreenDetailItem]}>
                      <DollarSign size={isSmallScreen ? 14 : 16} color={Colors.textSecondary} />
                      <Text style={[
                        styles.detailText,
                        isSmallScreen && styles.smallScreenDetailText
                      ]}>
                        ${((booking as any).amountTotal / 100).toFixed(2)} total
                      </Text>
                    </View>
                  </View>

                  {booking.ride?.departureAt && (
                    <View style={styles.timeInfo}>
                      <Text style={styles.timeLabel}>Departure in:</Text>
                      <Text style={styles.timeValue}>
                        {getTimeUntilDeparture(booking.ride.departureAt)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionSection}>
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.viewButton]}
                      onPress={() => {
                        if (booking.rideId) {
                          router.push({ pathname: '/ride-details', params: { id: booking.rideId } });
                        } else {
                          Alert.alert('Error', 'Ride details not available');
                        }
                      }}
                    >
                      <Eye size={16} color={Colors.background} />
                      <Text style={styles.actionButtonText}>View Ride Details</Text>
                    </TouchableOpacity>

                    {['accepted', 'confirmed'].includes(booking.status) && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.messageButton]}
                        onPress={() => router.push('/(tabs)/chat')}
                      >
                        <MessageCircle size={16} color={Colors.background} />
                        <Text style={styles.actionButtonText}>Contact Driver</Text>
                      </TouchableOpacity>
                    )}

                    {canCancelBooking(booking) && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => handleCancelBooking(booking)}
                        disabled={isLoading}
                      >
                        <XCircle size={16} color={Colors.error} />
                        <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                      </TouchableOpacity>
                    )}

                    {/* Retry Payment Button for Failed Payments */}
                    {booking.status === 'payment_failed' && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.retryButton]}
                        onPress={() => handleRetryPayment(booking)}
                        disabled={retryingPayment === booking.id}
                      >
                        <CreditCard size={16} color={Colors.background} />
                        <Text style={styles.actionButtonText}>
                          {retryingPayment === booking.id ? 'Processing...' : 'Retry Payment'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {canCancelBooking(booking) && policy && (
                    <View style={[styles.policyInfo, isSmallScreen && styles.smallScreenPolicyInfo]}>
                      <AlertTriangle size={isSmallScreen ? 12 : 14} color={policy.color} />
                      <Text style={[
                        styles.policyText,
                        { color: policy.color },
                        isSmallScreen && styles.smallScreenPolicyText
                      ]}>
                        {policy.message}
                      </Text>
                    </View>
                  )}
                </View>

                {booking.cancellationReason && (
                  <View style={styles.cancellationInfo}>
                    <Text style={styles.cancellationLabel}>Cancellation Reason:</Text>
                    <Text style={styles.cancellationReason}>{booking.cancellationReason}</Text>
                  </View>
                )}
              </Card>
            );
          })
        ) : (
          <Card style={styles.emptyCard}>
            <Clock size={48} color={Colors.textLight} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No bookings found</Text>
            <Text style={styles.emptySubtext}>
              Your ride bookings will appear here
            </Text>
          </Card>
        )}
      </ScrollView>

      {selectedBooking && (
        <CancellationModal
          visible={showCancellationModal}
          booking={selectedBooking}
          userRole="passenger"
          onClose={() => {
            setShowCancellationModal(false);
            setSelectedBooking(null);
          }}
          onConfirm={handleConfirmCancellation}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  tabContainer: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  smallScreenTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.background,
  },
  smallScreenTabText: {
    fontSize: 12,
  },
  tabBadge: {
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  activeTabBadgeText: {
    color: Colors.background,
  },
  smallScreenBadgeText: {
    fontSize: 10,
  },
  content: {
    flex: 1,
    padding: isSmallScreen ? 16 : 24,
  },
  header: {
    marginBottom: isSmallScreen ? 16 : 24,
  },
  title: {
    fontSize: isSmallScreen ? 24 : 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  smallScreenTitle: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: Colors.textSecondary,
  },
  smallScreenSubtitle: {
    fontSize: 12,
  },
  bookingCard: {
    marginBottom: 16,
    padding: isSmallScreen ? 16 : 20,
  },
  smallScreenCard: {
    marginBottom: 12,
    padding: 12,
  },
  bookingHeader: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isSmallScreen ? 'flex-start' : 'center',
    marginBottom: 16,
    gap: isSmallScreen ? 8 : 0,
  },
  smallScreenHeader: {
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  smallScreenStatusText: {
    fontSize: 12,
  },
  bookingId: {
    fontSize: isSmallScreen ? 10 : 12,
    color: Colors.textLight,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  smallScreenBookingId: {
    fontSize: 9,
  },
  rideInfo: {
    marginBottom: 16,
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
    backgroundColor: Colors.success,
  },
  toDot: {
    backgroundColor: Colors.error,
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
    marginBottom: 12,
  },
  smallScreenDetails: {
    gap: 4,
    marginBottom: 8,
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
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 8,
    borderRadius: 6,
  },
  timeLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  actionSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: isSmallScreen ? 12 : 16,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
    minHeight: 44,
    flex: 1,
    minWidth: 120,
  },
  viewButton: {
    backgroundColor: Colors.primary,
  },
  messageButton: {
    backgroundColor: Colors.success,
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  retryButton: {
    backgroundColor: Colors.warning,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.background,
    textAlign: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.error,
    textAlign: 'center',
  },
  policyInfo: {
    flexDirection: 'row',
    alignItems: isSmallScreen ? 'flex-start' : 'center',
    padding: isSmallScreen ? 6 : 8,
    backgroundColor: Colors.surface,
    borderRadius: 6,
  },
  smallScreenPolicyInfo: {
    padding: 4,
  },
  policyText: {
    fontSize: isSmallScreen ? 10 : 12,
    marginLeft: 6,
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: isSmallScreen ? 12 : 16,
  },
  smallScreenPolicyText: {
    fontSize: 9,
    lineHeight: 11,
  },
  cancellationInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 6,
  },
  cancellationLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cancellationReason: {
    fontSize: 14,
    color: Colors.text,
    fontStyle: 'italic',
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