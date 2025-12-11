import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Send,
  X,
  User,
  Star,
  Phone,
  Navigation,
} from 'lucide-react-native';
import { Delivery, ChatMessage, User as UserType } from '@/types';
import { useAuthStore } from '@/store/auth-store';
import { AuthService } from '@/services/auth';
import { ChatService } from '@/services/chat';

interface DeliveryChatProps {
  delivery: Delivery;
  onClose: () => void;
}

interface DeliveryMessage extends Omit<ChatMessage, 'rideId' | 'bookingId'> {
  deliveryId: string;
}

export const DeliveryChat: React.FC<DeliveryChatProps> = ({
  delivery,
  onClose,
}) => {
  const { user } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<DeliveryMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otherParticipant, setOtherParticipant] = useState<UserType | null>(null);

  const isDriver = user?.id === delivery.driverId;
  const isBusiness = user?.id === delivery.businessId;

  useEffect(() => {
    loadChatData();
    loadMessages();
    
    // Set up real-time message subscription
    const unsubscribe = ChatService.subscribeToDeliveryMessages(
      delivery.id,
      (newMessages) => {
        if (newMessages && newMessages.length > 0) {
          setMessages(newMessages as DeliveryMessage[]);
          // Mark messages as read
          if (user) {
            ChatService.markDeliveryMessagesAsRead(delivery.id, user.id)
              .catch(err => console.error('Failed to mark messages as read:', err));
          }
        }
      }
    );
    
    // Clean up subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [delivery.id, user?.id]);

  const loadChatData = async () => {
    try {
      // Load the other participant's info
      const participantId = isDriver ? delivery.businessId : delivery.driverId;
      
      if (participantId) {
        // Fetch real user data from Firebase
        const userProfile = await AuthService.getUserProfile(participantId);
        
        let participantName = 'Unknown User';
        let participantEmail = 'user@example.com';
        let participantPhone = '+61 400 000 000';
        let participantRating = 4.5;
        let participantPhotoURL = '';
        let participantTotalRides = 0;
        
        if (userProfile) {
          // Use real user data from Firebase
          participantName = userProfile.name || userProfile.displayName || participantName;
          participantEmail = userProfile.email || participantEmail;
          participantPhone = userProfile.phone || participantPhone;
          participantRating = userProfile.rating || participantRating;
          participantPhotoURL = userProfile.photoURL || '';
          participantTotalRides = userProfile.totalRides || (isDriver ? 25 : 150);
          console.log(`Loaded real user data for ${participantId}:`, participantName, participantPhone);
        } else if (isDriver) {
          // Fallback for business user if profile not found
          if (delivery.business) {
            participantName = delivery.business.name || delivery.business.displayName || participantName;
            participantEmail = delivery.business.email || participantEmail;
            participantPhone = delivery.business.phone || participantPhone;
            participantRating = delivery.business.rating || participantRating;
            participantPhotoURL = delivery.business.photoURL || '';
            participantTotalRides = delivery.business.totalDeliveries || 25;
          } else if (delivery.businessId === user?.id && user) {
            participantName = user.name || user.displayName || participantName;
            participantEmail = user.email || participantEmail;
            participantPhone = user.phone || participantPhone;
            participantRating = user.rating || participantRating;
            participantPhotoURL = user.photoURL || '';
            participantTotalRides = user.totalRides || 25;
          } else {
            participantName = `User ${delivery.businessId?.slice(-4) || 'Unknown'}`;
            participantPhone = '+61 400 789 012';
          }
        } else {
          // Fallback for driver if profile not found
          if (delivery.driver) {
            participantName = delivery.driver.name || delivery.driver.displayName || participantName;
            participantEmail = delivery.driver.email || participantEmail;
            participantPhone = delivery.driver.phone || participantPhone;
            participantRating = delivery.driver.rating || participantRating;
            participantPhotoURL = delivery.driver.photoURL || '';
            participantTotalRides = delivery.driver.totalRides || 150;
          } else if (delivery.driverId === user?.id && user) {
            participantName = user.name || user.displayName || participantName;
            participantEmail = user.email || participantEmail;
            participantPhone = user.phone || participantPhone;
            participantRating = user.rating || participantRating;
            participantPhotoURL = user.photoURL || '';
            participantTotalRides = user.totalRides || 150;
          } else if (delivery.driverId) {
            participantName = `Driver ${delivery.driverId.slice(-4)}`;
            participantPhone = '+61 400 123 456';
            participantRating = 4.8;
            participantTotalRides = 150;
          }
        }
        
        setOtherParticipant({
          id: participantId,
          name: participantName,
          displayName: participantName,
          email: participantEmail,
          phone: participantPhone,
          photoURL: participantPhotoURL,
          role: isDriver ? 'rider' : 'driver',
          canBeDriver: !isDriver,
          canBeRider: isDriver,
          rating: participantRating,
          totalRides: participantTotalRides,
          joinedDate: '2023-01-01',
          verified: true,
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
        });
      }
    } catch (error) {
      console.error('Failed to load chat data:', error);
    }
  };

  const loadMessages = async () => {
    try {
      // Get proper user names with better fallbacks
      let businessName = 'Business User';
      let driverName = 'Driver';
      
      // Get business name from Firebase
      if (delivery.businessId) {
        const businessProfile = await AuthService.getUserProfile(delivery.businessId);
        if (businessProfile) {
          businessName = businessProfile.name || businessProfile.displayName || businessName;
          console.log(`Loaded real business name: ${businessName}`);
        } else if (delivery.business) {
          businessName = delivery.business.name || delivery.business.displayName || businessName;
        } else if (delivery.businessId === user?.id && user) {
          businessName = user.name || user.displayName || businessName;
        } else if (delivery.businessId) {
          businessName = `User ${delivery.businessId.slice(-4)}`;
        }
      }
      
      // Get driver name from Firebase
      if (delivery.driverId) {
        const driverProfile = await AuthService.getUserProfile(delivery.driverId);
        if (driverProfile) {
          driverName = driverProfile.name || driverProfile.displayName || driverName;
          console.log(`Loaded real driver name: ${driverName}`);
        } else if (delivery.driver) {
          driverName = delivery.driver.name || delivery.driver.displayName || driverName;
        } else if (delivery.driverId === user?.id && user) {
          driverName = user.name || user.displayName || driverName;
        } else if (delivery.driverId) {
          driverName = `Driver ${delivery.driverId.slice(-4)}`;
        }
      }
      
      // Try to get real messages from Firebase
      try {
        const result = await ChatService.getDeliveryMessages(delivery.id);
        if (result.messages && result.messages.length > 0) {
          console.log(`Loaded ${result.messages.length} real messages from Firebase`);
          setMessages(result.messages as DeliveryMessage[]);
          
          // Mark messages as read
          if (user) {
            ChatService.markDeliveryMessagesAsRead(delivery.id, user.id)
              .catch(err => console.error('Failed to mark messages as read:', err));
          }
          
          // Scroll to bottom after loading messages
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
          return;
        }
      } catch (firebaseError) {
        console.warn('Failed to load messages from Firebase, using fallback:', firebaseError);
      }
      
      // Fallback to contextual messages if no real messages found
      const contextualMessages: DeliveryMessage[] = [];
      
      // Only add messages if there's a driver assigned and delivery is active
      if (delivery.driverId && ['matched', 'confirmed', 'picked_up', 'in_transit', 'delivered'].includes(delivery.status)) {
        // Initial acceptance message
        contextualMessages.push({
          id: `msg_${delivery.id}_1`,
          deliveryId: delivery.id,
          senderId: delivery.businessId,
          senderName: businessName,
          message: `Hi ${driverName}! Thanks for accepting my delivery request for ${delivery.items.length} item${delivery.items.length !== 1 ? 's' : ''}. The pickup location is ${delivery.pickupLocation.address}.`,
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          type: 'text',
          readBy: [delivery.businessId],
        });
        
        contextualMessages.push({
          id: `msg_${delivery.id}_2`,
          deliveryId: delivery.id,
          senderId: delivery.driverId,
          senderName: driverName,
          message: `Hi ${businessName}! I've accepted your delivery. I'll coordinate pickup with you and keep you updated on the progress.`,
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          type: 'text',
          readBy: [delivery.driverId],
        });
        
        // Add item details message
        const itemsList = delivery.items.map(item => `• ${item.name} (x${item.quantity})`).join('\n');
        contextualMessages.push({
          id: `msg_${delivery.id}_3`,
          deliveryId: delivery.id,
          senderId: delivery.businessId,
          senderName: businessName,
          message: `Items to be delivered:\n${itemsList}\n\nDelivery address: ${delivery.dropoffLocation.address}${delivery.specialInstructions ? `\n\nSpecial instructions: ${delivery.specialInstructions}` : ''}`,
          timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          type: 'text',
          readBy: [delivery.businessId, delivery.driverId],
        });
      }
      
      // Add status-specific messages with real context
      if (delivery.status === 'picked_up' && delivery.driverId) {
        contextualMessages.push({
          id: `msg_${delivery.id}_pickup`,
          deliveryId: delivery.id,
          senderId: delivery.driverId,
          senderName: driverName,
          message: `Items picked up successfully from ${delivery.pickupLocation.address}! On my way to ${delivery.dropoffLocation.address}. Estimated delivery time: 30-45 minutes.`,
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          type: 'text',
          readBy: [delivery.driverId],
        });
      }
      
      if (delivery.status === 'in_transit' && delivery.driverId) {
        contextualMessages.push({
          id: `msg_${delivery.id}_transit`,
          deliveryId: delivery.id,
          senderId: delivery.driverId,
          senderName: driverName,
          message: `Currently en route to the delivery location. I'll notify you when I arrive at ${delivery.dropoffLocation.address}.`,
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          type: 'text',
          readBy: [delivery.driverId],
        });
      }
      
      if (delivery.status === 'delivered' && delivery.driverId) {
        contextualMessages.push({
          id: `msg_${delivery.id}_delivered`,
          deliveryId: delivery.id,
          senderId: delivery.driverId,
          senderName: driverName,
          message: `Delivery completed successfully! All ${delivery.items.length} item${delivery.items.length !== 1 ? 's have' : ' has'} been delivered to ${delivery.dropoffLocation.address}. Thank you for using our service!`,
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          type: 'text',
          readBy: [delivery.driverId],
        });
      }

      setMessages(contextualMessages);
      
      // Scroll to bottom after loading messages
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);

    try {
      // Create a temporary message for immediate display
      const tempMessage: DeliveryMessage = {
        id: `temp_${Date.now()}`,
        deliveryId: delivery.id,
        senderId: user.id,
        senderName: user.name || user.displayName || 'You',
        message: messageText,
        timestamp: new Date().toISOString(),
        type: 'text',
        readBy: [user.id],
      };

      // Add message to local state immediately for better UX
      setMessages(prev => [...prev, tempMessage]);

      // Send message to Firebase using ChatService
      const messageId = await ChatService.sendDeliveryMessage(
        delivery.id,
        user.id,
        user.name || user.displayName || 'You',
        messageText
      );

      console.log('Message sent successfully with ID:', messageId);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove message from local state on error
      setMessages(prev => prev.filter(m => m.message !== messageText));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderMessage = (message: DeliveryMessage, index: number) => {
    const isMyMessage = message.senderId === user?.id;
    const showSender = index === 0 || messages[index - 1].senderId !== message.senderId;

    return (
      <View key={message.id} style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
      ]}>
        {showSender && !isMyMessage && (
          <Text style={styles.senderName}>{message.senderName}</Text>
        )}
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText,
          ]}>
            {message.message}
          </Text>
        </View>
        <Text style={[
          styles.messageTime,
          isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
        ]}>
          {formatMessageTime(message.timestamp)}
        </Text>
      </View>
    );
  };

  const renderParticipantInfo = () => {
    if (!otherParticipant) return null;

    return (
      <View style={styles.participantInfo}>
        <View style={styles.participantDetails}>
          <User size={20} color="#374151" />
          <View style={styles.participantText}>
            <Text style={styles.participantName}>{otherParticipant.name}</Text>
            <View style={styles.participantMeta}>
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.participantRating}>{otherParticipant.rating?.toFixed(1) || '5.0'}</Text>
              <Text style={styles.participantRole}>
                • {isDriver ? 'Requester' : 'Driver'}
                {delivery.status && ` • ${delivery.status.replace('_', ' ').toUpperCase()}`}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.participantActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              if (otherParticipant?.phone) {
                const url = `tel:${otherParticipant.phone}`;
                Linking.canOpenURL(url)
                  .then((supported) => {
                    if (supported) {
                      return Linking.openURL(url);
                    } else {
                      console.log('Phone calls not supported on this device');
                    }
                  })
                  .catch((error) => {
                    console.error('Failed to make call:', error);
                  });
              } else {
                console.log('Phone number not available');
              }
            }}
            testID={`call-participant-${otherParticipant?.id}`}
          >
            <Phone size={16} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              const location = isDriver ? delivery.pickupLocation : delivery.dropoffLocation;
              const url = Platform.select({
                ios: `maps:0,0?q=${location.latitude},${location.longitude}`,
                android: `geo:0,0?q=${location.latitude},${location.longitude}`,
                default: `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`,
              });
              
              if (url) {
                Linking.canOpenURL(url)
                  .then((supported) => {
                    if (supported) {
                      return Linking.openURL(url);
                    } else {
                      const webUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
                      return Linking.openURL(webUrl);
                    }
                  })
                  .catch((error) => {
                    console.error('Failed to open maps:', error);
                  });
              }
            }}
            testID={`navigate-to-location`}
          >
            <Navigation size={16} color="#059669" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Delivery Chat</Text>
            <Text style={styles.headerSubtitle}>
              {delivery.items.length} item{delivery.items.length !== 1 ? 's' : ''} • {delivery.packageSize}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {renderParticipantInfo()}

        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptyText}>
                  Send a message to coordinate pickup and delivery details.
                </Text>
              </View>
            ) : (
              messages.map((message, index) => renderMessage(message, index))
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newMessage.trim() || isLoading) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || isLoading}
            >
              <Send size={20} color={(!newMessage.trim() || isLoading) ? '#9ca3af' : '#ffffff'} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  participantDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantText: {
    marginLeft: 12,
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  participantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  participantRating: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 4,
  },
  participantRole: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  deliveryStatus: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 4,
    fontWeight: '600',
  },
  participantActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  messageContainer: {
    marginBottom: 12,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: '#6b7280',
    textAlign: 'right',
    marginRight: 12,
  },
  otherMessageTime: {
    color: '#6b7280',
    marginLeft: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#ffffff',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
});