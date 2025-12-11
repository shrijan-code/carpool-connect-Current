import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { Location } from '@/types';
import { MapPin } from 'lucide-react-native';
import { usePlacesAutocomplete } from '@/hooks/usePlacesAutocomplete';

interface OptimizedPlacesAutocompleteProps {
  placeholder: string;
  onLocationSelect: (location: Location) => void;
  value?: Location | null;
  style?: any;
  label?: string;
  error?: string;
  testID?: string;
}

export const OptimizedPlacesAutocomplete: React.FC<OptimizedPlacesAutocompleteProps> = ({
  placeholder,
  onLocationSelect,
  value,
  style,
  label,
  error,
  testID,
}) => {
  const {
    inputValue,
    handleTextChange,
    predictions,
    showPredictions,
    isLoading,
    focused,
    inputRef,
    open,
    close,
    selectPlace,
  } = usePlacesAutocomplete({ onLocationSelect });

  // Update input value when external value changes
  React.useEffect(() => {
    if (value?.name && inputValue !== value.name) {
      handleTextChange(value.name);
    }
  }, [value?.name, inputValue, handleTextChange]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        focused && styles.inputContainerFocused,
        error && styles.inputContainerError
      ]}>
        <MapPin size={20} color={Colors.textSecondary} style={styles.icon} />
        <TextInput
          ref={inputRef}
          testID={`${testID}-input`}
          placeholder={placeholder}
          value={inputValue}
          onChangeText={handleTextChange}
          style={styles.input}
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
          onFocus={open}
          onBlur={() => {
            setTimeout(close, 200); // Delay to allow prediction selection
          }}
          returnKeyType="done"
          blurOnSubmit={true}
        />
        {isLoading && (
          <View style={styles.loadingIndicator}>
            <Text style={styles.loadingText}>...</Text>
          </View>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {showPredictions && predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          {predictions.map((prediction, index) => (
            <TouchableOpacity
              key={`${prediction.place_id}-${index}`}
              testID={`${testID}-prediction-${index}`}
              style={styles.predictionItem}
              onPress={() => selectPlace(prediction)}
              activeOpacity={0.7}
            >
              <MapPin size={16} color={Colors.textSecondary} />
              <View style={styles.predictionTextContainer}>
                <Text style={styles.predictionText} numberOfLines={2}>
                  {prediction.description}
                </Text>
                {prediction.structured_formatting?.secondary_text && (
                  <Text style={styles.predictionSecondaryText} numberOfLines={1}>
                    {prediction.structured_formatting.secondary_text}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      <Text style={styles.note}>
        🇦🇺 Australian locations • Optimized with session tokens
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  inputContainerFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerError: {
    borderColor: Colors.error,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: 'transparent',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  predictionsContainer: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -1,
    maxHeight: 200,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  predictionTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  predictionText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  predictionSecondaryText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
  note: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
});

export default OptimizedPlacesAutocomplete;