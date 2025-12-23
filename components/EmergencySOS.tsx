/**
 * EmergencySOS - Floating SOS button for active rides
 * Long-press to activate, calls emergency services and shares location
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Alert,
    Linking,
    Platform,
    Vibration,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/auth-store';
import { Phone, AlertTriangle, Share2, X, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface EmergencyContact {
    id: string;
    name: string;
    phone: string;
    relationship: string;
    isPrimary?: boolean;
}

interface EmergencySOSProps {
    rideId: string;
    visible?: boolean;
}

const LONG_PRESS_DURATION = 2000; // 2 seconds for safety

export const EmergencySOS: React.FC<EmergencySOSProps> = ({
    rideId,
    visible = true,
}) => {
    const { colors } = useTheme();
    const { user } = useAuthStore();
    const styles = createStyles(colors);

    const [isActivated, setIsActivated] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [holdProgress, setHoldProgress] = useState(0);
    const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    // Pulse animation for SOS button
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    // Load emergency contacts
    useEffect(() => {
        const loadContacts = async () => {
            if (!user?.id) return;
            try {
                const contactsRef = collection(db, 'emergency_contacts');
                const q = query(contactsRef, where('userId', '==', user.id));
                const snapshot = await getDocs(q);
                const contacts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                })) as EmergencyContact[];
                setEmergencyContacts(contacts);
            } catch (error) {
                console.error('Failed to load emergency contacts:', error);
            }
        };
        loadContacts();
    }, [user?.id]);

    // Get current location
    const getCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                return null;
            }
            const location = await Location.getCurrentPositionAsync({});
            return {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            };
        } catch (error) {
            console.error('Failed to get location:', error);
            return null;
        }
    };

    const generateLocationLink = (lat: number, lng: number) => {
        return `https://maps.google.com/maps?q=${lat},${lng}`;
    };

    const handlePressIn = () => {
        setIsHolding(true);
        Vibration.vibrate(50);

        // Start progress animation
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: LONG_PRESS_DURATION,
            useNativeDriver: false,
        }).start();

        // Track hold progress
        let progress = 0;
        holdTimer.current = setInterval(() => {
            progress += 100 / (LONG_PRESS_DURATION / 100);
            setHoldProgress(Math.min(progress, 100));
        }, 100);

        // Trigger after hold duration
        setTimeout(async () => {
            if (holdTimer.current) {
                clearInterval(holdTimer.current);
                holdTimer.current = null;
            }

            // Get location before activating
            const location = await getCurrentLocation();
            setCurrentLocation(location);

            setIsActivated(true);
            setIsHolding(false);
            Vibration.vibrate([0, 200, 100, 200]); // Alert pattern
        }, LONG_PRESS_DURATION);
    };

    const handlePressOut = () => {
        if (!isActivated) {
            // Cancelled before full hold
            setIsHolding(false);
            setHoldProgress(0);
            progressAnim.setValue(0);

            if (holdTimer.current) {
                clearInterval(holdTimer.current);
                holdTimer.current = null;
            }
        }
    };

    const handleCallEmergency = () => {
        Alert.alert(
            '🚨 Call Emergency Services?',
            'This will call 000 (Australian Emergency). Only use for genuine emergencies.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Call 000',
                    style: 'destructive',
                    onPress: () => Linking.openURL('tel:000'),
                },
            ]
        );
    };

    const handleShareLocation = async () => {
        const location = currentLocation || await getCurrentLocation();

        if (!location) {
            Alert.alert('Location Unavailable', 'Could not get your current location.');
            return;
        }

        const link = generateLocationLink(location.lat, location.lng);
        const message = `🚨 EMERGENCY: I may need help. My current location: ${link}\n\nRide ID: ${rideId}\n- Sent from CarpoolConnect`;

        if (emergencyContacts.length === 0) {
            Alert.alert(
                'No Emergency Contacts',
                'Please add emergency contacts in your safety settings.',
                [{ text: 'OK' }]
            );
            return;
        }

        // Send to primary contact or first contact
        const primaryContact = emergencyContacts.find(c => c.isPrimary) || emergencyContacts[0];

        const smsUrl = Platform.OS === 'ios'
            ? `sms:${primaryContact.phone}&body=${encodeURIComponent(message)}`
            : `sms:${primaryContact.phone}?body=${encodeURIComponent(message)}`;

        try {
            await Linking.openURL(smsUrl);
        } catch (error) {
            Alert.alert('Error', 'Could not open SMS app');
        }
    };

    const handleDeactivate = () => {
        setIsActivated(false);
        setHoldProgress(0);
        progressAnim.setValue(0);
    };

    if (!visible) return null;

    // Show emergency action panel when activated
    if (isActivated) {
        return (
            <View style={styles.activatedContainer}>
                <View style={styles.activatedPanel}>
                    <View style={styles.activatedHeader}>
                        <AlertTriangle size={24} color={colors.error || '#FF3B30'} />
                        <Text style={[styles.activatedTitle, { color: colors.text }]}>
                            Emergency Mode Active
                        </Text>
                        <TouchableOpacity onPress={handleDeactivate} style={styles.closeButton}>
                            <X size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {currentLocation && (
                        <View style={styles.locationInfo}>
                            <MapPin size={16} color={colors.primary} />
                            <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                                Location captured
                            </Text>
                        </View>
                    )}

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.emergencyCallButton]}
                            onPress={handleCallEmergency}
                        >
                            <Phone size={24} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Call 000</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.shareButton, { backgroundColor: colors.primary }]}
                            onPress={handleShareLocation}
                        >
                            <Share2 size={24} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Share Location</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                        Your location will be shared with your emergency contacts
                    </Text>
                </View>
            </View>
        );
    }

    // Show floating SOS button
    return (
        <Animated.View
            style={[
                styles.floatingButton,
                {
                    transform: [{ scale: isHolding ? 1.2 : pulseAnim }],
                },
            ]}
        >
            <TouchableOpacity
                style={styles.sosButton}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
            >
                <View style={styles.sosInner}>
                    {isHolding && (
                        <Animated.View
                            style={[
                                styles.progressRing,
                                {
                                    borderColor: '#FFFFFF',
                                    borderRightColor: 'transparent',
                                    transform: [
                                        {
                                            rotate: progressAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0deg', '360deg'],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                    )}
                    <Text style={styles.sosText}>SOS</Text>
                </View>
            </TouchableOpacity>
            <Text style={styles.holdHint}>Hold for help</Text>
        </Animated.View>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        floatingButton: {
            position: 'absolute',
            bottom: 100,
            right: 20,
            alignItems: 'center',
            zIndex: 1000,
        },
        sosButton: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#FF3B30',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#FF3B30',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
        },
        sosInner: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#FF3B30',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.3)',
        },
        sosText: {
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '800',
        },
        progressRing: {
            position: 'absolute',
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: 3,
        },
        holdHint: {
            marginTop: 4,
            fontSize: 10,
            color: colors.textSecondary,
            fontWeight: '500',
        },
        activatedContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
        },
        activatedPanel: {
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 10,
        },
        activatedHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
        },
        activatedTitle: {
            fontSize: 18,
            fontWeight: '700',
            marginLeft: 10,
            flex: 1,
        },
        closeButton: {
            padding: 8,
        },
        locationInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background,
            padding: 10,
            borderRadius: 8,
            marginBottom: 16,
            gap: 8,
        },
        locationText: {
            fontSize: 13,
        },
        actionButtons: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 12,
        },
        actionButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            borderRadius: 12,
            gap: 8,
        },
        emergencyCallButton: {
            backgroundColor: '#FF3B30',
        },
        shareButton: {},
        actionButtonText: {
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: '600',
        },
        helpText: {
            fontSize: 12,
            textAlign: 'center',
        },
    });

export default EmergencySOS;
