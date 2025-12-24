/**
 * Rides Near Me Quick Search Component
 * One-tap button that uses GPS to find nearby rides
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    Alert,
} from 'react-native';
import { MapPin, Navigation, RefreshCw, ChevronRight } from 'lucide-react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { RidesService } from '@/services/rides';
import { Colors } from '@/constants/colors';
import { Ride } from '@/types';
import { formatDistance } from '@/utils/haversine';

interface RidesNearMeProps {
    onRideSelect?: (ride: Ride) => void;
    maxResults?: number;
    radiusKm?: number;
}

export const RidesNearMe: React.FC<RidesNearMeProps> = ({
    onRideSelect,
    maxResults = 10,
    radiusKm = 10,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [rides, setRides] = useState<(Ride & { distanceFromUser?: number })[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const searchNearbyRides = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Request location permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location permission required');
                Alert.alert(
                    'Location Required',
                    'Please enable location access to find rides near you.',
                    [{ text: 'OK' }]
                );
                return;
            }

            // Get current location
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;

            // Search for nearby rides using geohash-optimized query
            const nearbyRides = await RidesService.getNearbyRides(
                latitude,
                longitude,
                radiusKm,
                maxResults
            );

            setRides(nearbyRides as (Ride & { distanceFromUser?: number })[]);
            setHasSearched(true);

            if (nearbyRides.length === 0) {
                setError(`No rides found within ${radiusKm}km`);
            }
        } catch (err) {
            console.error('Error searching nearby rides:', err);
            setError('Failed to search for rides');
        } finally {
            setIsLoading(false);
        }
    }, [radiusKm, maxResults]);

    const handleRidePress = (ride: Ride) => {
        if (onRideSelect) {
            onRideSelect(ride);
        } else {
            router.push({
                pathname: '/ride-details',
                params: { id: ride.id },
            });
        }
    };

    const formatRideTime = (departureTime: string) => {
        const date = new Date(departureTime);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays === 0) {
            return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        }
    };

    const RideItem = ({ ride }: { ride: Ride & { distanceFromUser?: number } }) => {
        const origin = ride.from || ride.origin;
        const destination = ride.to || ride.destination;
        const distance = ride.distanceFromUser;

        return (
            <TouchableOpacity
                style={styles.rideCard}
                onPress={() => handleRidePress(ride)}
                activeOpacity={0.7}
            >
                <View style={styles.rideHeader}>
                    {distance !== undefined && (
                        <View style={styles.distanceBadge}>
                            <Navigation size={12} color={Colors.primary} />
                            <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
                        </View>
                    )}
                    <Text style={styles.rideTime}>{formatRideTime(ride.departureTime)}</Text>
                </View>

                <View style={styles.rideRoute}>
                    <View style={styles.routePoint}>
                        <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                        <Text style={styles.locationText} numberOfLines={1}>
                            {origin?.name || origin?.address || 'Unknown'}
                        </Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routePoint}>
                        <View style={[styles.dot, { backgroundColor: Colors.error }]} />
                        <Text style={styles.locationText} numberOfLines={1}>
                            {destination?.name || destination?.address || 'Unknown'}
                        </Text>
                    </View>
                </View>

                <View style={styles.rideFooter}>
                    <Text style={styles.price}>
                        ${((ride.pricePerSeat || 0) / 100).toFixed(2)}/seat
                    </Text>
                    <Text style={styles.seats}>
                        {ride.seatsAvailable || ride.availableSeats || 0} seats left
                    </Text>
                    <ChevronRight size={16} color={Colors.textSecondary} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Search Button */}
            <TouchableOpacity
                style={[styles.searchButton, isLoading && styles.searchButtonDisabled]}
                onPress={searchNearbyRides}
                disabled={isLoading}
                activeOpacity={0.8}
            >
                {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <>
                        <MapPin size={20} color="#fff" />
                        <Text style={styles.searchButtonText}>
                            {hasSearched ? 'Refresh' : 'Find Rides Near Me'}
                        </Text>
                        {hasSearched && <RefreshCw size={16} color="#fff" />}
                    </>
                )}
            </TouchableOpacity>

            {/* Results */}
            {hasSearched && (
                <View style={styles.resultsContainer}>
                    {error ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>{error}</Text>
                            <Text style={styles.emptyHint}>
                                Try increasing the search radius or check back later
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.resultsTitle}>
                                {rides.length} ride{rides.length !== 1 ? 's' : ''} within {radiusKm}km
                            </Text>
                            <FlatList
                                data={rides}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => <RideItem ride={item} />}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.listContent}
                            />
                        </>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 12,
        gap: 10,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    searchButtonDisabled: {
        opacity: 0.7,
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    resultsContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    resultsTitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 12,
    },
    listContent: {
        paddingBottom: 24,
    },
    rideCard: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    rideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    distanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primaryLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    distanceText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
    },
    rideTime: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    rideRoute: {
        marginBottom: 12,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    routeLine: {
        width: 1,
        height: 16,
        backgroundColor: Colors.border,
        marginLeft: 3,
        marginVertical: 2,
    },
    locationText: {
        flex: 1,
        fontSize: 14,
        color: Colors.text,
    },
    rideFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: 12,
        gap: 12,
    },
    price: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.success,
    },
    seats: {
        flex: 1,
        fontSize: 12,
        color: Colors.textSecondary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: Colors.textLight,
        textAlign: 'center',
    },
});

export default RidesNearMe;
