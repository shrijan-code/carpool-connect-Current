import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { X, AlertTriangle, DollarSign, Clock, Info } from 'lucide-react-native';
import { Booking } from '@/types';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';

interface CancellationModalProps {
  visible: boolean;
  booking: Booking;
  userRole: 'driver' | 'passenger';
  onClose: () => void;
  onConfirm: (reason: string, cancellationType?: 'passenger_cancel' | 'driver_cancel' | 'no_show') => Promise<void>;
}

interface CancellationPolicy {
  refundAmountCents: number;
  driverCompensationCents: number;
  cancellationFee: number;
  refundType: 'full' | 'partial' | 'none';
  reason: string;
}

export const CancellationModal: React.FC<CancellationModalProps> = ({
  visible,
  booking,
  userRole,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cancellationType, setCancellationType] = useState<'passenger_cancel' | 'driver_cancel' | 'no_show'>('passenger_cancel');

  // Calculate cancellation policy preview
  const cancellationPreview = useMemo((): CancellationPolicy => {
    if (!booking.ride?.departureAt || !booking.payment) {
      return {
        refundAmountCents: 0,
        driverCompensationCents: 0,
        cancellationFee: 0,
        refundType: 'none',
        reason: 'Unable to calculate refund'
      };
    }

    const now = new Date();
    const departure = new Date(booking.ride.departureAt);
    const hoursUntilDeparture = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);

    const amountCents = (booking as any).amountTotal || 0;
    const PLATFORM_FEE = 500; // $5 flat platform fee
    const fareAmount = Math.max(0, amountCents - PLATFORM_FEE); // Fare excluding platform fee

    switch (cancellationType) {
      case 'driver_cancel':
        // Driver cancels: Full refund including platform fee, platform gets nothing
        return {
          refundAmountCents: amountCents,
          driverCompensationCents: 0,
          cancellationFee: 0,
          refundType: 'full',
          reason: 'Driver cancelled - full refund including platform fee'
        };

      case 'no_show':
        // No-show: Driver gets full fare, platform keeps fee, rider gets nothing
        return {
          refundAmountCents: 0,
          driverCompensationCents: fareAmount,
          cancellationFee: PLATFORM_FEE,
          refundType: 'none',
          reason: 'Passenger no-show - driver receives full fare compensation'
        };

      case 'passenger_cancel':
      default:
        if (hoursUntilDeparture > 24) {
          // Early cancellation (>24h): 100% refund (Full fare + platform fee)
          return {
            refundAmountCents: amountCents,
            driverCompensationCents: 0,
            cancellationFee: 0,
            refundType: 'full',
            reason: 'Cancelled 24+ hours before - 100% refund'
          };
        } else {
          // Late cancellation (<24h): 50% refund, 50% to driver, platform keeps $5
          const halfFare = Math.round(fareAmount / 2);
          return {
            refundAmountCents: halfFare,
            driverCompensationCents: halfFare,
            cancellationFee: PLATFORM_FEE,
            refundType: 'partial',
            reason: 'Cancelled within 24 hours - 50% refund, 50% to driver, platform fee retained'
          };
        }
    }
  }, [booking, cancellationType]);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for cancellation.');
      return;
    }

    const actionText = cancellationType === 'no_show' ? 'mark as no-show' : 'cancel';
    const confirmTitle = cancellationType === 'no_show' ? 'Mark as No-Show?' : 'Confirm Cancellation';

    let confirmMessage = `Are you sure you want to ${actionText} this booking?\n\n`;

    if (cancellationPreview.refundAmountCents > 0) {
      confirmMessage += `• Refund: ${formatCurrency(cancellationPreview.refundAmountCents)}\n`;
    }
    if (cancellationPreview.driverCompensationCents > 0) {
      confirmMessage += `• Driver compensation: ${formatCurrency(cancellationPreview.driverCompensationCents)}\n`;
    }
    if (cancellationPreview.cancellationFee > 0) {
      confirmMessage += `• Cancellation fee: ${formatCurrency(cancellationPreview.cancellationFee)}\n`;
    }

    confirmMessage += `\nReason: ${reason}`;

    Alert.alert(
      confirmTitle,
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await onConfirm(reason, cancellationType);
              onClose();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to process cancellation');
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  const renderDriverOptions = () => (
    <View style={styles.optionsContainer}>
      <Text style={styles.optionsTitle}>Cancellation Type</Text>

      <TouchableOpacity
        style={[styles.optionButton, cancellationType === 'driver_cancel' && styles.optionButtonSelected]}
        onPress={() => setCancellationType('driver_cancel')}
      >
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, cancellationType === 'driver_cancel' && styles.optionTitleSelected]}>
            Cancel Ride
          </Text>
          <Text style={styles.optionDescription}>
            You&apos;re cancelling the ride. Passenger gets full refund including service fees.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.optionButton, cancellationType === 'no_show' && styles.optionButtonSelected]}
        onPress={() => setCancellationType('no_show')}
      >
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, cancellationType === 'no_show' && styles.optionTitleSelected]}>
            Mark as No-Show
          </Text>
          <Text style={styles.optionDescription}>
            Passenger didn&apos;t show up. You receive full compensation, no refund for passenger.
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderPolicyBreakdown = () => (
    <View style={styles.policyContainer}>
      <View style={styles.policyHeader}>
        <Info size={20} color="#007bff" />
        <Text style={styles.policyTitle}>Cancellation Policy</Text>
      </View>

      <View style={styles.policyContent}>
        <Text style={styles.policyReason}>{cancellationPreview.reason}</Text>

        <View style={styles.policyBreakdown}>
          {cancellationPreview.refundAmountCents > 0 && (
            <View style={styles.policyRow}>
              <Text style={styles.policyLabel}>Refund Amount:</Text>
              <Text style={[styles.policyValue, styles.refundAmount]}>
                {formatCurrency(cancellationPreview.refundAmountCents)}
              </Text>
            </View>
          )}

          {cancellationPreview.driverCompensationCents > 0 && (
            <View style={styles.policyRow}>
              <Text style={styles.policyLabel}>Driver Compensation:</Text>
              <Text style={[styles.policyValue, styles.compensationAmount]}>
                {formatCurrency(cancellationPreview.driverCompensationCents)}
              </Text>
            </View>
          )}

          {cancellationPreview.cancellationFee > 0 && (
            <View style={styles.policyRow}>
              <Text style={styles.policyLabel}>Cancellation Fee:</Text>
              <Text style={[styles.policyValue, styles.feeAmount]}>
                {formatCurrency(cancellationPreview.cancellationFee)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const renderBookingInfo = () => (
    <View style={styles.bookingInfo}>
      <Text style={styles.bookingTitle}>Booking Details</Text>

      <View style={styles.routeContainer}>
        <View style={styles.locationRow}>
          <View style={[styles.dot, styles.fromDot]} />
          <Text style={styles.locationText} numberOfLines={2}>
            {booking.ride?.origin?.name || 'Unknown'}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.locationRow}>
          <View style={[styles.dot, styles.toDot]} />
          <Text style={styles.locationText} numberOfLines={2}>
            {booking.ride?.destination?.name || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Clock size={16} color="#6c757d" />
          <Text style={styles.detailText}>
            {formatDate(booking.ride?.departureAt || '')} at{' '}
            {formatTime(booking.ride?.departureAt || '')}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <DollarSign size={16} color="#6c757d" />
          <Text style={styles.detailText}>
            {formatCurrency((booking as any).amountTotal || 0)} total
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AlertTriangle size={24} color="#dc3545" />
            <Text style={styles.headerTitle}>
              {userRole === 'driver' && cancellationType === 'no_show' ? 'Mark No-Show' : 'Cancel Booking'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            disabled={isProcessing}
          >
            <X size={24} color="#495057" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderBookingInfo()}

          {userRole === 'driver' && renderDriverOptions()}

          {renderPolicyBreakdown()}

          <View style={styles.reasonContainer}>
            <Text style={styles.reasonLabel}>Reason for Cancellation *</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Please provide a reason..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.characterCount}>{reason.length}/500</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isProcessing}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, isProcessing && styles.disabledButton]}
            onPress={handleConfirm}
            disabled={isProcessing || !reason.trim()}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.confirmButtonText}>
                {cancellationType === 'no_show' ? 'Mark No-Show' : 'Confirm Cancellation'}
              </Text>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginLeft: 12,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bookingInfo: {
    marginVertical: 20,
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  routeContainer: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  fromDot: {
    backgroundColor: '#28a745',
  },
  toDot: {
    backgroundColor: '#dc3545',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#dee2e6',
    marginLeft: 6,
    marginVertical: 2,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    flex: 1,
  },
  detailsGrid: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
  },
  optionsContainer: {
    marginVertical: 20,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  optionButtonSelected: {
    borderColor: '#007bff',
    backgroundColor: '#f8f9ff',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#007bff',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  policyContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginVertical: 20,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginLeft: 8,
  },
  policyContent: {
    gap: 12,
  },
  policyReason: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  policyBreakdown: {
    gap: 8,
  },
  policyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  policyLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  policyValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  refundAmount: {
    color: '#28a745',
  },
  compensationAmount: {
    color: '#007bff',
  },
  feeAmount: {
    color: '#dc3545',
  },
  reasonContainer: {
    marginVertical: 20,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212529',
    minHeight: 80,
  },
  characterCount: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});