import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Package,
  Clock,
  DollarSign,
  Truck,
  Navigation,
  Star,
  Users,
  User,
} from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { useDeliveryStore } from '@/store/delivery-store';
import { Delivery, Ride } from '@/types';
import { DeliveryService } from '@/services/delivery';
import { DeliveryMarketplace } from '@/components/DeliveryMarketplace';
import { DeliveryTracking } from '@/components/DeliveryTracking';
import { DeliveryChat } from '@/components/DeliveryChat';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QuickStats } from '@/components/deliveries/QuickStats';
import { ActionCards } from '@/components/deliveries/ActionCards';
import { NotificationBell } from '@/components/NotificationBell';
import { AvailableDeliveryDrivers } from '@/components/AvailableDeliveryDrivers';
import { UniversalFilters } from '@/components/UniversalFilters';
import { useDeliveryFilters } from '@/hooks/useRideFilters';

import { styles } from '@/styles/deliveries';

type TabType = 'browse' | 'create' | 'my-deliveries' | 'active-matches' | 'completed' | 'cancelled' | 'schedule' | 'available-drivers';



export default function DeliveriesScreen() {
  const { user } = useAuthStore();
  const { deliveries, isLoading, error, firebaseFunctionsAvailable, fetchDeliveries, setDeliveries } = useDeliveryStore();
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const insets = useSafeAreaInsets();



  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [showTracking, setShowTracking] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Initialize filtering system with current deliveries
  const {
    filters,
    filteredDeliveries: clientFilteredDeliveries,
    updateFilters,
    clearFilters,
    activeFiltersCount,
    totalDeliveries,
    filteredCount
  } = useDeliveryFilters(deliveries || []);

  const isDriver = user?.role === 'driver' || user?.role === 'both';
  const canCreateDelivery = !!user && user.role !== 'driver';

  const loadDeliveries = useCallback(async () => {
    if (!user) return;
    try {
      console.log('Loading deliveries for user:', user.id, 'role:', user.role);
      await fetchDeliveries(user.id, user.role);
      console.log('Deliveries loaded successfully');
    } catch (error) {
      console.log('Failed to load deliveries:', error);
      // Error is handled in the store with graceful fallback to mock data
    }
  }, [user, fetchDeliveries]);

  useEffect(() => {
    if (user) {
      loadDeliveries();
    }
  }, [user, loadDeliveries]);



  // Use client-side filtered deliveries if filters are active, otherwise use all deliveries
  const displayDeliveries = useMemo(() => {
    return activeFiltersCount > 0 ? clientFilteredDeliveries : (deliveries || []);
  }, [activeFiltersCount, clientFilteredDeliveries, deliveries]);

  const myDeliveries = useMemo(() => {
    return displayDeliveries.filter(d => d.businessId === user?.id);
  }, [displayDeliveries, user?.id]);

  const availableDeliveries = useMemo(() => {
    const now = new Date();
    return displayDeliveries.filter(d => {
      const isPending = d.status === 'pending';
      const isNotMyDelivery = d.businessId !== user?.id;
      const isRiderPost = (d.deliveryType ?? 'riderPost') === 'riderPost';
      
      // For available deliveries, only show future ones
      if (isPending && isNotMyDelivery && isRiderPost) {
        const deliveryTime = new Date(d.preferredTimeWindow.start);
        const isFutureDelivery = deliveryTime.getTime() > now.getTime();
        return isFutureDelivery;
      }
      
      return false;
    });
  }, [displayDeliveries, user?.id]);

  const activeMatches = useMemo(() => {
    return displayDeliveries.filter(d => 
      (d.driverId === user?.id || d.businessId === user?.id) && 
      ['matched', 'confirmed', 'picked_up', 'in_transit'].includes(d.status)
    );
  }, [displayDeliveries, user?.id]);

  const completedDeliveries = useMemo(() => {
    return displayDeliveries.filter(d => 
      (d.driverId === user?.id || d.businessId === user?.id) && 
      d.status === 'delivered'
    );
  }, [displayDeliveries, user?.id]);

  const cancelledDeliveries = useMemo(() => {
    return displayDeliveries.filter(d => 
      (d.driverId === user?.id || d.businessId === user?.id) && 
      d.status === 'cancelled'
    );
  }, [displayDeliveries, user?.id]);

  const renderQuickStats = () => (
    <QuickStats
      firebaseFunctionsAvailable={firebaseFunctionsAvailable}
      availableCount={availableDeliveries.length}
      activeCount={activeMatches.length}
      earnings={Math.round(activeMatches.reduce((sum, d) => sum + d.priceCents / 100, 0))}
      rating={user?.rating?.toFixed(1) ?? '5.0'}
    />
  );


  const renderDeliveryCard = ({ item: delivery }: { item: Delivery }) => {
    const isMyDelivery = delivery.businessId === user?.id;
    const isAssignedToMe = delivery.driverId === user?.id;
    const canAccept = isDriver && delivery.status === 'pending' && !isMyDelivery;

    // Get user details for display
    const businessName = delivery.business?.name || `User ${delivery.businessId.slice(0, 6)}`;
    const driverName = delivery.driver?.name || delivery.driver?.displayName || 'Driver';
    const businessRating = delivery.business?.rating || 4.5;
    const driverRating = delivery.driver?.rating || 4.8;

    return (
      <View style={styles.deliveryCard}>
        <View style={styles.deliveryHeader}>
          <View style={styles.deliveryTitleRow}>
            <Package size={20} color="#2563eb" />
            <Text style={styles.deliveryTitle}>
              {delivery.items.length} item{delivery.items.length !== 1 ? 's' : ''} • {delivery.packageSize}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.status) }]}>
            <Text style={styles.statusText}>{delivery.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* User Details Section */}
        <View style={styles.userDetailsSection}>
          <View style={styles.userDetail}>
            <User size={16} color="#6b7280" />
            <View style={styles.userDetailContent}>
              <Text style={styles.userDetailLabel}>User:</Text>
              <Text style={styles.userDetailName}>{businessName}</Text>
              <View style={styles.ratingContainer}>
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.ratingText}>{businessRating.toFixed(1)}</Text>
                <Text style={styles.ratingCount}>({delivery.business?.totalDeliveries || 25} deliveries)</Text>
              </View>
            </View>
          </View>
          {delivery.driverId && (
            <View style={styles.userDetail}>
              <Truck size={16} color="#6b7280" />
              <View style={styles.userDetailContent}>
                <Text style={styles.userDetailLabel}>Driver:</Text>
                <Text style={styles.userDetailName}>{driverName}</Text>
                <View style={styles.ratingContainer}>
                  <Star size={12} color="#f59e0b" fill="#f59e0b" />
                  <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>({delivery.driver?.totalRides || 150} rides)</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.deliveryRoute}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.pickupDot]} />
            <Text style={styles.routeText} numberOfLines={2}>
              Pickup: {delivery.pickupLocation.address}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.dropoffDot]} />
            <Text style={styles.routeText} numberOfLines={2}>
              Dropoff: {delivery.dropoffLocation.address}
            </Text>
          </View>
        </View>

        <View style={styles.deliveryDetails}>
          <View style={styles.detailRow}>
            <Clock size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              {new Date(delivery.preferredTimeWindow.start).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <DollarSign size={16} color="#059669" />
            <Text style={styles.priceText}>
              ${(delivery.priceCents / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {delivery.specialInstructions && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsLabel}>Special Instructions:</Text>
            <Text style={styles.instructionsText}>{delivery.specialInstructions}</Text>
          </View>
        )}

        <View style={styles.itemsList}>
          <Text style={styles.itemsLabel}>Items:</Text>
          {delivery.items.map((item, index) => (
            <Text key={item.itemId} style={styles.itemText}>
              • {item.name} (x{item.quantity})
            </Text>
          ))}
        </View>

        {canAccept && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptDelivery(delivery.id)}
            testID={`accept-delivery-${delivery.id}`}
          >
            <Truck size={20} color="#ffffff" />
            <Text style={styles.acceptButtonText}>Accept Delivery</Text>
          </TouchableOpacity>
        )}

        {isMyDelivery && delivery.status === 'pending' && (
          <View style={styles.statusInfo}>
            <Text style={styles.statusInfoText}>Waiting for driver to accept</Text>
          </View>
        )}

        {delivery.status === 'matched' && isAssignedToMe && (
          <View style={styles.statusInfo}>
            <Text style={styles.statusInfoText}>You accepted this delivery - coordinate pickup</Text>
          </View>
        )}

        {/* Delivery Progress Indicator */}
        {(isMyDelivery || isAssignedToMe) && delivery.status !== 'pending' && (
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Delivery Progress</Text>
            {renderDeliveryProgress(delivery)}
          </View>
        )}

        {/* Status Update Buttons for Drivers */}
        {isAssignedToMe && ['matched', 'confirmed', 'picked_up', 'in_transit'].includes(delivery.status) && (
          <View style={styles.statusUpdateSection}>
            <Text style={styles.statusUpdateTitle}>Next Action</Text>
            {renderStatusUpdateButton(delivery)}
          </View>
        )}

        {(isMyDelivery || isAssignedToMe) && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity 
              style={styles.trackButton} 
              testID={`track-delivery-${delivery.id}`}
              onPress={() => {
                setSelectedDelivery(delivery);
                setShowTracking(true);
              }}
            >
              <Navigation size={16} color="#2563eb" />
              <Text style={styles.trackButtonText}>Track Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.chatButton} 
              testID={`chat-delivery-${delivery.id}`}
              onPress={() => {
                setSelectedDelivery(delivery);
                setShowChat(true);
              }}
            >
              <Users size={16} color="#059669" />
              <Text style={styles.chatButtonText}>Chat with {isMyDelivery ? 'Driver' : 'User'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderDeliveryProgress = (delivery: Delivery) => {
    const steps = [
      { key: 'matched', label: 'Driver Assigned', completed: true },
      { key: 'confirmed', label: 'Pickup Confirmed', completed: ['confirmed', 'picked_up', 'in_transit', 'delivered'].includes(delivery.status) },
      { key: 'picked_up', label: 'Items Collected', completed: ['picked_up', 'in_transit', 'delivered'].includes(delivery.status) },
      { key: 'in_transit', label: 'In Transit', completed: ['in_transit', 'delivered'].includes(delivery.status) },
      { key: 'delivered', label: 'Delivered', completed: delivery.status === 'delivered' },
    ];

    return (
      <View style={styles.progressSteps}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              step.completed && styles.progressDotCompleted,
              delivery.status === step.key && styles.progressDotCurrent,
            ]}>
              {step.completed && (
                <Text style={styles.progressDotText}>✓</Text>
              )}
            </View>
            <Text style={[
              styles.progressLabel,
              step.completed && styles.progressLabelCompleted,
              delivery.status === step.key && styles.progressLabelCurrent,
            ]}>
              {step.label}
            </Text>
            {index < steps.length - 1 && (
              <View style={[
                styles.progressLine,
                step.completed && styles.progressLineCompleted,
              ]} />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderStatusUpdateButton = (delivery: Delivery) => {
    const getNextStatus = () => {
      switch (delivery.status) {
        case 'matched': return 'confirmed';
        case 'confirmed': return 'picked_up';
        case 'picked_up': return 'in_transit';
        case 'in_transit': return 'delivered';
        default: return null;
      }
    };

    const getButtonText = () => {
      switch (delivery.status) {
        case 'matched': return 'Confirm Pickup';
        case 'confirmed': return 'Mark as Picked Up';
        case 'picked_up': return 'Start Delivery';
        case 'in_transit': return 'Mark as Delivered';
        default: return 'Update Status';
      }
    };

    const nextStatus = getNextStatus();
    if (!nextStatus) return null;

    return (
      <TouchableOpacity
        style={styles.statusUpdateButton}
        onPress={() => handleStatusUpdate(delivery.id, nextStatus)}
        testID={`update-status-${delivery.id}`}
      >
        <Text style={styles.statusUpdateButtonText}>{getButtonText()}</Text>
      </TouchableOpacity>
    );
  };



  const handleRequestDeliveryFromRide = async (ride: Ride) => {
    try {
      if (!user) {
        Alert.alert('Error', 'Please log in to request deliveries.');
        return;
      }
      
      // Show confirmation dialog
      Alert.alert(
        'Request Delivery',
        `Request delivery service from ${ride.driver?.name || 'this driver'}?\n\nRoute: ${ride.from?.name || ride.origin?.name} → ${ride.to?.name || ride.destination?.name}\nPrice: ${ride.pricePerSeat}/seat`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Request',
            onPress: async () => {
              try {
                // Create a delivery request based on the ride
                const deliveryData = {
                  businessId: user.id,
                  driverId: ride.driverId,
                  rideId: ride.id,
                  items: [{ itemId: Date.now().toString(), name: 'Package', quantity: 1 }],
                  pickupLocation: ride.from || ride.origin!,
                  dropoffLocation: ride.to || ride.destination!,
                  packageSize: 'medium' as const,
                  priceCents: Math.round(ride.pricePerSeat * 100),
                  preferredTimeWindow: {
                    start: ride.departureTime || ride.departureAt || new Date().toISOString(),
                    end: new Date(new Date(ride.departureTime || ride.departureAt || new Date()).getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
                  },
                  status: 'pending' as const,
                  deliveryType: 'riderPost' as const,
                };
                
                await DeliveryService.createDelivery(deliveryData);
                
                Alert.alert(
                  'Success',
                  'Your delivery request has been sent to the driver. They will be notified and can accept or decline your request.',
                  [{ text: 'OK' }]
                );
                
                loadDeliveries();
              } catch (error) {
                console.error('Failed to request delivery:', error);
                Alert.alert('Error', 'Failed to send delivery request. Please try again.');
              }
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to request delivery');
    }
  };

  const handleStatusUpdate = async (deliveryId: string, newStatus: Delivery['status']) => {
    try {
      console.log('Updating delivery status:', { deliveryId, newStatus });
      await DeliveryService.updateDeliveryStatus(deliveryId, newStatus);
      
      // Update local state immediately for better UX
      setDeliveries(prevDeliveries => 
        prevDeliveries.map(delivery => 
          delivery.id === deliveryId 
            ? { ...delivery, status: newStatus }
            : delivery
        )
      );
      
      Alert.alert(
        'Status Updated',
        `Delivery status updated to ${newStatus.replace('_', ' ')}`,
        [{ text: 'OK' }]
      );
      
      // Refresh from server to get latest data
      setTimeout(() => {
        loadDeliveries();
      }, 1000);
    } catch (error) {
      console.error('Failed to update delivery status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to update delivery status: ${errorMessage}`);
    }
  };

  const handleAcceptDelivery = async (deliveryId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to accept deliveries.');
      return;
    }
    
    if (!isDriver) {
      Alert.alert('Error', 'Only drivers can accept deliveries.');
      return;
    }
    
    Alert.alert(
      'Accept Delivery',
      'Are you sure you want to accept this delivery? You will be responsible for pickup and delivery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              console.log('Accepting delivery:', deliveryId, 'by driver:', user.id);
              await DeliveryService.acceptDelivery(deliveryId, user.id);
              
              Alert.alert(
                'Success', 
                'Delivery accepted successfully! You can now coordinate pickup with the business.',
                [{ text: 'OK' }]
              );
              
              // Update local state immediately for better UX
              setDeliveries(prevDeliveries => 
                prevDeliveries.map(delivery => 
                  delivery.id === deliveryId 
                    ? { ...delivery, status: 'matched', driverId: user.id }
                    : delivery
                )
              );
              
              // Refresh from server to get latest data
              setTimeout(() => {
                loadDeliveries();
              }, 1000);
            } catch (error) {
              console.error('Failed to accept delivery:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert('Error', `Failed to accept delivery: ${errorMessage}`);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: '#f59e0b',
      matched: '#2563eb',
      confirmed: '#059669',
      picked_up: '#ef4444',
      in_transit: '#f97316',
      delivered: '#10b981',
      cancelled: '#6b7280',
      declined: '#ef4444',
    };
    return colors[status as keyof typeof colors] || '#6b7280';
  };



  const getTabData = (): Delivery[] => {
    if (isLoading) return [];
    
    if (activeTab === 'available-drivers') {
      return [];
    }

    switch (activeTab) {
      case 'browse':
        return availableDeliveries;
      case 'my-deliveries':
        return myDeliveries;
      case 'active-matches':
        return activeMatches;
      case 'completed':
        return completedDeliveries;
      case 'cancelled':
        return cancelledDeliveries;
      case 'schedule':
        return displayDeliveries.filter(d => {
          const deliveryTime = new Date(d.preferredTimeWindow.start);
          const now = new Date();
          return deliveryTime.getTime() > now.getTime();
        });
      default:
        return availableDeliveries;
    }
  };

  const renderEmptyState = () => {
    if (activeTab === 'available-drivers') return null;
    
    return (
      <View style={styles.modernEmptyState}>
        <View style={styles.emptyIconContainer}>
          <Package size={64} color="#e5e7eb" />
        </View>
        <Text style={styles.emptyTitle}>No deliveries yet</Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'browse' ? 'Check back soon for new requests' : 
           activeTab === 'my-deliveries' ? 'Create your first delivery request' :
           activeTab === 'completed' ? 'Your completed deliveries will appear here' :
           activeTab === 'cancelled' ? 'Your cancelled deliveries will appear here' :
           'Your active deliveries will appear here'}
        </Text>
        {error && firebaseFunctionsAvailable !== false && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadDeliveries()}
            testID="retry-button"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderListHeader = () => (
    <>
      {renderQuickStats()}
      
      <UniversalFilters
        type="deliveries"
        filters={filters}
        onFiltersChange={updateFilters}
        onClearFilters={clearFilters}
        activeFiltersCount={activeFiltersCount}
        totalCount={totalDeliveries}
        filteredCount={filteredCount}
      />
      
      <ActionCards
        canCreateDelivery={canCreateDelivery}
        isDriver={isDriver}
        availableCount={availableDeliveries.length}
        activeCount={activeMatches.length}
        myDeliveriesCount={myDeliveries.length}
        completedCount={completedDeliveries.length}
        cancelledCount={cancelledDeliveries.length}
        onCreate={() => setShowCreateModal(true)}
        onBrowse={() => setActiveTab('browse')}
        onMyDeliveries={() => setActiveTab('my-deliveries')}
        onActive={() => setActiveTab('active-matches')}
        onCompleted={() => setActiveTab('completed')}
        onCancelled={() => setActiveTab('cancelled')}
        onAvailableDrivers={() => setActiveTab('available-drivers')}
      />
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>
            {firebaseFunctionsAvailable === false 
              ? 'Loading sample deliveries...' 
              : 'Loading deliveries...'}
          </Text>
        </View>
      )}
      
      {activeTab === 'available-drivers' && !isLoading && (
        <AvailableDeliveryDrivers
          onRequestDelivery={handleRequestDeliveryFromRide}
        />
      )}
    </>
  );



  return (
    <ErrorBoundary>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Delivery Marketplace</Text>
          <NotificationBell />
        </View>

        <FlatList
          data={getTabData()}
          renderItem={renderDeliveryCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          testID="deliveries-scroll"
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyState}
        />

        {showCreateModal && (
          <DeliveryMarketplace 
            autoOpenCreate
            onClose={() => {
              setShowCreateModal(false);
              loadDeliveries();
            }} 
          />
        )}

        {showTracking && selectedDelivery && (
          <DeliveryTracking
            delivery={selectedDelivery}
            onClose={() => {
              setShowTracking(false);
              setSelectedDelivery(null);
              loadDeliveries();
            }}
            onChatPress={() => {
              setShowTracking(false);
              setShowChat(true);
            }}
          />
        )}

        {showChat && selectedDelivery && (
          <DeliveryChat
            delivery={selectedDelivery}
            onClose={() => {
              setShowChat(false);
              setSelectedDelivery(null);
            }}
          />
        )}
      </View>
    </ErrorBoundary>
  );
}
