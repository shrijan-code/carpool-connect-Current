import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Plus, Search, Calendar, Package } from 'lucide-react-native';

interface Props {
  canCreateDelivery: boolean;
  isDriver: boolean;
  onCreate: () => void;
  onBrowse: () => void;
  onSchedule: () => void;
  onMyDeliveries: () => void;
}

export const ActionButtons: React.FC<Props> = ({ canCreateDelivery, isDriver, onCreate, onBrowse, onSchedule, onMyDeliveries }) => {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {canCreateDelivery && (
          <TouchableOpacity style={[styles.button, styles.primary]} onPress={onCreate} testID="create-delivery-btn">
            <Plus size={20} color="#ffffff" />
            <Text style={styles.primaryText}>Create Delivery</Text>
          </TouchableOpacity>
        )}
        {isDriver && (
          <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onBrowse} testID="browse-deliveries-btn">
            <Search size={20} color="#2563eb" />
            <Text style={styles.secondaryText}>Browse Deliveries</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onSchedule} testID="schedule-delivery-btn">
          <Calendar size={20} color="#2563eb" />
          <Text style={styles.secondaryText}>Schedule Delivery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onMyDeliveries} testID="my-deliveries-btn">
          <Package size={20} color="#2563eb" />
          <Text style={styles.secondaryText}>My Deliveries</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#ffffff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  scroll: { paddingHorizontal: 20, gap: 12 },
  button: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 8, minWidth: 140 },
  primary: { backgroundColor: '#2563eb' },
  secondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  secondaryText: { color: '#374151', fontSize: 14, fontWeight: '600' },
});
