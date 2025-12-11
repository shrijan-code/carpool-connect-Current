import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onDismiss: () => void;
  position?: 'top' | 'bottom';
  showCloseButton?: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  type,
  title,
  message,
  duration = 4000,
  onDismiss,
  position = 'top',
  showCloseButton = true
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;

  const styles = createStyles(colors, type, position, insets);

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, fadeAnim, slideAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: position === 'top' ? -100 : 100,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const getIcon = () => {
    const iconSize = 20;
    const iconColor = colors.background;

    switch (type) {
      case 'success':
        return <CheckCircle size={iconSize} color={iconColor} />;
      case 'error':
        return <XCircle size={iconSize} color={iconColor} />;
      case 'warning':
        return <AlertCircle size={iconSize} color={iconColor} />;
      case 'info':
        return <Info size={iconSize} color={iconColor} />;
      default:
        return <Info size={iconSize} color={iconColor} />;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {message && (
            <Text style={styles.message} numberOfLines={3}>
              {message}
            </Text>
          )}
        </View>
        {showCloseButton && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color={colors.background} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: any, type: ToastType, position: 'top' | 'bottom', insets: any) => {
  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      case 'info':
        return colors.primary;
      default:
        return colors.primary;
    }
  };

  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 16,
      right: 16,
      [position]: position === 'top' ? insets.top + 16 : insets.bottom + 16,
      zIndex: 9999,
      elevation: 10,
    },
    content: {
      backgroundColor: getBackgroundColor(),
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'flex-start',
      shadowColor: colors.shadow.color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: colors.shadow.opacity * 2,
      shadowRadius: 8,
      elevation: 8,
    },
    iconContainer: {
      marginRight: 12,
      marginTop: 2,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.background,
      marginBottom: 2,
    },
    message: {
      fontSize: 14,
      color: colors.background,
      opacity: 0.9,
      lineHeight: 20,
    },
    closeButton: {
      marginLeft: 12,
      padding: 2,
    },
  });
};

// Toast Manager Hook
interface ToastState {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  position?: 'top' | 'bottom';
  showCloseButton?: boolean;
}

let toastId = 0;

export const useToast = () => {
  const [toasts, setToasts] = React.useState<ToastState[]>([]);

  const showToast = React.useCallback((toast: Omit<ToastState, 'id'>) => {
    const id = `toast-${++toastId}`;
    const newToast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    
    return id;
  }, []);

  const hideToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const hideAllToasts = React.useCallback(() => {
    setToasts([]);
  }, []);

  const success = React.useCallback((title: string, message?: string, options?: Partial<ToastState>) => {
    return showToast({ type: 'success', title, message, ...options });
  }, [showToast]);

  const error = React.useCallback((title: string, message?: string, options?: Partial<ToastState>) => {
    return showToast({ type: 'error', title, message, duration: 6000, ...options });
  }, [showToast]);

  const warning = React.useCallback((title: string, message?: string, options?: Partial<ToastState>) => {
    return showToast({ type: 'warning', title, message, ...options });
  }, [showToast]);

  const info = React.useCallback((title: string, message?: string, options?: Partial<ToastState>) => {
    return showToast({ type: 'info', title, message, ...options });
  }, [showToast]);

  const ToastContainer = React.useCallback(() => (
    <>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          duration={toast.duration}
          position={toast.position}
          showCloseButton={toast.showCloseButton}
          onDismiss={() => hideToast(toast.id)}
        />
      ))}
    </>
  ), [toasts, hideToast]);

  return {
    showToast,
    hideToast,
    hideAllToasts,
    success,
    error,
    warning,
    info,
    ToastContainer,
    toasts
  };
};