import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ProgressBarProps {
  progress: number; // 0 to 1
  height?: number;
  showPercentage?: boolean;
  color?: string;
  backgroundColor?: string;
  animated?: boolean;
  duration?: number;
  style?: any;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  showPercentage = false,
  color,
  backgroundColor,
  animated = true,
  duration = 500,
  style
}) => {
  const { colors } = useTheme();
  const animatedWidth = useRef(new Animated.Value(0)).current;
  
  const progressColor = color || colors.primary;
  const bgColor = backgroundColor || colors.borderLight;
  
  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: progress,
        duration,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(progress);
    }
  }, [progress, animated, duration, animatedWidth]);

  const percentage = Math.round(progress * 100);

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.track, { height, backgroundColor: bgColor }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              backgroundColor: progressColor,
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
      {showPercentage && (
        <Text style={[styles.percentage, { color: colors.textSecondary }]}>
          {percentage}%
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 4,
  },
  percentage: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
  },
});

// Circular Progress Bar
interface CircularProgressProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  animated?: boolean;
  duration?: number;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 60,
  strokeWidth = 6,
  color,
  backgroundColor,
  showPercentage = true,
  animated = true,
  duration = 500
}) => {
  const { colors } = useTheme();
  const animatedProgress = useRef(new Animated.Value(0)).current;
  
  const progressColor = color || colors.primary;
  const bgColor = backgroundColor || colors.borderLight;
  
  useEffect(() => {
    if (animated) {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration,
        useNativeDriver: false,
      }).start();
    } else {
      animatedProgress.setValue(progress);
    }
  }, [progress, animated, duration, animatedProgress]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.round(progress * 100);

  return (
    <View style={[circularStyles.circularContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          circularStyles.circularProgress,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: bgColor,
          },
        ]}
      >
        <Animated.View
          style={[
            circularStyles.circularFill,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: progressColor,
              transform: [
                {
                  rotate: animatedProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
      {showPercentage && (
        <View style={circularStyles.circularText}>
          <Text style={[circularStyles.circularPercentage, { color: colors.text }]}>
            {percentage}%
          </Text>
        </View>
      )}
    </View>
  );
};

const circularStyles = StyleSheet.create({
  circularContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularProgress: {
    position: 'absolute',
  },
  circularFill: {
    position: 'absolute',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  circularText: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
});