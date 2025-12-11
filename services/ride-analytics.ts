import { collection, query, where, orderBy, getDocs, startAfter, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface RideHistoryItem {
  id: string;
  date: Date;
  from: string;
  to: string;
  distance: number;
  duration: number;
  cost: number;
  status: 'completed' | 'cancelled';
  rating?: number;
  driverName?: string;
  passengerNames?: string[];
  vehicleType: string;
  paymentMethod: string;
  carbonSaved: number;
  isDriver: boolean;
}

export interface RideAnalytics {
  totalRides: number;
  totalDistance: number;
  totalCost: number;
  totalSavings: number;
  carbonFootprintSaved: number;
  averageRating: number;
  favoriteRoutes: Array<{
    route: string;
    count: number;
    avgCost: number;
  }>;
  monthlyStats: Array<{
    month: string;
    rides: number;
    cost: number;
    distance: number;
  }>;
  ridesByDay: Array<{
    day: string;
    count: number;
  }>;
  costBreakdown: {
    asDriver: number;
    asPassenger: number;
  };
  timePatterns: {
    morningRides: number;
    afternoonRides: number;
    eveningRides: number;
    nightRides: number;
  };
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    unlockedAt?: Date;
    progress?: number;
    target?: number;
  }>;
}

export interface MonthlyComparison {
  currentMonth: {
    rides: number;
    cost: number;
    distance: number;
    carbonSaved: number;
  };
  previousMonth: {
    rides: number;
    cost: number;
    distance: number;
    carbonSaved: number;
  };
  changes: {
    rides: number;
    cost: number;
    distance: number;
    carbonSaved: number;
  };
}

