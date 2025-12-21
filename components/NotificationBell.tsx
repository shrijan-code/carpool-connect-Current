import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { NotificationService, InAppNotification } from '@/services/notifications';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { formatTimeAgo } from '@/utils/formatters';

export const NotificationBell = React.memo(() => {
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);

  useEffect(() => {
    if (!user?.id) {
      NotificationService.clearCache();
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    const unsubscribeCount = NotificationService.getUnreadCount(
      user.id,
      setUnreadCount,
      true
    );

    const unsubscribeNotifications = NotificationService.getUserNotifications(
      user.id,
      setNotifications,
      true
    );

    const removeListener = NotificationService.addNotificationListener((n) => {
      try {
        // Disable immediate alerts to prevent popup storms on login
        // Users can check notifications via the bell icon instead
        console.log('New notification received:', n.title, n.body);
      } catch (e) {
        console.log('notification listener error', e);
      }
    });

    return () => {
      unsubscribeCount();
      unsubscribeNotifications();
      removeListener();
    };
  }, [user?.id]);

  const handleNotificationPress = useCallback(async (notification: InAppNotification) => {
    if (!notification.read && user?.id) {
      await NotificationService.markAsRead(notification.id, user.id);
    }

    setShowModal(false);

    // Handle navigation based on notification type and data
    // Types stored in Firestore: 'booking' | 'payment' | 'ride' | 'system' | 'reminder'
    const { type, data } = notification;

    switch (type) {
      case 'booking':
        // For booking notifications, navigate based on available data
        if (data?.bookingId) {
          // Navigate to booking management if we have a bookingId
          router.push({ pathname: '/booking-management', params: { bookingId: data.bookingId } });
        } else if (data?.rideId) {
          // Fallback to ride details if we have rideId
          router.push({ pathname: '/ride-details', params: { id: data.rideId } });
        } else {
          // Fallback to booking requests for drivers or rides tab
          router.push('/booking-requests');
        }
        break;

      case 'ride':
        // For ride notifications, navigate to ride details
        if (data?.rideId) {
          router.push({ pathname: '/ride-details', params: { id: data.rideId } });
        } else if (data?.bookingId) {
          router.push({ pathname: '/booking-management', params: { bookingId: data.bookingId } });
        } else {
          router.push('/(tabs)/rides');
        }
        break;

      case 'payment':
        // For payment notifications, navigate to ride or booking details
        if (data?.bookingId) {
          router.push({ pathname: '/booking-management', params: { bookingId: data.bookingId } });
        } else if (data?.rideId) {
          router.push({ pathname: '/ride-details', params: { id: data.rideId } });
        } else {
          router.push('/(tabs)/rides');
        }
        break;

      case 'reminder':
        // For reminders, go to ride details
        if (data?.rideId) {
          router.push({ pathname: '/ride-details', params: { id: data.rideId } });
        } else {
          router.push('/(tabs)/rides');
        }
        break;

      case 'message':
        // For message notifications, go to chat
        if (data?.rideId) {
          router.push({ pathname: '/(tabs)/chat', params: { rideId: data.rideId } });
        } else {
          router.push('/(tabs)/chat');
        }
        break;

      case 'system':
      default:
        // For system notifications or unknown types, check data first
        if (data?.rideId) {
          router.push({ pathname: '/ride-details', params: { id: data.rideId } });
        } else if (data?.bookingId) {
          router.push({ pathname: '/booking-management', params: { bookingId: data.bookingId } });
        } else {
          router.push('/(tabs)/home');
        }
        break;
    }
  }, [user?.id]);

  // Memoized render callback
  const renderNotification = useCallback(({ item }: { item: InAppNotification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadNotification]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  ), [styles, handleNotificationPress]);

  return (
    <>
      <TouchableOpacity
        style={styles.bellContainer}
        onPress={() => setShowModal(true)}
        testID="notification-bell"
      >
        <Bell size={24} color={colors.background} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount.toString()}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.notificationsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Bell size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </>
  );
});

const createStyles = (colors: any) => StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  notificationsList: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  unreadNotification: {
    backgroundColor: colors.primary + '20',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
});