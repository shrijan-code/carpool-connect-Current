import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Package, TrendingUp, DollarSign, Star } from 'lucide-react-native';

interface Props {
  firebaseFunctionsAvailable: boolean | null;
  availableCount: number;
  activeCount: number;
  earnings: number;
  rating: string;
}

export const QuickStats: React.FC<Props> = ({
  firebaseFunctionsAvailable,
  availableCount,
  activeCount,
  earnings,
  rating,
}) => {
  return (
    <View style={styles.container}>
      {firebaseFunctionsAvailable === false && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoText}>Demo Mode - Using sample data</Text>
          <Text style={styles.demoSubtext}>Firestore connection unavailable</Text>
        </View>
      )}
      <View style={styles.card}>
        <Package size={20} color="#2563eb" />
        <Text style={styles.cardNumber}>{availableCount}</Text>
        <Text style={styles.cardLabel}>Available</Text>
      </View>
      <View style={styles.card}>
        <TrendingUp size={20} color="#059669" />
        <Text style={styles.cardNumber}>{activeCount}</Text>
        <Text style={styles.cardLabel}>Active</Text>
      </View>
      <View style={styles.card}>
        <DollarSign size={20} color="#dc2626" />
        <Text style={styles.cardNumber}>${earnings}</Text>
        <Text style={styles.cardLabel}>Earnings</Text>
      </View>
      <View style={styles.card}>
        <Star size={20} color="#f59e0b" />
        <Text style={styles.cardNumber}>{rating}</Text>
        <Text style={styles.cardLabel}>Rating</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  demoBanner: { position: 'absolute', top: 8, left: 20, right: 20, backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#2563eb' },
  demoText: { fontSize: 12, color: '#1e40af', fontWeight: '600', textAlign: 'center' },
  demoSubtext: { fontSize: 10, color: '#1e40af', textAlign: 'center', marginTop: 2, opacity: 0.8 },
  card: { flex: 1, alignItems: 'center' },
  cardNumber: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 4 },
  cardLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
