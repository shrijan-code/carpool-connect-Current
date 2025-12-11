import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { haversineDistance } from '@/utils/haversine';

export interface UserPreferences {
  smokingAllowed: boolean;
  musicPreference: 'quiet' | 'low' | 'moderate' | 'loud';
  conversationLevel: 'minimal' | 'moderate' | 'chatty';
  petFriendly: boolean;
  temperaturePreference: 'cool' | 'moderate' | 'warm';
  punctualityImportance: 'flexible' | 'moderate' | 'strict';
}

export interface CompatibilityScore {
  overall: number;
  breakdown: {
    preferences: number;
    ratings: number;
    history: number;
    location: number;
  };
  reasons: string[];
}

export interface SmartMatchResult {
  rideId: string;
  driverId: string;
  compatibilityScore: CompatibilityScore;
  estimatedPickupTime: Date;
  detourDistance: number;
  priceAdjustment: number;
}

class SmartMatchingService {
  async findCompatibleRides(
    userId: string,
    fromLocation: { latitude: number; longitude: number; address: string },
    toLocation: { latitude: number; longitude: number; address: string },
    departureTime: Date,
    maxDetourKm: number = 5
  ): Promise<SmartMatchResult[]> {
    try {
      // Get user preferences and history
      const userProfile = await this.getUserProfile(userId);
      const userHistory = await this.getUserRideHistory(userId);

      // Find available rides within time window (±2 hours)
      const timeWindow = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      const startTime = new Date(departureTime.getTime() - timeWindow);
      const endTime = new Date(departureTime.getTime() + timeWindow);

      const ridesQuery = query(
        collection(db, 'rides'),
        where('status', '==', 'active'),
        where('availableSeats', '>', 0),
        where('departureTime', '>=', startTime),
        where('departureTime', '<=', endTime)
      );

      const ridesSnapshot = await getDocs(ridesQuery);
      const potentialMatches: SmartMatchResult[] = [];

      for (const rideDoc of ridesSnapshot.docs) {
        const ride = { id: rideDoc.id, ...rideDoc.data() };
        
        // Calculate route compatibility
        const routeCompatibility = this.calculateRouteCompatibility(
          fromLocation,
          toLocation,
          ride.fromLocation,
          ride.toLocation,
          maxDetourKm
        );

        if (routeCompatibility.isCompatible) {
          // Get driver profile and history
          const driverProfile = await this.getUserProfile(ride.driverId);
          const driverHistory = await this.getUserRideHistory(ride.driverId);

          // Calculate compatibility score
          const compatibilityScore = this.calculateCompatibilityScore(
            userProfile,
            driverProfile,
            userHistory,
            driverHistory,
            routeCompatibility
          );

          if (compatibilityScore.overall >= 0.6) { // 60% minimum compatibility
            potentialMatches.push({
              rideId: ride.id,
              driverId: ride.driverId,
              compatibilityScore,
              estimatedPickupTime: this.calculatePickupTime(
                ride.departureTime,
                routeCompatibility.detourTime
              ),
              detourDistance: routeCompatibility.detourDistance,
              priceAdjustment: this.calculatePriceAdjustment(
                compatibilityScore.overall,
                routeCompatibility.detourDistance
              )
            });
          }
        }
      }

      // Sort by compatibility score and return top matches
      return potentialMatches
        .sort((a, b) => b.compatibilityScore.overall - a.compatibilityScore.overall)
        .slice(0, 10);

    } catch (error) {
      console.error('Error finding compatible rides:', error);
      throw error;
    }
  }

  private async getUserProfile(userId: string) {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists() ? userDoc.data() : null;
  }

  private async getUserRideHistory(userId: string) {
    const historyQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', userId),
      where('status', '==', 'completed')
    );
    const historySnapshot = await getDocs(historyQuery);
    return historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  private calculateRouteCompatibility(
    userFrom: { latitude: number; longitude: number },
    userTo: { latitude: number; longitude: number },
    rideFrom: { latitude: number; longitude: number },
    rideTo: { latitude: number; longitude: number },
    maxDetourKm: number
  ) {
    // Calculate if pickup and dropoff points are within acceptable detour
    const pickupDetour = haversineDistance(
      rideFrom.latitude,
      rideFrom.longitude,
      userFrom.latitude,
      userFrom.longitude
    );

    const dropoffDetour = haversineDistance(
      rideTo.latitude,
      rideTo.longitude,
      userTo.latitude,
      userTo.longitude
    );

    const totalDetour = pickupDetour + dropoffDetour;
    const isCompatible = totalDetour <= maxDetourKm;

    return {
      isCompatible,
      detourDistance: totalDetour,
      detourTime: totalDetour * 2, // Estimate 2 minutes per km
      pickupDetour,
      dropoffDetour
    };
  }

