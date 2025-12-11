import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { SafetyReport } from '@/types';
import { SafetyReportService } from '@/services/safety-reports';
import { useAuthStore } from '@/store/auth-store';
import {
  X,
  AlertTriangle,
  Shield,
  FileText,
  Camera,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';

interface SafetyReportComponentProps {
  isVisible: boolean;
  onClose: () => void;
  rideId?: string;
  deliveryId?: string;
}

export function SafetyReportComponent({
  isVisible,
  onClose,
  rideId,
  deliveryId,
}: SafetyReportComponentProps) {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    type: 'other' as SafetyReport['type'],
    severity: 'medium' as SafetyReport['severity'],
    description: '',
  });

  const reportTypes = [
    { value: 'unsafe_driving', label: 'Unsafe Driving', icon: AlertTriangle },
    { value: 'harassment', label: 'Harassment', icon: Shield },
    { value: 'vehicle_issue', label: 'Vehicle Issue', icon: AlertCircle },
    { value: 'route_deviation', label: 'Route Deviation', icon: FileText },
    { value: 'emergency', label: 'Emergency', icon: AlertTriangle },
    { value: 'other', label: 'Other', icon: FileText },
  ] as const;

  const severityLevels = [
    { value: 'low', label: 'Low Priority', color: '#28a745' },
    { value: 'medium', label: 'Medium Priority', color: '#ffc107' },
    { value: 'high', label: 'High Priority', color: '#fd7e14' },
    { value: 'critical', label: 'Critical', color: '#dc3545' },
  ] as const;

  useEffect(() => {
    if (isVisible && user?.id) {
      loadReports();
    }
  }, [isVisible, user?.id]);

  const loadReports = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const userReports = await SafetyReportService.getReports(user.id);
      setReports(userReports);
    } catch (error) {
      console.error('Failed to load safety reports:', error);
      Alert.alert('Error', 'Failed to load safety reports');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!user?.id) return;
    
    const errors = SafetyReportService.validateReport({
      ...formData,
      reporterId: user.id,
    });
    
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    try {
      setSubmitting(true);
      
      await SafetyReportService.submitReport({
        ...formData,
        reporterId: user.id,
        rideId,
        deliveryId,
        status: 'pending',
      });
      
      setShowReportModal(false);
      setFormData({
        type: 'other',
        severity: 'medium',
        description: '',
      });
      
      await loadReports();
      
      Alert.alert(
        'Report Submitted',
        'Your safety report has been submitted successfully. We will review it and take appropriate action.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Failed to submit safety report:', error);
      Alert.alert('Error', error.message || 'Failed to submit safety report');
    } finally {
      setSubmitting(false);
    }
  };

  const renderReportItem = (report: SafetyReport) => {
    const displayData = SafetyReportService.formatReportForDisplay(report);
    
    return (
      <View key={report.id} style={styles.reportItem}>
        <View style={styles.reportHeader}>
          <View style={styles.reportTitle}>
            <Text style={styles.reportTitleText}>{displayData.title}</Text>
            <View style={[styles.severityBadge, { backgroundColor: displayData.severityColor }]}>
              <Text style={styles.severityText}>
                {SafetyReportService.getSeverityText(report.severity)}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: displayData.statusColor }]}>
            <Text style={styles.statusText}>{report.status.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={styles.reportDescription}>{displayData.subtitle}</Text>
        
        <View style={styles.reportFooter}>
          <Text style={styles.reportTime}>{displayData.timeText}</Text>
          {report.rideId && (
            <Text style={styles.reportId}>Ride: {report.rideId.slice(-8)}</Text>
          )}
          {report.deliveryId && (
            <Text style={styles.reportId}>Delivery: {report.deliveryId.slice(-8)}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Safety Reports</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.description}>
          <Shield size={20} color={Colors.primary} />
          <Text style={styles.descriptionText}>
            Report any safety concerns during your rides or deliveries. All reports are reviewed promptly.
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading reports...</Text>
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Shield size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Safety Reports</Text>
              <Text style={styles.emptyText}>
                You haven't submitted any safety reports yet.
              </Text>
            </View>
          ) : (
            <View style={styles.reportsList}>
              {reports.map(renderReportItem)}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => setShowReportModal(true)}
        >
          <AlertTriangle size={20} color={Colors.background} />
          <Text style={styles.reportButtonText}>Report Safety Issue</Text>
        </TouchableOpacity>

        {/* Report Modal */}
        <Modal
          visible={showReportModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowReportModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Safety Issue</Text>
              <TouchableOpacity
                onPress={() => setShowReportModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Type of Issue *</Text>
                <View style={styles.typeGrid}>
                  {reportTypes.map((type) => {
                    const IconComponent = type.icon;
                    const isSelected = formData.type === type.value;
                    
                    return (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.typeOption,
                          isSelected && styles.typeOptionSelected
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, type: type.value }))}
                      >
                        <IconComponent
                          size={20}
                          color={isSelected ? Colors.background : Colors.primary}
                        />
                        <Text style={[
                          styles.typeOptionText,
                          isSelected && styles.typeOptionTextSelected
                        ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Severity Level *</Text>
                <View style={styles.severityGrid}>
                  {severityLevels.map((severity) => {
                    const isSelected = formData.severity === severity.value;
                    
                    return (
                      <TouchableOpacity
                        key={severity.value}
                        style={[
                          styles.severityOption,
                          isSelected && { backgroundColor: severity.color }
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, severity: severity.value }))}
                      >
                        <Text style={[
                          styles.severityOptionText,
                          isSelected && styles.severityOptionTextSelected
                        ]}>
                          {severity.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description *</Text>
                <TextInput
                  style={styles.textArea}
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Please describe the safety issue in detail..."
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>

              {formData.severity === 'critical' && (
                <View style={styles.emergencyNotice}>
                  <AlertTriangle size={20} color={Colors.error} />
                  <Text style={styles.emergencyNoticeText}>
                    For critical emergencies, please call 000 immediately and then submit this report.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowReportModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmitReport}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.background} />
                ) : (
                  <>
                    <Send size={16} color={Colors.background} />
                    <Text style={styles.submitButtonText}>Submit Report</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#e3f2fd',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  descriptionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginLeft: 12,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  reportsList: {
    gap: 12,
  },
  reportItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reportTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportTitleText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginRight: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  reportDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  reportId: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    margin: 20,
    gap: 8,
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    gap: 6,
  },
  typeOptionSelected: {
    backgroundColor: Colors.primary,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  typeOptionTextSelected: {
    color: Colors.background,
  },
  severityGrid: {
    gap: 8,
  },
  severityOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  severityOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  severityOptionTextSelected: {
    color: Colors.background,
    fontWeight: '600' as const,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minHeight: 120,
  },
  emergencyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    marginBottom: 20,
  },
  emergencyNoticeText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500' as const,
    lineHeight: 20,
    marginLeft: 12,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  submitButton: {
    backgroundColor: Colors.error,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
});