import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    SafeAreaView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Star, User as UserIcon, Car, MapPin, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { RatingService, PendingReview } from '@/services/rating';
import { useAuthStore } from '@/store/auth-store';
import { RatingSystem } from '@/components/RatingSystem';
import { logger } from '@/utils/logger';

interface ReviewStep {
    pendingReview: PendingReview;
    completed: boolean;
    skipped: boolean;
}

export default function RideReviewScreen() {
    const { rideId, bookingId } = useLocalSearchParams<{ rideId?: string; bookingId?: string }>();
    const { user } = useAuthStore();
    const [pendingReviews, setPendingReviews] = useState<ReviewStep[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);

    useEffect(() => {
        loadPendingReviews();
    }, [user?.id]);

    const loadPendingReviews = async () => {
        if (!user?.id) return;

        setIsLoading(true);
        try {
            let reviews = await RatingService.getPendingReviews(user.id);

            // If specific rideId/bookingId provided, filter to that ride
            if (rideId || bookingId) {
                reviews = reviews.filter(r =>
                    (rideId && r.rideId === rideId) ||
                    (bookingId && r.bookingId === bookingId)
                );
            }

            setPendingReviews(reviews.map(r => ({
                pendingReview: r,
                completed: false,
                skipped: false,
            })));
        } catch (error) {
            logger.error('Failed to load pending reviews', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitReview = async (rating: number, comment: string) => {
        if (!user?.id || currentIndex >= pendingReviews.length) return;

        const currentReview = pendingReviews[currentIndex].pendingReview;
        setIsSubmitting(true);

        try {
            if (currentReview.reviewerRole === 'rider') {
                await RatingService.submitDriverReview({
                    rideId: currentReview.rideId,
                    bookingId: currentReview.bookingId,
                    driverId: currentReview.userToReview.id,
                    riderId: user.id,
                    rating,
                    comment,
                });
            } else {
                await RatingService.submitRiderReview({
                    rideId: currentReview.rideId,
                    bookingId: currentReview.bookingId,
                    driverId: user.id,
                    riderId: currentReview.userToReview.id,
                    rating,
                    comment,
                });
            }

            // Mark as completed
            const updatedReviews = [...pendingReviews];
            updatedReviews[currentIndex].completed = true;
            setPendingReviews(updatedReviews);

            setShowRatingModal(false);
            moveToNext();
        } catch (error) {
            logger.error('Failed to submit review', error);
            Alert.alert('Error', 'Failed to submit review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = () => {
        const updatedReviews = [...pendingReviews];
        updatedReviews[currentIndex].skipped = true;
        setPendingReviews(updatedReviews);
        setShowRatingModal(false);
        moveToNext();
    };

    const moveToNext = () => {
        if (currentIndex < pendingReviews.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            // All reviews done
            showCompletionMessage();
        }
    };

    const showCompletionMessage = () => {
        const completedCount = pendingReviews.filter(r => r.completed).length;
        const message = completedCount > 0
            ? `Thank you! You submitted ${completedCount} review${completedCount > 1 ? 's' : ''}.`
            : 'No reviews submitted.';

        Alert.alert('Reviews Complete', message, [
            { text: 'Done', onPress: () => router.back() }
        ]);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading reviews...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (pendingReviews.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Reviews</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.emptyContainer}>
                    <Check size={64} color={Colors.success} />
                    <Text style={styles.emptyTitle}>All caught up!</Text>
                    <Text style={styles.emptySubtitle}>You don't have any pending reviews.</Text>
                    <Button
                        title="Go Back"
                        onPress={() => router.back()}
                        style={styles.goBackButton}
                    />
                </View>
            </SafeAreaView>
        );
    }

    const currentReview = pendingReviews[currentIndex].pendingReview;
    const roleLabel = currentReview.reviewerRole === 'rider' ? 'Driver' : 'Rider';
    const progressText = `Review ${currentIndex + 1} of ${pendingReviews.length}`;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Rate Your {roleLabel}</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Progress indicator */}
                <View style={styles.progressContainer}>
                    <Text style={styles.progressText}>{progressText}</Text>
                    <View style={styles.progressBar}>
                        {pendingReviews.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.progressDot,
                                    index === currentIndex && styles.progressDotActive,
                                    pendingReviews[index].completed && styles.progressDotCompleted,
                                    pendingReviews[index].skipped && styles.progressDotSkipped,
                                ]}
                            />
                        ))}
                    </View>
                </View>

                {/* Ride Info Card */}
                <View style={styles.rideCard}>
                    <View style={styles.routeInfo}>
                        <View style={styles.routeRow}>
                            <MapPin size={16} color={Colors.success} />
                            <Text style={styles.routeText}>{currentReview.origin}</Text>
                        </View>
                        <View style={styles.routeDivider} />
                        <View style={styles.routeRow}>
                            <MapPin size={16} color={Colors.error} />
                            <Text style={styles.routeText}>{currentReview.destination}</Text>
                        </View>
                    </View>
                    <Text style={styles.rideDate}>
                        {new Date(currentReview.rideDate).toLocaleDateString('en-AU', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                        })}
                    </Text>
                </View>

                {/* User to Review Card */}
                <View style={styles.userCard}>
                    <View style={styles.userInfo}>
                        {currentReview.userToReview.photoURL ? (
                            <Image
                                source={{ uri: currentReview.userToReview.photoURL }}
                                style={styles.userAvatar}
                            />
                        ) : (
                            <View style={styles.userAvatarPlaceholder}>
                                {currentReview.reviewerRole === 'rider' ? (
                                    <Car size={32} color={Colors.textSecondary} />
                                ) : (
                                    <UserIcon size={32} color={Colors.textSecondary} />
                                )}
                            </View>
                        )}
                        <View style={styles.userDetails}>
                            <Text style={styles.userName}>{currentReview.userToReview.name}</Text>
                            <Text style={styles.userRole}>{roleLabel}</Text>
                        </View>
                    </View>
                </View>

                {/* Rate Button */}
                <Button
                    title={`Rate ${currentReview.userToReview.name.split(' ')[0]}`}
                    onPress={() => setShowRatingModal(true)}
                    style={styles.rateButton}
                />

                {/* Skip Button */}
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Rating Modal */}
            <RatingSystem
                visible={showRatingModal}
                onClose={handleSkip}
                onSubmit={handleSubmitReview}
                title={`Rate Your ${roleLabel}`}
                subtitle={`How was your experience with ${currentReview.userToReview.name}?`}
                recipientName={currentReview.userToReview.name}
                isLoading={isSubmitting}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: Colors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    goBackButton: {
        marginTop: 24,
        minWidth: 150,
    },
    progressContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    progressText: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 12,
    },
    progressBar: {
        flexDirection: 'row',
        gap: 8,
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.border,
    },
    progressDotActive: {
        backgroundColor: Colors.primary,
        transform: [{ scale: 1.3 }],
    },
    progressDotCompleted: {
        backgroundColor: Colors.success,
    },
    progressDotSkipped: {
        backgroundColor: Colors.warning,
    },
    rideCard: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    routeInfo: {
        marginBottom: 12,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeText: {
        fontSize: 15,
        color: Colors.text,
        flex: 1,
    },
    routeDivider: {
        width: 2,
        height: 20,
        backgroundColor: Colors.border,
        marginLeft: 7,
        marginVertical: 4,
    },
    rideDate: {
        fontSize: 13,
        color: Colors.textSecondary,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: 12,
        marginTop: 4,
    },
    userCard: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    userInfo: {
        alignItems: 'center',
    },
    userAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 12,
    },
    userAvatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    userDetails: {
        alignItems: 'center',
    },
    userName: {
        fontSize: 20,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    userRole: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    rateButton: {
        marginBottom: 16,
    },
    skipButton: {
        alignItems: 'center',
        padding: 12,
    },
    skipButtonText: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
});
