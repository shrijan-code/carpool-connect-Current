import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { ChatService } from '@/services/chat';
import { ChatMessage, Ride } from '@/types';
import { MessageCircle, Send, Phone, MoreVertical, Check, CheckCheck } from 'lucide-react-native';
import { logger } from '@/utils/logger';

interface ChatRoom {
  id: string;
  rideId: string;
  bookingId?: string;  // Added for message sending
  ride: Ride;
  otherUser: {
    id: string;
    name: string;
    role: 'driver' | 'rider';
    avatar?: string;
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface ExtendedChatMessage extends ChatMessage {
  isCurrentUser: boolean;
}

interface BookingWithRide {
  id: string;
  rideId: string;
  passengerId: string;
  status: string;
  ride: {
    id: string;
    driverId: string;
    driver: {
      name: string;
    };
    from: {
      name: string;
    };
    to: {
      name: string;
    };
  };
}

export default function ChatScreen() {
  const { user } = useAuthStore();
  const { rides, bookings } = useRidesStore();
  const params = useLocalSearchParams<{ rideId?: string }>();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(false);

  // Generate chat rooms from user's rides and bookings
  const generateChatRooms = useCallback(() => {
    if (!user) return [];

    const rooms: ChatRoom[] = [];
    const seenIds = new Set<string>(); // Track unique IDs to prevent duplicates

    // For drivers: create chat rooms with passengers who have confirmed/accepted bookings
    if (user.role === 'driver') {
      rides.forEach((ride) => {
        if (ride?.id && ride.passengers && ride.passengers.length > 0) {
          ride.passengers.forEach((passenger) => {
            if (passenger?.id && passenger.user?.name && passenger.bookingId) {
              const chatId = `driver-${ride.id}-${passenger.id}-${passenger.bookingId}`;
              if (!seenIds.has(chatId)) {
                seenIds.add(chatId);
                rooms.push({
                  id: chatId,
                  rideId: ride.id,
                  bookingId: passenger.bookingId,  // Include bookingId for message sending
                  ride,
                  otherUser: {
                    id: passenger.id,
                    name: passenger.user.name,
                    role: 'rider',
                  },
                  lastMessage: 'Start a conversation',
                  lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  unreadCount: 0,
                });
              }
            }
          });
        }
      });
    } else {
      // For riders: create chat rooms with drivers for confirmed bookings
      bookings.forEach((booking) => {
        if (booking?.rideId && booking.ride?.id && booking.ride.driver?.name &&
          booking.status === 'confirmed') {
          const chatId = `rider-${booking.rideId}-${user.id}-${booking.id}`;
          if (!seenIds.has(chatId)) {
            seenIds.add(chatId);
            rooms.push({
              id: chatId,
              rideId: booking.rideId,
              bookingId: booking.id,  // Include bookingId for message sending
              ride: booking.ride,
              otherUser: {
                id: booking.ride.driverId,
                name: booking.ride.driver.name,
                role: 'driver',
              },
              lastMessage: 'Start a conversation',
              lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              unreadCount: 0,
            });
          }
        }
      });
    }

    logger.debug('Generated chat rooms', { count: rooms.length, role: user.role });
    return rooms.filter(room => room.id && room.otherUser?.name); // Filter out invalid rooms
  }, [user, rides, bookings]);

  useEffect(() => {
    const rooms = generateChatRooms();
    setChatRooms(rooms);
  }, [generateChatRooms]);

  // Auto-select chat when navigating from notification with rideId
  useEffect(() => {
    if (params.rideId && chatRooms.length > 0 && !selectedChat) {
      const matchingRoom = chatRooms.find(room => room.rideId === params.rideId);
      if (matchingRoom) {
        handleChatSelect(matchingRoom.id);
      }
    }
  }, [params.rideId, chatRooms, selectedChat]);

  const handleChatSelect = (chatId: string) => {
    setSelectedChat(chatId);
    const room = chatRooms.find(r => r.id === chatId);
    if (room && user) {
      // Mark messages as read
      ChatService.markMessagesAsRead(room.rideId, user.id);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user) {
      console.warn('Cannot send message: missing required data', {
        hasMessage: !!newMessage.trim(),
        hasSelectedChat: !!selectedChat,
        hasUser: !!user,
        userName: user?.name
      });
      return;
    }

    const room = chatRooms.find(r => r.id === selectedChat);
    if (!room) {
      console.warn('Cannot send message: room not found', { selectedChat, availableRooms: chatRooms.length });
      return;
    }

    // Validate user data
    if (!user.id || !user.name) {
      console.error('Cannot send message: invalid user data', { userId: user.id, userName: user.name });
      Alert.alert('Error', 'User information is incomplete. Please try logging in again.');
      return;
    }

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear immediately for better UX
    setLoading(true);

    try {
      logger.debug('Sending message', { rideId: room.rideId, bookingId: room.bookingId });

      await ChatService.sendMessage(
        room.rideId,
        user.id,
        user.name,
        messageText,
        room.bookingId  // Pass bookingId to ensure participants are set correctly
      );

      logger.debug('Message sent successfully');
    } catch (error: unknown) {
      console.error('Send message error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to send message: ${errorMessage}`);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setLoading(false);
    }
  };

  // Get the rideId for the selected chat room (stable reference)
  const selectedRideId = useMemo(() => {
    if (!selectedChat) return null;
    const room = chatRooms.find(r => r.id === selectedChat);
    return room?.rideId || null;
  }, [selectedChat, chatRooms]);

  useEffect(() => {
    if (selectedRideId && user?.id) {
      logger.debug('Subscribing to messages', { rideId: selectedRideId });
      // Subscribe to messages for the selected chat
      const unsubscribe = ChatService.subscribeToRideMessages(
        selectedRideId,
        user.id,
        (newMessages) => {
          logger.debug('Received messages update', { count: newMessages.length });
          const messagesWithCurrentUser = newMessages.map(msg => ({
            ...msg,
            isCurrentUser: msg.senderId === user.id
          }));
          setMessages(messagesWithCurrentUser);
        }
      );

      return () => {
        logger.debug('Unsubscribing from messages', { rideId: selectedRideId });
        unsubscribe();
      };
    } else {
      setMessages([]);
    }
  }, [selectedRideId, user?.id]);

  // Subscribe to unread message counts for each chat room
  useEffect(() => {
    if (chatRooms.length === 0 || !user) return;

    const updateUnreadCounts = async () => {
      for (const room of chatRooms) {
        try {
          const count = await ChatService.getUnreadMessageCount(room.rideId, user.id);
          setChatRooms(prev => prev.map(r =>
            r.id === room.id ? { ...r, unreadCount: count } : r
          ));
        } catch (error) {
          console.error('Error getting unread count:', error);
        }
      }
    };

    updateUnreadCounts();
  }, [chatRooms.length, user, chatRooms]);

  const renderChatList = () => (
    <View style={styles.chatList}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>
        Chat with your ride partners
      </Text>

      {chatRooms.length > 0 ? (
        chatRooms
          .filter(chat => chat.id && chat.otherUser?.name) // Filter out invalid chats
          .map((chat, index) => {
            // Generate unique key for each chat room
            const chatKey = chat.id
              ? `chat-${chat.id}`
              : `chat-fallback-${index}-${chat.rideId || 'unknown'}-${chat.otherUser?.id || 'unknown'}-${Math.random().toString(36).substr(2, 9)}`;
            return (
              <TouchableOpacity
                key={chatKey}
                onPress={() => handleChatSelect(chat.id)}
                activeOpacity={0.8}
              >
                <Card style={styles.chatCard}>
                  <View style={styles.chatHeader}>
                    <View style={styles.chatAvatar}>
                      <Text style={styles.chatAvatarText}>
                        {chat.otherUser.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.chatInfo}>
                      <View style={styles.chatTitleRow}>
                        <Text style={styles.chatName}>{chat.otherUser.name}</Text>
                        <Text style={styles.chatTime}>{chat.lastMessageTime}</Text>
                      </View>
                      <View style={styles.chatMessageRow}>
                        <Text style={styles.chatLastMessage} numberOfLines={1}>
                          {chat.lastMessage || 'No messages yet'}
                        </Text>
                        {chat.unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{chat.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.chatRole}>
                        {chat.otherUser.role === 'driver' ? 'Driver' : 'Passenger'} • {chat.ride.from?.name || 'Unknown'} → {chat.ride.to?.name || 'Unknown'}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
      ) : (
        <Card style={styles.emptyCard}>
          <MessageCircle size={48} color={Colors.textLight} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Start a conversation with your ride partners
          </Text>
        </Card>
      )}
    </View>
  );

  const renderChatView = () => {
    const selectedChatData = chatRooms.find(chat => chat.id === selectedChat);
    if (!selectedChatData) return null;

    return (
      <View style={styles.chatView}>
        <View style={styles.chatViewHeader}>
          <TouchableOpacity
            onPress={() => setSelectedChat(null)}
            style={styles.backButton}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.chatViewInfo}>
            <Text style={styles.chatViewName}>{selectedChatData.otherUser.name}</Text>
            <Text style={styles.chatViewRole}>
              {selectedChatData.otherUser.role === 'driver' ? 'Driver' : 'Passenger'}
            </Text>
          </View>
          <View style={styles.chatViewActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Phone size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MoreVertical size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContentContainer}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 100
          }}
        >
          {messages
            .filter(message => message.id) // Filter out messages without IDs
            .map((message, index) => {
              // Generate unique key for each message
              const messageKey = message.id
                ? `message-${message.id}`
                : `message-fallback-${index}-${message.senderId || 'unknown'}-${message.timestamp || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              return (
                <View
                  key={messageKey}
                  style={[
                    styles.messageContainer,
                    message.isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      message.isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message.isCurrentUser ? styles.currentUserText : styles.otherUserText,
                      ]}
                    >
                      {message.message}
                    </Text>
                  </View>
                  <View style={styles.messageFooter}>
                    <Text style={styles.messageTime}>
                      {typeof message.timestamp === 'string'
                        ? new Date(message.timestamp).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })
                        : message.timestamp
                      }
                    </Text>
                    {/* Message status indicators - only show for current user's messages */}
                    {message.isCurrentUser && (
                      <View style={styles.messageStatus}>
                        {message.status === 'read' ? (
                          <CheckCheck size={14} color={Colors.primary} />
                        ) : message.status === 'delivered' ? (
                          <CheckCheck size={14} color={Colors.textLight} />
                        ) : (
                          <Check size={14} color={Colors.textLight} />
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
        </ScrollView>

        <View style={styles.messageInput}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textLight}
            multiline
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            style={[
              styles.sendButton,
              newMessage.trim() && styles.sendButtonActive,
            ]}
            disabled={!newMessage.trim() || loading}
          >
            <Send size={20} color={newMessage.trim() ? Colors.background : Colors.textLight} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {selectedChat ? renderChatView() : renderChatList()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  chatList: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  chatCard: {
    marginBottom: 12,
    padding: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatAvatarText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  chatInfo: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  chatTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  chatMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatLastMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  chatRole: {
    fontSize: 12,
    color: Colors.textLight,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  chatView: {
    flex: 1,
  },
  chatViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  chatViewInfo: {
    flex: 1,
  },
  chatViewName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  chatViewRole: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  chatViewActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContentContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 16,
  },
  currentUserMessage: {
    alignItems: 'flex-end',
  },
  otherUserMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 4,
  },
  currentUserBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: Colors.background,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  currentUserText: {
    color: Colors.background,
  },
  otherUserText: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageStatus: {
    marginLeft: 2,
  },
  messageInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
});