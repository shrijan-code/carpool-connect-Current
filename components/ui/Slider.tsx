import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';

interface SliderProps {
  style?: any;
  minimumValue?: number;
  maximumValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  disabled?: boolean;
  step?: number;
}

export function Slider({
  style,
  minimumValue = 0,
  maximumValue = 1,
  value = 0,
  onValueChange,
  minimumTrackTintColor = '#007AFF',
  maximumTrackTintColor = '#E5E5EA',
  thumbTintColor = '#007AFF',
  disabled = false,
  step,
}: SliderProps) {
  const [sliderWidth, setSliderWidth] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const animatedValue = React.useRef(new Animated.Value(value)).current;
  const webSliderRef = useRef<HTMLInputElement>(null);

  const getValueFromPosition = useCallback(
    (position: number) => {
      const ratio = Math.max(0, Math.min(1, position / sliderWidth));
      let newValue = minimumValue + ratio * (maximumValue - minimumValue);
      
      if (step) {
        newValue = Math.round(newValue / step) * step;
      }
      
      return Math.max(minimumValue, Math.min(maximumValue, newValue));
    },
    [sliderWidth, minimumValue, maximumValue, step]
  );

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        if (disabled) return;
        setIsDragging(true);
        const newValue = getValueFromPosition(evt.nativeEvent.locationX);
        onValueChange?.(newValue);
      },
      onPanResponderMove: (evt) => {
        if (disabled) return;
        const newValue = getValueFromPosition(evt.nativeEvent.locationX);
        onValueChange?.(newValue);
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
      },
    })
  ).current;

  React.useEffect(() => {
    animatedValue.setValue(value);
  }, [value, animatedValue]);

  const trackWidth = sliderWidth || 200;
  const thumbPosition = ((value - minimumValue) / (maximumValue - minimumValue)) * trackWidth;
  const minimumTrackWidth = thumbPosition;
  const maximumTrackWidth = trackWidth - thumbPosition;

  if (Platform.OS === 'web') {
    // Web-specific implementation using HTML input range
    
    return (
      <View style={[styles.container, style]}>
        <input
          ref={webSliderRef}
          type="range"
          min={minimumValue}
          max={maximumValue}
          step={step || 0.01}
          value={value}
          onChange={(e) => {
            const newValue = parseFloat(e.target.value);
            onValueChange?.(newValue);
          }}
          disabled={disabled}
          style={{
            width: '100%',
            height: 40,
            background: 'transparent',
            outline: 'none',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            WebkitAppearance: 'none',
            appearance: 'none',
          } as any}
          className="custom-slider"
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            .custom-slider::-webkit-slider-track {
              height: 4px;
              background: ${maximumTrackTintColor};
              border-radius: 2px;
            }
            .custom-slider::-webkit-slider-thumb {
              appearance: none;
              width: 20px;
              height: 20px;
              background: ${thumbTintColor};
              border-radius: 50%;
              cursor: pointer;
              border: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            .custom-slider::-moz-range-track {
              height: 4px;
              background: ${maximumTrackTintColor};
              border-radius: 2px;
              border: none;
            }
            .custom-slider::-moz-range-thumb {
              width: 20px;
              height: 20px;
              background: ${thumbTintColor};
              border-radius: 50%;
              cursor: pointer;
              border: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
          `
        }} />
      </View>
    );
  }

  // Native implementation
  return (
    <View
      style={[styles.container, style]}
      onLayout={(event) => {
        setSliderWidth(event.nativeEvent.layout.width);
      }}
      {...panResponder.panHandlers}
    >
      <View style={styles.track}>
        <View
          style={[
            styles.minimumTrack,
            {
              width: minimumTrackWidth,
              backgroundColor: minimumTrackTintColor,
            },
          ]}
        />
        <View
          style={[
            styles.maximumTrack,
            {
              width: maximumTrackWidth,
              backgroundColor: maximumTrackTintColor,
            },
          ]}
        />
      </View>
      <View
        style={[
          styles.thumb,
          {
            left: thumbPosition - 10, // Half of thumb width
            backgroundColor: thumbTintColor,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: isDragging ? 1.2 : 1 }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 4,
    borderRadius: 2,
    flexDirection: 'row',
    position: 'absolute',
    left: 10,
    right: 10,
  },
  minimumTrack: {
    height: 4,
    borderRadius: 2,
  },
  maximumTrack: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default Slider;