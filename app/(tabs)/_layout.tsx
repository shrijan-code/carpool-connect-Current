import { Tabs, Redirect } from "expo-router";
import React from "react";
import { Home, Calendar, MessageCircle, User } from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export default function TabLayout() {
  const { isAuthenticated, isOnboarded } = useAuthStore();
  const { colors } = useTheme();

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
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
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