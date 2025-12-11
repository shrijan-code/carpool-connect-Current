import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';
import { Calendar, Clock } from 'lucide-react-native';

interface DateTimeFieldProps {
  value: Date;
  onChange: (date: Date) => void;
  mode: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  label?: string;
  error?: string;
  style?: any;
}

export const DateTimeField: React.FC<DateTimeFieldProps> = ({
  value,
  onChange,
  mode,
  minimumDate,
  maximumDate,
  label,
  error,
  style
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [currentMode, setCurrentMode] = useState<'date' | 'time'>(mode === 'datetime' ? 'date' : mode);
  const [tempDate, setTempDate] = useState(value);

  const formatValue = () => {
    if (mode === 'date') {
      return value.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } else if (mode === 'time') {
      return value.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return `${value.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })}, ${value.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`;
    }
  };

  const handlePress = () => {
    setTempDate(value);
    setCurrentMode(mode === 'datetime' ? 'date' : mode);
    setShowPicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    if (selectedDate) {
      setTempDate(selectedDate);
      
      if (mode === 'datetime' && currentMode === 'date') {
        // Switch to time picker for datetime mode
        setCurrentMode('time');
      } else {
        // Final selection
        onChange(selectedDate);
        if (Platform.OS === 'ios') {
          setShowPicker(false);
        }
      }
    }
  };

  const handleDone = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const getIcon = () => {
    if (mode === 'time') {
      return <Clock size={16} color={Colors.primary} />;
    }
    return <Calendar size={16} color={Colors.primary} />;
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={[styles.field, error && styles.errorField]}
        onPress={handlePress}
      >
        {getIcon()}
        <Text style={styles.value}>{formatValue()}</Text>
      </TouchableOpacity>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {/* Live selected value display for iOS */}
      {Platform.OS === 'ios' && showPicker && (
        <View style={styles.liveValueContainer}>
          <Text style={styles.liveValueLabel}>Selected:</Text>
          <Text style={styles.liveValue}>
            {mode === 'date' && tempDate.toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })}
            {mode === 'time' && tempDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}
            {mode === 'datetime' && `${tempDate.toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })}, ${tempDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}`}
          </Text>
        </View>
      )}

      {showPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerBackdrop} />
          <View style={[styles.pickerContainer, Platform.OS === 'ios' && styles.iosPickerContainer]}>
            {Platform.OS === 'ios' && (
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  Select {currentMode === 'date' ? 'Date' : 'Time'}
                </Text>
                <TouchableOpacity onPress={handleDone}>
                  <Text style={styles.doneButton}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={Platform.OS === 'ios' ? styles.iosPickerWrapper : undefined}>
              <DateTimePicker
                value={tempDate}
                mode={currentMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                // iOS-specific props for better visibility
                textColor={Platform.OS === 'ios' ? '#000000' : undefined}
                themeVariant={Platform.OS === 'ios' ? 'light' : undefined}
                style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  errorField: {
    borderColor: Colors.error,
  },
  value: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
    marginLeft: 12,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
  liveValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  liveValueLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  liveValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  pickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    margin: 24,
    minWidth: '80%',
    maxWidth: '90%',
  },
  iosPickerContainer: {
    backgroundColor: '#ffffff',
    padding: 0,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: '#f8f9fa',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000000',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  iosPickerWrapper: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
  },
  iosPicker: {
    backgroundColor: '#ffffff',
  },
});