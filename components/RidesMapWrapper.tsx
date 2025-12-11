import React from 'react';
import { Platform } from 'react-native';
import { Ride } from '@/types';

interface RidesMapWrapperProps {
  rides: Ride[];
  userLocation?: { latitude: number; longitude: number } | null;
  onRideSelect?: (rideId: string) => void;
}

let RidesMapComponent: React.ComponentType<RidesMapWrapperProps>;

if (Platform.OS === 'web') {
  RidesMapComponent = require('./RidesMap').default;
} else {
  RidesMapComponent = require('./RidesMap.native').default;
}

export default function RidesMapWrapper(props: RidesMapWrapperProps) {
  return <RidesMapComponent {...props} />;
}
