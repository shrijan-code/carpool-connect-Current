/**
 * DriverCancellationWarning - Modal showing impact of canceling a ride
 * Displays affected passengers and refund amounts before confirmation
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { AlertTriangle, User, DollarSign, X, Users } from 'lucide-react-native';
import { Booking } from '@/types';
import { formatPrice } from '@/utils/price';

interface DriverCancellationWarningProps {
    visible: boolean;
    bookings: Booking[];
    onCancel: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export const DriverCancellationWarning: React.FC<DriverCancellationWarningProps> = ({
    visible,
    bookings,
    onCancel,
    onConfirm,
    isLoading = false,
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    // Filter to only active bookings that would be affected
    const affectedBookings = bookings.filter(b =>
        ['pending_driver', 'confirmed'].includes(b.status)
    );

    const totalRefund = affectedBookings.reduce((sum, b) => sum + (b.amountTotal || 0), 0);
    const totalPassengers = affectedBookings.reduce((sum, b) => sum + (b.seats || 1), 0);

    const hasAffectedPassengers = affectedBookings.length > 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={[styles.modal, { backgroundColor: colors.card }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.error + '20' }]}>
                            <AlertTriangle size={28} color={colors.error || '#FF3B30'} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>
                            {hasAffectedPassengers ? 'This Will Affect Passengers' : 'Cancel This Ride?'}
                        </Text>
                    </View>

                    {/* Affected Passengers */}
                    {hasAffectedPassengers ? (
                        <>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Users size={20} color={colors.primary} />
                                    <Text style={[styles.statValue, { color: colors.text }]}>
                                        {affectedBookings.length}
                                    </Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                        Booking{affectedBookings.length !== 1 ? 's' : ''}
                                    </Text>
                                </View>
                                <View style={styles.statItem}>
                                    <User size={20} color={colors.primary} />
                                    <Text style={[styles.statValue, { color: colors.text }]}>
                                        {totalPassengers}
                                    </Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                        Passenger{totalPassengers !== 1 ? 's' : ''}
                                    </Text>
                                </View>
                                <View style={styles.statItem}>
                                    <DollarSign size={20} color={colors.primary} />
                                    <Text style={[styles.statValue, { color: colors.text }]}>
                                        {formatPrice(totalRefund)}
                                    </Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                        Refunds
                                    </Text>
                                </View>
                            </View>

                            <ScrollView style={styles.bookingsList}>
                                {affectedBookings.map((booking) => (
                                    <View
                                        key={booking.id}
                                        style={[styles.bookingItem, { backgroundColor: colors.background }]}
                                    >
                                        <View style={styles.bookingInfo}>
                                            <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                                                <User size={16} color={colors.primary} />
                                            </View>
                                            <View style={styles.bookingDetails}>
                                                <Text style={[styles.passengerName, { color: colors.text }]}>
                                                    {booking.passenger?.name || 'Passenger'}
                                                </Text>
                                                <Text style={[styles.bookingMeta, { color: colors.textSecondary }]}>
                                                    {booking.seats} seat{booking.seats !== 1 ? 's' : ''} • {
                                                        booking.status === 'pending_driver' ? 'Pending' : 'Confirmed'
                                                    }
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.refundAmount, { color: colors.success || '#34C759' }]}>
                                            +{formatPrice(booking.amountTotal || 0)}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={[styles.warningBox, { backgroundColor: colors.warning + '15' }]}>
                                <AlertTriangle size={16} color={colors.warning || '#FF9500'} />
                                <Text style={[styles.warningText, { color: colors.warning || '#FF9500' }]}>
                                    All passengers will be notified and fully refunded
                                </Text>
                            </View>
                        </>
                    ) : (
                        <Text style={[styles.noPassengersText, { color: colors.textSecondary }]}>
                            No passengers have booked this ride yet.{'\n'}
                            You can safely cancel without affecting anyone.
                        </Text>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
                            onPress={onCancel}
                            disabled={isLoading}
                        >
                            <Text style={[styles.buttonText, { color: colors.text }]}>
                                Keep Ride
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.confirmButton,
                                { backgroundColor: colors.error || '#FF3B30' },
                                isLoading && styles.buttonDisabled,
                            ]}
                            onPress={onConfirm}
                            disabled={isLoading}
                        >
                            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                                {isLoading ? 'Cancelling...' : hasAffectedPassengers ? 'Cancel Anyway' : 'Cancel Ride'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        modal: {
            width: '100%',
            maxWidth: 400,
            borderRadius: 16,
            padding: 24,
        },
        header: {
            alignItems: 'center',
            marginBottom: 20,
        },
        iconContainer: {
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
        },
        title: {
            fontSize: 18,
            fontWeight: '600',
            textAlign: 'center',
        },
        statsRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingVertical: 16,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
        },
        statItem: {
            alignItems: 'center',
        },
        statValue: {
            fontSize: 20,
            fontWeight: '700',
            marginTop: 4,
        },
        statLabel: {
            fontSize: 12,
            marginTop: 2,
        },
        bookingsList: {
            maxHeight: 180,
            marginBottom: 16,
        },
        bookingItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderRadius: 10,
            marginBottom: 8,
        },
        bookingInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        avatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        bookingDetails: {
            flex: 1,
        },
        passengerName: {
            fontSize: 14,
            fontWeight: '500',
        },
        bookingMeta: {
            fontSize: 12,
            marginTop: 2,
        },
        refundAmount: {
            fontSize: 14,
            fontWeight: '600',
        },
        warningBox: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            gap: 8,
        },
        warningText: {
            flex: 1,
            fontSize: 13,
        },
        noPassengersText: {
            textAlign: 'center',
            fontSize: 14,
            lineHeight: 22,
            marginBottom: 24,
        },
        actions: {
            flexDirection: 'row',
            gap: 12,
        },
        button: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: 'center',
        },
        cancelButton: {
            borderWidth: 1,
        },
        confirmButton: {},
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            fontSize: 15,
            fontWeight: '600',
        },
    });

export default DriverCancellationWarning;
