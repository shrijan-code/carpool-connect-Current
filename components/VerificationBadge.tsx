import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { User } from '@/types';
import { VerificationService } from '@/services/verification';

interface VerificationBadgeProps {
  user: User;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onPress?: () => void;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  user,
  size = 'medium',
  showLabel = false,
  onPress
}) => {
  if (!VerificationService.shouldShowVerificationBadge(user)) {
    return null;
  }

  const verificationLevel = (user as any).verificationLevel || 'none';
  const badgeColor = VerificationService.getVerificationBadgeColor(verificationLevel);
  const badgeLabel = VerificationService.getVerificationBadgeLabel(verificationLevel);

  const iconSize = size === 'small' ? 14 : size === 'medium' ? 18 : 24;
  const fontSize = size === 'small' ? 10 : size === 'medium' ? 12 : 14;

  const BadgeContent = () => (
    <View style={[styles.container, styles[`container_${size}`]]}>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <ShieldCheck size={iconSize} color="#FFFFFF" fill="#FFFFFF" />
      </View>
      {showLabel && (
        <Text style={[styles.label, { fontSize, color: badgeColor }]}>
          {badgeLabel}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <BadgeContent />
      </TouchableOpacity>
    );
  }

  return <BadgeContent />;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  container_small: {
    gap: 2,
  },
  container_medium: {
    gap: 4,
  },
  container_large: {
    gap: 6,
  },
  badge: {
    borderRadius: 12,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600' as const,
  },
});
