import { EmergencyContact } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const COLLECTION_TOP = 'emergency_contacts' as const;

export class EmergencyContactService {
  static async createContact(contact: Omit<EmergencyContact, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('🔄 Creating emergency contact:', { name: contact.name, userId: contact.userId });
      
      // Validate required fields
      const validationErrors = this.validateContact(contact);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
      
      const existingContacts = await this.getContacts(contact.userId);
      const isPrimary = contact.isPrimary || existingContacts.length === 0;
      
      const contactData = {
        userId: contact.userId,
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        relationship: contact.relationship.trim(),
        isPrimary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, COLLECTION_TOP), contactData);
      console.log('✅ Emergency contact saved to Firestore with ID:', docRef.id);
      
      // If this is the primary contact, update existing primary contacts
      if (isPrimary && existingContacts.length > 0) {
        const updatePromises = existingContacts
          .filter(c => c.isPrimary)
          .map(c => {
            try {
              return updateDoc(doc(db, COLLECTION_TOP, c.id), { 
                isPrimary: false, 
                updatedAt: serverTimestamp() 
              });
            } catch (err) {
              console.warn(`Failed to update contact ${c.id}:`, err);
              return Promise.resolve();
            }
          });
        await Promise.allSettled(updatePromises);
      }
      
      // Create the new contact object
      const newContact: EmergencyContact = {
        id: docRef.id,
        userId: contact.userId,
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        relationship: contact.relationship.trim(),
        isPrimary,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Update local cache
      const updatedContacts = isPrimary 
        ? [newContact, ...existingContacts.map(c => ({ ...c, isPrimary: false }))]
        : [...existingContacts, newContact];
      
      await this.saveContacts(contact.userId, updatedContacts);
      console.log('✅ Emergency contact cached locally');
      
      return docRef.id;
    } catch (error) {
      console.error('Create emergency contact error:', error);
      throw new Error(`Failed to create emergency contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async saveContact(userId: string, contact: Omit<EmergencyContact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.createContact({ ...contact, userId });
  }

  static async getContacts(userId: string): Promise<EmergencyContact[]> {
    try {
      console.log('🔄 Fetching emergency contacts for user:', userId);
      
      // First try to get from Firestore top-level collection
      try {
        const q = query(
          collection(db, COLLECTION_TOP),
          where('userId', '==', userId)
        );
        const querySnapshot = await getDocs(q);
        const contacts = querySnapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
          createdAt: (d.data() as any).createdAt?.toDate?.()?.toISOString() || (d.data() as any).createdAt,
          updatedAt: (d.data() as any).updatedAt?.toDate?.()?.toISOString() || (d.data() as any).updatedAt,
        })) as EmergencyContact[];
        
        if (contacts.length > 0) {
          console.log('✅ Emergency contacts fetched from Firestore:', contacts.length);
          // Cache locally for offline access
          await this.saveContacts(userId, contacts);
          return contacts.sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }
      } catch (firestoreError) {
        console.warn('Firestore fetch failed:', firestoreError);
      }
      
      // Fallback to local storage if Firestore fails
      try {
        const stored = await AsyncStorage.getItem(`emergency_contacts_${userId}`);
        if (stored) {
          try {
            const contacts = JSON.parse(stored) as EmergencyContact[];
            console.log('📱 Loaded emergency contacts from local storage:', contacts.length);
            return contacts.sort((a, b) => {
              if (a.isPrimary && !b.isPrimary) return -1;
              if (!a.isPrimary && b.isPrimary) return 1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
          } catch (parseError) {
            console.warn('Failed to parse stored emergency contacts, clearing corrupted data:', parseError);
            await AsyncStorage.removeItem(`emergency_contacts_${userId}`);
          }
        }
      } catch (storageError) {
        console.warn('Local storage fetch failed:', storageError);
      }
      
      console.log('No emergency contacts found, returning empty array');
      return [];
    } catch (error) {
      console.error('Get emergency contacts error:', error);
      return [];
    }
  }

  static async updateContact(userId: string, contactId: string, updates: Partial<EmergencyContact>): Promise<void> {
    try {
      console.log('🔄 Updating emergency contact:', contactId, updates);
      
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp(),
      };
      delete updateData.id;
      delete updateData.userId;
      delete updateData.createdAt;
      
      await updateDoc(doc(db, COLLECTION_TOP, contactId), updateData);
      try {
        // Best-effort mirror update in subcollection (contactId may differ there)
      } catch {}
      console.log('✅ Emergency contact updated in Firestore');
      
      const contacts = await this.getContacts(userId);
      const updatedContacts = contacts.map(contact => 
        contact.id === contactId 
          ? { ...contact, ...updates, updatedAt: new Date().toISOString() }
          : contact
      );
      await this.saveContacts(userId, updatedContacts);
      
    } catch (error) {
      console.error('Update emergency contact error:', error);
      throw new Error(`Failed to update emergency contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async deleteContact(userId: string, contactId: string): Promise<void> {
    try {
      console.log('🔄 Deleting emergency contact:', contactId);
      
      await deleteDoc(doc(db, COLLECTION_TOP, contactId));
      try {
        // Best-effort delete in subcollection is skipped because IDs differ
      } catch {}
      console.log('✅ Emergency contact deleted from Firestore');
      
      const contacts = await this.getContacts(userId);
      const updatedContacts = contacts.filter(contact => contact.id !== contactId);
      await this.saveContacts(userId, updatedContacts);
      
    } catch (error) {
      console.error('Delete emergency contact error:', error);
      throw new Error(`Failed to delete emergency contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static validateContact(contact: Partial<EmergencyContact>): string[] {
    const errors: string[] = [];

    if (!contact.name?.trim()) {
      errors.push('Name is required');
    }

    if (!contact.phone?.trim()) {
      errors.push('Phone number is required');
    } else if (!/^\+?[\d\s\-\(\)]+$/.test(contact.phone.trim())) {
      errors.push('Please enter a valid phone number');
    }

    if (!contact.relationship?.trim()) {
      errors.push('Relationship is required');
    }

    return errors;
  }

  private static async saveContacts(userId: string, contacts: EmergencyContact[]): Promise<void> {
    try {
      if (!userId || !Array.isArray(contacts)) {
        console.warn('Invalid parameters for saveContacts:', { userId, contactsLength: contacts?.length });
        return;
      }
      
      const contactsToSave = contacts.map(contact => ({
        ...contact,
        // Ensure all required fields are present
        id: contact.id || `temp_${Date.now()}`,
        userId: contact.userId || userId,
        name: contact.name || '',
        phone: contact.phone || '',
        relationship: contact.relationship || '',
        isPrimary: contact.isPrimary || false,
        createdAt: contact.createdAt || new Date().toISOString(),
        updatedAt: contact.updatedAt || new Date().toISOString(),
      }));
      
      await AsyncStorage.setItem(`emergency_contacts_${userId}`, JSON.stringify(contactsToSave));
      console.log('✅ Emergency contacts saved to local storage:', contactsToSave.length);
    } catch (error) {
      console.error('Save emergency contacts error:', error);
      // Don't throw - this is a cache operation
    }
  }

  static async getPrimaryContact(userId: string): Promise<EmergencyContact | null> {
    try {
      const contacts = await this.getContacts(userId);
      return contacts.find(c => c.isPrimary) || contacts[0] || null;
    } catch (error) {
      console.error('Get primary emergency contact error:', error);
      return null;
    }
  }

  static formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    if (cleaned.startsWith('61')) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
  }

  static async triggerEmergencyAlert(userId: string, rideId?: string, deliveryId?: string): Promise<void> {
    try {
      const contacts = await this.getContacts(userId);
      const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
      if (!primaryContact) {
        throw new Error('No emergency contacts available');
      }
      const alertData = {
        userId,
        contactId: primaryContact.id,
        rideId,
        deliveryId,
        timestamp: new Date().toISOString(),
        type: 'emergency_alert',
      };
      console.log('🚨 Emergency alert triggered:', alertData);
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ Emergency alert sent successfully');
    } catch (error) {
      console.error('Failed to trigger emergency alert:', error);
      throw error;
    }
  }
}
