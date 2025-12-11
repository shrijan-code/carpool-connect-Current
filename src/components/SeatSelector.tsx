import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Users } from 'lucide-react-native';

interface SeatSelectorProps {
  availableSeats: number;
  selectedSeats: number;
  onSeatChange: (seats: number) => void;
  maxSelectableSeats?: number;
  testID?: string;
}

export const SeatSelector: React.FC<SeatSelectorProps> = ({
  availableSeats,
  selectedSeats,
  onSeatChange,
  maxSelectableSeats = 8,
  testID,
}) => {
  const maxSeats = Math.min(availableSeats, maxSelectableSeats);
  const seatOptions = Array.from({ length: maxSeats }, (_, i) => i + 1);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Users size={20} color="#495057" />
        <Text style={styles.title}>Select Number of Seats</Text>
      </View>
      
      <Text style={styles.subtitle}>
        {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
      </Text>

      <View style={styles.seatGrid}>
        {seatOptions.map((seatCount) => (
          <TouchableOpacity
            key={seatCount}
            style={[
              styles.seatOption,
              selectedSeats === seatCount && styles.selectedSeatOption,
            ]}
            onPress={() => onSeatChange(seatCount)}
            testID={`${testID}-seat-${seatCount}`}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.seatOptionText,
                selectedSeats === seatCount && styles.selectedSeatOptionText,
              ]}
            >
              {seatCount}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedSeats > 0 && (
        <View style={styles.selectionSummary}>
          <Text style={styles.selectionText}>
            Selected: {selectedSeats} seat{selectedSeats !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  seatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 12,
  },
  seatOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#dee2e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedSeatOption: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },
  seatOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  selectedSeatOptionText: {
    color: '#ffffff',
  },
  selectionSummary: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
});