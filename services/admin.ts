import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  limit,
  getDoc,
  writeBatch,
  serverTimestamp,
  getCountFromServer
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User, Ride, Booking, AdminStats } from '@/types';

export class AdminService {
  // Get admin dashboard stats
  static async getAdminStats(): Promise<AdminStats> {
    try {
      const [usersCountSnap, ridesCountSnap, bookingsCountSnap, activeRidesCountSnap] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'rides')),
        getCountFromServer(collection(db, 'bookings')),
        getCountFromServer(query(collection(db, 'rides'), where('status', 'in', ['upcoming', 'active'])))
      ]);

      // Revenue and disputes should come from aggregated docs in production.
      // For MVP, fetch a small recent window to estimate.
      const recentBookingsSnap = await getDocs(query(
        collection(db, 'bookings'),
        orderBy('createdAt', 'desc'),
        limit(100)
      ));
      const recentBookings = recentBookingsSnap.docs.map(b => ({ id: b.id, ...b.data() } as any));
      const totalRevenue = recentBookings
        .filter((b: any) => (b.paymentStatus ?? b.payment?.status) === 'paid' || (b.payment?.status) === 'captured')
        .reduce((sum: number, b: any) => sum + (b.totalPrice ?? b.amountTotal ?? 0), 0);
      const pendingDisputes = recentBookings.filter((b: any) => !!b.disputeReason).length;

      return {
        totalUsers: usersCountSnap.data().count,
        totalRides: ridesCountSnap.data().count,
        totalBookings: bookingsCountSnap.data().count,
        totalRevenue,
        activeRides: activeRidesCountSnap.data().count,
        pendingDisputes
      };
    } catch (error: any) {
      console.error('Get admin stats error:', error);
      throw new Error('Failed to get admin stats');
    }
  }

  // Get all users with pagination
  static async getUsers(limitCount: number = 50): Promise<User[]> {
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const users: User[] = [];
      
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() } as User);
      });

      return users;
    } catch (error: any) {
      console.error('Get users error:', error);
      return [];
    }
  }

  // Suspend user
  static async suspendUser(userId: string, reason: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        suspended: true,
        suspensionReason: reason,
        suspendedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Cancel all active rides for this user
      const userRidesQuery = query(
        collection(db, 'rides'),
        where('driverId', '==', userId),
        where('status', 'in', ['upcoming', 'active'])
      );

      const ridesSnapshot = await getDocs(userRidesQuery);
      const batch = writeBatch(db);

      ridesSnapshot.docs.forEach((rideDoc) => {
        batch.update(doc(db, 'rides', rideDoc.id), {
          status: 'cancelled',
          cancellationReason: 'User suspended by admin',
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
    } catch (error: any) {
      console.error('Suspend user error:', error);
      throw new Error('Failed to suspend user');
    }
  }

  // Cancel ride
  static async cancelRide(rideId: string, reason: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledBy: 'admin',
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Cancel ride error:', error);
      throw new Error('Failed to cancel ride');
    }
  }

  // Send system-wide notification
  static async sendSystemNotification(
    title: string,
    body: string,
    targetRole?: 'driver' | 'rider'
  ): Promise<void> {
    try {
      let usersQuery = collection(db, 'users');
      
      if (targetRole) {
        usersQuery = query(collection(db, 'users'), where('role', '==', targetRole)) as any;
      }

      const usersSnapshot = await getDocs(usersQuery);
      const batch = writeBatch(db);

      usersSnapshot.docs.forEach((userDoc) => {
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: userDoc.id,
          title,
          body,
          type: 'system',
          data: {},
          read: false,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
    } catch (error: any) {
      console.error('Send system notification error:', error);
      throw new Error('Failed to send system notification');
    }
  }
}