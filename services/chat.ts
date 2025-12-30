import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  writeBatch,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { ChatMessage, MessageThread } from '@/types';
import { ImageService } from './image';
import { NotificationService } from './notifications';
import { logger } from '@/utils/logger';

export class ChatService {
  // Get all participants for a ride (including from confirmed bookings)
  static async getParticipantsForRide(rideId: string): Promise<string[]> {
    try {
      const participants = new Set<string>();

      // Get ride data for driver
      const rideDoc = await getDoc(doc(db, 'rides', rideId));
      if (rideDoc.exists()) {
        const rideData = rideDoc.data();

        // Always include driver
        if (rideData.driverId) participants.add(rideData.driverId);

        // Include all passengers from ride's passengers array
        if (rideData.passengers && Array.isArray(rideData.passengers)) {
          rideData.passengers.forEach((p: any) => {
            if (p.id) participants.add(p.id);
          });
        }
      }

      // Also fetch from confirmed bookings to ensure riders are included
      // This handles cases where the booking exists but rider isn't in ride.passengers yet
      try {
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('rideId', '==', rideId),
          where('status', 'in', ['pending_driver', 'confirmed', 'completed'])
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);

        bookingsSnapshot.forEach((bookingDoc) => {
          const bookingData = bookingDoc.data();
          // Add rider from booking
          if (bookingData.riderId) participants.add(bookingData.riderId);
          if (bookingData.passengerId) participants.add(bookingData.passengerId);
          // Also ensure driver is included
          if (bookingData.driverId) participants.add(bookingData.driverId);
        });
      } catch (bookingError) {
        logger.warn('Error fetching bookings for participants', { error: bookingError });
      }

      return Array.from(participants);
    } catch (error) {
      logger.warn('Error fetching ride participants', { error });
      return [];
    }
  }

  // Create or get message thread
  static async createOrGetThread(
    bookingId: string,
    rideId: string,
    driverId: string,
    passengerId: string
  ): Promise<string> {
    try {
      // Check if thread already exists
      const q = query(
        collection(db, 'message_threads'),
        where('bookingId', '==', bookingId)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id;
      }

      // Create new thread
      const threadRef = await addDoc(collection(db, 'message_threads'), {
        bookingId,
        rideId,
        driverId,
        passengerId,
        participants: [driverId, passengerId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      logger.chat.threadCreated(threadRef.id, bookingId);
      return threadRef.id;
    } catch (error: unknown) {
      logger.error('Create or get thread error', error);
      throw new Error('Failed to create message thread');
    }
  }

  // Send a text message
  static async sendMessage(
    rideId: string,
    senderId: string,
    senderName: string,
    message: string,
    bookingId?: string
  ): Promise<string> {
    try {
      // Validate required parameters
      if (!rideId || !senderId || !senderName || !message?.trim()) {
        logger.error('Missing required message parameters', undefined, { rideId, senderId, senderName, hasMessage: !!message?.trim() });
        throw new Error('Missing required message parameters');
      }

      logger.debug('Attempting to send message', { rideId, senderId, messageLength: message.length, bookingId });

      let threadId: string | undefined;
      let participants: string[] = [];

      // If bookingId is provided, make this a PRIVATE conversation between driver and rider only
      if (bookingId) {
        try {
          // Get booking to find driver and passenger IDs
          const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
          if (bookingDoc.exists()) {
            const bookingData = bookingDoc.data();
            const driverId = bookingData.ride?.driverId || bookingData.driverId;
            const passengerId = bookingData.riderId || bookingData.passengerId;

            if (driverId && passengerId) {
              // PRIVATE conversation: only driver and this specific rider
              participants = [driverId, passengerId];
              threadId = await this.createOrGetThread(bookingId, rideId, driverId, passengerId);
              logger.debug('Private message between driver and rider', { driverId, passengerId });
            }
          }
        } catch (threadError) {
          logger.warn('Failed to create thread, falling back to ride-based participants', { error: threadError });
        }
      }

      // Fallback: If no bookingId or thread creation failed, use ride-based participants (group chat)
      if (participants.length === 0) {
        participants = await this.getParticipantsForRide(rideId);
        logger.debug('Group message to all ride participants', { count: participants.length });
      }

      // Ensure sender is always in participants
      if (!participants.includes(senderId)) {
        participants.push(senderId);
      }

      const messageData = {
        rideId,
        bookingId: bookingId || null,
        threadId: threadId || null,
        senderId,
        senderName,
        message: message.trim(),
        type: 'text' as const,
        readBy: [senderId],
        participants,
        status: 'sent' as const,  // Message status tracking
        timestamp: serverTimestamp()
      };

      logger.debug('Sending message', { rideId: messageData.rideId, threadId: messageData.threadId });
      const messageRef = await addDoc(collection(db, 'messages'), messageData);
      logger.chat.messageSent(rideId, senderId);

      // Update thread with last message info (non-blocking)
      if (threadId) {
        try {
          await updateDoc(doc(db, 'message_threads', threadId), {
            lastMessage: message.length > 50 ? message.substring(0, 50) + '...' : message,
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (updateError) {
          logger.warn('Failed to update thread, message still sent', { error: updateError });
        }
      }

      // Send notification to other participants (non-blocking)
      if (bookingId) {
        try {
          const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
          if (bookingDoc.exists()) {
            const bookingData = bookingDoc.data();
            const driverId = bookingData.ride?.driverId || bookingData.driverId;
            const passengerId = bookingData.passengerId;

            const recipientId = senderId === driverId ? passengerId : driverId;
            if (recipientId) {
              await NotificationService.sendNewMessageNotification(
                recipientId,
                senderName,
                message,
                rideId
              );
            }
          }
        } catch (notificationError) {
          logger.warn('Failed to send notification, message still sent', { error: notificationError });
        }
      }

      return messageRef.id;
    } catch (error: unknown) {
      logger.error('Send message error', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to send message: ${errorMessage}`);
    }
  }

  // Send an image message
  static async sendImageMessage(
    rideId: string,
    senderId: string,
    senderName: string,
    imageUri: string,
    message?: string,
    bookingId?: string
  ): Promise<string> {
    try {
      // Upload image first
      const imageUrl = await ImageService.uploadImage(
        imageUri,
        `chat-images`,
        `${rideId}_${Date.now()}.jpg`
      );

      if (!imageUrl) {
        throw new Error('Failed to upload image');
      }

      let threadId: string | undefined;
      let participants: string[] = [];

      // If bookingId is provided, make this a PRIVATE conversation between driver and rider only
      if (bookingId) {
        const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
        if (bookingDoc.exists()) {
          const bookingData = bookingDoc.data();
          const driverId = bookingData.ride?.driverId || bookingData.driverId;
          const passengerId = bookingData.riderId || bookingData.passengerId;

          if (driverId && passengerId) {
            // PRIVATE conversation: only driver and this specific rider
            participants = [driverId, passengerId];
            threadId = await this.createOrGetThread(bookingId, rideId, driverId, passengerId);
          }
        }
      }

      // Fallback: If no bookingId, use ride-based participants (group chat)
      if (participants.length === 0) {
        participants = await this.getParticipantsForRide(rideId);
      }

      if (!participants.includes(senderId)) {
        participants.push(senderId);
      }

      const messageData = {
        rideId,
        bookingId,
        threadId,
        senderId,
        senderName,
        message: message || '',
        type: 'image' as const,
        imageUrl,
        readBy: [senderId],
        participants,
        timestamp: serverTimestamp()
      };

      const messageRef = await addDoc(collection(db, 'messages'), messageData);

      // Update thread with last message info
      if (threadId) {
        await updateDoc(doc(db, 'message_threads', threadId), {
          lastMessage: '📷 Image',
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      return messageRef.id;
    } catch (error: any) {
      console.error('Send image message error:', error);
      throw new Error('Failed to send image message');
    }
  }

  // Get latest messages for a ride with pagination (default 50)
  static async getRideMessages(
    rideId: string,
    userId: string, // Required for security rules filtering
    pageSize: number = 50,
    cursor?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ messages: ChatMessage[]; nextCursor?: QueryDocumentSnapshot<DocumentData> }> {
    try {
      const base = [
        where('rideId', '==', rideId),
        where('participants', 'array-contains', userId),
        orderBy('timestamp', 'desc') as any,
        limit(Math.max(1, Math.min(200, pageSize)))
      ];

      const q = cursor
        ? query(collection(db, 'messages'), ...base, startAfter(cursor))
        : query(collection(db, 'messages'), ...base);

      const querySnapshot = await getDocs(q);
      const messages: ChatMessage[] = [];

      querySnapshot.forEach((snap) => {
        const data = snap.data();
        messages.push({
          id: snap.id,
          rideId: data.rideId,
          bookingId: data.bookingId,
          threadId: data.threadId,
          senderId: data.senderId,
          senderName: data.senderName,
          message: data.message,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
          type: data.type || 'text',
          imageUrl: data.imageUrl,
          readBy: data.readBy || [],
          participants: data.participants || []
        });
      });

      // return in ascending time for UI
      const ordered = messages.reverse();
      const nextCursor = querySnapshot.docs.length === pageSize
        ? querySnapshot.docs[querySnapshot.docs.length - 1]
        : undefined;

      return { messages: ordered, nextCursor };
    } catch (error) {
      console.error('Get ride messages error:', error);
      return { messages: [], nextCursor: undefined };
    }
  }

  // Listen to real-time messages
  static subscribeToRideMessages(
    rideId: string,
    userId: string, // Required for security rules filtering
    callback: (messages: ChatMessage[]) => void,
    pageSize: number = 50
  ): Unsubscribe {
    const q = query(
      collection(db, 'messages'),
      where('rideId', '==', rideId),
      where('participants', 'array-contains', userId),
      orderBy('timestamp', 'desc'),
      limit(Math.max(1, Math.min(200, pageSize)))
    );

    return onSnapshot(q, (querySnapshot) => {
      const messages: ChatMessage[] = [];
      querySnapshot.forEach((snap) => {
        const data = snap.data();
        messages.push({
          id: snap.id,
          rideId: data.rideId,
          bookingId: data.bookingId,
          threadId: data.threadId,
          senderId: data.senderId,
          senderName: data.senderName,
          message: data.message,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
          type: data.type || 'text',
          imageUrl: data.imageUrl,
          readBy: data.readBy || [],
          participants: data.participants || [],
          status: data.status || 'sent',
          deliveredTo: data.deliveredTo || [],
          deliveredAt: data.deliveredAt,
          readAt: data.readAt
        });
      });
      callback(messages.reverse());
    }, (error) => {
      console.error('Messages subscription error:', error);
    });
  }

  // Send system message via Cloud Function (bypasses security rules)
  static async sendSystemMessage(
    rideId: string,
    message: string
  ): Promise<string> {
    try {
      // Use Cloud Function to send system message (runs with admin privileges)
      const sendSystemMessageFn = httpsCallable(functions, 'sendSystemMessageFn');
      const result = await sendSystemMessageFn({ rideId, message });
      const data = result.data as { success: boolean; messageId: string };

      if (!data.success) {
        throw new Error('Failed to send system message');
      }

      return data.messageId;
    } catch (error: any) {
      console.error('Send system message error:', error);
      // Don't throw - system messages are non-critical
      // Log it and continue without blocking the main operation
      console.warn('System message failed, continuing without it');
      return '';
    }
  }

  // Mark messages as read and update status
  static async markMessagesAsRead(
    rideId: string,
    userId: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, 'messages'),
        where('rideId', '==', rideId),
        where('participants', 'array-contains', userId),
        where('senderId', '!=', userId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return;
      }

      const batch = writeBatch(db);
      const now = new Date().toISOString();

      querySnapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const readBy = data.readBy || [];

        if (!readBy.includes(userId)) {
          const updateData: Record<string, unknown> = {
            readBy: [...readBy, userId],
            status: 'read',  // Update status to read
          };

          // Only set readAt if this is the first read by someone other than sender
          if (!data.readAt) {
            updateData.readAt = now;
          }

          batch.update(doc(db, 'messages', docSnapshot.id), updateData);
        }
      });

      await batch.commit();
    } catch (error: unknown) {
      console.error('Mark messages as read error:', error);
    }
  }

  // Get unread message count
  static async getUnreadMessageCount(
    rideId: string,
    userId: string
  ): Promise<number> {
    try {
      const q = query(
        collection(db, 'messages'),
        where('rideId', '==', rideId),
        where('participants', 'array-contains', userId),
        where('senderId', '!=', userId)
      );

      const querySnapshot = await getDocs(q);
      let unreadCount = 0;

      querySnapshot.forEach(doc => {
        const data = doc.data();
        const readBy = data.readBy || [];
        if (!readBy.includes(userId)) {
          unreadCount++;
        }
      });

      return unreadCount;
    } catch (error: any) {
      console.error('Get unread message count error:', error);
      return 0;
    }
  }

  // Get user's message threads
  static async getUserThreads(userId: string): Promise<MessageThread[]> {
    try {
      const q = query(
        collection(db, 'message_threads'),
        where('participants', 'array-contains', userId)
      );

      const querySnapshot = await getDocs(q);
      const threads: MessageThread[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();
        threads.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          lastMessageTime: data.lastMessageTime?.toDate?.()?.toISOString() || data.lastMessageTime
        } as MessageThread);
      });

      // Sort by last message time
      threads.sort((a, b) => {
        const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bTime - aTime;
      });

      return threads;
    } catch (error: any) {
      console.error('Get user threads error:', error);
      return [];
    }
  }

  // Subscribe to user's message threads
  static subscribeToUserThreads(
    userId: string,
    callback: (threads: MessageThread[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'message_threads'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (querySnapshot) => {
      const threads: MessageThread[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        threads.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          lastMessageTime: data.lastMessageTime?.toDate?.()?.toISOString() || data.lastMessageTime
        } as MessageThread);
      });

      // Sort by last message time
      threads.sort((a, b) => {
        const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bTime - aTime;
      });

      callback(threads);
    }, (error) => {
      console.error('User threads subscription error:', error);
      callback([]);
    });
  }

  // Get total unread message count for user
  static getUnreadMessageCountForUser(
    userId: string,
    callback: (count: number) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', userId),
      where('senderId', '!=', userId),
      limit(200)
    );

    return onSnapshot(q, (querySnapshot) => {
      let unreadCount = 0;

      querySnapshot.forEach(doc => {
        const data = doc.data();
        const readBy = data.readBy || [];
        if (!readBy.includes(userId)) {
          unreadCount++;
        }
      });

      callback(unreadCount);
    }, (error) => {
      console.error('Unread count subscription error:', error);
      callback(0);
    });
  }
}