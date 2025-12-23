/**
 * BookingStatusTimeline - Visual step indicator for booking progression
 * Shows clear visual representation of where the booking is in its lifecycle
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Check, Clock, CreditCard, Car, Flag, X, AlertCircle } from 'lucide-react-native';

type BookingStatus =
    | 'pending_driver'
    | 'confirmed'
    | 'declined'
    | 'completed'
    | 'cancelled_by_rider'
    | 'cancelled_by_driver'
    | 'refunded'
    | 'expired'
    | 'payment_failed'
    | 'no_show';

type RideStatus = 'upcoming' | 'active' | 'completed' | 'cancelled' | 'expired' | 'completed_partial';

interface BookingStatusTimelineProps {
    bookingStatus: BookingStatus;
    rideStatus?: RideStatus;
    compact?: boolean;
    showLabels?: boolean;
}

interface Step {
    id: string;
    label: string;
    icon: React.FC<{ size: number; color: string }>;
    status: 'completed' | 'active' | 'pending' | 'error';
}

export const BookingStatusTimeline: React.FC<BookingStatusTimelineProps> = ({
    bookingStatus,
    rideStatus = 'upcoming',
    compact = false,
    showLabels = true,
}) => {
    const { colors } = useTheme();

    // Determine which steps to show and their states
    const getSteps = (): Step[] => {
        // Handle cancelled/error states
        if (['declined', 'cancelled_by_rider', 'cancelled_by_driver', 'expired', 'payment_failed', 'no_show'].includes(bookingStatus)) {
            return getCancelledSteps();
        }

        const steps: Step[] = [
            {
                id: 'request',
                label: 'Request Sent',
                icon: Clock,
                status: getStepStatus('request'),
            },
            {
                id: 'approved',
                label: 'Approved',
                icon: Check,
                status: getStepStatus('approved'),
            },
            {
                id: 'payment',
                label: 'Payment Held',
                icon: CreditCard,
                status: getStepStatus('payment'),
            },
            {
                id: 'ride',
                label: 'Ride',
                icon: Car,
                status: getStepStatus('ride'),
            },
            {
                id: 'complete',
                label: 'Complete',
                icon: Flag,
                status: getStepStatus('complete'),
            },
        ];

        return steps;
    };

    const getCancelledSteps = (): Step[] => {
        const cancelLabels: Record<string, string> = {
            declined: 'Declined by Driver',
            cancelled_by_rider: 'Cancelled',
            cancelled_by_driver: 'Cancelled by Driver',
            expired: 'Expired',
            payment_failed: 'Payment Failed',
            no_show: 'No-Show',
        };

        return [
            {
                id: 'request',
                label: 'Request',
                icon: Clock,
                status: 'completed',
            },
            {
                id: 'cancelled',
                label: cancelLabels[bookingStatus] || 'Cancelled',
                icon: bookingStatus === 'payment_failed' ? AlertCircle : X,
                status: 'error',
            },
        ];
    };

    const getStepStatus = (stepId: string): Step['status'] => {
        switch (stepId) {
            case 'request':
                return 'completed'; // Always completed if booking exists

            case 'approved':
                if (bookingStatus === 'pending_driver') return 'active';
                if (['confirmed', 'completed', 'refunded'].includes(bookingStatus)) return 'completed';
                return 'pending';

            case 'payment':
                if (bookingStatus === 'pending_driver') return 'pending';
                if (bookingStatus === 'confirmed' && rideStatus === 'upcoming') return 'active';
                if (['completed', 'refunded'].includes(bookingStatus)) return 'completed';
                return 'pending';

            case 'ride':
                if (['pending_driver', 'confirmed'].includes(bookingStatus) && rideStatus !== 'active') return 'pending';
                if (rideStatus === 'active') return 'active';
                if (bookingStatus === 'completed') return 'completed';
                return 'pending';

            case 'complete':
                if (bookingStatus === 'completed') return 'completed';
                return 'pending';

            default:
                return 'pending';
        }
    };

    const getStatusMessage = (): string => {
        switch (bookingStatus) {
            case 'pending_driver':
                return 'Waiting for driver approval...';
            case 'confirmed':
                if (rideStatus === 'active') return 'Ride in progress!';
                return 'Booking confirmed! Awaiting ride.';
            case 'completed':
                return 'Ride completed successfully!';
            case 'declined':
                return 'Request was declined by the driver.';
            case 'cancelled_by_rider':
                return 'You cancelled this booking.';
            case 'cancelled_by_driver':
                return 'The driver cancelled this ride.';
            case 'expired':
                return 'Booking expired - no driver response.';
            case 'payment_failed':
                return 'Payment could not be processed.';
            case 'no_show':
                return 'Marked as no-show by driver.';
            case 'refunded':
                return 'Refund processed successfully.';
            default:
                return '';
        }
    };

    const steps = getSteps();

    const getStepColor = (status: Step['status']) => {
        switch (status) {
            case 'completed':
                return colors.success || '#34C759';
            case 'active':
                return colors.primary;
            case 'error':
                return colors.error || '#FF3B30';
            default:
                return colors.borderLight;
        }
    };

    const getIconColor = (status: Step['status']) => {
        if (status === 'pending') return colors.textSecondary;
        return '#FFFFFF';
    };

    const styles = createStyles(colors, compact);

    return (
        <View style={styles.container}>
            {/* Steps Row */}
            <View style={styles.stepsContainer}>
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        {/* Step Circle */}
                        <View style={styles.stepWrapper}>
                            <View
                                style={[
                                    styles.stepCircle,
                                    {
                                        backgroundColor: getStepColor(step.status),
                                        borderColor: step.status === 'pending' ? colors.border : 'transparent',
                                        borderWidth: step.status === 'pending' ? 2 : 0,
                                    },
                                ]}
                            >
                                <step.icon
                                    size={compact ? 12 : 16}
                                    color={getIconColor(step.status)}
                                />
                            </View>
                            {showLabels && (
                                <Text
                                    style={[
                                        styles.stepLabel,
                                        {
                                            color: step.status === 'pending'
                                                ? colors.textSecondary
                                                : step.status === 'error'
                                                    ? colors.error || '#FF3B30'
                                                    : colors.text,
                                            fontWeight: step.status === 'active' ? '600' : '400',
                                        },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {step.label}
                                </Text>
                            )}
                        </View>

                        {/* Connector Line */}
                        {index < steps.length - 1 && (
                            <View
                                style={[
                                    styles.connector,
                                    {
                                        backgroundColor:
                                            step.status === 'completed'
                                                ? (colors.success || '#34C759')
                                                : step.status === 'error'
                                                    ? (colors.error || '#FF3B30')
                                                    : colors.borderLight,
                                    },
                                ]}
                            />
                        )}
                    </React.Fragment>
                ))}
            </View>

            {/* Status Message */}
            <View style={styles.messageContainer}>
                <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
                    {getStatusMessage()}
                </Text>
            </View>
        </View>
    );
};

const createStyles = (colors: any, compact: boolean) =>
    StyleSheet.create({
        container: {
            paddingVertical: compact ? 8 : 16,
        },
        stepsContainer: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'center',
        },
        stepWrapper: {
            alignItems: 'center',
            maxWidth: compact ? 50 : 70,
        },
        stepCircle: {
            width: compact ? 28 : 36,
            height: compact ? 28 : 36,
            borderRadius: compact ? 14 : 18,
            justifyContent: 'center',
            alignItems: 'center',
        },
        stepLabel: {
            fontSize: compact ? 10 : 11,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 14,
        },
        connector: {
            height: 3,
            flex: 1,
            marginTop: compact ? 12 : 16,
            marginHorizontal: 4,
            borderRadius: 2,
        },
        messageContainer: {
            marginTop: 12,
            alignItems: 'center',
        },
        statusMessage: {
            fontSize: 13,
            textAlign: 'center',
            fontStyle: 'italic',
        },
    });

export default BookingStatusTimeline;
