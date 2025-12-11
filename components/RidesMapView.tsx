import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Linking, StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ride } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';

interface RidesMapProps {
  rides: Ride[];
  userLocation?: { latitude: number; longitude: number } | null;
  onRideSelect?: (rideId: string) => void;
}

type Coord = { latitude: number; longitude: number };

const RidesMapView: React.FC<RidesMapProps> = (props) => {
  const { rides } = props;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const getWebGeo = useCallback(async (): Promise<Coord | null> => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          },
          (err) => {
            console.log('Web geolocation error', err);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
        );
      });
    }
    return null;
  }, []);

  useEffect(() => {
    void getWebGeo().then((coord) => {
      if (!coord) {
        setErrorText('Unable to fetch your location. Showing nearby rides around a default area.');
      }
    }).catch((e) => {
      console.log('getLocation error', e);
      setErrorText('Location error. Showing default area.');
    });
  }, [getWebGeo]);

  const handleOpenRide = useCallback((rideId?: string) => {
    if (!rideId) return;
    if (props.onRideSelect) {
      props.onRideSelect(rideId);
    } else {
      router.push({ pathname: '/ride-details', params: { id: rideId } });
    }
  }, [props]);

  return (
    <View style={styles.container} testID="rides-map-container-web">
      {errorText && (
        <Text style={styles.errorText} numberOfLines={2} testID="rides-map-error">{errorText}</Text>
      )}
      <ScrollView style={styles.webList} contentContainerStyle={{ padding: 12 }} testID="rides-map-web-list">
        <Text style={styles.webHeader}>Nearby rides</Text>
        {rides.length === 0 ? (
          <Text style={styles.webEmpty}>No rides to display.</Text>
        ) : (
          rides.filter(ride => ride != null && ride.id).map((ride) => {
            const lat = ride.origin?.latitude ?? ride.from?.latitude;
            const lng = ride.origin?.longitude ?? ride.from?.longitude;
            const hasCoords = typeof lat === 'number' && typeof lng === 'number';
            const title = `${ride.from?.name || ride.origin?.name || 'Origin'} → ${ride.to?.name || ride.destination?.name || 'Destination'}`;
            const price = typeof ride.pricePerSeat === 'number' ? (ride.pricePerSeat / 100).toFixed(2) : '—';
            const gmaps = hasCoords ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : undefined;
            return (
              <View key={`ride-web-${ride.id}`} style={styles.webItem} testID={`ride-item-${ride.id}`}>
                <TouchableOpacity onPress={() => handleOpenRide(ride.id)} testID={`ride-open-${ride.id}`}>
                  <Text style={styles.calloutTitle} numberOfLines={2}>{title}</Text>
                  <Text style={styles.calloutSubtitle}>{ride.departureTime || ride.departureAt || ''}</Text>
                  <Text style={styles.calloutPrice}>${price} per seat</Text>
                </TouchableOpacity>
                {hasCoords && (
                  <TouchableOpacity onPress={() => Linking.openURL(gmaps!)} style={styles.webLinkBtn} testID={`ride-maplink-${ride.id}`}>
                    <Text style={styles.webLinkText}>Open in Google Maps</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  )
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
  webList: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  webHeader: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 8,
  },
  webEmpty: {
    color: colors.textSecondary,
  },
  webItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  webLinkBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webLinkText: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
});

export default RidesMapView;
