import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  runTransaction,
  and
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Review, User, Booking } from '@/types';
import { logger } from '@/utils/logger';

// ============================================================================
// Types for Two-Way Review System
// ============================================================================

export interface DriverReviewData {
  rideId: string;
  bookingId: string;
  driverId: string;    // The driver being reviewed
  riderId: string;     // The rider writing the review
  rating: number;
  comment: string;
}

export interface RiderReviewData {
  rideId: string;
  bookingId: string;
  driverId: string;    // The driver writing the review
  riderId: string;     // The rider being reviewed
  rating: number;
  comment: string;
}

export interface PendingReview {
  rideId: string;
  bookingId: string;
  userToReview: {
    id: string;
    name: string;
    photoURL?: string;
  };
  rideDate: string;
  origin: string;
  destination: string;
  reviewerRole: 'driver' | 'rider';
}

export interface RoleRatingStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { [key: number]: number };
}

// Legacy type for backward compatibility
export interface RatingData {
  rating: number;
  comment: string;
  rideId?: string;
  deliveryId?: string;
  reviewerId: string;
  revieweeId: string;
  type: 'ride' | 'delivery';
}

// Review window in days - reviews can only be submitted within this period
const REVIEW_WINDOW_DAYS = 7;

// ============================================================================
// Rating Service - Enhanced for Two-Way Reviews
// ============================================================================

export class RatingService {

  // --------------------------------------------------------------------------
  // Two-Way Review Methods
  // --------------------------------------------------------------------------

  /**
   * Submit a review from a rider to a driver
   */
  static async submitDriverReview(data: DriverReviewData): Promise<string> {
    try {
      logger.info('Submitting driver review', { rideId: data.rideId, driverId: data.driverId });

      // Check if already reviewed
      const alreadyReviewed = await this.hasRiderReviewedDriver(data.riderId, data.rideId);
      if (alreadyReviewed) {
        throw new Error('You have already reviewed this driver for this ride.');
      }

      // Create the review document
      const reviewData: Omit<Review, 'id'> = {
        rideId: data.rideId,
        bookingId: data.bookingId,
        reviewerId: data.riderId,
        revieweeId: data.driverId,
        rating: data.rating,
        comment: this.sanitizeComment(data.comment),
        reviewerRole: 'rider',
        revieweeRole: 'driver',
        createdAt: new Date().toISOString(),
      };

      const reviewRef = await addDoc(collection(db, 'reviews'), reviewData);
      logger.info('Driver review created', { reviewId: reviewRef.id });

      // Update the booking to mark review as complete
      await this.updateBookingReviewStatus(data.bookingId, 'riderReviewedDriver', reviewRef.id);

      // Update the driver's rating
      // this.updateUserDriverRating(data.driverId); // Moved to Cloud Function onReviewCreated

      return reviewRef.id;
    } catch (error) {
      logger.error('Error submitting driver review', error);
      throw error;
    }
  }

  /**
   * Submit a review from a driver to a rider
   */
  static async submitRiderReview(data: RiderReviewData): Promise<string> {
    try {
      logger.info('Submitting rider review', { rideId: data.rideId, riderId: data.riderId });

      // Check if already reviewed
      const alreadyReviewed = await this.hasDriverReviewedRider(data.driverId, data.riderId, data.rideId);
      if (alreadyReviewed) {
        throw new Error('You have already reviewed this rider for this ride.');
      }

      // Create the review document
      const reviewData: Omit<Review, 'id'> = {
        rideId: data.rideId,
        bookingId: data.bookingId,
        reviewerId: data.driverId,
        revieweeId: data.riderId,
        rating: data.rating,
        comment: this.sanitizeComment(data.comment),
        reviewerRole: 'driver',
        revieweeRole: 'rider',
        createdAt: new Date().toISOString(),
      };

      const reviewRef = await addDoc(collection(db, 'reviews'), reviewData);
      logger.info('Rider review created', { reviewId: reviewRef.id });

      // Update the booking to mark review as complete
      await this.updateBookingReviewStatus(data.bookingId, 'driverReviewedRider', reviewRef.id);

      // Update the rider's rating
      // this.updateUserRiderRating(data.riderId); // Moved to Cloud Function onReviewCreated

      return reviewRef.id;
    } catch (error) {
      logger.error('Error submitting rider review', error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Review Status Checking
  // --------------------------------------------------------------------------

  /**
   * Check if a rider has already reviewed the driver for a specific ride
   */
  static async hasRiderReviewedDriver(riderId: string, rideId: string): Promise<boolean> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('reviewerId', '==', riderId),
        where('rideId', '==', rideId),
        where('reviewerRole', '==', 'rider')
      );

      const snapshot = await getDocs(reviewsQuery);
      return !snapshot.empty;
    } catch (error) {
      logger.error('Error checking rider review status', error);
      return false;
    }
  }