class RideAnalyticsService {
  async getRideHistory(
    userId: string,
    pageSize: number = 20,
    lastDoc?: any
  ): Promise<{ rides: RideHistoryItem[]; hasMore: boolean; lastDoc: any }> {
    try {
      let ridesQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      if (lastDoc) {
        ridesQuery = query(ridesQuery, startAfter(lastDoc));
      }

      const snapshot = await getDocs(ridesQuery);
      const rides: RideHistoryItem[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        rides.push({
          id: doc.id,
          date: data.createdAt?.toDate() || new Date(),
          from: data.fromAddress || 'Unknown',
          to: data.toAddress || 'Unknown',
          distance: data.distance || 0,
          duration: data.duration || 0,
          cost: data.cost || 0,
          status: data.status || 'completed',
          rating: data.rating,
          driverName: data.driverName,
          passengerNames: data.passengerNames || [],
          vehicleType: data.vehicleType || 'Car',
          paymentMethod: data.paymentMethod || 'Card',
          carbonSaved: data.carbonSaved || 0,
          isDriver: data.isDriver || false,
        });
      });

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      const hasMore = snapshot.docs.length === pageSize;

      return { rides, hasMore, lastDoc: lastVisible };
    } catch (error) {
      console.error('Error fetching ride history:', error);
      throw error;
    }
  }

  async getRideAnalytics(userId: string): Promise<RideAnalytics> {
    try {
      // Get all user rides for comprehensive analysis
      const allRidesQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(allRidesQuery);
      const rides: RideHistoryItem[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        rides.push({
          id: doc.id,
          date: data.createdAt?.toDate() || new Date(),
          from: data.fromAddress || 'Unknown',
          to: data.toAddress || 'Unknown',
          distance: data.distance || 0,
          duration: data.duration || 0,
          cost: data.cost || 0,
          status: data.status || 'completed',
          rating: data.rating,
          driverName: data.driverName,
          passengerNames: data.passengerNames || [],
          vehicleType: data.vehicleType || 'Car',
          paymentMethod: data.paymentMethod || 'Card',
          carbonSaved: data.carbonSaved || 0,
          isDriver: data.isDriver || false,
        });
      });

      return this.calculateAnalytics(rides);
    } catch (error) {
      console.error('Error fetching ride analytics:', error);
      throw error;
    }
  }

  private calculateAnalytics(rides: RideHistoryItem[]): RideAnalytics {
    const completedRides = rides.filter(ride => ride.status === 'completed');
    
    // Basic stats
    const totalRides = completedRides.length;
    const totalDistance = completedRides.reduce((sum, ride) => sum + ride.distance, 0);
    const totalCost = completedRides.reduce((sum, ride) => sum + ride.cost, 0);
    const carbonFootprintSaved = completedRides.reduce((sum, ride) => sum + ride.carbonSaved, 0);
    
    // Calculate average rating
    const ratedRides = completedRides.filter(ride => ride.rating);
    const averageRating = ratedRides.length > 0 
      ? ratedRides.reduce((sum, ride) => sum + (ride.rating || 0), 0) / ratedRides.length
      : 0;

    // Calculate estimated savings (compared to individual car rides)
    const estimatedIndividualCost = totalDistance * 0.5; // $0.50 per km estimate
    const totalSavings = Math.max(0, estimatedIndividualCost - totalCost);

    // Favorite routes
    const routeMap = new Map<string, { count: number; totalCost: number }>();
    completedRides.forEach(ride => {
      const route = `${ride.from} → ${ride.to}`;
      const existing = routeMap.get(route) || { count: 0, totalCost: 0 };
      routeMap.set(route, {
        count: existing.count + 1,
        totalCost: existing.totalCost + ride.cost
      });
    });

    const favoriteRoutes = Array.from(routeMap.entries())
      .map(([route, data]) => ({
        route,
        count: data.count,
        avgCost: data.totalCost / data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Monthly stats (last 12 months)
    const monthlyStats = this.calculateMonthlyStats(completedRides);

    // Rides by day of week
    const ridesByDay = this.calculateRidesByDay(completedRides);

    // Cost breakdown
    const driverRides = completedRides.filter(ride => ride.isDriver);
    const passengerRides = completedRides.filter(ride => !ride.isDriver);
    const costBreakdown = {
      asDriver: driverRides.reduce((sum, ride) => sum + ride.cost, 0),
      asPassenger: passengerRides.reduce((sum, ride) => sum + ride.cost, 0)
    };

    // Time patterns
    const timePatterns = this.calculateTimePatterns(completedRides);

    // Achievements
    const achievements = this.calculateAchievements(completedRides);

    return {
      totalRides,
      totalDistance,
      totalCost,
      totalSavings,
      carbonFootprintSaved,
      averageRating,
      favoriteRoutes,
      monthlyStats,
      ridesByDay,
      costBreakdown,
      timePatterns,
      achievements
    };
  }

  private calculateMonthlyStats(rides: RideHistoryItem[]) {
    const monthlyMap = new Map<string, { rides: number; cost: number; distance: number }>();
    
    rides.forEach(ride => {
      const monthKey = ride.date.toISOString().substring(0, 7); // YYYY-MM
      const existing = monthlyMap.get(monthKey) || { rides: 0, cost: 0, distance: 0 };
      monthlyMap.set(monthKey, {
        rides: existing.rides + 1,
        cost: existing.cost + ride.cost,
        distance: existing.distance + ride.distance
      });
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);
  }

  private calculateRidesByDay(rides: RideHistoryItem[]) {
    const dayMap = new Map<string, number>();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    days.forEach(day => dayMap.set(day, 0));
    
    rides.forEach(ride => {
      const dayName = days[ride.date.getDay()];
      dayMap.set(dayName, (dayMap.get(dayName) || 0) + 1);
    });

    return Array.from(dayMap.entries()).map(([day, count]) => ({ day, count }));
  }

  private calculateTimePatterns(rides: RideHistoryItem[]) {
    let morningRides = 0; // 6-12
    let afternoonRides = 0; // 12-17
    let eveningRides = 0; // 17-22
    let nightRides = 0; // 22-6

    rides.forEach(ride => {
      const hour = ride.date.getHours();
      if (hour >= 6 && hour < 12) morningRides++;
      else if (hour >= 12 && hour < 17) afternoonRides++;
      else if (hour >= 17 && hour < 22) eveningRides++;
      else nightRides++;
    });

    return { morningRides, afternoonRides, eveningRides, nightRides };
  }

  private calculateAchievements(rides: RideHistoryItem[]) {
    const achievements = [
      {
        id: 'first_ride',
        title: 'First Ride',
        description: 'Complete your first carpool ride',
        icon: '🚗',
        target: 1
      },
      {
        id: 'eco_warrior',
        title: 'Eco Warrior',
        description: 'Save 100kg of CO2 through carpooling',
        icon: '🌱',
        target: 100
      },
      {
        id: 'frequent_rider',
        title: 'Frequent Rider',
        description: 'Complete 50 rides',
        icon: '🎯',
        target: 50
      },
      {
        id: 'distance_master',
        title: 'Distance Master',
        description: 'Travel 1000km through carpooling',
        icon: '🛣️',
        target: 1000
      },
      {
        id: 'social_butterfly',
        title: 'Social Butterfly',
        description: 'Ride with 25 different people',
        icon: '🦋',
        target: 25
      },
      {
        id: 'five_star',
        title: 'Five Star Rider',
        description: 'Maintain a 5.0 rating for 10+ rides',
        icon: '⭐',
        target: 10
      }
    ];

    const totalRides = rides.length;
    const totalDistance = rides.reduce((sum, ride) => sum + ride.distance, 0);
    const totalCarbon = rides.reduce((sum, ride) => sum + ride.carbonSaved, 0);
    const uniquePeople = new Set(rides.flatMap(ride => 
      ride.isDriver ? ride.passengerNames || [] : [ride.driverName || '']
    )).size;
    const ratedRides = rides.filter(ride => ride.rating);
    const averageRating = ratedRides.length > 0 
      ? ratedRides.reduce((sum, ride) => sum + (ride.rating || 0), 0) / ratedRides.length
      : 0;

    return achievements.map(achievement => {
      let progress = 0;
      let unlockedAt: Date | undefined;

      switch (achievement.id) {
        case 'first_ride':
          progress = Math.min(totalRides, achievement.target);
          break;
        case 'eco_warrior':
          progress = Math.min(totalCarbon, achievement.target);
          break;
        case 'frequent_rider':
          progress = Math.min(totalRides, achievement.target);
          break;
        case 'distance_master':
          progress = Math.min(totalDistance, achievement.target);
          break;
        case 'social_butterfly':
          progress = Math.min(uniquePeople, achievement.target);
          break;
        case 'five_star':
          progress = averageRating >= 5.0 && ratedRides.length >= achievement.target 
            ? achievement.target 
            : Math.min(ratedRides.length, achievement.target);
          break;
      }

      if (progress >= achievement.target) {
        unlockedAt = rides[0]?.date; // Approximate unlock date
      }

      return {
        ...achievement,
        progress,
        unlockedAt
      };
    });
  }

  async getMonthlyComparison(userId: string): Promise<MonthlyComparison> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get current month rides
      const currentMonthQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', userId),
        where('createdAt', '>=', currentMonthStart),
        where('status', '==', 'completed')
      );

      // Get previous month rides
      const previousMonthQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', userId),
        where('createdAt', '>=', previousMonthStart),
        where('createdAt', '<=', previousMonthEnd),
        where('status', '==', 'completed')
      );

      const [currentSnapshot, previousSnapshot] = await Promise.all([
        getDocs(currentMonthQuery),
        getDocs(previousMonthQuery)
      ]);

      const currentMonth = this.calculateMonthStats(currentSnapshot);
      const previousMonth = this.calculateMonthStats(previousSnapshot);

      const changes = {
        rides: currentMonth.rides - previousMonth.rides,
        cost: currentMonth.cost - previousMonth.cost,
        distance: currentMonth.distance - previousMonth.distance,
        carbonSaved: currentMonth.carbonSaved - previousMonth.carbonSaved
      };

      return { currentMonth, previousMonth, changes };
    } catch (error) {
      console.error('Error calculating monthly comparison:', error);
      throw error;
    }
  }

  private calculateMonthStats(snapshot: any) {
    let rides = 0;
    let cost = 0;
    let distance = 0;
    let carbonSaved = 0;

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      rides++;
      cost += data.cost || 0;
      distance += data.distance || 0;
      carbonSaved += data.carbonSaved || 0;
    });

    return { rides, cost, distance, carbonSaved };
  }

  async exportRideHistory(userId: string): Promise<string> {
    try {
      const { rides } = await this.getRideHistory(userId, 1000); // Get all rides
      
      const csvHeader = 'Date,From,To,Distance (km),Duration (min),Cost ($),Status,Rating,Driver/Passengers,Vehicle Type,Payment Method,Carbon Saved (kg)\n';
      
      const csvRows = rides.map(ride => {
        const people = ride.isDriver 
          ? ride.passengerNames?.join('; ') || 'No passengers'
          : ride.driverName || 'Unknown driver';
        
        return [
          ride.date.toISOString().split('T')[0],
          ride.from,
          ride.to,
          ride.distance.toFixed(2),
          ride.duration.toString(),
          ride.cost.toFixed(2),
          ride.status,
          ride.rating?.toString() || 'N/A',
          people,
          ride.vehicleType,
          ride.paymentMethod,
          ride.carbonSaved.toFixed(2)
        ].join(',');
      });

      return csvHeader + csvRows.join('\n');
    } catch (error) {
      console.error('Error exporting ride history:', error);
      throw error;
    }
  }
}

export const rideAnalyticsService = new RideAnalyticsService();