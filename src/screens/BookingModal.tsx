import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { X, MapPin, Clock, Users, CreditCard } from 'lucide-react-native';
import { SeatSelector } from '../components/SeatSelector';
import { useAuthStore } from '../../store/auth-store';
import { useRidesStore } from '../../store/rides-store';
import { Ride } from '../../types';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';

interface BookingModalProps {
  visible: boolean;
  ride: Ride;
  onClose: () => void;
  onSuccess: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  visible,
  ride,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const { requestBooking } = useRidesStore();
  
  const [selectedSeats, setSelectedSeats] = useState<number>(1);
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [bookingStep, setBookingStep] = useState<'select' | 'confirm' | 'processing' | 'success'>('select');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setSelectedSeats(1);
      setIsBooking(false);
      setBookingStep('select');
    }
  }, [visible]);

  // Calculate pricing
  const pricing = useMemo(() => {
    const pricePerSeat = ride.pricePerSeat || 0;
    const subtotalCents = pricePerSeat * selectedSeats;
    const platformFeePercent = 10; // 10% platform fee
    const platformFeeCents = Math.round(subtotalCents * (platformFeePercent / 100));
    const totalCents = subtotalCents + platformFeeCents;

    return {
      pricePerSeat: pricePerSeat,
      subtotalCents,
      platformFeeCents,
      totalCents,
      platformFeePercent,
    };
  }, [ride, selectedSeats]);

  const handleBooking = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to book a ride.');
      return;
    }

    if (selectedSeats <= 0) {
      Alert.alert('Invalid Selection', 'Please select at least one seat.');
      return;
    }

    const availableSeats = ride.seatsAvailable || ride.availableSeats || 0;
    if (selectedSeats > availableSeats) {
      Alert.alert('Not Enough Seats', 'The selected number of seats is not available.');
      return;
    }

    setIsBooking(true);
    setBookingStep('processing');

    try {
      await requestBooking(ride.id, selectedSeats, user);
      
      setBookingStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('Booking error:', error);
      setBookingStep('select');
      
      const errorMessage = error.message || 'Failed to create booking request. Please try again.';
      Alert.alert('Booking Failed', errorMessage);
    } finally {
      setIsBooking(false);
    }
  };

  const handleClose = () => {
    if (!isBooking) {
      onClose();
    }
  };

  const renderSelectStep = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.rideInfo}>
        <View style={styles.routeContainer}>
          <View style={styles.locationRow}>
            <MapPin size={16} color="#28a745" />
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.origin?.name || ride.from?.name || 'Unknown'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationRow}>
            <MapPin size={16} color="#dc3545" />
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.destination?.name || ride.to?.name || 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.rideDetails}>
          <View style={styles.detailRow}>
            <Clock size={16} color="#6c757d" />
            <Text style={styles.detailText}>
              {formatDate(ride.departureAt || ride.departureTime || '')} at{' '}
              {formatTime(ride.departureAt || ride.departureTime || '')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Users size={16} color="#6c757d" />
            <Text style={styles.detailText}>
              {ride.seatsAvailable || ride.availableSeats || 0} seats available
            </Text>
          </View>
        </View>
      </View>

      <SeatSelector
        availableSeats={ride.seatsAvailable || ride.availableSeats || 0}
        selectedSeats={selectedSeats}
        onSeatChange={setSelectedSeats}
        testID="booking-seat-selector"
      />

      <View style={styles.pricingBreakdown}>
        <Text style={styles.pricingTitle}>Pricing Breakdown</Text>
        
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>
            {selectedSeats} seat{selectedSeats !== 1 ? 's' : ''} × {formatCurrency(pricing.pricePerSeat)}
          </Text>
          <Text style={styles.pricingValue}>
            {formatCurrency(pricing.subtotalCents)}
          </Text>
        </View>

        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>
            Platform fee ({pricing.platformFeePercent}%)
          </Text>
          <Text style={styles.pricingValue}>
            {formatCurrency(pricing.platformFeeCents)}
          </Text>
        </View>

        <View style={[styles.pricingRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(pricing.totalCents)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderConfirmStep = () => (
    <View style={styles.content}>
      <View style={styles.confirmationContainer}>
        <CreditCard size={48} color="#007bff" />
        <Text style={styles.confirmationTitle}>Confirm Your Booking</Text>
        <Text style={styles.confirmationText}>
          You&apos;re about to request {selectedSeats} seat{selectedSeats !== 1 ? 's' : ''} for{' '}
          {formatCurrency(pricing.totalCents)}
        </Text>
        <Text style={styles.confirmationSubtext}>
          The driver will be notified and can accept or decline your request.
        </Text>
      </View>
    </View>
  );

  const renderProcessingStep = () => (
    <View style={styles.content}>
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.processingTitle}>Processing Your Request</Text>
        <Text style={styles.processingText}>
          Please wait while we send your booking request to the driver...
        </Text>
      </View>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.content}>
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Request Sent!</Text>
        <Text style={styles.successText}>
          Your booking request has been sent to the driver. You&apos;ll be notified when they respond.
        </Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (bookingStep === 'processing' || bookingStep === 'success') {
      return null;
    }

    if (bookingStep === 'confirm') {
      return (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setBookingStep('select')}
            disabled={isBooking}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, isBooking && styles.disabledButton]}
            onPress={handleBooking}
            disabled={isBooking}
            testID="confirm-booking-button"
          >
            {isBooking ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm Booking</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleClose}
          disabled={isBooking}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (selectedSeats <= 0 || isBooking) && styles.disabledButton,
          ]}
          onPress={() => setBookingStep('confirm')}
          disabled={selectedSeats <= 0 || isBooking}
          testID="continue-booking-button"
        >
          <Text style={styles.primaryButtonText}>
            Continue - {formatCurrency(pricing.totalCents)}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Ride</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={isBooking}
            testID="close-booking-modal"
          >
            <X size={24} color="#495057" />
          </TouchableOpacity>
        </View>

        {bookingStep === 'select' && renderSelectStep()}
        {bookingStep === 'confirm' && renderConfirmStep()}
        {bookingStep === 'processing' && renderProcessingStep()}
        {bookingStep === 'success' && renderSuccessStep()}

        {renderFooter()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  rideInfo: {
    marginVertical: 20,
  },
  routeContainer: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginLeft: 8,
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#dee2e6',
    marginLeft: 8,
    marginVertical: 2,
  },
  rideDetails: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
  },
  pricingBreakdown: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginVertical: 20,
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28a745',
  },
  confirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#212529',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 16,
    color: '#495057',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmationSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  processingText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIconText: {
    fontSize: 40,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#212529',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#495057',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  secondaryButtonText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
});