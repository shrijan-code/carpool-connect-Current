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

    // Handle navigation based on notification type
    switch (notification.type) {
      case 'ride_booked':
      case 'ride_confirmed':
      case 'ride_cancelled':
      case 'ride_completed':
        // Navigate to rides screen
        router.push('/(tabs)/rides');
        break;
      case 'message':
        // Navigate to chat screen
        router.push('/(tabs)/chat');
        break;
      case 'ride_request':
        // Navigate to ride details if rideId is available
        if (notification.data?.rideId) {
          router.push({ pathname: '/ride-details', params: { id: notification.data.rideId } });
        } else {
          router.push('/(tabs)/rides');
        }
        break;
      case 'delivery_new':
      case 'delivery_accepted':
      case 'delivery_status_update':
      case 'delivery_completed':
      case 'delivery_cancelled':
        // Navigate to deliveries screen
        router.push('/(tabs)/deliveries');
        break;
      default:
        // Default to home screen
        router.push('/(tabs)/home');
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