  /**
   * Check if a driver has already reviewed a specific rider for a ride
   */
  static async hasDriverReviewedRider(driverId: string, riderId: string, rideId: string): Promise<boolean> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('reviewerId', '==', driverId),
        where('revieweeId', '==', riderId),
        where('rideId', '==', rideId),
        where('reviewerRole', '==', 'driver')
      );

      const snapshot = await getDocs(reviewsQuery);
      return !snapshot.empty;
    } catch (error) {
      logger.error('Error checking driver review status', error);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Pending Reviews
  // --------------------------------------------------------------------------

  /**
   * Get list of completed rides pending review by the user
   * Returns both rides where user was a driver (need to review riders)
   * and rides where user was a rider (need to review driver)
   */
  static async getPendingReviews(userId: string): Promise<PendingReview[]> {
    const pendingReviews: PendingReview[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - REVIEW_WINDOW_DAYS);

    try {
      // Get bookings where user is the rider and hasn't reviewed driver yet
      const riderBookingsQuery = query(
        collection(db, 'bookings'),
        where('riderId', '==', userId),
        where('status', '==', 'completed'),
        where('riderReviewedDriver', '==', false)
      );

      const riderBookingsSnapshot = await getDocs(riderBookingsQuery);

      for (const bookingDoc of riderBookingsSnapshot.docs) {
        const booking = { id: bookingDoc.id, ...bookingDoc.data() } as Booking;

        // Check if within review window
        const rideDate = new Date(booking.ride?.departureAt || booking.createdAt);
        if (rideDate < cutoffDate) continue;

        pendingReviews.push({
          rideId: booking.rideId,
          bookingId: booking.id,
          userToReview: {
            id: booking.driverId,
            name: booking.ride?.driver?.name || 'Driver',
            photoURL: booking.ride?.driver?.photoURL,
          },
          rideDate: booking.ride?.departureAt || booking.createdAt,
          origin: booking.ride?.origin?.name || booking.ride?.from?.name || 'Origin',
          destination: booking.ride?.destination?.name || booking.ride?.to?.name || 'Destination',
          reviewerRole: 'rider',
        });
      }

      // Get bookings where user is the driver and hasn't reviewed rider yet
      const driverBookingsQuery = query(
        collection(db, 'bookings'),
        where('driverId', '==', userId),
        where('status', '==', 'completed'),
        where('driverReviewedRider', '==', false)
      );

      const driverBookingsSnapshot = await getDocs(driverBookingsQuery);

      for (const bookingDoc of driverBookingsSnapshot.docs) {
        const booking = { id: bookingDoc.id, ...bookingDoc.data() } as Booking;

        // Check if within review window
        const rideDate = new Date(booking.ride?.departureAt || booking.createdAt);
        if (rideDate < cutoffDate) continue;

        pendingReviews.push({
          rideId: booking.rideId,
          bookingId: booking.id,
          userToReview: {
            id: booking.riderId,
            name: booking.passenger?.name || 'Rider',
            photoURL: booking.passenger?.photoURL,
          },
          rideDate: booking.ride?.departureAt || booking.createdAt,
          origin: booking.ride?.origin?.name || booking.ride?.from?.name || 'Origin',
          destination: booking.ride?.destination?.name || booking.ride?.to?.name || 'Destination',
          reviewerRole: 'driver',
        });
      }

      // Sort by most recent first
      pendingReviews.sort((a, b) => new Date(b.rideDate).getTime() - new Date(a.rideDate).getTime());

      return pendingReviews;
    } catch (error) {
      logger.error('Error fetching pending reviews', error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Role-Specific Rating Calculations
  // --------------------------------------------------------------------------

  /**
   * Get a user's rating statistics as a driver
   */
  static async getUserDriverRatingStats(userId: string): Promise<RoleRatingStats> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('revieweeId', '==', userId),
        where('revieweeRole', '==', 'driver'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(reviewsQuery);
      const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];

      if (reviews.length === 0) {
        return {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
      }

      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach(review => {
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      });

      return {
        averageRating: Math.round((totalRating / reviews.length) * 10) / 10,
        totalReviews: reviews.length,
        ratingDistribution,
      };
    } catch (error) {
      logger.error('Error getting driver rating stats', error);
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }
  }

  /**
   * Get a user's rating statistics as a rider
   */
  static async getUserRiderRatingStats(userId: string): Promise<RoleRatingStats> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('revieweeId', '==', userId),
        where('revieweeRole', '==', 'rider'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(reviewsQuery);
      const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];

      if (reviews.length === 0) {
        return {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
      }

      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach(review => {
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      });

      return {
        averageRating: Math.round((totalRating / reviews.length) * 10) / 10,
        totalReviews: reviews.length,
        ratingDistribution,
      };
    } catch (error) {
      logger.error('Error getting rider rating stats', error);
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }
  }

  /**
   * Get reviews received by a user as a driver
   */
  static async getDriverReviews(userId: string, limitCount: number = 50): Promise<Review[]> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('revieweeId', '==', userId),
        where('revieweeRole', '==', 'driver'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(reviewsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];
    } catch (error) {
      logger.error('Error fetching driver reviews', error);
      return [];
    }
  }

  /**
   * Get reviews received by a user as a rider
   */
  static async getRiderReviews(userId: string, limitCount: number = 50): Promise<Review[]> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('revieweeId', '==', userId),
        where('revieweeRole', '==', 'rider'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(reviewsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];
    } catch (error) {
      logger.error('Error fetching rider reviews', error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Internal Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Update user's driver rating based on reviews received as a driver
   */
  private static async updateUserDriverRating(userId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        // Get reviews where user was the driver (being reviewed by riders)
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('revieweeId', '==', userId),
          where('revieweeRole', '==', 'driver'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];

        if (reviews.length === 0) return;

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = Math.round((totalRating / reviews.length) * 10) / 10;

        // Count total driver reviews
        const allDriverReviewsQuery = query(
          collection(db, 'reviews'),
          where('revieweeId', '==', userId),
          where('revieweeRole', '==', 'driver')
        );
        const allDriverReviewsSnapshot = await getDocs(allDriverReviewsQuery);

        transaction.update(userRef, {
          ratingAsDriver: averageRating,
          totalDriverReviews: allDriverReviewsSnapshot.size,
        });

        logger.info('Updated user driver rating', { userId, rating: averageRating });
      });
    } catch (error) {
      logger.error('Error updating user driver rating', error);
      throw error;
    }
  }

  /**
   * Update user's rider rating based on reviews received as a rider
   */
  private static async updateUserRiderRating(userId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        // Get reviews where user was the rider (being reviewed by drivers)
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('revieweeId', '==', userId),
          where('revieweeRole', '==', 'rider'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];

        if (reviews.length === 0) return;

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = Math.round((totalRating / reviews.length) * 10) / 10;

        // Count total rider reviews
        const allRiderReviewsQuery = query(
          collection(db, 'reviews'),
          where('revieweeId', '==', userId),
          where('revieweeRole', '==', 'rider')
        );
        const allRiderReviewsSnapshot = await getDocs(allRiderReviewsQuery);

        transaction.update(userRef, {
          ratingAsRider: averageRating,
          totalRiderReviews: allRiderReviewsSnapshot.size,
        });

        logger.info('Updated user rider rating', { userId, rating: averageRating });
      });
    } catch (error) {
      logger.error('Error updating user rider rating', error);
      throw error;
    }
  }

  /**
   * Update booking document to mark review as completed
   */
  private static async updateBookingReviewStatus(
    bookingId: string,
    field: 'driverReviewedRider' | 'riderReviewedDriver',
    reviewId: string
  ): Promise<void> {
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      const updateData: Partial<Booking> = {
        [field]: true,
        [field === 'driverReviewedRider' ? 'driverReviewId' : 'riderReviewId']: reviewId,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(bookingRef, updateData);
    } catch (error) {
      logger.error('Error updating booking review status', error);
      // Don't throw - review was already created, this is secondary
    }
  }

  /**
   * Basic profanity filter for comments
   */
  private static sanitizeComment(comment: string): string {
    // Basic profanity list - can be expanded
    const profanityList = ['fuck', 'shit', 'ass', 'bitch', 'damn', 'crap'];
    let sanitized = comment.trim();

    profanityList.forEach(word => {
      const regex = new RegExp(word, 'gi');
      sanitized = sanitized.replace(regex, '*'.repeat(word.length));
    });

    return sanitized;
  }

  // --------------------------------------------------------------------------
  // Legacy Methods (Backward Compatibility)
  // --------------------------------------------------------------------------

  /**
   * @deprecated Use submitDriverReview or submitRiderReview instead
   */
  static async submitRating(data: RatingData): Promise<string> {
    try {
      logger.info('Submitting rating (legacy)', { rideId: data.rideId, reviewerId: data.reviewerId });

      // Create the review document with legacy format
      const reviewData: Omit<Review, 'id'> = {
        rideId: data.rideId || '',
        reviewerId: data.reviewerId,
        revieweeId: data.revieweeId,
        rating: data.rating,
        comment: this.sanitizeComment(data.comment),
        reviewerRole: 'rider', // Default to rider for legacy
        revieweeRole: 'driver', // Default to driver for legacy
        createdAt: new Date().toISOString(),
      };

      const reviewRef = await addDoc(collection(db, 'reviews'), reviewData);
      logger.info('Review created (legacy)', { reviewId: reviewRef.id });

      // Update the reviewee's overall rating
      // this.updateUserRating(data.revieweeId); // Moved to Cloud Function

      return reviewRef.id;
    } catch (error) {
      logger.error('Error submitting rating (legacy)', error);
      throw new Error('Failed to submit rating. Please try again.');
    }
  }

  /**
   * @deprecated Use updateUserDriverRating or updateUserRiderRating instead
   * Kept for backward compatibility - updates overall rating
   */
  static async updateUserRating(userId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        // Get all reviews for this user (most recent first)
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('revieweeId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        const reviewsSnapshot = await getDocs(reviewsQuery);
        const recentReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];

        // Get total count
        const allReviewsQuery = query(
          collection(db, 'reviews'),
          where('revieweeId', '==', userId)
        );
        const allReviewsSnapshot = await getDocs(allReviewsQuery);
        const totalReviewCount = allReviewsSnapshot.size;

        if (recentReviews.length === 0) return;

        const totalRating = recentReviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / recentReviews.length;

        const userData = userDoc.data() as User;
        const updatedData = {
          rating: Math.round(averageRating * 10) / 10,
          totalRides: userData.totalRides || totalReviewCount,
          totalReviews: totalReviewCount,
          recentRatingCount: recentReviews.length,
        };

        transaction.update(userRef, updatedData);
        logger.info('Updated user rating (legacy)', { userId, rating: updatedData.rating });
      });
    } catch (error) {
      logger.error('Error updating user rating (legacy)', error);
      throw error;
    }
  }

  static async getUserReviews(userId: string, limitCount: number = 100): Promise<Review[]> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('revieweeId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(reviewsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];
    } catch (error) {
      logger.error('Error fetching user reviews', error);
      return [];
    }
  }

  static async hasUserRatedRide(reviewerId: string, rideId: string): Promise<boolean> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('reviewerId', '==', reviewerId),
        where('rideId', '==', rideId)
      );

      const snapshot = await getDocs(reviewsQuery);
      return !snapshot.empty;
    } catch (error) {
      logger.error('Error checking if user has rated ride', error);
      return false;
    }
  }

  static async getUserRatingStats(userId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    recentReviewsCount: number;
    ratingDistribution: { [key: number]: number };
    recentRatingDistribution: { [key: number]: number };
  }> {
    try {
      const recentReviews = await this.getUserReviews(userId, 100);
      const allReviews = await this.getUserReviews(userId, 1000);

      if (allReviews.length === 0) {
        return {
          averageRating: 0,
          totalReviews: 0,
          recentReviewsCount: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          recentRatingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
      }

      const recentTotalRating = recentReviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = recentReviews.length > 0 ? recentTotalRating / recentReviews.length : 0;

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      allReviews.forEach(review => {
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      });

      const recentRatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      recentReviews.forEach(review => {
        recentRatingDistribution[review.rating as keyof typeof recentRatingDistribution]++;
      });

      return {
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews: allReviews.length,
        recentReviewsCount: recentReviews.length,
        ratingDistribution,
        recentRatingDistribution
      };
    } catch (error) {
      logger.error('Error getting user rating stats', error);
      return {
        averageRating: 0,
        totalReviews: 0,
        recentReviewsCount: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recentRatingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }
  }

  // --------------------------------------------------------------------------
  // Mock Data (Development/Testing)
  // --------------------------------------------------------------------------

  static getMockRatingStats() {
    return {
      averageRating: 4.6,
      totalReviews: 127,
      recentReviewsCount: 100,
      ratingDistribution: { 1: 2, 2: 5, 3: 15, 4: 45, 5: 60 },
      recentRatingDistribution: { 1: 10, 2: 12, 3: 18, 4: 22, 5: 38 }
    };
  }

  static getMockReviews(): Review[] {
    return [
      {
        id: 'mock-review-1',
        rideId: 'mock-ride-1',
        reviewerId: 'mock-reviewer-1',
        revieweeId: 'mock-reviewee-1',
        rating: 5,
        comment: 'Great driver! Very punctual and friendly.',
        reviewerRole: 'rider',
        revieweeRole: 'driver',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'mock-review-2',
        rideId: 'mock-ride-2',
        reviewerId: 'mock-reviewer-2',
        revieweeId: 'mock-reviewee-1',
        rating: 4,
        comment: 'Good ride, clean car and safe driving.',
        reviewerRole: 'rider',
        revieweeRole: 'driver',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: 'mock-review-3',
        rideId: 'mock-ride-3',
        reviewerId: 'mock-reviewer-3',
        revieweeId: 'mock-reviewee-1',
        rating: 5,
        comment: 'Excellent rider! On time and pleasant company.',
        reviewerRole: 'driver',
        revieweeRole: 'rider',
        createdAt: new Date(Date.now() - 259200000).toISOString(),
      },
    ];
  }

  static getMockPendingReviews(): PendingReview[] {
    return [
      {
        rideId: 'mock-ride-1',
        bookingId: 'mock-booking-1',
        userToReview: {
          id: 'mock-user-1',
          name: 'John Driver',
        },
        rideDate: new Date(Date.now() - 86400000).toISOString(),
        origin: 'Sydney CBD',
        destination: 'Parramatta',
        reviewerRole: 'rider',
      },
      {
        rideId: 'mock-ride-2',
        bookingId: 'mock-booking-2',
        userToReview: {
          id: 'mock-user-2',
          name: 'Jane Rider',
        },
        rideDate: new Date(Date.now() - 172800000).toISOString(),
        origin: 'Bondi',
        destination: 'Chatswood',
        reviewerRole: 'driver',
      },
    ];
  }
}