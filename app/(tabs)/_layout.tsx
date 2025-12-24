import { Tabs, Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Home, Calendar, MessageCircle, User } from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";
import { ChatService } from "@/services/chat";

// Badge component for showing unread count
const TabBarBadge = ({ count, color }: { count: number; color: string }) => {
  if (count === 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

export default function TabLayout() {
  const { isAuthenticated, isOnboarded, user } = useAuthStore();
  const { colors } = useTheme();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Subscribe to unread message count
  useEffect(() => {
    if (!user?.id) {
      setUnreadMessageCount(0);
      return;
    }

    const unsubscribe = ChatService.getUnreadMessageCountForUser(
      user.id,
      (count) => {
        setUnreadMessageCount(count);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  if (!isOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          shadowColor: colors.shadow.color,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: colors.shadow.opacity,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600' as const,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "My Rides",
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <View>
              <MessageCircle color={color} size={size} />
              <TabBarBadge count={unreadMessageCount} color={colors.primary} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});