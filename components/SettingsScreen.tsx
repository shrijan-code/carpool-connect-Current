import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Slider } from '@/components/ui/Slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore, AVAILABLE_LANGUAGES, NOTIFICATION_SOUNDS } from '@/store/settings-store';
import {
  Bell,
  Volume2,
  Moon,
  Globe,
  Lock,
  ChevronRight,
  Check,
  X,
  Smartphone,
  MessageSquare,
  CreditCard,
  Mail,
  Shield,
  Database,
  MapPin,
  User,
  Vibrate,
  Sun,
  Palette,
  VolumeX,
} from 'lucide-react-native';

interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsScreen({ visible, onClose }: SettingsScreenProps) {
  const {
    settings,
    loadSettings,
    togglePushNotifications,
    toggleSound,
    toggleVibration,
    setDarkMode,
    setLanguage,
    updateNotificationType,
    updatePrivacySetting,
    setVolume,
    setNotificationSound,
    resetSettings,
    playNotificationSound,
    triggerHaptic,
    getColors,
  } = useSettingsStore();
  
  const colors = getColors();

  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);
  const [showSoundModal, setShowSoundModal] = useState<boolean>(false);
  const [showNotificationTypesModal, setShowNotificationTypesModal] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible, loadSettings]);

  const handleDarkModePress = async () => {
    const options = ['Auto', 'Light', 'Dark', 'Cancel'];
    const modes: ('auto' | 'light' | 'dark')[] = ['auto', 'light', 'dark'];

    await triggerHaptic('light');
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 3,
          title: 'Choose Theme',
        },
        async (buttonIndex) => {
          if (buttonIndex < 3) {
            await triggerHaptic('medium');
            await setDarkMode(modes[buttonIndex]);
          }
        }
      );
    } else {
      Alert.alert(
        'Choose Theme',
        'Select your preferred theme',
        [
          { text: 'Auto', onPress: async () => {
            await triggerHaptic('medium');
            await setDarkMode('auto');
          }},
          { text: 'Light', onPress: async () => {
            await triggerHaptic('medium');
            await setDarkMode('light');
          }},
          { text: 'Dark', onPress: async () => {
            await triggerHaptic('medium');
            await setDarkMode('dark');
          }},
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleNotificationToggle = async () => {
    try {
      await triggerHaptic('light');
      await togglePushNotifications();
    } catch {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive ride updates.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => {
            // In a real app, you would open device settings
            console.log('Open device settings');
          }},
        ]
      );
    }
  };

  const handleSoundToggle = async () => {
    await triggerHaptic('light');
    await toggleSound();
    if (!settings.soundEnabled) {
      // Play sound when enabling
      setTimeout(() => playNotificationSound(), 100);
    }
  };

  const handleVibrationToggle = async () => {
    await toggleVibration();
    if (!settings.vibrationEnabled) {
      // Test vibration when enabling
      setTimeout(() => triggerHaptic('medium'), 100);
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetSettings();
              Alert.alert('Success', 'Settings have been reset to default values.');
            } catch {
              Alert.alert('Error', 'Failed to reset settings. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getDarkModeLabel = () => {
    switch (settings.darkMode) {
      case 'auto': return 'Auto';
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      default: return 'Auto';
    }
  };

  const getLanguageLabel = () => {
    const language = AVAILABLE_LANGUAGES.find(lang => lang.code === settings.language);
    return language ? language.nativeName : 'English';
  };

  const getSoundLabel = () => {
    const sound = NOTIFICATION_SOUNDS.find(s => s.id === settings.notificationSound);
    return sound ? sound.name : 'Default';
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
            
            <View style={[styles.settingItem, { backgroundColor: colors.surface }]}>
              <View style={styles.settingLeft}>
                <Bell size={20} color={colors.primary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Push Notifications</Text>
              </View>
              <Switch
                value={settings.pushNotificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>

            <TouchableOpacity
              style={[styles.settingItem, { backgroundColor: colors.surface }]}
              onPress={() => setShowNotificationTypesModal(true)}
              disabled={!settings.pushNotificationsEnabled}
            >
              <View style={styles.settingLeft}>
                <Smartphone size={20} color={settings.pushNotificationsEnabled ? colors.primary : colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }, !settings.pushNotificationsEnabled && styles.disabledText]}>
                  Notification Types
                </Text>
              </View>
              <ChevronRight size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.settingItem, { backgroundColor: colors.surface }]}>
              <View style={styles.settingLeft}>
                <Volume2 size={20} color={colors.primary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Sound</Text>
              </View>
              <Switch
                value={settings.soundEnabled}
                onValueChange={handleSoundToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>

            <TouchableOpacity
              style={[styles.settingItem, { backgroundColor: colors.surface }]}
              onPress={() => setShowSoundModal(true)}
              disabled={!settings.soundEnabled}
            >
              <View style={styles.settingLeft}>
                <VolumeX size={20} color={settings.soundEnabled ? colors.primary : colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }, !settings.soundEnabled && styles.disabledText]}>
                  Notification Sound
                </Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: colors.textSecondary }, !settings.soundEnabled && styles.disabledText]}>
                  {getSoundLabel()}
                </Text>
                <ChevronRight size={16} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>

            {Platform.OS !== 'web' && (
              <View style={[styles.settingItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <Vibrate size={20} color={colors.primary} />
                  <Text style={[styles.settingText, { color: colors.text }]}>Vibration</Text>
                </View>
                <Switch
                  value={settings.vibrationEnabled}
                  onValueChange={handleVibrationToggle}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            )}

            {settings.soundEnabled && (
              <View style={[styles.settingItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <Volume2 size={20} color={colors.primary} />
                  <Text style={[styles.settingText, { color: colors.text }]}>Volume</Text>
                </View>
                <View style={styles.sliderContainer}>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={1}
                    value={settings.volume}
                    onValueChange={setVolume}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                  <Text style={[styles.volumeText, { color: colors.textSecondary }]}>{Math.round(settings.volume * 100)}%</Text>
                </View>
              </View>
            )}
          </View>

          {/* Appearance Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
            
            <TouchableOpacity style={[styles.settingItem, { backgroundColor: colors.surface }]} onPress={handleDarkModePress}>
              <View style={styles.settingLeft}>
                {settings.darkMode === 'dark' ? (
                  <Moon size={20} color={colors.primary} />
                ) : settings.darkMode === 'light' ? (
                  <Sun size={20} color={colors.primary} />
                ) : (
                  <Palette size={20} color={colors.primary} />
                )}
                <Text style={[styles.settingText, { color: colors.text }]}>Theme</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{getDarkModeLabel()}</Text>
                <ChevronRight size={16} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { backgroundColor: colors.surface }]}
              onPress={() => setShowLanguageModal(true)}
            >
              <View style={styles.settingLeft}>
                <Globe size={20} color={colors.primary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Language</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{getLanguageLabel()}</Text>
                <ChevronRight size={16} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Privacy Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy</Text>
            
            <TouchableOpacity
              style={[styles.settingItem, { backgroundColor: colors.surface }]}
              onPress={() => setShowPrivacyModal(true)}
            >
              <View style={styles.settingLeft}>
                <Lock size={20} color={colors.primary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Privacy Settings</Text>
              </View>
              <ChevronRight size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Reset Section */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.resetButton} onPress={handleResetSettings}>
              <Text style={styles.resetText}>Reset All Settings</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Language Selection Modal */}
        <Modal
          visible={showLanguageModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {AVAILABLE_LANGUAGES.map((language) => (
                <TouchableOpacity
                  key={language.code}
                  style={[styles.optionItem, { backgroundColor: colors.surface }]}
                  onPress={async () => {
                    await triggerHaptic('light');
                    await setLanguage(language.code);
                    setShowLanguageModal(false);
                  }}
                >
                  <View style={styles.optionLeft}>
                    <Text style={[styles.optionText, { color: colors.text }]}>{language.nativeName}</Text>
                    <Text style={[styles.optionSubtext, { color: colors.textSecondary }]}>{language.name}</Text>
                  </View>
                  {settings.language === language.code && (
                    <Check size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Sound Selection Modal */}
        <Modal
          visible={showSoundModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSoundModal(false)}
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Notification Sound</Text>
              <TouchableOpacity onPress={() => setShowSoundModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {NOTIFICATION_SOUNDS.map((sound) => (
                <TouchableOpacity
                  key={sound.id}
                  style={[styles.optionItem, { backgroundColor: colors.surface }]}
                  onPress={async () => {
                    await triggerHaptic('light');
                    await setNotificationSound(sound.id);
                    setShowSoundModal(false);
                  }}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>{sound.name}</Text>
                  {settings.notificationSound === sound.id && (
                    <Check size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Notification Types Modal */}
        <Modal
          visible={showNotificationTypesModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowNotificationTypesModal(false)}
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Notification Types</Text>
              <TouchableOpacity onPress={() => setShowNotificationTypesModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={[styles.notificationTypeItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <Bell size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingText, { color: colors.text }]}>Ride Requests</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>New ride booking requests</Text>
                  </View>
                </View>
                <Switch
                  value={settings.notificationTypes.rideRequests}
                  onValueChange={(value) => updateNotificationType('rideRequests', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View style={[styles.notificationTypeItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <Shield size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingText, { color: colors.text }]}>Ride Updates</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>Status changes and confirmations</Text>
                  </View>
                </View>
                <Switch
                  value={settings.notificationTypes.rideUpdates}
                  onValueChange={(value) => updateNotificationType('rideUpdates', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View style={[styles.notificationTypeItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <MessageSquare size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingText, { color: colors.text }]}>Messages</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>New chat messages</Text>
                  </View>
                </View>
                <Switch
                  value={settings.notificationTypes.messages}
                  onValueChange={(value) => updateNotificationType('messages', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View style={[styles.notificationTypeItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <CreditCard size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingText, { color: colors.text }]}>Payments</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>Payment confirmations and receipts</Text>
                  </View>
                </View>
                <Switch
                  value={settings.notificationTypes.payments}
                  onValueChange={(value) => updateNotificationType('payments', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View style={[styles.notificationTypeItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <Mail size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingText, { color: colors.text }]}>Marketing</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>Promotions and updates</Text>
                  </View>
                </View>
                <Switch
                  value={settings.notificationTypes.marketing}
                  onValueChange={(value) => updateNotificationType('marketing', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Privacy Settings Modal */}
        <Modal
          visible={showPrivacyModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPrivacyModal(false)}
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Privacy Settings</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={[styles.notificationTypeItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <MapPin size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingText, { color: colors.text }]}>Share Location</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>Allow location sharing during rides</Text>
                  </View>
                </View>
                <Switch
                  value={settings.shareLocation}
                  onValueChange={(value) => updatePrivacySetting('shareLocation', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View style={[styles.notificationTypeItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <User size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingText, { color: colors.text }]}>Share Profile</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>Show profile to other users</Text>
                  </View>
                </View>
                <Switch
                  value={settings.shareProfile}
                  onValueChange={(value) => updatePrivacySetting('shareProfile', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <View style={[styles.notificationTypeItem, { backgroundColor: colors.surface }]}>
                <View style={styles.settingLeft}>
                  <Database size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingText, { color: colors.text }]}>Data Collection</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>Allow analytics and improvement data</Text>
                  </View>
                </View>
                <Switch
                  value={settings.allowDataCollection}
                  onValueChange={(value) => updatePrivacySetting('allowDataCollection', value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  settingSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    marginRight: 8,
  },
  disabledText: {
    opacity: 0.6,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  volumeText: {
    fontSize: 12,
    marginLeft: 8,
    minWidth: 35,
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  resetText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionLeft: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  optionSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  notificationTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
});