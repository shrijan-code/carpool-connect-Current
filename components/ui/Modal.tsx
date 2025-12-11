import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

const { height: screenHeight } = Dimensions.get('window');

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  position?: 'center' | 'bottom';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  style?: any;
  contentStyle?: any;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  size = 'medium',
  position = 'center',
  showCloseButton = true,
  closeOnBackdrop = true,
  animationType = 'slide',
  style,
  contentStyle
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const styles = createStyles(colors, size, position, insets);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        animationType === 'slide' ? Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }) : Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        animationType === 'slide' ? Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }) : Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim, scaleAnim, animationType]);

  const handleBackdropPress = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  const getTransform = () => {
    if (animationType === 'slide') {
      return [{ translateY: slideAnim }];
    }
    return [{ scale: scaleAnim }];
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View
          style={[styles.backdrop, { opacity: fadeAnim }]}
        >
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: getTransform(),
            },
            style,
          ]}
        >
          <View style={[styles.modal, contentStyle]}>
            {(title || showCloseButton) && (
              <View style={styles.header}>
                {title && (
                  <Text style={styles.title} numberOfLines={2}>
                    {title}
                  </Text>
                )}
                {showCloseButton && (
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const createStyles = (colors: any, size: string, position: string, insets: any) => {
  const getModalWidth = () => {
    switch (size) {
      case 'small':
        return '80%';
      case 'medium':
        return '90%';
      case 'large':
        return '95%';
      case 'fullscreen':
        return '100%';
      default:
        return '90%';
    }
  };

  const getModalHeight = () => {
    if (size === 'fullscreen') {
      return '100%';
    }
    if (position === 'bottom') {
      return 'auto';
    }
    switch (size) {
      case 'small':
        return 'auto';
      case 'medium':
        return 'auto';
      case 'large':
        return '80%';
      default:
        return 'auto';
    }
  };

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdropTouchable: {
      flex: 1,
    },
    modalContainer: {
      flex: 1,
      justifyContent: position === 'bottom' ? 'flex-end' : 'center',
      alignItems: 'center',
      paddingHorizontal: size === 'fullscreen' ? 0 : 16,
      paddingTop: position === 'center' ? insets.top : 0,
      paddingBottom: position === 'bottom' ? insets.bottom : 0,
    },
    modal: {
      backgroundColor: colors.card,
      borderRadius: size === 'fullscreen' ? 0 : 16,
      width: getModalWidth(),
      height: getModalHeight(),
      maxHeight: position === 'center' ? '90%' : '80%',
      shadowColor: colors.shadow.color,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: colors.shadow.opacity * 2,
      shadowRadius: 16,
      elevation: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: 16,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
  });
};

// Confirmation Modal
interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger' | 'warning';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default'
}) => {
  const { colors } = useTheme();

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger':
        return colors.error;
      case 'warning':
        return colors.warning;
      default:
        return colors.primary;
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      size="small"
      showCloseButton={false}
    >
      <View style={confirmationStyles.content}>
        <Text style={[confirmationStyles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>
        <View style={confirmationStyles.buttons}>
          <TouchableOpacity
            style={[confirmationStyles.button, confirmationStyles.cancelButton, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[confirmationStyles.buttonText, { color: colors.textSecondary }]}>
              {cancelText}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[confirmationStyles.button, confirmationStyles.confirmButton, { backgroundColor: getConfirmButtonColor() }]}
            onPress={() => {
              onConfirm();
              onClose();
            }}
          >
            <Text style={[confirmationStyles.buttonText, { color: colors.background }]}>
              {confirmText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const confirmationStyles = StyleSheet.create({
  content: {
    paddingVertical: 8,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});