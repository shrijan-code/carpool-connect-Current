import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DarkColors, LightColors } from '@/constants/colors';
import { useSettingsStore } from '@/store/settings-store';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  testID,
  leftIcon,
  rightIcon,
}) => {
  const theme = useSettingsStore((s) => s.settings.currentTheme);
  const Colors = useMemo(() => (theme === 'dark' ? DarkColors : LightColors), [theme]);
  const buttonStyle = [
    styles.base,
    styles[size],
    disabled && styles.disabled,
    variant === 'secondary' && { backgroundColor: Colors.secondary, shadowColor: Colors.shadow.color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: Colors.shadow.opacity, shadowRadius: 4, elevation: 3 },
    variant === 'outline' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary },
    variant === 'ghost' && { backgroundColor: 'transparent' },
    style,
  ];

  const textStyleCombined = [
    styles.text,
    styles[`${size}Text` as keyof typeof styles],
    (variant === 'outline' || variant === 'ghost' || variant === 'secondary') ? { color: Colors.primary } : { color: Colors.background },
    variant === 'secondary' && { color: Colors.background },
    disabled && styles.disabledText,
    textStyle,
  ];

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        testID={testID}
        activeOpacity={0.8}
        style={[styles.base, styles[size], disabled && styles.disabled, { shadowColor: Colors.shadow.color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: Colors.shadow.opacity, shadowRadius: 4, elevation: 3 }, style]}
      >
        <LinearGradient
          colors={Colors.gradient.primary}
          style={styles.gradientButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {loading ? (
            <ActivityIndicator 
              color={Colors.background} 
              size="small" 
            />
          ) : (
            <>
              {leftIcon && <Text style={styles.iconLeft}>{leftIcon}</Text>}
              <Text style={[styles.text, styles[`${size}Text` as keyof typeof styles], { color: Colors.background }, disabled && styles.disabledText, textStyle]}>{title}</Text>
              {rightIcon && <Text style={styles.iconRight}>{rightIcon}</Text>}
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'secondary' || variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.background} 
          size="small" 
        />
      ) : (
        <>
          {leftIcon && <Text style={styles.iconLeft}>{leftIcon}</Text>}
          <Text style={textStyleCombined}>{title}</Text>
          {rightIcon && <Text style={styles.iconRight}>{rightIcon}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {},
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  secondary: {},
  outline: {},
  ghost: {},
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  large: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    minHeight: 56,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  primaryText: {},
  secondaryText: {},
  outlineText: {},
  ghostText: {},
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  disabledText: {
    opacity: 0.7,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});