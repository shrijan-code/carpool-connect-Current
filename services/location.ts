import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { Location as LocationType } from '@/types';

export class LocationService {
  // Request location permissions
  static async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }

  // Get current location
  static async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Get current location error:', error);
      return null;
    }
  }

  // Reverse geocoding - get address from coordinates
  static async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses.length > 0) {
        const address = addresses[0];
        return `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
      }
      return 'Unknown location';
    } catch (error) {
      console.error('Reverse geocode error:', error);
      return 'Unknown location';
    }
  }

  // Forward geocoding - get coordinates from address
  static async geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const locations = await Location.geocodeAsync(address);
      if (locations.length > 0) {
        return {
          latitude: locations[0].latitude,
          longitude: locations[0].longitude,
        };
      }
      return null;
    } catch (error) {
      console.error('Geocode error:', error);
      return null;
    }
  }

  // Calculate distance between two points (Haversine formula)
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Search for nearby rides based on location
  static async findNearbyRides(
    userLocation: { latitude: number; longitude: number },
    maxDistance: number = 50 // km
  ): Promise<LocationType[]> {
    // This would typically integrate with Google Places API or similar
    // For now, return mock data
    return [
      {
        id: '1',
        name: 'Downtown',
        address: 'Downtown Area',
        latitude: userLocation.latitude + 0.01,
        longitude: userLocation.longitude + 0.01,
      },
      {
        id: '2',
        name: 'Airport',
        address: 'International Airport',
        latitude: userLocation.latitude + 0.05,
        longitude: userLocation.longitude + 0.05,
      },
    ];
  }

  // Get route between two points
  static async getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<{
    distance: string;
    duration: string;
    polyline: string;
  } | null> {
    try {
      // This would integrate with Google Directions API
      // For now, return calculated distance and estimated duration
      const distance = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );
      
      const duration = Math.round((distance / 60) * 60); // Assuming 60 km/h average speed
      
      return {
        distance: `${distance.toFixed(1)} km`,
        duration: `${duration} min`,
        polyline: '', // Would contain encoded polyline from Google
      };
    } catch (error) {
      console.error('Get route error:', error);
      return null;
    }
  }
}