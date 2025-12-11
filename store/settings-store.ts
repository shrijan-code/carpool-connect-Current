import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Appearance } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as Localization from 'expo-localization';
import { LightColors, DarkColors, ColorScheme } from '@/constants/colors';

export interface AppSettings {
  // Notification settings
  pushNotificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationTypes: {
    rideRequests: boolean;
    rideUpdates: boolean;
    messages: boolean;
    payments: boolean;
    marketing: boolean;
  };
  
  // Appearance settings
  darkMode: 'auto' | 'light' | 'dark';
  language: string;
  
  // Privacy settings
  shareLocation: boolean;
  shareProfile: boolean;
  allowDataCollection: boolean;
  
  // Sound settings
  notificationSound: string;
  messageSound: string;
  volume: number;
  
  // Internal state
  currentTheme: 'light' | 'dark';
  isInitialized: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  pushNotificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  notificationTypes: {
    rideRequests: true,
    rideUpdates: true,
    messages: true,
    payments: true,
    marketing: false,
  },
  darkMode: 'auto',
  language: (Localization.getLocales()[0]?.languageCode) || 'en',
  shareLocation: true,
  shareProfile: true,
  allowDataCollection: true,
  notificationSound: 'default',
  messageSound: 'default',
  volume: 0.8,
  currentTheme: Appearance.getColorScheme() || 'light',
  isInitialized: false,
};

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  
  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  
  // Specific setting updates
  togglePushNotifications: () => Promise<void>;
  toggleSound: () => Promise<void>;
  toggleVibration: () => Promise<void>;
  setDarkMode: (mode: 'auto' | 'light' | 'dark') => Promise<void>;
  setLanguage: (language: string) => Promise<void>;
  updateNotificationType: (type: keyof AppSettings['notificationTypes'], enabled: boolean) => Promise<void>;
  updatePrivacySetting: (setting: 'shareLocation' | 'shareProfile' | 'allowDataCollection', enabled: boolean) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setNotificationSound: (soundId: string) => Promise<void>;
  
  // Utility functions
  playNotificationSound: (soundId?: string) => Promise<void>;
  triggerHaptic: (type?: 'light' | 'medium' | 'heavy') => Promise<void>;
  getCurrentTheme: () => 'light' | 'dark';
  getColors: () => ColorScheme;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,

  loadSettings: async () => {
    try {
      set({ isLoading: true });
      const stored = await AsyncStorage.getItem('app_settings');
      let settings: AppSettings;
      
      if (stored) {
        try {
          const parsedSettings = JSON.parse(stored);
          // Merge with defaults to ensure all properties exist
          settings = { ...DEFAULT_SETTINGS, ...parsedSettings };
        } catch (parseError) {
          console.warn('Failed to parse stored settings, using defaults:', parseError);
          // Clear corrupted data and use defaults
          await AsyncStorage.removeItem('app_settings');
          settings = { ...DEFAULT_SETTINGS };
        }
      } else {
        // First time, use defaults
        settings = { ...DEFAULT_SETTINGS };
      }
      
      // Update current theme based on system or user preference
      const systemTheme = Appearance.getColorScheme() || 'light';
      if (settings.darkMode === 'auto') {
        settings.currentTheme = systemTheme;
      } else {
        settings.currentTheme = settings.darkMode;
      }
      
      settings.isInitialized = true;
      set({ settings });
      
      // Apply settings to system
      await applySettings(settings);
      
      // Save updated settings
      await AsyncStorage.setItem('app_settings', JSON.stringify(settings));
      
      console.log('Settings loaded and applied:', settings);
    } catch (error) {
      console.error('Load settings error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    try {
      const currentSettings = get().settings;
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      // Update current theme if dark mode changed
      if (newSettings.darkMode !== undefined) {
        const systemTheme = Appearance.getColorScheme() || 'light';
        if (newSettings.darkMode === 'auto') {
          updatedSettings.currentTheme = systemTheme;
        } else {
          updatedSettings.currentTheme = newSettings.darkMode;
        }
      }
      
      set({ settings: updatedSettings });
      await AsyncStorage.setItem('app_settings', JSON.stringify(updatedSettings));
      await applySettings(updatedSettings);
      
      console.log('Settings updated:', newSettings);
    } catch (error) {
      console.error('Update settings error:', error);
      throw error;
    }
  },

  resetSettings: async () => {
    try {
      set({ settings: DEFAULT_SETTINGS });
      await AsyncStorage.setItem('app_settings', JSON.stringify(DEFAULT_SETTINGS));
      await applySettings(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Reset settings error:', error);
      throw error;
    }
  },

  togglePushNotifications: async () => {
    const currentSettings = get().settings;
    const newValue = !currentSettings.pushNotificationsEnabled;
    
    if (newValue) {
      // Request permission when enabling
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Notification permission denied');
      }
    }
    
    await get().updateSettings({ pushNotificationsEnabled: newValue });
  },

  toggleSound: async () => {
    const currentSettings = get().settings;
    await get().updateSettings({ soundEnabled: !currentSettings.soundEnabled });
  },

  toggleVibration: async () => {
    const currentSettings = get().settings;
    await get().updateSettings({ vibrationEnabled: !currentSettings.vibrationEnabled });
  },

  setDarkMode: async (mode: 'auto' | 'light' | 'dark') => {
    await get().updateSettings({ darkMode: mode });
  },

  setLanguage: async (language: string) => {
    await get().updateSettings({ language });
  },

  updateNotificationType: async (type: keyof AppSettings['notificationTypes'], enabled: boolean) => {
    const currentSettings = get().settings;
    const updatedNotificationTypes = {
      ...currentSettings.notificationTypes,
      [type]: enabled,
    };
    await get().updateSettings({ notificationTypes: updatedNotificationTypes });
  },

  updatePrivacySetting: async (setting: 'shareLocation' | 'shareProfile' | 'allowDataCollection', enabled: boolean) => {
    await get().updateSettings({ [setting]: enabled });
  },

  setVolume: async (volume: number) => {
    await get().updateSettings({ volume });
    // Play a test sound at the new volume
    if (get().settings.soundEnabled) {
      await get().playNotificationSound();
    }
  },
  
  setNotificationSound: async (soundId: string) => {
    await get().updateSettings({ notificationSound: soundId });
    // Play the selected sound
    await get().playNotificationSound(soundId);
  },
  
  playNotificationSound: async (soundId?: string) => {
    try {
      const settings = get().settings;
      if (!settings.soundEnabled) return;
      
      const selectedSound = soundId || settings.notificationSound;
      const soundFile = NOTIFICATION_SOUNDS.find(s => s.id === selectedSound);
      
      if (Platform.OS !== 'web' && soundFile?.file) {
        const { sound } = await Audio.Sound.createAsync(soundFile.file);
        await sound.setVolumeAsync(settings.volume);
        await sound.playAsync();
        
        // Unload sound after playing
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
          }
        });
      } else {
        // Web fallback - use Web Audio API or console log
        console.log(`Playing notification sound: ${soundFile?.name || 'Default'}`);
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  },
  
  triggerHaptic: async (type: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      const settings = get().settings;
      if (!settings.vibrationEnabled || Platform.OS === 'web') return;
      
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } catch (error) {
      console.error('Error triggering haptic feedback:', error);
    }
  },
  
  getCurrentTheme: () => {
    return get().settings.currentTheme;
  },
  
  getColors: () => {
    const theme = get().settings.currentTheme;
    // Return theme-specific colors
    return theme === 'dark' ? getDarkColors() : getLightColors();
  },
}));

