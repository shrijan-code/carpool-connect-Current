import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

type ViewMode = 'list' | 'map';

interface Props {
  viewMode: ViewMode;
  onChange: (m: ViewMode) => void;
}

export const ViewModeToggle: React.FC<Props> = ({ viewMode, onChange }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.btn, viewMode === 'list' && styles.active]} onPress={() => onChange('list')} testID="view-mode-list">
        <Text style={[styles.text, viewMode === 'list' && styles.textActive]}>List</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, viewMode === 'map' && styles.active]} onPress={() => onChange('map')} testID="view-mode-map">
        <Text style={[styles.text, viewMode === 'map' && styles.textActive]}>Map</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 2 },
  btn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  active: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  text: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  textActive: { color: '#374151' },
});
