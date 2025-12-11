import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RideAnalyticsDashboard } from '@/components/RideAnalyticsDashboard';
import { useAuthStore } from '@/store/auth-store';

export default function AnalyticsScreen() {
  const { user } = useAuthStore();

  if (!user) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <RideAnalyticsDashboard userId={user.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});