  private calculateCompatibilityScore(
    userProfile: any,
    driverProfile: any,
    userHistory: any[],
    driverHistory: any[],
    routeCompatibility: any
  ): CompatibilityScore {
    const scores = {
      preferences: 0,
      ratings: 0,
      history: 0,
      location: 0
    };

    const reasons: string[] = [];

    // Preferences compatibility (40% weight)
    if (userProfile?.preferences && driverProfile?.preferences) {
      let prefScore = 0;
      let prefCount = 0;

      const prefKeys: (keyof UserPreferences)[] = [
        'smokingAllowed',
        'musicPreference',
        'conversationLevel',
        'petFriendly',
        'temperaturePreference',
        'punctualityImportance'
      ];

      prefKeys.forEach(key => {
        if (userProfile.preferences[key] !== undefined && driverProfile.preferences[key] !== undefined) {
          prefCount++;
          if (userProfile.preferences[key] === driverProfile.preferences[key]) {
            prefScore += 1;
            reasons.push(`Matching ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
          }
        }
      });

      scores.preferences = prefCount > 0 ? prefScore / prefCount : 0.5;
    } else {
      scores.preferences = 0.5; // Neutral if no preferences set
    }

    // Ratings compatibility (25% weight)
    const userRating = userProfile?.averageRating || 3.5;
    const driverRating = driverProfile?.averageRating || 3.5;
    
    if (userRating >= 4.0 && driverRating >= 4.0) {
      scores.ratings = 1.0;
      reasons.push('Both users have excellent ratings');
    } else if (userRating >= 3.5 && driverRating >= 3.5) {
      scores.ratings = 0.8;
      reasons.push('Both users have good ratings');
    } else {
      scores.ratings = Math.min(userRating, driverRating) / 5.0;
    }

    // History compatibility (20% weight)
    const userRideCount = userHistory.length;
    const driverRideCount = driverHistory.length;
    
    if (userRideCount >= 10 && driverRideCount >= 10) {
      scores.history = 1.0;
      reasons.push('Both users are experienced');
    } else if (userRideCount >= 5 && driverRideCount >= 5) {
      scores.history = 0.8;
      reasons.push('Both users have moderate experience');
    } else {
      scores.history = 0.6;
    }

    // Location compatibility (15% weight)
    const detourRatio = routeCompatibility.detourDistance / 10; // Normalize to 10km max
    scores.location = Math.max(0, 1 - detourRatio);
    
    if (routeCompatibility.detourDistance <= 2) {
      reasons.push('Minimal detour required');
    } else if (routeCompatibility.detourDistance <= 5) {
      reasons.push('Reasonable detour distance');
    }

    // Calculate weighted overall score
    const overall = (
      scores.preferences * 0.4 +
      scores.ratings * 0.25 +
      scores.history * 0.2 +
      scores.location * 0.15
    );

    return {
      overall,
      breakdown: scores,
      reasons
    };
  }

  private calculatePickupTime(departureTime: Date, detourMinutes: number): Date {
    return new Date(departureTime.getTime() + detourMinutes * 60 * 1000);
  }

  private calculatePriceAdjustment(compatibilityScore: number, detourDistance: number): number {
    // Higher compatibility = small discount, longer detour = small surcharge
    const compatibilityDiscount = (compatibilityScore - 0.8) * 0.1; // Max 2% discount
    const detourSurcharge = Math.min(detourDistance * 0.02, 0.15); // Max 15% surcharge
    
    return detourSurcharge - compatibilityDiscount;
  }

  async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await getDoc(userRef).then(async (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Update preferences in user document
          // This would need to be implemented with proper Firestore update
          console.log('Updating user preferences:', preferences);
        }
      });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }
}

export const smartMatchingService = new SmartMatchingService();