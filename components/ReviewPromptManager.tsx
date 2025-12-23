import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Image,
    Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Star, X, ArrowRight, Car, User as UserIcon } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { RatingService, PendingReview } from '@/services/rating';
import { useAuthStore } from '@/store/auth-store';
import { logger } from '@/utils/logger';

interface ReviewPromptManagerProps {
    // Called when all prompts are dismissed
    onComplete?: () => void;
}

/**
 * ReviewPromptManager - Shows a banner/modal prompting users to review 
 * their recent rides. Used at the app root level.
 */
export function ReviewPromptManager({ onComplete }: ReviewPromptManagerProps) {
    const { user } = useAuthStore();
    const isSignedIn = !!user;
    const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
    const [showPrompt, setShowPrompt] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);
    const slideAnim = useState(new Animated.Value(-100))[0];

    useEffect(() => {
        if (isSignedIn && user?.id && !hasChecked) {
            checkForPendingReviews();
        }
    }, [isSignedIn, user?.id, hasChecked]);

    const checkForPendingReviews = async () => {
        if (!user?.id) return;

        try {
            const reviews = await RatingService.getPendingReviews(user.id);
            if (reviews.length > 0) {
                setPendingReviews(reviews);
                setShowPrompt(true);
                // Animate in
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 9,
                }).start();
            }
            setHasChecked(true);
        } catch (error) {
            logger.error('Failed to check pending reviews', error);
            setHasChecked(true);
        }
    };

    const dismissPrompt = useCallback(() => {
        Animated.timing(slideAnim, {
            toValue: -150,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setShowPrompt(false);
            onComplete?.();
        });
    }, [slideAnim, onComplete]);

    const handleReviewNow = useCallback(() => {
        dismissPrompt();
        // Navigate to review page
        if (pendingReviews.length === 1) {
            router.push({
                pathname: '/ride-review' as any,
                params: {
                    rideId: pendingReviews[0].rideId,
                    bookingId: pendingReviews[0].bookingId,
                },
            });
        } else {
            router.push('/ride-review' as any);
        }
    }, [pendingReviews, dismissPrompt]);

    if (!showPrompt || pendingReviews.length === 0) {
        return null;
    }

    const firstReview = pendingReviews[0];
    const roleLabel = firstReview.reviewerRole === 'rider' ? 'driver' : 'rider';
    const pendingCount = pendingReviews.length;

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] }
            ]}
        >
            <View style={styles.banner}>
                <View style={styles.iconContainer}>
                    <Star size={24} color={Colors.warning} fill={Colors.warning} />
                </View>

                <View style={styles.content}>
                    <Text style={styles.title}>
                        {pendingCount === 1
                            ? `Rate your ${roleLabel}!`
                            : `${pendingCount} reviews pending`}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {pendingCount === 1
                            ? `How was your ride with ${firstReview.userToReview.name}?`
                            : `Share your experience from recent rides`}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={handleReviewNow}
                    testID="review-now-button"
                >
                    <Text style={styles.reviewButtonText}>Review</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={dismissPrompt}
                    testID="dismiss-review-prompt"
                >
                    <X size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingTop: 50, // Account for status bar
        paddingHorizontal: 12,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: `${Colors.warning}20`,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    reviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 4,
        marginRight: 8,
    },
    reviewButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textInverse,
    },
    closeButton: {
        padding: 8,
    },
});

export default ReviewPromptManager;
