/**
 * Notification Settings Screen
 * Allows users to control which notification types they receive
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/auth-store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Bell, MessageCircle, CreditCard, Clock, Gift, ChevronLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

interface NotificationPreferences {
    bookingUpdates: boolean;
    rideReminders: boolean;
    messages: boolean;
    paymentAlerts: boolean;
    promotions: boolean;
}

const defaultPreferences: NotificationPreferences = {
    bookingUpdates: true,
    rideReminders: true,
    messages: true,
    paymentAlerts: true,
    promotions: false,
};

export default function NotificationSettingsScreen() {
    const { colors } = useTheme();
    const { user } = useAuthStore();
    const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const styles = createStyles(colors);

    useEffect(() => {
        if (user?.notificationPreferences) {
            setPreferences({
                ...defaultPreferences,
                ...user.notificationPreferences,
            });
        }
    }, [user]);

    const handleToggle = (key: keyof NotificationPreferences) => {
        setPreferences(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!user) return;

        setIsLoading(true);
        try {
            await updateDoc(doc(db, 'users', user.id), {
                notificationPreferences: preferences,
                updatedAt: new Date().toISOString(),
            });

            setHasChanges(false);
            Alert.alert('Saved', 'Your notification preferences have been updated.');
        } catch (error) {
            Alert.alert('Error', 'Failed to save preferences. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const settingsItems = [
        {
            key: 'bookingUpdates' as const,
            title: 'Booking Updates',
            description: 'Confirmations, cancellations, and booking status changes',
            icon: Bell,
        },
        {
            key: 'rideReminders' as const,
            title: 'Ride Reminders',
            description: 'Reminders before your upcoming rides',
            icon: Clock,
        },
        {
            key: 'messages' as const,
            title: 'Messages',
            description: 'Chat messages from drivers and riders',
            icon: MessageCircle,
        },
        {
            key: 'paymentAlerts' as const,
            title: 'Payment Alerts',
            description: 'Payment confirmations and issues',
            icon: CreditCard,
        },
        {
            key: 'promotions' as const,
            title: 'Promotions',
            description: 'Special offers and updates from CarpoolConnect',
            icon: Gift,
        },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Stack.Screen
                options={{
                    title: 'Notifications',
                    headerStyle: { backgroundColor: colors.primary },
                    headerTintColor: colors.background,
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}
                        >
                            <ChevronLeft size={28} color={colors.background} />
                            <Text style={{ color: colors.background, fontSize: 17, marginLeft: -4, fontWeight: '500' }}>Back</Text>
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                    Choose which notifications you'd like to receive. Important security and account alerts will always be sent.
                </Text>

                <Card style={styles.settingsCard}>
                    {settingsItems.map((item, index) => (
                        <View key={item.key}>
                            <View style={styles.settingItem}>
                                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                                    <item.icon size={20} color={colors.primary} />
                                </View>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.text }]}>
                                        {item.title}
                                    </Text>
                                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                        {item.description}
                                    </Text>
                                </View>
                                <Switch
                                    value={preferences[item.key]}
                                    onValueChange={() => handleToggle(item.key)}
                                    trackColor={{ false: colors.borderLight, true: colors.primary + '80' }}
                                    thumbColor={preferences[item.key] ? colors.primary : '#f4f3f4'}
                                />
                            </View>
                            {index < settingsItems.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            )}
                        </View>
                    ))}
                </Card>

                {hasChanges && (
                    <Button
                        title={isLoading ? 'Saving...' : 'Save Changes'}
                        onPress={handleSave}
                        disabled={isLoading}
                        style={styles.saveButton}
                    />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        content: {
            flex: 1,
            padding: 16,
        },
        sectionDescription: {
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 16,
        },
        settingsCard: {
            padding: 4,
        },
        settingItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
        },
        iconContainer: {
            width: 40,
            height: 40,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        settingContent: {
            flex: 1,
            marginRight: 12,
        },
        settingTitle: {
            fontSize: 15,
            fontWeight: '500',
        },
        settingDescription: {
            fontSize: 12,
            marginTop: 2,
        },
        divider: {
            height: 1,
            marginLeft: 64,
        },
        saveButton: {
            marginTop: 24,
            marginBottom: 32,
        },
    });
