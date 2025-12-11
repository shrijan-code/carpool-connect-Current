import { 
  collection, 
  doc, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Review, User } from '@/types';

export interface RatingData {
  rating: number;
  comment: string;
  rideId?: string;
  deliveryId?: string;
  reviewerId: string;
  revieweeId: string;
  type: 'ride' | 'delivery';
}

export class RatingService {
  static async submitRating(data: RatingData): Promise<string> {
    try {
      console.log('Submitting rating:', data);
      
      // Create the review document
      const reviewData: Omit<Review, 'id'> = {
        rideId: data.rideId || '',
        reviewerId: data.reviewerId,
        revieweeId: data.revieweeId,
        rating: data.rating,
        comment: data.comment,
        createdAt: new Date().toISOString(),
      };

      const reviewRef = await addDoc(collection(db, 'reviews'), reviewData);
      console.log('Review created with ID:', reviewRef.id);

      // Update the reviewee's rating using a transaction
      await this.updateUserRating(data.revieweeId);

      return reviewRef.id;
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw new Error('Failed to submit rating. Please try again.');
    }
  }

  static async updateUserRating(userId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        // Get the last 100 reviews for this user (most recent first)
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('revieweeId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const recentReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];

        // Also get total count of all reviews for display purposes
        const allReviewsQuery = query(
          collection(db, 'reviews'),
          where('revieweeId', '==', userId)
        );
        const allReviewsSnapshot = await getDocs(allReviewsQuery);
        const totalReviewCount = allReviewsSnapshot.size;

        if (recentReviews.length === 0) {
          // No reviews yet, keep default rating
          return;
        }

        // Calculate average rating based on last 100 reviews only
        const totalRating = recentReviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / recentReviews.length;

        // Update user's rating and total review count
        const userData = userDoc.data() as User;
        const updatedData = {
          rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
          totalRides: userData.totalRides || totalReviewCount, // Use existing or set to total review count
          totalReviews: totalReviewCount, // Store total number of reviews
          recentRatingCount: recentReviews.length, // Store how many reviews were used for current rating
        };

        transaction.update(userRef, updatedData);
        console.log(`Updated user ${userId} rating to ${updatedData.rating} (based on ${recentReviews.length} recent reviews out of ${totalReviewCount} total)`);
      });
    } catch (error) {
      console.error('Error updating user rating:', error);
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
      console.error('Error fetching user reviews:', error);
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
      console.error('Error checking if user has rated ride:', error);
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
      // Get last 100 reviews for current rating calculation
      const recentReviews = await this.getUserReviews(userId, 100);
      
      // Get all reviews for total count and distribution
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

      // Calculate average based on recent reviews only
      const recentTotalRating = recentReviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = recentReviews.length > 0 ? recentTotalRating / recentReviews.length : 0;

      // Calculate distribution for all reviews
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      allReviews.forEach(review => {
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      });

      // Calculate distribution for recent reviews
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
      console.error('Error getting user rating stats:', error);
      return {
        averageRating: 0,
        totalReviews: 0,
        recentReviewsCount: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recentRatingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }
  }

  // Mock data fallback for when Firebase is not available
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
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
      {
        id: 'mock-review-2',
        rideId: 'mock-ride-2',
        reviewerId: 'mock-reviewer-2',
        revieweeId: 'mock-reviewee-1',
        rating: 4,
        comment: 'Good ride, clean car and safe driving.',
        createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      },
      {
        id: 'mock-review-3',
        rideId: 'mock-ride-3',
        reviewerId: 'mock-reviewer-3',
        revieweeId: 'mock-reviewee-1',
        rating: 5,
        comment: 'Excellent service! Would definitely ride again.',
        createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      },
    ];
  }
}