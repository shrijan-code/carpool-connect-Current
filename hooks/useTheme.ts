import { useMemo } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { DarkColors, LightColors, ColorScheme } from '@/constants/colors';
import { Appearance } from 'react-native';

export const useTheme = () => {
  const settings = useSettingsStore((s) => s.settings);
  const isInitialized = useSettingsStore((s) => s.settings.isInitialized);
  
  const colors = useMemo((): ColorScheme => {
    // If settings aren't initialized yet, use system theme as fallback
    if (!isInitialized) {
      const systemTheme = Appearance.getColorScheme() || 'light';
      return systemTheme === 'dark' ? DarkColors : LightColors;
    }
    
    return settings.currentTheme === 'dark' ? DarkColors : LightColors;
  }, [settings.currentTheme, isInitialized]);

  const theme = isInitialized ? settings.currentTheme : (Appearance.getColorScheme() || 'light');

  return {
    theme,
    colors,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    isInitialized,
  };
};

export default useTheme;