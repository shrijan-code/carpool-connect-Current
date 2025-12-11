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
import { db } from '@/config/firebase';
import { ChatMessage, MessageThread, Delivery } from '@/types';
import { ImageService } from './image';
import { NotificationService } from './notifications';

export class ChatService {
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
      
      console.log('Created new message thread:', threadRef.id);
      return threadRef.id;
    } catch (error: any) {
      console.error('Create or get thread error:', error);
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
        console.error('Missing required message parameters:', { rideId, senderId, senderName, message: message?.trim() });
        throw new Error('Missing required message parameters');
      }

      console.log('Attempting to send message:', { rideId, senderId, senderName, messageLength: message.length, bookingId });

      let threadId: string | undefined;
      
      // Create thread if bookingId is provided
      if (bookingId) {
        try {
          // Get booking to find driver and passenger IDs
          const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
          if (bookingDoc.exists()) {
            const bookingData = bookingDoc.data();
            const driverId = bookingData.ride?.driverId || bookingData.driverId;
            const passengerId = bookingData.passengerId;
            
            if (driverId && passengerId) {
              threadId = await this.createOrGetThread(bookingId, rideId, driverId, passengerId);
            }
          }
        } catch (threadError) {
          console.warn('Failed to create thread, continuing without thread:', threadError);
        }
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
        timestamp: serverTimestamp()
      };

      console.log('Sending message with data:', messageData);
      const messageRef = await addDoc(collection(db, 'messages'), messageData);
      console.log('Message sent successfully with ID:', messageRef.id);
      
      // Update thread with last message info (non-blocking)
      if (threadId) {
        try {
          await updateDoc(doc(db, 'message_threads', threadId), {
            lastMessage: message.length > 50 ? message.substring(0, 50) + '...' : message,
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (updateError) {
          console.warn('Failed to update thread, message still sent:', updateError);
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
                message
              );
            }
          }
        } catch (notificationError) {
          console.warn('Failed to send notification, message still sent:', notificationError);
        }
      }
      
      return messageRef.id;
    } catch (error: any) {
      console.error('Send message error:', error);
      throw new Error(`Failed to send message: ${error.message}`);
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
      
      // Create thread if bookingId is provided
      if (bookingId) {
        const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
        if (bookingDoc.exists()) {
          const bookingData = bookingDoc.data();
          const driverId = bookingData.ride?.driverId || bookingData.driverId;
          const passengerId = bookingData.passengerId;
          
          if (driverId && passengerId) {
            threadId = await this.createOrGetThread(bookingId, rideId, driverId, passengerId);
          }
        }
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
    pageSize: number = 50,
    cursor?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ messages: ChatMessage[]; nextCursor?: QueryDocumentSnapshot<DocumentData> }> {
    try {
      const base = [
        where('rideId', '==', rideId),
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
          readBy: data.readBy || []
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
      return [];
    }
  }

  // Listen to real-time messages
  static subscribeToRideMessages(
    rideId: string, 
    callback: (messages: ChatMessage[]) => void,
    pageSize: number = 50
  ): Unsubscribe {
    const q = query(
      collection(db, 'messages'),
      where('rideId', '==', rideId),
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
          readBy: data.readBy || []
        });
      });
      callback(messages.reverse());
    }, (error) => {
      console.error('Messages subscription error:', error);
    });
  }

  // Send system message
  static async sendSystemMessage(
    rideId: string, 
    message: string
  ): Promise<string> {
    try {
      const messageData = {
        rideId,
        senderId: 'system',
        senderName: 'System',
        message,
        type: 'system' as const,
        readBy: [],
        timestamp: serverTimestamp()
      };

      const messageRef = await addDoc(collection(db, 'messages'), messageData);
      return messageRef.id;
    } catch (error: any) {
      console.error('Send system message error:', error);
      throw new Error('Failed to send system message');
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(
    rideId: string,
    userId: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, 'messages'),
        where('rideId', '==', rideId),
        where('senderId', '!=', userId)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return;
      }

      const batch = writeBatch(db);
      querySnapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const readBy = data.readBy || [];
        
        if (!readBy.includes(userId)) {
          batch.update(doc(db, 'messages', docSnapshot.id), {
            readBy: [...readBy, userId]
          });
        }
      });

      await batch.commit();
    } catch (error: any) {
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

  // Send a delivery message
  static async sendDeliveryMessage(
    deliveryId: string,
    senderId: string,
    senderName: string,
    message: string
  ): Promise<string> {
    try {
      // Validate required parameters
      if (!deliveryId || !senderId || !senderName || !message?.trim()) {
        console.error('Missing required delivery message parameters:', { deliveryId, senderId, senderName, message: message?.trim() });
        throw new Error('Missing required message parameters');
      }

      console.log('Sending delivery message:', { deliveryId, senderId, senderName, messageLength: message.length });
      
      const messageData = {
        deliveryId,
        senderId,
        senderName,
        message: message.trim(),
        type: 'text' as const,
        readBy: [senderId],
        timestamp: serverTimestamp()
      };

      const messageRef = await addDoc(collection(db, 'delivery_messages'), messageData);
      console.log('Delivery message sent successfully with ID:', messageRef.id);
      
      // Get delivery to find the other participant for notification
      try {
        const deliveryDoc = await getDoc(doc(db, 'deliveries', deliveryId));
        if (deliveryDoc.exists()) {
          const deliveryData = deliveryDoc.data() as Delivery;
          const businessId = deliveryData.businessId;
          const driverId = deliveryData.driverId;
          
          if (businessId && driverId) {
            const recipientId = senderId === businessId ? driverId : businessId;
            if (recipientId) {
              await NotificationService.sendNewMessageNotification(
                recipientId,
                senderName,
                message
              );
            }
          }
        }
      } catch (notificationError) {
        console.warn('Failed to send notification, message still sent:', notificationError);
      }
      
      return messageRef.id;
    } catch (error: any) {
      console.error('Send delivery message error:', error);
      throw new Error(`Failed to send delivery message: ${error.message}`);
    }
  }
  
  // Get delivery messages
  static async getDeliveryMessages(
    deliveryId: string,
    pageSize: number = 50,
    cursor?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ messages: any[]; nextCursor?: QueryDocumentSnapshot<DocumentData> }> {
    try {
      const base = [
        where('deliveryId', '==', deliveryId),
        orderBy('timestamp', 'desc') as any,
        limit(Math.max(1, Math.min(200, pageSize)))
      ];

      const q = cursor
        ? query(collection(db, 'delivery_messages'), ...base, startAfter(cursor))
        : query(collection(db, 'delivery_messages'), ...base);

      const querySnapshot = await getDocs(q);
      const messages: any[] = [];

      querySnapshot.forEach((snap) => {
        const data = snap.data();
        messages.push({
          id: snap.id,
          deliveryId: data.deliveryId,
          senderId: data.senderId,
          senderName: data.senderName,
          message: data.message,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
          type: data.type || 'text',
          readBy: data.readBy || []
        });
      });

      // return in ascending time for UI
      const ordered = messages.reverse();
      const nextCursor = querySnapshot.docs.length === pageSize 
        ? querySnapshot.docs[querySnapshot.docs.length - 1]
        : undefined;

      return { messages: ordered, nextCursor };
    } catch (error) {
      console.error('Get delivery messages error:', error);
      return { messages: [] };
    }
  }

  // Listen to real-time delivery messages
  static subscribeToDeliveryMessages(
    deliveryId: string, 
    callback: (messages: any[]) => void,
    pageSize: number = 50
  ): Unsubscribe {
    const q = query(
      collection(db, 'delivery_messages'),
      where('deliveryId', '==', deliveryId),
      orderBy('timestamp', 'desc'),
      limit(Math.max(1, Math.min(200, pageSize)))
    );

    return onSnapshot(q, (querySnapshot) => {
      const messages: any[] = [];
      querySnapshot.forEach((snap) => {
        const data = snap.data();
        messages.push({
          id: snap.id,
          deliveryId: data.deliveryId,
          senderId: data.senderId,
          senderName: data.senderName,
          message: data.message,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
          type: data.type || 'text',
          readBy: data.readBy || []
        });
      });
      callback(messages.reverse());
    }, (error) => {
      console.error('Delivery messages subscription error:', error);
      callback([]);
    });
  }

  // Mark delivery messages as read
  static async markDeliveryMessagesAsRead(
    deliveryId: string,
    userId: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, 'delivery_messages'),
        where('deliveryId', '==', deliveryId),
        where('senderId', '!=', userId)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return;
      }

      const batch = writeBatch(db);
      querySnapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const readBy = data.readBy || [];
        
        if (!readBy.includes(userId)) {
          batch.update(doc(db, 'delivery_messages', docSnapshot.id), {
            readBy: [...readBy, userId]
          });
        }
      });

      await batch.commit();
    } catch (error: any) {
      console.error('Mark delivery messages as read error:', error);
    }
  }
}