import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { AlertCircle, CreditCard, Check, ChevronLeft, MapPin, Calendar } from 'lucide-react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuthStore } from '@/store/auth-store';
import { Colors } from '@/constants/colors';

interface OutstandingBooking {
    id: string;
    rideId: string;
    amount: number;
    seats: number;
    createdAt: string;
    failureReason: string;
    ride: {
        origin: string;
        destination: string;
        departureTime: string | null;
    } | null;
}

interface BalanceData {
    hasOutstandingBalance: boolean;
    totalAmount: number;
    totalAmountFormatted: string;
    bookingCount: number;
    bookings: OutstandingBooking[];
}

export default function SettleBalanceScreen() {
    const { user } = useAuthStore();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadBalance = useCallback(async () => {
        try {
            setError(null);
            const getBalance = httpsCallable(functions, 'getOutstandingBalance');
            const result = await getBalance({});
            const data = result.data as BalanceData;
            setBalanceData(data);
        } catch (err: any) {
            console.error('Failed to load balance:', err);
            setError(err.message || 'Failed to load outstanding balance');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadBalance();
    }, [loadBalance]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadBalance();
    }, [loadBalance]);

    const handlePayNow = async () => {
        if (!balanceData?.hasOutstandingBalance) return;

        setProcessing(true);
        try {
            // Create payment intent for settlement
            const createIntent = httpsCallable(functions, 'createPaymentIntent');
            const intentResult = await createIntent({
                amount: balanceData.totalAmount,
                type: 'balance_settlement',
            });

            const { clientSecret, paymentIntentId } = intentResult.data as any;

            // Initialize and present payment sheet
            const { error: initError } = await initPaymentSheet({
                paymentIntentClientSecret: clientSecret,
                merchantDisplayName: 'CarpoolConnect',
                allowsDelayedPaymentMethods: false,
            });

            if (initError) {
                throw new Error(initError.message);
            }

            const { error: presentError } = await presentPaymentSheet();

            if (presentError) {
                if (presentError.code === 'Canceled') {
                    // User cancelled, don't show error
                    return;
                }
                throw new Error(presentError.message);
            }

            // Payment succeeded - settle the balance
            const settleBalance = httpsCallable(functions, 'settleOutstandingBalance');
            const settleResult = await settleBalance({ paymentIntentId });
            const result = settleResult.data as any;

            if (result.success) {
                Alert.alert(
                    'Payment Successful! ✅',
                    `Your outstanding balance of ${balanceData.totalAmountFormatted} has been settled. You can now book rides again.`,
                    [
                        { text: 'OK', onPress: () => router.back() }
                    ]
                );
            }
        } catch (err: any) {
            console.error('Payment failed:', err);
            Alert.alert('Payment Failed', err.message || 'Failed to process payment. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-AU', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return 'N/A';
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading balance...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Outstanding Balance</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {error ? (
                    <View style={styles.errorContainer}>
                        <AlertCircle size={48} color={Colors.error} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={loadBalance}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : !balanceData?.hasOutstandingBalance ? (
                    <View style={styles.successContainer}>
                        <View style={styles.successIcon}>
                            <Check size={48} color="#22C55E" />
                        </View>
                        <Text style={styles.successTitle}>All Clear! ✅</Text>
                        <Text style={styles.successText}>
                            You don't have any outstanding balance. You're free to book rides!
                        </Text>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => router.replace('/(tabs)/search')}
                        >
                            <Text style={styles.primaryButtonText}>Find a Ride</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Balance Summary Card */}
                        <View style={styles.balanceCard}>
                            <View style={styles.balanceHeader}>
                                <AlertCircle size={24} color="#DC2626" />
                                <Text style={styles.balanceLabel}>Outstanding Balance</Text>
                            </View>
                            <Text style={styles.balanceAmount}>{balanceData.totalAmountFormatted}</Text>
                            <Text style={styles.balanceSubtext}>
                                From {balanceData.bookingCount} unpaid booking{balanceData.bookingCount > 1 ? 's' : ''}
                            </Text>
                        </View>

                        {/* Info Card */}
                        <View style={styles.infoCard}>
                            <Text style={styles.infoTitle}>Why do I have a balance?</Text>
                            <Text style={styles.infoText}>
                                This balance is from bookings where payment couldn't be processed. This may be due to:
                            </Text>
                            <Text style={styles.infoListItem}>• Late cancellation fees (less than 24h notice)</Text>
                            <Text style={styles.infoListItem}>• Payment method issues at ride completion</Text>
                            <Text style={styles.infoListItem}>• Expired payment authorization</Text>
                        </View>

                        {/* Booking Details */}
                        <Text style={styles.sectionTitle}>Booking Details</Text>
                        {balanceData.bookings.map((booking) => (
                            <View key={booking.id} style={styles.bookingCard}>
                                <View style={styles.bookingHeader}>
                                    <Text style={styles.bookingAmount}>
                                        ${(booking.amount / 100).toFixed(2)}
                                    </Text>
                                    <Text style={styles.bookingSeats}>{booking.seats} seat{booking.seats > 1 ? 's' : ''}</Text>
                                </View>

                                {booking.ride && (
                                    <View style={styles.bookingDetails}>
                                        <View style={styles.bookingRow}>
                                            <MapPin size={16} color={Colors.textLight} />
                                            <Text style={styles.bookingText}>
                                                {booking.ride.origin} → {booking.ride.destination}
                                            </Text>
                                        </View>
                                        <View style={styles.bookingRow}>
                                            <Calendar size={16} color={Colors.textLight} />
                                            <Text style={styles.bookingText}>
                                                {formatDate(booking.ride.departureTime)}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <Text style={styles.bookingReason}>{booking.failureReason}</Text>
                            </View>
                        ))}

                        {/* Pay Button */}
                        <TouchableOpacity
                            style={[styles.payButton, processing && styles.payButtonDisabled]}
                            onPress={handlePayNow}
                            disabled={processing}
                        >
                            {processing ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <CreditCard size={20} color="#FFF" />
                                    <Text style={styles.payButtonText}>
                                        Pay {balanceData.totalAmountFormatted} Now
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.disclaimer}>
                            Payment is processed securely through Stripe. After payment, you'll be able to book rides again.
                        </Text>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: Colors.textLight,
    },
    errorContainer: {
        alignItems: 'center',
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        color: Colors.error,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontWeight: '600',
    },
    successContainer: {
        alignItems: 'center',
        padding: 32,
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#DCFCE7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#166534',
        marginBottom: 8,
    },
    successText: {
        fontSize: 16,
        color: Colors.textLight,
        textAlign: 'center',
        marginBottom: 24,
    },
    primaryButton: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    balanceCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    balanceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    balanceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#991B1B',
        marginLeft: 8,
    },
    balanceAmount: {
        fontSize: 40,
        fontWeight: '700',
        color: '#DC2626',
        marginVertical: 8,
    },
    balanceSubtext: {
        fontSize: 14,
        color: '#991B1B',
    },
    infoCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E40AF',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#1E40AF',
        marginBottom: 8,
    },
    infoListItem: {
        fontSize: 14,
        color: '#1E40AF',
        marginLeft: 8,
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 12,
    },
    bookingCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    bookingAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#DC2626',
    },
    bookingSeats: {
        fontSize: 14,
        color: Colors.textLight,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    bookingDetails: {
        marginBottom: 8,
    },
    bookingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    bookingText: {
        fontSize: 14,
        color: Colors.text,
        marginLeft: 8,
        flex: 1,
    },
    bookingReason: {
        fontSize: 12,
        color: Colors.error,
        fontStyle: 'italic',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#DC2626',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 24,
        gap: 8,
    },
    payButtonDisabled: {
        opacity: 0.7,
    },
    payButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    disclaimer: {
        fontSize: 12,
        color: Colors.textLight,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 32,
    },
});
