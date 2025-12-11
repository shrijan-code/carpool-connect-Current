import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '@/components/ui/Card';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { Sparkles, TrendingUp, Clock, MapPin } from 'lucide-react-native';
import { Ride } from '@/types';
import { formatPrice } from '@/utils/price';
import { formatTime } from '@/utils/formatters';

interface SmartRideRecommendationsProps {
  onRidePress: (rideId: string) => void;
  onBookRide: (rideId: string, availableSeats: number) => void;
}

interface RecommendationScore {
  ride: Ride;
  score: number;
  reasons: string[];
}

export const SmartRideRecommendations = React.memo(({
  onRidePress,
  onBookRide
}: SmartRideRecommendationsProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const { searchResults, getUserBookings } = useRidesStore();

  // Memoize callbacks
  const handleRidePress = useCallback((rideId: string) => {
    onRidePress(rideId);
  }, [onRidePress]);

  const handleBookRide = useCallback((rideId: string, availableSeats: number) => {
    onBookRide(rideId, availableSeats);
  }, [onBookRide]);

  const recommendations = useMemo(() => {
    if (!user?.id) return [];

    const userBookings = getUserBookings(user.id);
    const availableRides = searchResults.filter(ride => ride.driverId !== user.id);

    const scoredRides: RecommendationScore[] = availableRides.map(ride => {
      let score = 0;
      const reasons: string[] = [];

      const fromLocation = ride.from || ride.origin;
      const toLocation = ride.to || ride.destination;

      userBookings.forEach(booking => {
        const bookingFrom = booking.ride.from || booking.ride.origin;
        const bookingTo = booking.ride.to || booking.ride.destination;

        if (fromLocation?.address.toLowerCase().includes(bookingFrom?.address.toLowerCase() || '')) {
          score += 30;
          reasons.push('Frequent pickup location');
        }

        if (toLocation?.address.toLowerCase().includes(bookingTo?.address.toLowerCase() || '')) {
          score += 30;
          reasons.push('Frequent destination');
        }
      });

      if (ride.driver?.rating && ride.driver.rating >= 4.5) {
        score += 20;
        reasons.push('Highly rated driver');
      }

      if (ride.driver?.totalReviews && ride.driver.totalReviews >= 10) {
        score += 15;
        reasons.push('Experienced driver');
      }

      const departureTime = new Date(ride.departureTime || ride.departureAt || '');
      const hour = departureTime.getHours();

      const morningCommute = hour >= 7 && hour <= 9;
      const eveningCommute = hour >= 17 && hour <= 19;

      if (morningCommute || eveningCommute) {
        score += 10;
        reasons.push('Peak commute time');
      }

      if (ride.pricePerSeat < 15) {
        score += 15;
        reasons.push('Great value');
      }

      const availableSeats = ride.availableSeats || ride.seatsAvailable || 0;
      if (availableSeats >= 2) {
        score += 10;
        reasons.push('Multiple seats available');
      }

      if (ride.vehicle) {
        score += 5;
        reasons.push('Vehicle details verified');
      }

      return { ride, score, reasons: reasons.slice(0, 3) };
    });

    return scoredRides
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [user?.id, searchResults, getUserBookings]);

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors.gradient.cyberpunk}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Sparkles size={24} color={colors.background} />
            <View>
              <Text style={styles.headerTitle}>Smart Picks</Text>
              <Text style={styles.headerSubtitle}>Personalized for you</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <TrendingUp size={14} color={colors.background} />
            <Text style={styles.badgeText}>{recommendations.length}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {recommendations.map((item, index) => (
          <View key={item.ride.id || `rec-${index}`} style={styles.recommendationCard}>
            <Card style={styles.card}>
              <View style={styles.scoreContainer}>
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={styles.scoreBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Sparkles size={12} color={colors.background} />
                  <Text style={styles.scoreText}>{item.score}% Match</Text>
                </LinearGradient>
              </View>

              <View style={styles.rideInfo}>
                <View style={styles.locationRow}>
                  <MapPin size={14} color={colors.primary} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.ride.from?.name || item.ride.origin?.name}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <MapPin size={14} color={colors.secondary} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.ride.to?.name || item.ride.destination?.name}
                  </Text>
                </View>
              </View>

              <View style={styles.reasonsContainer}>
                {item.reasons.map((reason, idx) => (
                  <View key={idx} style={styles.reasonChip}>
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.priceRow}>
                <View style={styles.priceInfo}>
                  <Text style={styles.priceLabel}>Price per seat</Text>
                  <Text style={styles.priceValue}>{formatPrice(item.ride.pricePerSeat)}</Text>
                </View>
                <View style={styles.timeInfo}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text style={styles.timeText}>
                    {formatTime(item.ride.departureTime || item.ride.departureAt || '')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => handleRidePress(item.ride.id)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={colors.gradient.cyberpunk}
                  style={styles.viewButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.viewButtonText}>View Details</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Card>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.background,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.background,
    opacity: 0.9,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 16,
  },
  recommendationCard: {
    width: 300,
  },
  card: {
    padding: 16,
  },
  scoreContainer: {
    marginBottom: 12,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.background,
  },
  rideInfo: {
    marginBottom: 12,
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.text,
    flex: 1,
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reasonChip: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  reasonText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500' as const,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceInfo: {
    gap: 2,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  viewButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.background,
  },
});
