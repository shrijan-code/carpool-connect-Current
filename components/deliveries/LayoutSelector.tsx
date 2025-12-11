import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LayoutGrid, Grid3X3, Layers } from 'lucide-react-native';

type LayoutOption = 'option1' | 'option2' | 'option3';

interface Props {
  currentLayout: LayoutOption;
  onLayoutChange: (layout: LayoutOption) => void;
}

export const LayoutSelector: React.FC<Props> = ({ currentLayout, onLayoutChange }) => {
  const layouts = [
    { key: 'option1' as LayoutOption, label: 'Clean', icon: LayoutGrid, description: 'Streamlined tabs' },
    { key: 'option2' as LayoutOption, label: 'Cards', icon: Grid3X3, description: 'Action cards' },
    { key: 'option3' as LayoutOption, label: 'Minimal', icon: Layers, description: 'Dashboard style' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Layout Options</Text>
      <View style={styles.options}>
        {layouts.map((layout) => {
          const Icon = layout.icon;
          const isActive = currentLayout === layout.key;
          
          return (
            <TouchableOpacity
              key={layout.key}
              style={[styles.option, isActive && styles.optionActive]}
              onPress={() => onLayoutChange(layout.key)}
            >
              <Icon size={20} color={isActive ? '#2563eb' : '#6b7280'} />
              <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                {layout.label}
              </Text>
              <Text style={[styles.optionDescription, isActive && styles.optionDescriptionActive]}>
                {layout.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  options: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  optionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 4,
  },
  optionLabelActive: {
    color: '#2563eb',
  },
  optionDescription: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  optionDescriptionActive: {
    color: '#2563eb',
  },
});