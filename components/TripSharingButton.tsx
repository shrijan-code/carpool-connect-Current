/**
 * TripSharingButton - Share live trip with trusted contacts
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, Linking, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/auth-store';
import { Share2, Users } from 'lucide-react-native';
import { TripSharingService } from '@/services/trip-sharing';

interface TripSharingButtonProps {
    rideId: string;
    destination: string;
    compact?: boolean;
}

export const TripSharingButton: React.FC<TripSharingButtonProps> = ({
    rideId,
    destination,
    compact = false,
}) => {
    const { colors } = useTheme();
    const { user } = useAuthStore();
    const styles = createStyles(colors, compact);

    const [isLoading, setIsLoading] = useState(false);

    const handleShare = async () => {
        if (!user?.id) return;

        setIsLoading(true);
        try {
            // Generate share link
            const { shareUrl } = await TripSharingService.createShareLink(rideId, user.id);

            const message = TripSharingService.generateShareMessage(
                shareUrl,
                user.name || 'A friend',
                destination
            );

            // Show share options
            Alert.alert(
                '📍 Share Trip',
                'Choose how to share your trip link',
                [
                    {
                        text: 'SMS',
                        onPress: () => sendSMS(message),
                    },
                    {
                        text: 'WhatsApp',
                        onPress: () => sendWhatsApp(message),
                    },
                    {
                        text: 'Share...',
                        onPress: () => shareNative(message),
                    },
                    { text: 'Cancel', style: 'cancel' },
                ]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to generate share link');
        } finally {
            setIsLoading(false);
        }
    };

    const sendSMS = async (message: string) => {
        const url = Platform.OS === 'ios'
            ? `sms:&body=${encodeURIComponent(message)}`
            : `sms:?body=${encodeURIComponent(message)}`;

        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Error', 'Could not open Messages app');
        }
    };

    const sendWhatsApp = async (message: string) => {
        const url = `whatsapp://send?text=${encodeURIComponent(message)}`;

        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                Alert.alert('WhatsApp Not Installed', 'Please install WhatsApp to share via WhatsApp.');
            }
        } catch {
            Alert.alert('Error', 'Could not open WhatsApp');
        }
    };

    const shareNative = async (message: string) => {
        try {
            await Share.share({
                message,
                title: 'Share My Trip',
            });
        } catch {
            // User cancelled
        }
    };

    if (compact) {
        return (
            <TouchableOpacity
                style={styles.compactButton}
                onPress={handleShare}
                disabled={isLoading}
            >
                <Share2 size={18} color={colors.primary} />
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={styles.button}
            onPress={handleShare}
            disabled={isLoading}
        >
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Users size={20} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.text }]}>
                    Share My Trip
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Let friends track your ride live
                </Text>
            </View>
            <Share2 size={20} color={colors.primary} />
        </TouchableOpacity>
    );
};

const createStyles = (colors: any, compact: boolean) =>
    StyleSheet.create({
        button: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
        },
        compactButton: {
            padding: 10,
            backgroundColor: colors.primary + '15',
            borderRadius: 10,
        },
        iconContainer: {
            width: 40,
            height: 40,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        textContainer: {
            flex: 1,
        },
        title: {
            fontSize: 15,
            fontWeight: '600',
        },
        subtitle: {
            fontSize: 12,
            marginTop: 2,
        },
    });

export default TripSharingButton;