// Apply settings to the system
async function applySettings(settings: AppSettings) {
  try {
    console.log('Applying settings:', settings);
    
    // Configure notifications
    if (Platform.OS !== 'web') {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: settings.pushNotificationsEnabled,
          shouldPlaySound: settings.soundEnabled,
          shouldSetBadge: true,
        }),
      });
    }

    // Configure audio
    if (Platform.OS !== 'web') {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: settings.soundEnabled,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (audioError) {
        console.warn('Audio configuration error:', audioError);
      }
    }

    // Apply theme changes
    if (Platform.OS !== 'web') {
      // Note: Appearance.setColorScheme is not available in Expo Go
      // The theme will be handled by the app's color system
      console.log('Theme applied:', settings.currentTheme);
    }

    console.log('Settings applied successfully');
  } catch (error) {
    console.error('Apply settings error:', error);
  }
}

// Get colors based on theme
function getDarkColors(): ColorScheme {
  return DarkColors;
}

function getLightColors(): ColorScheme {
  return LightColors;
}

// Available languages
export const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

// Available notification sounds
export const NOTIFICATION_SOUNDS = [
  { id: 'default', name: 'Default', file: null },
  { id: 'chime', name: 'Chime', file: null },
  { id: 'bell', name: 'Bell', file: null },
  { id: 'ping', name: 'Ping', file: null },
  { id: 'pop', name: 'Pop', file: null },
  { id: 'whistle', name: 'Whistle', file: null },
];

// Listen to system appearance changes
if (Platform.OS !== 'web') {
  Appearance.addChangeListener(({ colorScheme }) => {
    // This will be handled by the settings store when it's initialized
    console.log('System appearance changed to:', colorScheme);
  });
}