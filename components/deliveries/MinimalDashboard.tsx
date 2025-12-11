import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { Plus, Search, Package, TrendingUp, Filter } from 'lucide-react-native';

interface Props {
  canCreateDelivery: boolean;
  isDriver: boolean;
  availableCount: number;
  activeCount: number;
  myDeliveriesCount: number;
  earnings: number;
  rating: string;
  onCreate: () => void;
  onBrowse: () => void;
  onMyDeliveries: () => void;
  onActiveDeliveries: () => void;
}

// Redesign Option 3: Minimal Dashboard
export const MinimalDashboard: React.FC<Props> = ({ 
  canCreateDelivery, 
  isDriver, 
  availableCount, 
  activeCount, 
  myDeliveriesCount,
  earnings,
  rating,
  onCreate, 
  onBrowse, 
  onMyDeliveries,
  onActiveDeliveries
}) => {
  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>Good morning! 👋</Text>
        <Text style={styles.subtitle}>Ready to deliver?</Text>
        
        {canCreateDelivery && (
          <TouchableOpacity style={styles.primaryButton} onPress={onCreate}>
            <Plus size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Create Delivery</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{availableCount}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${earnings}</Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{rating}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>
      
      {/* Quick Actions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsScroll}>
        <View style={styles.actions}>
          {isDriver && (
            <TouchableOpacity style={styles.actionItem} onPress={onBrowse}>
              <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
                <Search size={20} color="#2563eb" />
              </View>
              <Text style={styles.actionText}>Browse</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.actionItem} onPress={onMyDeliveries}>
            <View style={[styles.actionIcon, { backgroundColor: '#ecfdf5' }]}>
              <Package size={20} color="#059669" />
            </View>
            <Text style={styles.actionText}>My Requests</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem} onPress={onActiveDeliveries}>
            <View style={[styles.actionIcon, { backgroundColor: '#fef2f2' }]}>
              <TrendingUp size={20} color="#dc2626" />
            </View>
            <Text style={styles.actionText}>Active</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#f3f4f6' }]}>
              <Filter size={20} color="#6b7280" />
            </View>
            <Text style={styles.actionText}>Filter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  
  hero: {
    padding: 24,
    alignItems: 'center',
  },
  
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 16,
    borderRadius: 12,
  },
  
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  
  actionsScroll: {
    paddingBottom: 20,
  },
  
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 16,
  },
  
  actionItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
});