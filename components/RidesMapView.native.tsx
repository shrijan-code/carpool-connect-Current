import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Linking, StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ride } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { LocationService } from '@/services/location';

interface RidesMapProps {
  rides: Ride[];
  userLocation?: { latitude: number; longitude: number } | null;
  onRideSelect?: (rideId: string) => void;
}

type Coord = { latitude: number; longitude: number };

const RidesMapView: React.FC<RidesMapProps> = (props) => {
  const { rides, userLocation: propUserLocation } = props;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const getLocation = useCallback(async (): Promise<Coord | null> => {
    try {
      const native = await LocationService.getCurrentLocation();
      return native ? { latitude: native.latitude, longitude: native.longitude } : null;
    } catch (e) {
      console.log('Location error', e);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!propUserLocation) {
      void getLocation().then((coord) => {
        if (!coord) {
          setErrorText('Unable to fetch your location. Showing nearby rides.');
        }
      }).catch((e) => {
        console.log('getLocation error', e);
        setErrorText('Location error. Showing nearby rides.');
      });
    }
  }, [getLocation, propUserLocation]);

  const handleOpenRide = useCallback((rideId?: string) => {
    if (!rideId) return;
    if (props.onRideSelect) {
      props.onRideSelect(rideId);
    } else {
      router.push({ pathname: '/ride-details', params: { id: rideId } });
    }
  }, [props]);

  return (
    <View style={styles.container} testID="rides-map-container-native">
      {errorText && (
        <Text style={styles.errorText} numberOfLines={2} testID="rides-map-error">{errorText}</Text>
      )}
      <ScrollView style={styles.nativeList} contentContainerStyle={{ padding: 12 }} testID="rides-map-native-list">
        <Text style={styles.nativeHeader}>Nearby rides</Text>
        {rides.length === 0 ? (
          <Text style={styles.nativeEmpty}>No rides to display.</Text>
        ) : (
          rides.filter(ride => ride != null && ride.id).map((ride) => {
            const lat = ride.origin?.latitude ?? ride.from?.latitude;
            const lng = ride.origin?.longitude ?? ride.from?.longitude;
            const hasCoords = typeof lat === 'number' && typeof lng === 'number';
            const title = `${ride.from?.name || ride.origin?.name || 'Origin'} → ${ride.to?.name || ride.destination?.name || 'Destination'}`;
            const price = typeof ride.pricePerSeat === 'number' ? (ride.pricePerSeat / 100).toFixed(2) : '—';
            const gmaps = hasCoords ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : undefined;
            return (
              <View key={`ride-native-${ride.id}`} style={styles.nativeItem} testID={`ride-item-${ride.id}`}>
                <TouchableOpacity onPress={() => handleOpenRide(ride.id)} testID={`ride-open-${ride.id}`}>
                  <Text style={styles.calloutTitle} numberOfLines={2}>{title}</Text>
                  <Text style={styles.calloutSubtitle}>{ride.departureTime || ride.departureAt || ''}</Text>
                  <Text style={styles.calloutPrice}>${price} per seat</Text>
                </TouchableOpacity>
                {hasCoords && (
                  <TouchableOpacity onPress={() => Linking.openURL(gmaps!)} style={styles.nativeLinkBtn} testID={`ride-maplink-${ride.id}`}>
                    <Text style={styles.nativeLinkText}>Open in Google Maps</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    position: 'absolute',
    zIndex: 2,
    top: 8,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
    color: colors.textSecondary,
    borderRadius: 12,
    fontSize: 12,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.text,
  },
  calloutSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  calloutPrice: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 6,
    fontWeight: '600' as const,
  },
  nativeList: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  nativeHeader: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 8,
  },
  nativeEmpty: {
    color: colors.textSecondary,
  },
  nativeItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nativeLinkBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nativeLinkText: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
});

export default RidesMapView;
