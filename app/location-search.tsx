import React from 'react';
import { Stack } from 'expo-router';
import { LocationBasedRideSearch } from '@/components/LocationBasedRideSearch';
import { useTheme } from '@/hooks/useTheme';

export default function LocationSearchScreen() {
  const { colors } = useTheme();
  
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Find Rides by Location',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.background,
          headerTitleStyle: { fontWeight: '600' }
        }} 
      />
      <LocationBasedRideSearch />
    </>
  );
}
