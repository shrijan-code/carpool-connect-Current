import { doc, updateDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User } from '@/types';

export interface VerificationCriteria {
  emailVerified: boolean;
  phoneVerified: boolean;
  profileComplete: boolean;
  documentsUploaded: boolean;
  stripeConnected?: boolean;
}

export interface VerificationStatus {
  isVerified: boolean;
  criteria: VerificationCriteria;
  missingCriteria: string[];
  verificationLevel: 'none' | 'premium';
}

export class VerificationService {

  static async checkVerificationStatus(user: User): Promise<VerificationStatus> {
    const criteria: VerificationCriteria = {
      emailVerified: !!user.email && user.email.length > 0,
      phoneVerified: !!user.phone && user.phone.length > 0,
      profileComplete: this.isProfileComplete(user),
      documentsUploaded: this.areDocumentsUploaded(user),
      stripeConnected: user.role === 'driver' ? !!user.stripeAccountId && user.stripeConnectCompleted : true
    };

    const missingCriteria: string[] = [];
    
    if (!criteria.emailVerified) missingCriteria.push('Email verification');
    if (!criteria.phoneVerified) missingCriteria.push('Phone verification');
    if (!criteria.profileComplete) missingCriteria.push('Complete profile');
    if (!criteria.documentsUploaded && user.role === 'driver') missingCriteria.push('Upload vehicle documents');
    if (user.role === 'driver' && !criteria.stripeConnected) missingCriteria.push('Connect Stripe account');

    const verificationLevel = this.calculateVerificationLevel(criteria, user);
    const isVerified = verificationLevel === 'premium';

    return {
      isVerified,
      criteria,
      missingCriteria,
      verificationLevel
    };
  }

  private static isProfileComplete(user: User): boolean {
    return !!(
      user.name &&
      user.email &&
      user.phone &&
      user.profilePicture
    );
  }

  private static areDocumentsUploaded(user: User): boolean {
    if (user.role !== 'driver') return true;
    
    return !!(
      user.carDetails?.registrationDocument &&
      user.carDetails?.insuranceDocument
    );
  }

  private static calculateVerificationLevel(
    criteria: VerificationCriteria,
    user: User
  ): 'none' | 'premium' {
    const premiumRequirements = 
      criteria.emailVerified && 
      criteria.phoneVerified && 
      criteria.profileComplete &&
      (user.role !== 'driver' || (criteria.documentsUploaded && criteria.stripeConnected));

    if (premiumRequirements) return 'premium';
    return 'none';
  }

  static async updateUserVerificationStatus(userId: string): Promise<void> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const user = userDoc.data() as User;
      const verificationStatus = await this.checkVerificationStatus(user);

      await updateDoc(doc(db, 'users', userId), {
        verified: verificationStatus.isVerified,
        verificationLevel: verificationStatus.verificationLevel,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Updated verification status for user ${userId}: ${verificationStatus.verificationLevel}`);
    } catch (error) {
      console.error('Error updating verification status:', error);
      throw error;
    }
  }

  static async verifyAllUsers(): Promise<void> {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const updatePromises = usersSnapshot.docs.map(doc => 
        this.updateUserVerificationStatus(doc.id)
      );
      
      await Promise.all(updatePromises);
      console.log(`✅ Updated verification status for ${usersSnapshot.docs.length} users`);
    } catch (error) {
      console.error('Error verifying all users:', error);
      throw error;
    }
  }

  static getVerificationBadgeColor(level: 'none' | 'premium'): string {
    return level === 'premium' ? '#FFD700' : '#9E9E9E';
  }

  static getVerificationBadgeLabel(level: 'none' | 'premium'): string {
    return level === 'premium' ? 'Verified' : 'Not Verified';
  }

  static shouldShowVerificationBadge(user: User): boolean {
    return user.verified === true;
  }
}
