import React, { useState, useRef, useMemo } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle, TouchableOpacity } from 'react-native';
import { DarkColors, LightColors } from '@/constants/colors';
import { useSettingsStore } from '@/store/settings-store';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftText?: string;
  rightText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  style,
  ...props
}) => {
  const theme = useSettingsStore((s) => s.settings.currentTheme);
  const Colors = useMemo(() => (theme === 'dark' ? DarkColors : LightColors), [theme]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: Colors.text }]}>{label}</Text>}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={handleContainerPress}
        style={[
          styles.inputContainer,
          { borderColor: Colors.border, backgroundColor: Colors.background },
          isFocused && { borderColor: Colors.primary, shadowColor: Colors.primary },
          error && { borderColor: Colors.error },
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIcon}>
            {typeof leftIcon === 'string' ? <Text>{leftIcon}</Text> : leftIcon}
          </View>
        )}
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: Colors.text }, style]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor={Colors.textLight}
          blurOnSubmit={false}
          returnKeyType="next"
          {...props}
        />
        {rightIcon && (
          <View style={styles.rightIcon}>
            {typeof rightIcon === 'string' ? <Text>{rightIcon}</Text> : rightIcon}
          </View>
        )}
      </TouchableOpacity>
      {error && <Text style={[styles.errorText, { color: Colors.error }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
  },
  focused: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  error: {},
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftIcon: {
    paddingLeft: 16,
  },
  rightIcon: {
    paddingRight: 16,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});