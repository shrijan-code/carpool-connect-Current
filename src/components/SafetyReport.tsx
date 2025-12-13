import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Shield, FileText, X, Camera, Upload, Trash2 } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { SafetyReport } from '@/types';
import { SafetyReportService } from '@/services/safety-reports';
import { ImageService } from '@/services/image';
import * as ImagePicker from 'expo-image-picker';

interface SafetyReportProps {
  rideId?: string;
  onClose?: () => void;
  isVisible?: boolean;
}

export const SafetyReportComponent: React.FC<SafetyReportProps> = ({
  rideId,
  onClose,
  isVisible = false,
}) => {
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(isVisible);
  const [reportType, setReportType] = useState<SafetyReport['type'] | null>(null);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<SafetyReport['severity']>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  React.useEffect(() => {
    setShowModal(isVisible);
  }, [isVisible]);

  const reportTypes = [
    {
      type: 'unsafe_driving' as const,
      title: 'Unsafe Driving',
      description: 'Speeding, reckless driving, or traffic violations',
      icon: '🚗',
      severity: 'high' as const,
    },
    {
      type: 'harassment' as const,
      title: 'Harassment',
      description: 'Inappropriate behavior or comments',
      icon: '⚠️',
      severity: 'critical' as const,
    },
    {
      type: 'vehicle_issue' as const,
      title: 'Vehicle Safety Issue',
      description: 'Mechanical problems or safety concerns',
      icon: '🔧',
      severity: 'medium' as const,
    },
    {
      type: 'route_deviation' as const,
      title: 'Route Deviation',
      description: 'Driver taking unexpected or unsafe routes',
      icon: '🗺️',
      severity: 'medium' as const,
    },
    {
      type: 'emergency' as const,
      title: 'Emergency Situation',
      description: 'Immediate danger or emergency assistance needed',
      icon: '🚨',
      severity: 'critical' as const,
    },
    {
      type: 'other' as const,
      title: 'Other Safety Concern',
      description: 'Any other safety-related issue',
      icon: '❗',
      severity: 'medium' as const,
    },
  ];

  const handleOpenReport = () => {
    setShowModal(true);
  };

  const handleCloseReport = () => {
    setShowModal(false);
    setReportType(null);
    setDescription('');
    setSeverity('medium');
    setEvidencePhotos([]);
    if (onClose) onClose();
  };

  const handleSelectReportType = (type: SafetyReport['type']) => {
    const selectedType = reportTypes.find(t => t.type === type);
    setReportType(type);
    if (selectedType) {
      setSeverity(selectedType.severity);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportType || !description.trim()) {
      Alert.alert('Incomplete Report', 'Please select a report type and provide a description.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found.');
      return;
    }

    setIsSubmitting(true);

    try {
      const report: Omit<SafetyReport, 'id' | 'createdAt' | 'updatedAt'> = {
        reporterId: user.id,
        type: reportType,
        description: description.trim(),
        severity,
        status: 'pending',
        ...(rideId && { rideId }),
        ...(evidencePhotos.length > 0 && {
          evidence: {
            photos: evidencePhotos,
          },
        }),
      };

      console.log('Submitting safety report:', report);

      // Submit to backend service (email notification handled automatically)
      const reportId = await SafetyReportService.submitReport(report);
      console.log('Safety report submitted with ID:', reportId);

      // Show confirmation with email notification info
      const emailMessage = (severity === 'critical' || severity === 'high')
        ? ' An email notification has been sent to our safety team for immediate review.'
        : ' Our safety team will review your report within 24 hours.';

      Alert.alert(
        '✅ Report Submitted Successfully',
        `Your safety report has been submitted and will be reviewed by our safety team. We take all reports seriously and will investigate promptly.${emailMessage}`,
        [
          {
            text: 'OK',
            onPress: () => {
              handleCloseReport();

              // If critical, show immediate action options
              if (severity === 'critical') {
                showCriticalReportActions();
              }
            },
          },
        ]
      );

    } catch (error) {
      console.error('Failed to submit safety report:', error);
      Alert.alert(
        'Submission Failed',
        error instanceof Error ? error.message : 'Failed to submit report. Please try again. If the problem persists, please contact support directly at shrijan.bhandari1318@gmail.com'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const showCriticalReportActions = () => {
    Alert.alert(
      '🚨 Critical Safety Report',
      'Due to the critical nature of your report, we recommend taking immediate action:',
      [
        {
          text: 'Call Emergency Services',
          onPress: () => {
            Alert.alert(
              'Call Emergency Services?',
              'This will call 000 (AU). Only use for immediate emergencies.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Call', onPress: () => callEmergencyServices() },
              ]
            );
          },
        },
        {
          text: 'End Ride Safely',
          onPress: () => {
            Alert.alert(
              'Safety Instructions',
              'If you feel unsafe:\n• Ask to be dropped at a safe, public location\n• Contact emergency services if needed\n• Report the incident to local authorities\n• We will follow up with you within 24 hours'
            );
          },
        },
        {
          text: 'Continue Monitoring',
          style: 'cancel',
        },
      ]
    );
  };

  const callEmergencyServices = async () => {
    try {
      // For Australia, use 000. For US, use 911
      const emergencyNumber = 'tel:000'; // Australian emergency number
      const canOpen = await Linking.canOpenURL(emergencyNumber);

      if (canOpen) {
        await Linking.openURL(emergencyNumber);
        console.log('Emergency services called from safety report');
      } else {
        Alert.alert('Error', 'Unable to make emergency call');
      }
    } catch (error) {
      console.error('Failed to call emergency services:', error);
      Alert.alert('Error', 'Failed to call emergency services');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      setIsUploadingPhoto(true);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEvidencePhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is required to select photos.');
        return;
      }

      setIsUploadingPhoto(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEvidencePhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const getSeverityColor = (sev: SafetyReport['severity']) => {
    switch (sev) {
      case 'low': return '#28a745';
      case 'medium': return '#ffc107';
      case 'high': return '#fd7e14';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getSeverityText = (sev: SafetyReport['severity']) => {
    switch (sev) {
      case 'low': return 'Low Priority';
      case 'medium': return 'Medium Priority';
      case 'high': return 'High Priority';
      case 'critical': return 'Critical - Immediate Action';
      default: return 'Unknown';
    }
  };

  if (!showModal && !isVisible) {
    return null;
  }

  return (
    <Modal
      visible={showModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseReport}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Report Safety Issue</Text>
          <TouchableOpacity onPress={handleCloseReport} style={styles.closeButton}>
            <X size={24} color="#495057" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {!reportType ? (
            <View>
              <Text style={styles.sectionTitle}>What type of safety issue would you like to report?</Text>
              <Text style={styles.sectionSubtitle}>
                Your report will be reviewed by our safety team and appropriate action will be taken.
              </Text>

              {reportTypes.map((type) => (
                <TouchableOpacity
                  key={type.type}
                  style={styles.reportTypeCard}
                  onPress={() => handleSelectReportType(type.type)}
                >
                  <Text style={styles.reportTypeIcon}>{type.icon}</Text>
                  <View style={styles.reportTypeContent}>
                    <Text style={styles.reportTypeTitle}>{type.title}</Text>
                    <Text style={styles.reportTypeDescription}>{type.description}</Text>
                  </View>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(type.severity) }]}>
                    <Text style={styles.severityText}>{type.severity.toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setReportType(null)}
              >
                <Text style={styles.backButtonText}>← Back to Categories</Text>
              </TouchableOpacity>

              <View style={styles.selectedTypeCard}>
                <Text style={styles.selectedTypeTitle}>
                  {reportTypes.find(t => t.type === reportType)?.title}
                </Text>
                <Text style={styles.selectedTypeDescription}>
                  {reportTypes.find(t => t.type === reportType)?.description}
                </Text>
              </View>

              <Text style={styles.inputLabel}>Describe the safety issue in detail:</Text>
              <TextInput
                style={styles.descriptionInput}
                multiline
                numberOfLines={6}
                placeholder="Please provide as much detail as possible about what happened, when it occurred, and any other relevant information..."
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Priority Level:</Text>
              <View style={styles.severitySelector}>
                {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                  <TouchableOpacity
                    key={sev}
                    style={[
                      styles.severityOption,
                      severity === sev && styles.severityOptionSelected,
                      { borderColor: getSeverityColor(sev) }
                    ]}
                    onPress={() => setSeverity(sev)}
                  >
                    <Text style={[
                      styles.severityOptionText,
                      severity === sev && { color: getSeverityColor(sev) }
                    ]}>
                      {getSeverityText(sev)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>Evidence (Optional)</Text>
                <Text style={styles.evidenceSubtext}>
                  Add photos to help our safety team understand the situation better
                </Text>

                <View style={styles.photoContainer}>
                  {evidencePhotos.map((photoUri, index) => (
                    <View key={index} style={styles.photoWrapper}>
                      <Image source={{ uri: photoUri }} style={styles.evidencePhoto} />
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <Trash2 size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {evidencePhotos.length < 3 && (
                    <View style={styles.addPhotoButtons}>
                      <TouchableOpacity
                        style={styles.addPhotoButton}
                        onPress={() => takePhoto()}
                        disabled={isUploadingPhoto}
                      >
                        <Camera size={20} color="#007bff" />
                        <Text style={styles.addPhotoText}>Take Photo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.addPhotoButton}
                        onPress={() => pickPhoto()}
                        disabled={isUploadingPhoto}
                      >
                        <Upload size={20} color="#007bff" />
                        <Text style={styles.addPhotoText}>Choose Photo</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {isUploadingPhoto && (
                  <Text style={styles.uploadingText}>Uploading photo...</Text>
                )}
              </View>

              <View style={styles.warningBox}>
                <AlertTriangle size={20} color="#856404" />
                <Text style={styles.warningText}>
                  All safety reports are taken seriously and will be investigated.
                  False reports may result in account suspension.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {reportType && (
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitReport}
              disabled={isSubmitting}
            >
              <FileText size={20} color="#ffffff" />
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  reportButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  reportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 24,
    lineHeight: 20,
  },
  reportTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  reportTypeIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  reportTypeContent: {
    flex: 1,
  },
  reportTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  reportTypeDescription: {
    fontSize: 14,
    color: '#6c757d',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '500',
  },
  selectedTypeCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  selectedTypeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  selectedTypeDescription: {
    fontSize: 14,
    color: '#495057',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#212529',
    backgroundColor: '#ffffff',
    minHeight: 120,
    marginBottom: 24,
  },
  severitySelector: {
    marginBottom: 24,
  },
  severityOption: {
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  severityOptionSelected: {
    backgroundColor: '#f8f9fa',
  },
  severityOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  submitButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 20,
  },
  evidenceSubtext: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 12,
    lineHeight: 16,
  },
  photoContainer: {
    gap: 12,
  },
  photoWrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  evidencePhoto: {
    width: 120,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#dc3545',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 8,
    flex: 1,
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007bff',
  },
  uploadingText: {
    fontSize: 12,
    color: '#007bff',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});