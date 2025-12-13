import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ShieldCheck, CheckCircle, AlertCircle, Info } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { Colors } from '@/constants/colors';

export default function VerifyIdentityScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<{
        status: string;
        verifiedAt?: Date;
    } | null>(null);

    useEffect(() => {
        checkVerificationStatus();
    }, []);

    const checkVerificationStatus = async () => {
        try {
            const getStatus = httpsCallable(functions, 'getVerificationStatus');
            const result = await getStatus();
            setVerificationStatus(result.data as any);
        } catch (error) {
            console.error('Error checking verification status:', error);
        }
    };

    const handleStartVerification = async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to verify your identity');
            return;
        }

        setIsLoading(true);

        try {
            // Create verification session
            const createSession = httpsCallable(functions, 'createVerificationSession');
            const result = await createSession();
            const data = result.data as any;

            console.log('Verification session created:', {
                sessionId: data.sessionId,
                hasUrl: !!data.url,
                hasClientSecret: !!data.clientSecret
            });

            if (!data.url || typeof data.url !== 'string') {
                throw new Error('Invalid verification URL received from server');
            }

            // Validate URL format
            if (!data.url.startsWith('https://')) {
                throw new Error('Invalid URL format - must be HTTPS');
            }

            console.log('Opening verification URL:', data.url);

            // Check if we can open the URL first
            const canOpen = await Linking.canOpenURL(data.url);

            if (!canOpen) {
                throw new Error('Cannot open verification link. Please ensure you have a browser installed.');
            }

            // Open Stripe Identity verification page
            const opened = await Linking.openURL(data.url);

            // Show instructions after opening
            setTimeout(() => {
                Alert.alert(
                    'Verification Started',
                    'Complete the verification in your browser. When done, return here and tap "Check Status" to see your verification result.',
                    [{ text: 'OK' }]
                );
            }, 500);

        } catch (error: any) {
            console.error('Error starting verification:', error);

            // Provide more specific error messages
            let errorMessage = 'Failed to start verification. Please try again.';

            if (error.code === 'functions/unauthenticated') {
                errorMessage = 'You must be logged in to verify your identity.';
            } else if (error.code === 'functions/internal') {
                errorMessage = 'Server error. Please try again later or contact support.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            Alert.alert(
                'Verification Error',
                errorMessage
            );
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusDisplay = () => {
        const status = verificationStatus?.status || user?.verification?.status || 'unverified';

        switch (status) {
            case 'verified':
                return {
                    icon: CheckCircle,
                    color: '#10B981',
                    title: 'Identity Verified',
                    message: 'Your identity has been successfully verified!',
                };
            case 'pending':
                return {
                    icon: AlertCircle,
                    color: '#F59E0B',
                    title: 'Verification Pending',
                    message: 'Your verification is being processed. Tap "Check Status" to refresh.',
                };
            case 'failed':
                return {
                    icon: AlertCircle,
                    color: '#EF4444',
                    title: 'Verification Failed',
                    message: 'Verification could not be completed. Please try again with clear photos.',
                };
            default:
                return {
                    icon: ShieldCheck,
                    color: '#6B7280',
                    title: 'Verify Your Identity',
                    message: 'Build trust and stand out with a verified badge.',
                };
        }
    };

    const statusDisplay = getStatusDisplay();
    const StatusIcon = statusDisplay.icon;
    const isVerified = verificationStatus?.status === 'verified' || user?.verification?.status === 'verified';

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Identity Verification',
                    headerStyle: { backgroundColor: Colors.surface },
                    headerTintColor: Colors.text,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Status Card */}
                <View style={styles.statusCard}>
                    <StatusIcon size={48} color={statusDisplay.color} />
                    <Text style={styles.statusTitle}>
                        {statusDisplay.title}
                    </Text>
                    <Text style={styles.statusMessage}>
                        {statusDisplay.message}
                    </Text>

                    {isVerified && verificationStatus?.verifiedAt && (
                        <Text style={styles.verifiedDate}>
                            Verified on {new Date(verificationStatus.verifiedAt).toLocaleDateString()}
                        </Text>
                    )}
                </View>

                {/* Why Verify Section */}
                {!isVerified && (
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <Info size={20} color={Colors.primary} />
                            <Text style={styles.infoTitle}>
                                Why Verify?
                            </Text>
                        </View>

                        <View style={styles.benefitsList}>
                            <View style={styles.benefitItem}>
                                <CheckCircle size={16} color={Colors.primary} />
                                <Text style={styles.benefitText}>Build trust with the community</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <CheckCircle size={16} color={Colors.primary} />
                                <Text style={styles.benefitText}>Stand out with verified badge</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <CheckCircle size={16} color={Colors.primary} />
                                <Text style={styles.benefitText}>Priority customer support</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Privacy Notice */}
                <View style={styles.privacyNotice}>
                    <Info size={16} color={Colors.textSecondary} />
                    <Text style={styles.privacyText}>
                        Your information is encrypted and secure. We use Stripe Identity for verification and never store your ID photos.
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    {!isVerified && (
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleStartVerification}
                            disabled={isLoading || verificationStatus?.status === 'pending'}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    {verificationStatus?.status === 'pending' ? 'Verification Pending...' : 'Start Verification'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}

                    {verificationStatus?.status === 'pending' && (
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={checkVerificationStatus}
                        >
                            <Text style={[styles.secondaryButtonText, { color: Colors.primary }]}>
                                Check Status
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.secondaryButtonText}>
                            {isVerified ? 'Done' : 'Maybe Later'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    statusCard: {
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: Colors.surface,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    statusTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginTop: 12,
        marginBottom: 8,
        color: Colors.text,
    },
    statusMessage: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        color: Colors.textSecondary,
    },
    verifiedDate: {
        fontSize: 12,
        marginTop: 8,
        color: Colors.textSecondary,
    },
    infoCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        backgroundColor: Colors.surface,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    benefitsList: {
        gap: 12,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    benefitText: {
        fontSize: 14,
        flex: 1,
        color: Colors.text,
    },
    privacyNotice: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 8,
        gap: 8,
        marginBottom: 24,
        backgroundColor: Colors.surface,
    },
    privacyText: {
        fontSize: 12,
        flex: 1,
        lineHeight: 16,
        color: Colors.textSecondary,
    },
    buttonContainer: {
        gap: 12,
    },
    primaryButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
        backgroundColor: Colors.primary,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
});
