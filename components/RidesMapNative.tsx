import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ride } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { LocationService } from '@/services/location';
import { router } from 'expo-router';

interface RidesMapNativeProps {
  rides: Ride[];
}

type Coord = { latitude: number; longitude: number };

interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const DEFAULT_COORD: Coord = { latitude: 37.7749, longitude: -122.4194 };

export const RidesMapNative: React.FC<RidesMapNativeProps> = ({ rides }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const mapRef = useRef<MapView | null>(null);
  const [userCoord, setUserCoord] = useState<Coord | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [initialRegion, setInitialRegion] = useState<MapRegion>({
    latitude: DEFAULT_COORD.latitude,
    longitude: DEFAULT_COORD.longitude,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  });

  const getLocation = useCallback(async () => {
    try {
      setErrorText(null);
      const native = await LocationService.getCurrentLocation();
      const coord = native ? { latitude: native.latitude, longitude: native.longitude } : null;
      if (!coord) {
        setErrorText('Unable to fetch your location. Showing nearby rides around a default area.');
        setUserCoord(DEFAULT_COORD);
      } else {
        setUserCoord(coord);
        setInitialRegion({ latitude: coord.latitude, longitude: coord.longitude, latitudeDelta: 0.25, longitudeDelta: 0.25 });
      }
    } catch (e: any) {
      console.log('getLocation error', e);
      setErrorText('Location error. Showing default area.');
      setUserCoord(DEFAULT_COORD);
    }
  }, []);

  useEffect(() => {
    void getLocation();
  }, [getLocation]);

  useEffect(() => {
    try {
      if (!mapRef.current) return;
      const coords: Coord[] = [];
      if (userCoord) coords.push(userCoord);
      rides.forEach((r) => {
        const lat = r.origin?.latitude ?? r.from?.latitude;
        const lng = r.origin?.longitude ?? r.from?.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          coords.push({ latitude: lat, longitude: lng });
        }
      });
      if (coords.length > 1) {
        setTimeout(() => {
          try {
            mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 60, bottom: 60, left: 60, right: 60 }, animated: true });
          } catch (e) {
            console.log('fitToCoordinates failed', e);
          }
        }, 350);
      }
    } catch (e) {
      console.log('map fit error', e);
    }
  }, [rides, userCoord]);

  const handleOpenRide = useCallback((rideId?: string) => {
    if (!rideId) return;
    router.push({ pathname: '/ride-details', params: { id: rideId } });
  }, []);

  return (
    <View style={styles.container} testID="rides-map-container">
      {errorText && (
        <Text style={styles.errorText} numberOfLines={2} testID="rides-map-error">{errorText}</Text>
      )}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        testID="rides-map-view"
      >
        {userCoord && (
          <Marker coordinate={userCoord} pinColor={colors.primary} identifier="me">
            <Callout>
              <View style={{ maxWidth: 180 }}>
                <Text style={styles.calloutTitle}>You are here</Text>
              </View>
            </Callout>
          </Marker>
        )}
        {rides.map((ride) => {
          const lat = ride.origin?.latitude ?? ride.from?.latitude;
          const lng = ride.origin?.longitude ?? ride.from?.longitude;
          if (typeof lat !== 'number' || typeof lng !== 'number') return null;
          const title = `${ride.from?.name || ride.origin?.name || 'Origin'} → ${ride.to?.name || ride.destination?.name || 'Destination'}`;
          const price = typeof ride.pricePerSeat === 'number' ? (ride.pricePerSeat / 100).toFixed(2) : '—';
          return (
            <Marker key={`ride-${ride.id}`} coordinate={{ latitude: lat, longitude: lng }} identifier={ride.id}>
              <Callout onPress={() => handleOpenRide(ride.id)} tooltip={false}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle} numberOfLines={2}>{title}</Text>
                  <Text style={styles.calloutSubtitle}>{ride.departureTime || ride.departureAt || ''}</Text>
                  <Text style={styles.calloutPrice}>${price} per seat • Tap to view</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
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
  map: {
    flex: 1,
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
  callout: {
    padding: 8,
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
});
