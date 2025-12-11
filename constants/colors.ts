export const LightColors = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#8B5CF6',
  secondary: '#06B6D4',
  secondaryDark: '#0891B2',
  secondaryLight: '#67E8F9',
  accent: '#F59E0B',
  accentLight: '#FBBF24',
  
  background: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FEFEFE',
  
  text: '#0F172A',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textLight: '#94A3B8',
  textInverse: '#FFFFFF',
  
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderDark: '#CBD5E1',
  divider: '#E5E7EB',
  
  success: '#10B981',
  successLight: '#6EE7B7',
  successDark: '#047857',
  warning: '#F59E0B',
  warningLight: '#FCD34D',
  warningDark: '#D97706',
  error: '#EF4444',
  errorLight: '#FCA5A5',
  errorDark: '#DC2626',
  info: '#3B82F6',
  infoLight: '#93C5FD',
  infoDark: '#1D4ED8',
  
  gradient: {
    primary: ['#6366F1', '#8B5CF6', '#EC4899', '#F97316'] as const,
    secondary: ['#06B6D4', '#8B5CF6', '#EC4899'] as const,
    accent: ['#F59E0B', '#FBBF24'] as const,
    text: ['#6366F1', '#8B5CF6', '#EC4899', '#F97316'] as const,
    cyberpunk: ['#00D4FF', '#6366F1', '#8B5CF6', '#EC4899', '#FF6B35'] as const,
  },
  
  shadow: {
    color: '#000000',
    opacity: 0.1,
  }
};

export const DarkColors = {
  primary: '#8B5CF6',
  primaryDark: '#6366F1',
  primaryLight: '#A78BFA',
  secondary: '#06B6D4',
  secondaryDark: '#0891B2',
  secondaryLight: '#67E8F9',
  accent: '#F59E0B',
  accentLight: '#FBBF24',
  
  background: '#0A0A0F',
  surface: '#111118',
  surfaceElevated: '#1A1A24',
  card: '#1A1A24',
  cardElevated: '#242438',
  
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B8',
  textTertiary: '#6B6B8A',
  textLight: '#52525B',
  textInverse: '#0F172A',
  
  border: '#2A2A3A',
  borderLight: '#1F1F2A',
  borderDark: '#374151',
  divider: '#374151',
  
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#047857',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',
  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',
  info: '#3B82F6',
  infoLight: '#60A5FA',
  infoDark: '#1D4ED8',
  
  gradient: {
    primary: ['#6366F1', '#8B5CF6', '#EC4899', '#F97316'] as const,
    secondary: ['#06B6D4', '#8B5CF6', '#EC4899'] as const,
    accent: ['#F59E0B', '#FBBF24'] as const,
    text: ['#6366F1', '#8B5CF6', '#EC4899', '#F97316'] as const,
    cyberpunk: ['#00D4FF', '#6366F1', '#8B5CF6', '#EC4899', '#FF6B35'] as const,
  },
  
  shadow: {
    color: '#000000',
    opacity: 0.3,
  }
};

// Default export for backward compatibility
export const Colors = LightColors;

export default LightColors;

export type ColorScheme = typeof LightColors;