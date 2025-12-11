import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Search, Package, Truck, Calendar } from 'lucide-react-native';

type TabType = 'browse' | 'create' | 'my-deliveries' | 'active-matches' | 'schedule';

interface Props {
  activeTab: TabType;
  onChangeTab: (t: TabType) => void;
}

export const DeliveriesTabBar: React.FC<Props> = ({ activeTab, onChangeTab }) => {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.content}>
          <Tab icon={<Search size={18} color={activeTab === 'browse' ? '#2563eb' : '#6b7280'} />} label="Browse Requests" active={activeTab === 'browse'} onPress={() => onChangeTab('browse')} testID="tab-browse" />
          <Tab icon={<Package size={18} color={activeTab === 'my-deliveries' ? '#2563eb' : '#6b7280'} />} label="My Deliveries" active={activeTab === 'my-deliveries'} onPress={() => onChangeTab('my-deliveries')} testID="tab-my-deliveries" />
          <Tab icon={<Truck size={18} color={activeTab === 'active-matches' ? '#2563eb' : '#6b7280'} />} label="Active Matches" active={activeTab === 'active-matches'} onPress={() => onChangeTab('active-matches')} testID="tab-active-matches" />
          <Tab icon={<Calendar size={18} color={activeTab === 'schedule' ? '#2563eb' : '#6b7280'} />} label="Schedule" active={activeTab === 'schedule'} onPress={() => onChangeTab('schedule')} testID="tab-schedule" />
        </View>
      </ScrollView>
    </View>
  );
};

const Tab = ({ icon, label, active, onPress, testID }: { icon: React.ReactNode; label: string; active: boolean; onPress: () => void; testID?: string }) => (
  <TouchableOpacity style={[styles.tab, active && styles.active]} onPress={onPress} testID={testID}>
    <View style={styles.iconWrap}>{icon}</View>
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  content: { flexDirection: 'row', paddingHorizontal: 20 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, marginRight: 8, gap: 6 },
  active: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  iconWrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#2563eb' },
});
