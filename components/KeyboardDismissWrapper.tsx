import React from 'react';
import { Pressable, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';

interface KeyboardDismissWrapperProps {
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}

export const KeyboardDismissWrapper: React.FC<KeyboardDismissWrapperProps> = ({
  children,
  style,
  disabled = false
}) => {
  const handlePress = () => {
    if (!disabled) {
      Keyboard.dismiss();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[{ flex: 1 }, style]}
    >
      <Pressable
        style={{ flex: 1 }}
        onPress={handlePress}
        pointerEvents={disabled ? 'none' : 'auto'}
      >
        {children}
      </Pressable>
    </KeyboardAvoidingView>
  );
};