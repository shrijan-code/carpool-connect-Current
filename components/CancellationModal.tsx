import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Booking } from '@/types';
import { X, AlertTriangle } from 'lucide-react-native';

interface CancellationModalProps {
  visible: boolean;
  booking: Booking;
  userRole: 'passenger' | 'driver';
  onClose: () => void;
  onConfirm: (reason: string, cancellationType?: 'passenger_cancel' | 'driver_cancel' | 'no_show') => Promise<void>;
}

const CANCELLATION_REASONS = {
  passenger: [
    'Change of plans',
    'Found alternative transport',
    'Emergency came up',
    'Driver not responding',
    'Ride details changed',
    'Other'
  ],
  driver: [
    'Vehicle breakdown',
    'Personal emergency',
    'Route not feasible',
    'Passenger not responding',
    'Weather conditions',
    'Other'
  ]
};

export function CancellationModal({
  visible,
  booking,
  userRole,
  onClose,
  onConfirm
}: CancellationModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = CANCELLATION_REASONS[userRole];
  const finalReason = selectedReason === 'Other' ? customReason : selectedReason;

  const getCancellationPolicy = () => {
    if (!booking.ride?.departureAt) return null;
    
    const now = new Date();
    const departure = new Date(booking.ride.departureAt);
    const hoursUntilDeparture = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilDeparture > 24) {
      return {
        type: 'full',
        message: 'Full refund (excluding service fees)',
        color: Colors.success
      };
    } else if (hoursUntilDeparture > 0) {
      return {
        type: 'partial',
        message: '50% refund, driver compensated',
        color: Colors.warning
      };
    } else {
      return {
        type: 'none',
        message: 'No refund available',
        color: Colors.error
      };
    }
  };

  const handleConfirm = async () => {
    if (!finalReason.trim()) {
      Alert.alert('Error', 'Please select or enter a cancellation reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(finalReason.trim());
      onClose();
      setSelectedReason('');
      setCustomReason('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to cancel booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
    setSelectedReason('');
    setCustomReason('');
  };

  const policy = getCancellationPolicy();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Cancel Booking</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {policy && (
              <View style={[styles.policyCard, { borderLeftColor: policy.color }]}>
                <AlertTriangle size={20} color={policy.color} />
                <View style={styles.policyContent}>
                  <Text style={styles.policyTitle}>Cancellation Policy</Text>
                  <Text style={[styles.policyText, { color: policy.color }]}>
                    {policy.message}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Reason for cancellation:</Text>
            
            <View style={styles.reasonsList}>
              {reasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonOption,
                    selectedReason === reason && styles.selectedReason
                  ]}
                  onPress={() => setSelectedReason(reason)}
                  disabled={isSubmitting}
                >
                  <View style={[
                    styles.radioButton,
                    selectedReason === reason && styles.selectedRadio
                  ]} />
                  <Text style={[
                    styles.reasonText,
                    selectedReason === reason && styles.selectedReasonText
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedReason === 'Other' && (
              <View style={styles.customReasonContainer}>
                <Text style={styles.customReasonLabel}>Please specify:</Text>
                <TextInput
                  style={styles.customReasonInput}
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="Enter your reason..."
                  placeholderTextColor={Colors.textLight}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>
            )}

            <View style={styles.warningContainer}>
              <AlertTriangle size={16} color={Colors.warning} />
              <Text style={styles.warningText}>
                This action cannot be undone. {userRole === 'passenger' ? 'Your booking' : 'The ride'} will be cancelled immediately.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Keep Booking</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                (!finalReason.trim() || isSubmitting) && styles.disabledButton
              ]}
              onPress={handleConfirm}
              disabled={!finalReason.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.confirmButtonText}>Cancel Booking</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  policyCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 20,
  },
  policyContent: {
    flex: 1,
    marginLeft: 12,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  policyText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  reasonsList: {
    gap: 12,
    marginBottom: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedReason: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    marginRight: 12,
  },
  selectedRadio: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  reasonText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  selectedReasonText: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  customReasonContainer: {
    marginBottom: 20,
  },
  customReasonLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  customReasonInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    minHeight: 80,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${Colors.warning}15`,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  warningText: {
    fontSize: 14,
    color: Colors.warning,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  confirmButton: {
    backgroundColor: Colors.error,
  },
  disabledButton: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
});