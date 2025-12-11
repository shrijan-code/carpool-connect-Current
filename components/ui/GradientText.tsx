import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTheme } from '@/hooks/useTheme';

interface GradientTextProps {
  children: React.ReactNode;
  colors?: string[];
  style?: TextStyle;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  colors,
  style,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
}) => {
  const { colors: themeColors } = useTheme();
  const gradientColors = colors || themeColors.gradient.text;
  const finalColors = Array.isArray(gradientColors) && gradientColors.length >= 2 
    ? (gradientColors as [string, string, ...string[]]) 
    : ['#6366F1', '#8B5CF6'] as [string, string];
  return (
    <MaskedView
      maskElement={
        <Text style={[style, styles.maskText]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={finalColors}
        start={start}
        end={end}
        style={styles.gradient}
      >
        <Text style={[style, styles.hiddenText]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
};

const styles = StyleSheet.create({
  maskText: {
    backgroundColor: 'transparent',
  },
  gradient: {
    flex: 1,
  },
  hiddenText: {
    opacity: 0,
  },
});
