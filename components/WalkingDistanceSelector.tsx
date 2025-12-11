import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';
import { Clock, MapPin } from 'lucide-react-native';

interface WalkingDistanceSelectorProps {
  selectedDistance: number;
  onDistanceSelect: (distance: number) => void;
  style?: any;
}

// Walking distance options in meters
// 5 min walk ≈ 400m, 10 min ≈ 800m, 15 min ≈ 1200m
const DISTANCE_OPTIONS = [
  { label: '5 min walk', value: 400, description: '~400m' },
  { label: '10 min walk', value: 800, description: '~800m' },
  { label: '15 min walk', value: 1200, description: '~1.2km' },
  { label: '20 min walk', value: 1600, description: '~1.6km' },
];

export const WalkingDistanceSelector: React.FC<WalkingDistanceSelectorProps> = ({
  selectedDistance,
  onDistanceSelect,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <MapPin size={20} color={Colors.primary} />
        <Text style={styles.title}>Walking Distance Tolerance</Text>
      </View>
      <Text style={styles.subtitle}>
        How far are you willing to walk to pickup/dropoff points?
      </Text>
      
      <View style={styles.optionsContainer}>
        {DISTANCE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedDistance === option.value && styles.selectedOption,
            ]}
            onPress={() => onDistanceSelect(option.value)}
          >
            <View style={styles.optionContent}>
              <Clock 
                size={16} 
                color={selectedDistance === option.value ? Colors.background : Colors.textSecondary} 
              />
              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionLabel,
                    selectedDistance === option.value && styles.selectedLabel,
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    selectedDistance === option.value && styles.selectedDescription,
                  ]}
                >
                  {option.description}
                </Text>
              </View>
            </View>
            {selectedDistance === option.value && (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Rides within your selected walking distance will be shown first. 
          This helps you find convenient pickup and dropoff points.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  selectedOption: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    marginLeft: 12,
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  selectedLabel: {
    color: Colors.background,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  selectedDescription: {
    color: Colors.background,
    opacity: 0.8,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: Colors.primary,
  },
  infoBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});