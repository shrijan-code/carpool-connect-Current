import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import {
  Bell,
  MapPin,
  Clock,
  Car,
  CheckCircle,
  AlertCircle,
  Navigation,
  Phone,
  MessageCircle,
} from 'lucide-react-native';
import { realTimeRideService, RideUpdate, NotificationData, RideStatus } from '@/services/real-time-ride';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface RealTimeRideTrackerProps {
  rideId: string;
  userId: string;
  isDriver?: boolean;
}

export const RealTimeRideTracker: React.FC<RealTimeRideTrackerProps> = ({
  rideId,
  userId,
  isDriver = false,
}) => {
  const [currentUpdate, setCurrentUpdate] = useState<RideUpdate | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [timeline, setTimeline] = useState<RideUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for active status
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    if (currentUpdate?.status === 'driver_en_route' || currentUpdate?.status === 'in_progress') {
      pulse.start();
    } else {
      pulse.stop();
      pulseAnim.setValue(1);
    }

    return () => pulse.stop();
  }, [currentUpdate?.status, pulseAnim]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeRide = realTimeRideService.subscribeToRideUpdates(
      rideId,
      (update) => {
        setCurrentUpdate(update);
        setTimeline(prev => [...prev, update]);
      }
    );

    const unsubscribeNotifications = realTimeRideService.subscribeToNotifications(
      userId,
      (notification) => {
        setNotifications(prev => [notification, ...prev]);
      }
    );

    setLoading(false);

    return () => {
      unsubscribeRide();
      unsubscribeNotifications();
    };
  }, [rideId, userId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rideTimeline = await realTimeRideService.getRideTimeline(rideId);
      setTimeline(rideTimeline);
    } catch (error) {
      console.error('Error refreshing timeline:', error);
    } finally {
      setRefreshing(false);
    }
  }, [rideId]);

  const handleStatusUpdate = async (status: RideStatus, message?: string) => {
    try {
      await realTimeRideService.updateRideStatus(rideId, status, undefined, message);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleEmergency = async () => {
    try {
      await realTimeRideService.sendEmergencyAlert(
        rideId,
        userId,
        { latitude: 0, longitude: 0 }, // Would get actual location
        'Emergency assistance requested'
      );
    } catch (error) {
      console.error('Error sending emergency alert:', error);
    }
  };

  const getStatusIcon = (status: RideStatus) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={24} color="#10B981" />;
      case 'driver_en_route':
        return <Car size={24} color="#F59E0B" />;
      case 'arrived':
        return <MapPin size={24} color="#3B82F6" />;
      case 'in_progress':
        return <Navigation size={24} color="#8B5CF6" />;
      case 'completed':
        return <CheckCircle size={24} color="#10B981" />;
      case 'cancelled':
        return <AlertCircle size={24} color="#EF4444" />;
      default:
        return <Clock size={24} color="#6B7280" />;
    }
  };

  const getStatusColor = (status: RideStatus) => {
    switch (status) {
      case 'confirmed':
        return '#10B981';
      case 'driver_en_route':
        return '#F59E0B';
      case 'arrived':
        return '#3B82F6';
      case 'in_progress':
        return '#8B5CF6';
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusMessage = (status: RideStatus) => {
    switch (status) {
      case 'pending':
        return 'Waiting for confirmation...';
      case 'confirmed':
        return 'Ride confirmed! Driver will be assigned soon.';
      case 'driver_en_route':
        return 'Driver is on the way to pick you up';
      case 'arrived':
        return 'Driver has arrived at pickup location';
      case 'in_progress':
        return 'Ride is in progress';
      case 'completed':
        return 'Ride completed successfully';
      case 'cancelled':
        return 'Ride has been cancelled';
      default:
        return 'Unknown status';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Loading ride status...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Current Status Card */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Animated.View
            style={[
              styles.statusIconContainer,
              {
                backgroundColor: getStatusColor(currentUpdate?.status || 'pending'),
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            {getStatusIcon(currentUpdate?.status || 'pending')}
          </Animated.View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>
              {currentUpdate?.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
            </Text>
            <Text style={styles.statusMessage}>
              {currentUpdate?.message || getStatusMessage(currentUpdate?.status || 'pending')}
            </Text>
          </View>
        </View>

        {currentUpdate?.estimatedArrival && (
          <View style={styles.estimatedArrival}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.estimatedArrivalText}>
              ETA: {currentUpdate.estimatedArrival.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {currentUpdate?.driverInfo && (
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{currentUpdate.driverInfo.name}</Text>
            <Text style={styles.vehicleInfo}>{currentUpdate.driverInfo.vehicleInfo}</Text>
            <View style={styles.driverActions}>
              <TouchableOpacity style={styles.actionButton}>
                <Phone size={16} color="#007AFF" />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <MessageCircle size={16} color="#007AFF" />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Card>

      {/* Driver Controls */}
      {isDriver && (
        <Card style={styles.driverControls}>
          <Text style={styles.controlsTitle}>Update Ride Status</Text>
          <View style={styles.controlButtons}>
            <Button
              title="En Route"
              onPress={() => handleStatusUpdate('driver_en_route')}
              variant="outline"
              style={styles.controlButton}
            />
            <Button
              title="Arrived"
              onPress={() => handleStatusUpdate('arrived')}
              variant="outline"
              style={styles.controlButton}
            />
            <Button
              title="Start Ride"
              onPress={() => handleStatusUpdate('in_progress')}
              style={styles.controlButton}
            />
            <Button
              title="Complete"
              onPress={() => handleStatusUpdate('completed')}
              style={styles.controlButton}
            />
          </View>
        </Card>
      )}

      {/* Emergency Button */}
      <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergency}>
        <AlertCircle size={20} color="#FFFFFF" />
        <Text style={styles.emergencyButtonText}>Emergency</Text>
      </TouchableOpacity>

      {/* Recent Notifications */}
      {notifications.length > 0 && (
        <Card style={styles.notificationsCard}>
          <View style={styles.notificationsHeader}>
            <Bell size={20} color="#374151" />
            <Text style={styles.notificationsTitle}>Recent Updates</Text>
          </View>
          {notifications.slice(0, 3).map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>
                  {notification.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              {!notification.read && <View style={styles.unreadDot} />}
            </View>
          ))}
        </Card>
      )}

      {/* Ride Timeline */}
      <Card style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Ride Timeline</Text>
        {timeline.length === 0 ? (
          <Text style={styles.emptyTimeline}>No updates yet</Text>
        ) : (
          timeline.map((update, index) => (
            <View key={`${update.id}-${index}`} style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                {getStatusIcon(update.status)}
                {index < timeline.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>
                  {update.status.replace('_', ' ').toUpperCase()}
                </Text>
                {update.message && (
                  <Text style={styles.timelineMessage}>{update.message}</Text>
                )}
                <Text style={styles.timelineTime}>
                  {update.timestamp.toLocaleString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  statusCard: {
    marginBottom: 16,
    padding: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statusMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  estimatedArrival: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  estimatedArrivalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  driverInfo: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  driverActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  driverControls: {
    marginBottom: 16,
    padding: 16,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  controlButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    minWidth: 100,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  emergencyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notificationsCard: {
    marginBottom: 16,
    padding: 16,
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notificationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginTop: 4,
  },
  timelineCard: {
    padding: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  emptyTimeline: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  timelineIconContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    top: 32,
    width: 2,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  timelineMessage: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});