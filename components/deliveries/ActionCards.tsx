import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Plus, Search, Package, TrendingUp, CheckCircle, XCircle, Users } from 'lucide-react-native';

interface Props {
  canCreateDelivery: boolean;
  isDriver: boolean;
  availableCount: number;
  activeCount: number;
  myDeliveriesCount: number;
  completedCount: number;
  cancelledCount: number;
  onCreate: () => void;
  onBrowse: () => void;
  onMyDeliveries: () => void;
  onActive?: () => void;
  onCompleted?: () => void;
  onCancelled?: () => void;
  onAvailableDrivers?: () => void;
}

// Redesign Option 2: Action Cards Layout
export const ActionCards: React.FC<Props> = ({ 
  canCreateDelivery, 
  isDriver, 
  availableCount, 
  activeCount, 
  myDeliveriesCount,
  completedCount,
  cancelledCount,
  onCreate, 
  onBrowse, 
  onMyDeliveries,
  onActive,
  onCompleted,
  onCancelled,
  onAvailableDrivers,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Primary Action Card */}
        {canCreateDelivery && (
          <TouchableOpacity
            testID="create-delivery-card"
            style={[styles.card, styles.primaryCard]}
            onPress={() => {
              console.log('[ActionCards] Create Delivery pressed');
              onCreate?.();
            }}
          >
            <View style={styles.cardIcon}>
              <Plus size={28} color="#ffffff" />
            </View>
            <Text style={styles.primaryCardTitle}>Create Delivery</Text>
            <Text style={styles.primaryCardSubtitle}>Post a new request</Text>
          </TouchableOpacity>
        )}
        
        {/* Available Drivers for Riders */}
        {canCreateDelivery && (
          <TouchableOpacity
            testID="available-drivers-card"
            style={[styles.card, styles.secondaryCard]}
            onPress={() => {
              console.log('[ActionCards] Available Drivers pressed');
              onAvailableDrivers?.();
            }}
          >
            <View style={[styles.cardIcon, styles.secondaryIcon]}>
              <Users size={24} color="#111827" />
            </View>
            <Text style={styles.secondaryCardTitle}>Available Drivers</Text>
            <Text style={styles.cardCount}>Browse drivers</Text>
          </TouchableOpacity>
        )}
        
        {/* Browse Card for Drivers */}
        {isDriver && (
          <TouchableOpacity
            testID="browse-deliveries-card"
            style={[styles.card, styles.secondaryCard]}
            onPress={() => {
              console.log('[ActionCards] Browse pressed');
              onBrowse?.();
            }}
          >
            <View style={[styles.cardIcon, styles.secondaryIcon]}>
              <Search size={24} color="#2563eb" />
            </View>
            <Text style={styles.secondaryCardTitle}>Browse</Text>
            <Text style={styles.cardCount}>{availableCount} available</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.row}>
        {/* My Deliveries Card */}
        <TouchableOpacity
          testID="my-deliveries-card"
          style={[styles.card, styles.secondaryCard]}
          onPress={() => {
            console.log('[ActionCards] My Deliveries pressed');
            onMyDeliveries?.();
          }}
        >
          <View style={[styles.cardIcon, styles.secondaryIcon]}>
            <Package size={24} color="#059669" />
          </View>
          <Text style={styles.secondaryCardTitle}>My Requests</Text>
          <Text style={styles.cardCount}>{myDeliveriesCount} created</Text>
        </TouchableOpacity>
        
        {/* Active Card */}
        <TouchableOpacity
          testID="active-deliveries-card"
          style={[styles.card, styles.secondaryCard]}
          onPress={() => {
            console.log('[ActionCards] Active pressed');
            if (onActive) {
              onActive();
            } else {
              console.log('[ActionCards] onActive not provided');
            }
          }}
        >
          <View style={[styles.cardIcon, styles.secondaryIcon]}>
            <TrendingUp size={24} color="#dc2626" />
          </View>
          <Text style={styles.secondaryCardTitle}>Active</Text>
          <Text style={styles.cardCount}>{activeCount} ongoing</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.row}>
        {/* Completed Card */}
        <TouchableOpacity
          testID="completed-deliveries-card"
          style={[styles.card, styles.secondaryCard]}
          onPress={() => {
            console.log('[ActionCards] Completed pressed');
            onCompleted?.();
          }}
        >
          <View style={[styles.cardIcon, styles.secondaryIcon]}>
            <CheckCircle size={24} color="#10b981" />
          </View>
          <Text style={styles.secondaryCardTitle}>Completed</Text>
          <Text style={styles.cardCount}>{completedCount} finished</Text>
        </TouchableOpacity>
        
        {/* Cancelled Card */}
        <TouchableOpacity
          testID="cancelled-deliveries-card"
          style={[styles.card, styles.secondaryCard]}
          onPress={() => {
            console.log('[ActionCards] Cancelled pressed');
            onCancelled?.();
          }}
        >
          <View style={[styles.cardIcon, styles.secondaryIcon]}>
            <XCircle size={24} color="#ef4444" />
          </View>
          <Text style={styles.secondaryCardTitle}>Cancelled</Text>
          <Text style={styles.cardCount}>{cancelledCount} cancelled</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  primaryCard: {
    backgroundColor: '#2563eb',
    minHeight: 100,
  },
  
  secondaryCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 85,
  },
  
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  
  secondaryIcon: {
    backgroundColor: '#f3f4f6',
  },
  
  primaryCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  
  primaryCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  
  secondaryCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  
  cardCount: {
    fontSize: 12,
    color: '#6b7280',
  },
});