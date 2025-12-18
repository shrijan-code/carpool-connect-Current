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
  primary: '#818CF8',       // Brighter indigo for better visibility
  primaryDark: '#6366F1',
  primaryLight: '#A5B4FC',
  secondary: '#22D3EE',     // Brighter cyan
  secondaryDark: '#06B6D4',
  secondaryLight: '#67E8F9',
  accent: '#FBBF24',        // Brighter amber
  accentLight: '#FCD34D',

  // Improved background hierarchy - less harsh, better contrast
  background: '#0F0F14',    // Slightly lighter base (was #0A0A0F)
  surface: '#1A1A23',       // More visible separation (was #111118)
  surfaceElevated: '#252532', // Better contrast for elevated elements
  card: '#1F1F2B',          // Clearly distinct from background (was #1A1A24)
  cardElevated: '#2D2D3D',  // More visible elevation

  // Improved text colors - more readable
  text: '#F8FAFC',          // Slightly softer white (was pure #FFFFFF)
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8', // Much more readable (was #A0A0B8)
  textTertiary: '#64748B',  // Better visibility (was #6B6B8A)
  textLight: '#71717A',     // More readable (was #52525B)
  textInverse: '#0F172A',

  // Improved borders - more visible
  border: '#374151',        // More visible borders (was #2A2A3A)
  borderLight: '#2D3748',   // Better distinction
  borderDark: '#4B5563',
  divider: '#3F3F50',       // More visible dividers

  // Status colors (slightly brighter for dark mode)
  success: '#22C55E',       // Brighter green
  successLight: '#4ADE80',
  successDark: '#16A34A',
  warning: '#FBBF24',       // Brighter amber
  warningLight: '#FCD34D',
  warningDark: '#F59E0B',
  error: '#F87171',         // Slightly softer red (was #EF4444)
  errorLight: '#FCA5A5',
  errorDark: '#EF4444',
  info: '#60A5FA',          // Brighter blue
  infoLight: '#93C5FD',
  infoDark: '#3B82F6',

  gradient: {
    primary: ['#6366F1', '#8B5CF6', '#EC4899', '#F97316'] as const,
    secondary: ['#06B6D4', '#8B5CF6', '#EC4899'] as const,
    accent: ['#F59E0B', '#FBBF24'] as const,
    text: ['#818CF8', '#A78BFA', '#F472B6', '#FB923C'] as const,
    cyberpunk: ['#00D4FF', '#6366F1', '#8B5CF6', '#EC4899', '#FF6B35'] as const,
  },

  shadow: {
    color: '#000000',
    opacity: 0.4,
  }
};

// Default export for backward compatibility
export const Colors = LightColors;

export default LightColors;

export type ColorScheme = typeof LightColors;