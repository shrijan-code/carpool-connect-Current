import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, CreditCard, AlertCircle } from 'lucide-react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { useAuthStore } from '@/store/auth-store';
import { useStripe } from '@stripe/stripe-react-native';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  ride: {
    id: string;
    pricePerSeat: number;
    seatsAvailable: number;
    origin: { name: string };
    destination: { name: string };
    departureTime: string;
    driver: { name: string };
  };
  seats: number;
  onBookingSuccess: (bookingId: string) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  visible,
  onClose,
  ride,
  seats,
  onBookingSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [lastBookingAttempt, setLastBookingAttempt] = useState<number>(0);
  const { user } = useAuthStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const ridePrice = ride.pricePerSeat * seats;
  const platformFee = 500; // $5 flat platform fee (in cents)
  const totalAmount = ridePrice + platformFee;

  // Initialize payment sheet when modal opens
  useEffect(() => {
    if (visible && user) {
      initializePaymentSheet();
    }

    // Reset state when modal closes
    if (!visible) {
      setPaymentReady(false);
      setPaymentIntentId(null);
    }
  }, [visible]);

  const initializePaymentSheet = async () => {
    try {
      console.log('💳 Initializing Payment Sheet...');
      setIsLoading(true);

      // Create Payment Intent via Cloud Function
      const createPI = httpsCallable(functions, 'createPaymentIntent');
      const result = await createPI({
        rideId: ride.id,
        seats: seats,
        amount: totalAmount, // in cents
      });

      const data = result.data as any;
      const { clientSecret, customerId, paymentIntentId: piId, ephemeralKey } = data;

      if (!clientSecret) {
        throw new Error('Failed to get payment client secret');
      }

      setPaymentIntentId(piId);

      // Initialize Stripe Payment Sheet with ephemeral key for card saving
      const { error } = await initPaymentSheet({
        merchantDisplayName: 'CarpoolConnect',
        customerId: customerId,
        customerEphemeralKeySecret: ephemeralKey, // CRITICAL: Enables showing saved cards
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: true, // Allow saved payment methods
        defaultBillingDetails: {
          name: user?.name || '',
          email: user?.email || '',
        },
        returnURL: 'carpoolconnect://payment-return',
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('✅ Payment Sheet initialized successfully');
      setPaymentReady(true);
    } catch (error: any) {
      console.error('❌ Payment sheet initialization failed:', error);
      Alert.alert(
        'Payment Setup Failed',
        error.message || 'Failed to initialize payment. Please try again.',
        [{ text: 'OK', onPress: onClose }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to book a ride');
      return;
    }

    // Prevent multiple simultaneous booking attempts
    if (isLoading) {
      console.log('⚠️ Booking already in progress, ignoring duplicate request');
      return;
    }

    // Prevent rapid successive booking attempts (debounce)
    const now = Date.now();
    if (now - lastBookingAttempt < 2000) { // 2 second cooldown
      console.log('⚠️ Too soon since last booking attempt, please wait');
      return;
    }
    setLastBookingAttempt(now);

    setIsLoading(true);

    if (!paymentReady) {
      Alert.alert('Payment Loading', 'Please wait for payment to initialize...');
      setIsLoading(false);
      return;
    }

    try {
      console.log('💳 Presenting Payment Sheet...');

      // Show Stripe Payment Sheet
      const { error } = await presentPaymentSheet();

      if (error) {
        // User cancelled or payment failed  
        console.log('Payment cancelled or failed:', error.message);
        Alert.alert('Payment Cancelled', error.message);
        setLastBookingAttempt(0);
        setIsLoading(false);
        return;
      }

      // Payment authorized successfully - create booking
      console.log('✅ Payment authorized, creating booking...');

      const createPendingBooking = httpsCallable(functions, 'createPendingBooking');
      const result = await createPendingBooking({
        rideId: ride.id,
        seats: seats,
        paymentIntentId: paymentIntentId,
      });

      const data = result.data as any;

      if (data.success) {
        console.log('✅ Booking created successfully:', data.bookingId);

        Alert.alert(
          'Booking Request Sent! 🚗',
          `Your booking request has been sent to the driver. You'll be notified when they respond.\n\n${data.message}`,
          [
            {
              text: 'OK',
              onPress: () => {
                onBookingSuccess(data.bookingId);
                onClose();
              },
            },
          ]
        );

        // Reset the booking attempt timer on success
        setLastBookingAttempt(0);
      } else {
        throw new Error(data.message || 'Failed to create booking');
      }
    } catch (error: any) {
      console.error('❌ Booking error:', error);

      let errorMessage = 'Failed to create booking request';
      if (error.message) {
        // Handle specific duplicate booking errors
        if (error.message.includes('already have a')) {
          errorMessage = '⚠️ Duplicate Booking Detected\n\n' + error.message + '\n\nPlease check your bookings to manage existing requests.';
        } else if (error.message.includes('seats available') || error.message.includes('seats actually available')) {
          errorMessage = '🚫 Not Enough Seats\n\n' + error.message + '\n\nPlease try a different ride or select fewer seats.';
        } else if (error.message.includes('already booked') || error.message.includes('fully booked')) {
          errorMessage = '🚫 Ride Full\n\nThis ride is fully booked. Please try another ride.';
        } else {
          errorMessage = error.message;
        }
      } else if (error.code === 'functions/unauthenticated') {
        errorMessage = 'You must be logged in to book a ride';
      } else if (error.code === 'functions/invalid-argument') {
        errorMessage = 'Invalid booking details';
      } else if (error.code === 'functions/internal') {
        errorMessage = 'Booking service temporarily unavailable. Please try again.';
      }

      Alert.alert('Booking Failed', errorMessage);

      // Reset the booking attempt timer on error to allow retry
      setLastBookingAttempt(0);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Ride Details */}
        <View style={styles.rideDetails}>
          <Text style={styles.sectionTitle}>Ride Details</Text>

          <View style={styles.routeContainer}>
            <Text style={styles.routeText}>
              {ride.origin.name} → {ride.destination.name}
            </Text>
            <Text style={styles.timeText}>
              {formatDate(ride.departureTime)} at {formatTime(ride.departureTime)}
            </Text>
            <Text style={styles.driverText}>Driver: {ride.driver.name}</Text>
          </View>

          <View style={styles.seatsContainer}>
            <Text style={styles.seatsText}>
              {seats} seat{seats > 1 ? 's' : ''} requested
            </Text>
          </View>
        </View>

        {/* Payment Breakdown */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Breakdown</Text>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>
              Ride cost ({seats} seat{seats > 1 ? 's' : ''})
            </Text>
            <Text style={styles.paymentAmount}>
              ${(ridePrice / 100).toFixed(2)}
            </Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Platform fee</Text>
            <Text style={styles.paymentAmount}>
              ${(platformFee / 100).toFixed(2)}
            </Text>
          </View>

          <View style={[styles.paymentRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>
              ${(totalAmount / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Important Notice */}
        <View style={styles.noticeContainer}>
          <AlertCircle size={20} color="#FF6B35" />
          <Text style={styles.noticeText}>
            Your payment method will be securely collected by Stripe.
            Payment will be authorized now, but you'll only be charged when the driver accepts and the ride is completed.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, isLoading && styles.disabledButton]}
            onPress={handleConfirmBooking}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <CreditCard size={20} color="#FFF" />
                <Text style={styles.confirmButtonText}>Confirm Booking</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  rideDetails: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  routeContainer: {
    marginBottom: 12,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  driverText: {
    fontSize: 14,
    color: '#666',
  },
  seatsContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  seatsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  paymentSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 8,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#FFF8F5',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE5D6',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#8B4513',
    marginLeft: 8,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    marginTop: 'auto',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  disabledButton: {
    backgroundColor: '#CCC',
  },
});