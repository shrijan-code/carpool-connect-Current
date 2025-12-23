/**
 * UserBadges - Display achievement badges for users
 * Shows: ID Verified, Top-Rated, Experienced
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ShieldCheck, Star, Car, Award } from 'lucide-react-native';
import { User } from '@/types';

interface Badge {
    id: string;
    label: string;
    icon: React.FC<{ size: number; color: string }>;
    color: string;
    bgColor: string;
}

interface UserBadgesProps {
    user: User;
    size?: 'small' | 'medium' | 'large';
    showLabels?: boolean;
    maxBadges?: number;
    onBadgePress?: (badge: Badge) => void;
}

// Badge definitions
const BADGE_DEFINITIONS: Record<string, Omit<Badge, 'id'>> = {
    id_verified: {
        label: 'ID Verified',
        icon: ShieldCheck,
        color: '#007AFF',
        bgColor: '#007AFF20',
    },
    top_rated: {
        label: 'Top Rated',
        icon: Star,
        color: '#FF9500',
        bgColor: '#FF950020',
    },
    experienced: {
        label: 'Experienced',
        icon: Car,
        color: '#34C759',
        bgColor: '#34C75920',
    },
    premium: {
        label: 'Premium',
        icon: Award,
        color: '#AF52DE',
        bgColor: '#AF52DE20',
    },
};

/**
 * Calculate which badges a user has earned
 */
function calculateBadges(user: User): Badge[] {
    const badges: Badge[] = [];

    // ID Verified badge (via Stripe Identity)
    if (user.verification?.status === 'verified') {
        badges.push({
            id: 'id_verified',
            ...BADGE_DEFINITIONS.id_verified,
        });
    }

    // Top Rated badge (4.8+ rating with 10+ reviews)
    const rating = user.ratingAsDriver || user.ratingAsRider || user.rating || 0;
    const reviewCount = user.totalDriverReviews || user.totalRiderReviews || user.totalReviews || 0;

    if (rating >= 4.8 && reviewCount >= 10) {
        badges.push({
            id: 'top_rated',
            ...BADGE_DEFINITIONS.top_rated,
        });
    }

    // Experienced badge (50+ completed rides)
    if ((user.totalRides || 0) >= 50) {
        badges.push({
            id: 'experienced',
            ...BADGE_DEFINITIONS.experienced,
        });
    }

    return badges;
}

export const UserBadges: React.FC<UserBadgesProps> = ({
    user,
    size = 'medium',
    showLabels = true,
    maxBadges = 3,
    onBadgePress,
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors, size);

    const badges = calculateBadges(user).slice(0, maxBadges);

    if (badges.length === 0) return null;

    const iconSize = size === 'small' ? 12 : size === 'medium' ? 16 : 20;

    return (
        <View style={styles.container}>
            {badges.map((badge) => (
                <TouchableOpacity
                    key={badge.id}
                    style={[styles.badge, { backgroundColor: badge.bgColor }]}
                    onPress={() => onBadgePress?.(badge)}
                    disabled={!onBadgePress}
                    activeOpacity={onBadgePress ? 0.7 : 1}
                >
                    <badge.icon size={iconSize} color={badge.color} />
                    {showLabels && (
                        <Text style={[styles.label, { color: badge.color }]}>
                            {badge.label}
                        </Text>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );
};

/**
 * Single badge component for inline use
 */
export const SingleBadge: React.FC<{
    badgeId: keyof typeof BADGE_DEFINITIONS;
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
}> = ({ badgeId, size = 'medium', showLabel = false }) => {
    const { colors } = useTheme();
    const badgeDef = BADGE_DEFINITIONS[badgeId];

    if (!badgeDef) return null;

    const iconSize = size === 'small' ? 12 : size === 'medium' ? 16 : 20;
    const fontSize = size === 'small' ? 10 : size === 'medium' ? 11 : 13;
    const padding = size === 'small' ? 4 : size === 'medium' ? 6 : 8;

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: badgeDef.bgColor,
                paddingHorizontal: padding + 2,
                paddingVertical: padding,
                borderRadius: 6,
                gap: 4,
            }}
        >
            <badgeDef.icon size={iconSize} color={badgeDef.color} />
            {showLabel && (
                <Text style={{ fontSize, fontWeight: '600', color: badgeDef.color }}>
                    {badgeDef.label}
                </Text>
            )}
        </View>
    );
};

const createStyles = (colors: any, size: 'small' | 'medium' | 'large') =>
    StyleSheet.create({
        container: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: size === 'small' ? 4 : 6,
        },
        badge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: size === 'small' ? 6 : size === 'medium' ? 8 : 10,
            paddingVertical: size === 'small' ? 3 : size === 'medium' ? 5 : 7,
            borderRadius: 6,
            gap: 4,
        },
        label: {
            fontSize: size === 'small' ? 10 : size === 'medium' ? 11 : 13,
            fontWeight: '600',
        },
    });

export default UserBadges;
