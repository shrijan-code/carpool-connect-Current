import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { DarkColors, LightColors } from '@/constants/colors';
import { useSettingsStore } from '@/store/settings-store';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 16,
  testID,
}) => {
  const theme = useSettingsStore((s) => s.settings.currentTheme);
  const Colors = useMemo(() => (theme === 'dark' ? DarkColors : LightColors), [theme]);
  return (
    <View
      style={[styles.cardBase, { padding, backgroundColor: Colors.card, borderColor: Colors.border, shadowColor: Colors.shadow.color, shadowOpacity: Colors.shadow.opacity }, style]}
      testID={testID}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  cardBase: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
});