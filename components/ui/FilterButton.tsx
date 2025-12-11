import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Filter } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface FilterButtonProps {
  activeFiltersCount: number;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export const FilterButton: React.FC<FilterButtonProps> = ({
  activeFiltersCount,
  onPress,
  style,
  textStyle,
  testID
}) => {
  const isActive = activeFiltersCount > 0;
  
  return (
    <TouchableOpacity
      style={[
        styles.filterButton,
        isActive && styles.filterButtonActive,
        style
      ]}
      onPress={onPress}
      testID={testID}
      activeOpacity={0.8}
    >
      <Filter 
        size={20} 
        color={isActive ? Colors.background : Colors.primary} 
      />
      <Text 
        style={[
          styles.filterButtonText,
          isActive && styles.filterButtonTextActive,
          textStyle
        ]}
      >
        Filters {isActive && `(${activeFiltersCount})`}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  filterButtonTextActive: {
    color: Colors.background,
  },
});