import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import {
  Activity,
  MapPin,
  Clock,
  DollarSign,
  MessageCircle,
  Bell,
  CheckCircle,
  AlertCircle,
  Car,
  Navigation,
  TrendingUp,
  Calendar,
  Star,
  Shield
} from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { EmergencyContactService } from '@/services/emergency-contacts';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';

interface DashboardStats {
  totalRides: number;
  activeRides: number;
  completedRides: number;
  totalEarnings: number;
  averageRating: number;
  pendingBookings: number;
  confirmedBookings: number;
  upcomingRides: number;
}

interface LiveActivity {
  id: string;
  type: 'booking_request' | 'booking_confirmed' | 'ride_started' | 'ride_completed' | 'message' | 'payment';
  title: string;
  description: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high';
  actionRequired?: boolean;
  relatedId?: string;
}

export default function LiveDashboardScreen() {
  const { user } = useAuthStore();
  const {
    rides,
    bookings,
    loadUserRides,
    loadUserBookings,
    getUserBookings,
    getUserRides,
    getPendingBookingRequests,
    subscribeToUserRides,
    subscribeToUserBookings
  } = useRidesStore();

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalRides: 0,
    activeRides: 0,
    completedRides: 0,
    totalEarnings: 0,
    averageRating: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    upcomingRides: 0
  });
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'earnings'>('overview');

  const isDriver = user?.role === 'driver' || user?.preferredRole === 'driver';

  // Calculate dashboard statistics
  const calculateStats = useCallback(() => {
    if (!user?.id) return;

    if (isDriver) {
      const userRides = getUserRides(user.id, 'driver');
      const totalRides = userRides.length;
      const activeRides = userRides.filter(r => r.status === 'upcoming' || r.status === 'active').length;
      const completedRides = userRides.filter(r => r.status === 'completed').length;

      // Calculate earnings from BOOKINGS (not ride.passengers which may be empty)
      // Get all bookings and filter those for completed rides where this user is driver
      const allBookings = bookings || [];
      const completedRideIds = new Set(
        userRides.filter(r => r.status === 'completed').map(r => r.id)
      );

      // Driver earnings = completed booking amounts minus platform fee
      const totalEarnings = allBookings
        .filter(b =>
          b.status === 'completed' &&
          completedRideIds.has(b.rideId)
        )
        .reduce((sum, booking) => {
          // Driver gets total - platform fee ($5)
          const driverEarning = (booking.amountTotal || 0) - 500;
          return sum + Math.max(0, driverEarning);
        }, 0);

      // Get pending booking requests
      getPendingBookingRequests(user.id).then(pendingRequests => {
        setStats(prev => ({
          ...prev,
          pendingBookings: pendingRequests.length
        }));
      });

      setStats(prev => ({
        ...prev,
        totalRides,
        activeRides,
        completedRides,
        totalEarnings: totalEarnings / 100, // Convert from cents
        averageRating: user.rating || 4.5
      }));
    } else {
      // Rider statistics
      const userBookings = getUserBookings(user.id);
      const confirmedBookings = userBookings.filter(b => b.status === 'confirmed').length;
      const pendingBookings = userBookings.filter(b => b.status === 'pending_driver').length;
      const upcomingRides = userBookings.filter(b =>
        b.status === 'confirmed' &&
        new Date(b.ride.departureAt || b.ride.departureTime || '') > new Date()
      ).length;

      const totalSpent = userBookings
        .filter(b => b.status === 'confirmed')
        .reduce((sum, booking) => sum + (booking.amountTotal || 0), 0);

      setStats(prev => ({
        ...prev,
        confirmedBookings,
        pendingBookings,
        upcomingRides,
        totalEarnings: totalSpent / 100, // Convert from cents (represents spending for riders)
        averageRating: user.rating || 4.5
      }));
    }
  }, [user, isDriver, getUserRides, getUserBookings, getPendingBookingRequests]);

  // Generate live activities
  const generateLiveActivities = useCallback(() => {
    if (!user?.id) return;

    const activities: LiveActivity[] = [];
    const now = new Date();

    if (isDriver) {
      const userRides = getUserRides(user.id, 'driver');

      // Add recent ride activities
      userRides.slice(0, 5).forEach(ride => {
        if (ride.status === 'upcoming') {
          const departureTime = new Date(ride.departureAt || ride.departureTime || '');
          const hoursUntilDeparture = (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (hoursUntilDeparture <= 24 && hoursUntilDeparture > 0) {
            activities.push({
              id: `ride-${ride.id}`,
              type: 'ride_started',
              title: 'Upcoming Ride',
              description: `${ride.from?.name || ride.origin?.name} → ${ride.to?.name || ride.destination?.name} in ${Math.round(hoursUntilDeparture)}h`,
              timestamp: ride.departureAt || ride.departureTime || '',
              priority: hoursUntilDeparture <= 2 ? 'high' : 'medium',
              actionRequired: hoursUntilDeparture <= 1,
              relatedId: ride.id
            });
          }
        }
      });

      // Add pending booking requests
      getPendingBookingRequests(user.id).then(pendingRequests => {
        pendingRequests.slice(0, 3).forEach(booking => {
          activities.push({
            id: `booking-${booking.id}`,
            type: 'booking_request',
            title: 'New Booking Request',
            description: `${booking.passenger?.name} wants to book ${booking.seats} seat(s)`,
            timestamp: booking.createdAt,
            priority: 'high',
            actionRequired: true,
            relatedId: booking.id
          });
        });

        setLiveActivities([...activities, ...pendingRequests.slice(0, 3).map(booking => ({
          id: `booking-${booking.id}`,
          type: 'booking_request' as const,
          title: 'New Booking Request',
          description: `${booking.passenger?.name} wants to book ${booking.seats} seat(s)`,
          timestamp: booking.createdAt,
          priority: 'high' as const,
          actionRequired: true,
          relatedId: booking.id
        }))]);
      });
    } else {
      // Rider activities
      const userBookings = getUserBookings(user.id);

      userBookings.slice(0, 5).forEach(booking => {
        if (booking.status === 'confirmed') {
          const departureTime = new Date(booking.ride.departureAt || booking.ride.departureTime || '');
          const hoursUntilDeparture = (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (hoursUntilDeparture <= 24 && hoursUntilDeparture > 0) {
            activities.push({
              id: `booking-${booking.id}`,
              type: 'ride_started',
              title: 'Upcoming Ride',
              description: `${booking.ride.from?.name || booking.ride.origin?.name} → ${booking.ride.to?.name || booking.ride.destination?.name} in ${Math.round(hoursUntilDeparture)}h`,
              timestamp: booking.ride.departureAt || booking.ride.departureTime || '',
              priority: hoursUntilDeparture <= 2 ? 'high' : 'medium',
              actionRequired: hoursUntilDeparture <= 1,
              relatedId: booking.ride.id
            });
          }
        } else if (booking.status === 'pending_driver') {
          activities.push({
            id: `pending-${booking.id}`,
            type: 'booking_request',
            title: 'Waiting for Driver',
            description: `Your booking request is pending driver approval`,
            timestamp: booking.createdAt,
            priority: 'medium',
            actionRequired: false,
            relatedId: booking.id
          });
        }
      });
    }

    // Sort by priority and timestamp
    activities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setLiveActivities(activities.slice(0, 10));
  }, [user, isDriver, getUserRides, getUserBookings, getPendingBookingRequests]);

  // Load data and set up real-time subscriptions
  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      if (isDriver) {
        await loadUserRides(user.id);
      } else {
        await loadUserBookings(user.id);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }, [user?.id, isDriver, loadUserRides, loadUserBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    calculateStats();
    generateLiveActivities();
  }, [calculateStats, generateLiveActivities, rides, bookings]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribes: (() => void)[] = [];

    if (isDriver) {
      unsubscribes.push(subscribeToUserRides(user.id));
    } else {
      unsubscribes.push(subscribeToUserBookings(user.id));
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user?.id, isDriver, subscribeToUserRides, subscribeToUserBookings]);

  const handleActivityPress = (activity: LiveActivity) => {
    if (activity.relatedId) {
      if (activity.type === 'booking_request' && isDriver) {
        // Pass bookingId to highlight the specific booking request
        router.push({ pathname: '/booking-requests', params: { bookingId: activity.relatedId } });
      } else if (activity.relatedId) {
        router.push({ pathname: '/ride-details', params: { id: activity.relatedId } });
      }
    }
  };

  const handleEmergencyContact = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Emergency Contact', 'Emergency contact feature is available on mobile devices.');
    } else {
      Alert.alert(
        '🚨 Emergency Contact',
        'Are you in an emergency? Select an option below.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: '📞 Call 000 (Emergency)',
            onPress: () => {
              Linking.openURL('tel:000').catch(() => {
                Alert.alert('Error', 'Unable to make call. Please dial 000 manually.');
              });
            },
            style: 'destructive'
          },
          {
            text: '👤 Call Emergency Contact',
            onPress: async () => {
              // Get user's primary emergency contact from Firestore
              try {
                const primaryContact = await EmergencyContactService.getPrimaryContact(user?.id || '');
                if (primaryContact?.phone) {
                  Linking.openURL(`tel:${primaryContact.phone}`).catch(() => {
                    Alert.alert('Error', 'Unable to make call. Please try again.');
                  });
                } else {
                  Alert.alert(
                    'No Emergency Contact',
                    'You have not set up an emergency contact. Would you like to add one now?',
                    [
                      { text: 'Later', style: 'cancel' },
                      { text: 'Add Contact', onPress: () => router.push('/profile') }
                    ]
                  );
                }
              } catch (error) {
                console.error('Failed to get emergency contact:', error);
                Alert.alert('Error', 'Failed to retrieve emergency contact. Please try again.');
              }
            }
          }
        ]
      );
    }
  };

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={[styles.statCard, styles.primaryStatCard]}>
          <View style={styles.statHeader}>
            <Car size={24} color={Colors.primary} />
            <Text style={styles.statValue}>{isDriver ? stats.totalRides : stats.confirmedBookings}</Text>
          </View>
          <Text style={styles.statLabel}>{isDriver ? 'Total Rides' : 'Confirmed Bookings'}</Text>
        </Card>

        <Card style={[styles.statCard, styles.successStatCard]}>
          <View style={styles.statHeader}>
            <DollarSign size={24} color={Colors.success} />
            <Text style={styles.statValue}>${stats.totalEarnings.toFixed(2)}</Text>
          </View>
          <Text style={styles.statLabel}>{isDriver ? 'Total Earnings' : 'Total Spent'}</Text>
        </Card>

        <Card style={[styles.statCard, styles.warningStatCard]}>
          <View style={styles.statHeader}>
            <Clock size={24} color={Colors.warning} />
            <Text style={styles.statValue}>{isDriver ? stats.activeRides : stats.upcomingRides}</Text>
          </View>
          <Text style={styles.statLabel}>{isDriver ? 'Active Rides' : 'Upcoming Rides'}</Text>
        </Card>

        <Card style={[styles.statCard, styles.infoStatCard]}>
          <View style={styles.statHeader}>
            <Star size={24} color={Colors.info} />
            <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
          </View>
          <Text style={styles.statLabel}>Rating</Text>
        </Card>
      </View>

      {/* Action Required Section */}
      {(isDriver && stats.pendingBookings > 0) && (
        <Card style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <AlertCircle size={24} color={Colors.error} />
            <Text style={styles.actionTitle}>Action Required</Text>
          </View>
          <Text style={styles.actionDescription}>
            You have {stats.pendingBookings} pending booking request{stats.pendingBookings > 1 ? 's' : ''} waiting for your response.
          </Text>
          <Button
            title="Review Requests"
            onPress={() => router.push('/booking-requests')}
            style={styles.actionButton}
          />
        </Card>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {isDriver ? (
            <>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push('/create-ride')}
              >
                <Car size={24} color={Colors.primary} />
                <Text style={styles.quickActionText}>Create Ride</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push('/booking-requests')}
              >
                <Bell size={24} color={Colors.warning} />
                <Text style={styles.quickActionText}>Requests</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push('/search-rides')}
              >
                <MapPin size={24} color={Colors.primary} />
                <Text style={styles.quickActionText}>Find Rides</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push('/(tabs)/rides')}
              >
                <Calendar size={24} color={Colors.info} />
                <Text style={styles.quickActionText}>My Bookings</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <MessageCircle size={24} color={Colors.success} />
            <Text style={styles.quickActionText}>Messages</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.emergencyButton]}
            onPress={handleEmergencyContact}
          >
            <Shield size={24} color={Colors.error} />
            <Text style={[styles.quickActionText, styles.emergencyText]}>Emergency</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderActivityTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Live Activity Feed</Text>
      {liveActivities.length > 0 ? (
        liveActivities.map((activity) => (
          <TouchableOpacity
            key={activity.id}
            style={[
              styles.activityCard,
              activity.priority === 'high' && styles.highPriorityActivity,
              activity.actionRequired && styles.actionRequiredActivity
            ]}
            onPress={() => handleActivityPress(activity)}
          >
            <View style={styles.activityHeader}>
              <View style={styles.activityIcon}>
                {activity.type === 'booking_request' && <Bell size={20} color={Colors.primary} />}
                {activity.type === 'ride_started' && <Navigation size={20} color={Colors.success} />}
                {activity.type === 'booking_confirmed' && <CheckCircle size={20} color={Colors.success} />}
                {activity.type === 'message' && <MessageCircle size={20} color={Colors.info} />}
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityDescription}>{activity.description}</Text>
                <Text style={styles.activityTime}>
                  {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {activity.actionRequired && (
                <View style={styles.actionRequiredBadge}>
                  <Text style={styles.actionRequiredText}>!</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Activity size={48} color={Colors.textLight} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No recent activity</Text>
          <Text style={styles.emptySubtext}>Your recent ride activities will appear here</Text>
        </Card>
      )}
    </View>
  );

  const renderEarningsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>{isDriver ? 'Earnings Overview' : 'Spending Overview'}</Text>

      <Card style={styles.earningsCard}>
        <View style={styles.earningsHeader}>
          <TrendingUp size={32} color={Colors.success} />
          <View style={styles.earningsInfo}>
            <Text style={styles.earningsAmount}>${stats.totalEarnings.toFixed(2)}</Text>
            <Text style={styles.earningsLabel}>{isDriver ? 'Total Earnings' : 'Total Spent'}</Text>
          </View>
        </View>

        <View style={styles.earningsStats}>
          <View style={styles.earningsStat}>
            <Text style={styles.earningsStatValue}>{isDriver ? stats.completedRides : stats.confirmedBookings}</Text>
            <Text style={styles.earningsStatLabel}>{isDriver ? 'Completed Rides' : 'Completed Bookings'}</Text>
          </View>
          <View style={styles.earningsStat}>
            <Text style={styles.earningsStatValue}>
              ${stats.totalEarnings > 0 ? (stats.totalEarnings / (isDriver ? stats.completedRides : stats.confirmedBookings) || 0).toFixed(2) : '0.00'}
            </Text>
            <Text style={styles.earningsStatLabel}>Average per {isDriver ? 'Ride' : 'Booking'}</Text>
          </View>
        </View>
      </Card>

      {isDriver && (
        <Card style={styles.payoutCard}>
          <View style={styles.payoutHeader}>
            <DollarSign size={24} color={Colors.primary} />
            <Text style={styles.payoutTitle}>Payout Information</Text>
          </View>
          <Text style={styles.payoutDescription}>
            Earnings are automatically transferred to your connected bank account weekly.
          </Text>
          <Button
            title="View Payout History"
            onPress={() => Alert.alert('Payout History', 'This feature will be available soon.')}
            style={styles.payoutButton}
          />
        </Card>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Live Dashboard',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.background,
          headerTitleStyle: { fontWeight: '600' }
        }}
      />

      <LinearGradient
        colors={[Colors.primary, Colors.secondary] as const}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Live Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              {isDriver ? 'Driver' : 'Rider'} • {user?.name}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Activity size={24} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' && styles.activeTab]}
          onPress={() => setActiveTab('activity')}
        >
          <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>
            Activity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'earnings' && styles.activeTab]}
          onPress={() => setActiveTab('earnings')}
        >
          <Text style={[styles.tabText, activeTab === 'earnings' && styles.activeTabText]}>
            {isDriver ? 'Earnings' : 'Spending'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'activity' && renderActivityTab()}
        {activeTab === 'earnings' && renderEarningsTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.background,
    opacity: 0.9,
    marginTop: 4,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    marginHorizontal: 24,
    marginTop: -12,
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
  },
  primaryStatCard: {
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  successStatCard: {
    backgroundColor: '#f0fff4',
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  warningStatCard: {
    backgroundColor: '#fffbf0',
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  infoStatCard: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  actionCard: {
    marginBottom: 24,
    backgroundColor: '#fff5f5',
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  actionDescription: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: Colors.error,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emergencyButton: {
    backgroundColor: '#fff5f5',
    borderColor: Colors.error,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emergencyText: {
    color: Colors.error,
  },
  activityCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  highPriorityActivity: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  actionRequiredActivity: {
    backgroundColor: '#fff8f0',
    borderColor: Colors.warning,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  actionRequiredBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRequiredText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  earningsCard: {
    marginBottom: 24,
    backgroundColor: Colors.background,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  earningsInfo: {
    flex: 1,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  earningsLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  earningsStats: {
    flexDirection: 'row',
    gap: 24,
  },
  earningsStat: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  earningsStatValue: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  earningsStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  payoutCard: {
    backgroundColor: Colors.background,
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  payoutTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  payoutDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  payoutButton: {
    backgroundColor: Colors.primary,
  },
});