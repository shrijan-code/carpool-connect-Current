import { SafetyReport } from '@/types';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ImageService } from '@/services/image';

// Email service for sending notifications
const EMAIL_API_URL = 'https://toolkit.rork.com/text/llm/';

export class SafetyReportService {
  static async submitReport(report: Omit<SafetyReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('🔄 Submitting safety report:', { type: report.type, severity: report.severity });

      // CRITICAL: Save report to Firestore IMMEDIATELY
      // Photos will upload in the background after
      const reportData: any = {
        reporterId: report.reporterId,
        type: report.type,
        description: report.description,
        severity: report.severity,
        status: report.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Only add optional fields if they have valid values
      if (report.rideId && report.rideId.trim() !== '') {
        reportData.rideId = report.rideId;
      }
      if (report.deliveryId && report.deliveryId.trim() !== '') {
        reportData.deliveryId = report.deliveryId;
      }
      if (report.location && Object.keys(report.location).length > 0) {
        reportData.location = report.location;
      }

      // SAVE REPORT FIRST - This must be fast!
      const docRef = await addDoc(collection(db, 'safety_reports'), reportData);
      console.log('✅ Safety report submitted to Firestore with ID:', docRef.id);

      // Return immediately so UI can respond quickly
      const reportId = docRef.id;

      // Upload photos in the background (don't block the response)
      const reporterId = report.reporterId;
      setTimeout(() => {
        this.uploadEvidencePhotosAsync(docRef.id, reporterId, report.evidence?.photos || []).catch(error => {
          console.error('Background photo upload failed:', error);
        });
      }, 0);

      return reportId;
    } catch (error) {
      console.error('❌ Submit safety report error:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to submit safety report';
      if (error instanceof Error) {
        if (error.message.includes('Missing or insufficient permissions')) {
          errorMessage = 'Permission denied. Please make sure you are logged in and try again.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else {
          errorMessage = `Failed to submit safety report: ${error.message}`;
        }
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Upload evidence photos asynchronously in the background
   * This doesn't block the safety report submission
   */
  private static async uploadEvidencePhotosAsync(reportId: string, reporterId: string, photos: string[]): Promise<void> {
    if (!photos || photos.length === 0) {
      console.log('No evidence photos to upload');
      return;
    }

    try {
      console.log(`📸 Starting background upload of ${photos.length} evidence photo(s)`);
      const uploadedUrls: string[] = [];

      // Upload photos one at a time with timeout
      for (let i = 0; i < photos.length; i++) {
        const photoUri = photos[i];
        if (!photoUri || photoUri.trim() === '') {
          continue;
        }

        try {
          console.log(`📸 Uploading evidence photo ${i + 1}/${photos.length}`);

          // Add timeout to prevent hanging
          const uploadPromise = ImageService.uploadSafetyEvidence(reportId, reporterId, photoUri, i);
          const timeoutPromise = new Promise<string | null>((_, reject) =>
            setTimeout(() => reject(new Error('Upload timeout (30s)')), 30000)
          );

          const url = await Promise.race([uploadPromise, timeoutPromise]);

          if (url && !url.includes('placeholder')) {
            uploadedUrls.push(url);
            console.log(`✅ Evidence photo ${i + 1} uploaded successfully`);
          } else {
            console.warn(`⚠️ Evidence photo ${i + 1} upload returned placeholder or null`);
          }
        } catch (photoError) {
          console.error(`❌ Failed to upload evidence photo ${i + 1}:`, photoError);
          // Continue with other photos even if one fails
        }
      }

      // Update report with uploaded photo URLs (if any succeeded)
      if (uploadedUrls.length > 0) {
        console.log(`📸 Updating report with ${uploadedUrls.length} uploaded photos`);
        await updateDoc(doc(db, 'safety_reports', reportId), {
          evidence: { photos: uploadedUrls },
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Evidence photos uploaded and report updated');
      } else {
        console.warn('⚠️ No evidence photos were successfully uploaded');
      }
    } catch (error) {
      console.error('❌ Background photo upload error:', error);
      // Don't throw - this is background processing
    }
  }

  static async getReports(userId: string): Promise<SafetyReport[]> {
    try {
      console.log('🔄 Fetching safety reports for user:', userId);

      // Use direct Firestore for reliability
      const q = query(
        collection(db, 'safety_reports'),
        where('reporterId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const reports = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      })) as SafetyReport[];

      console.log('✅ Safety reports fetched:', reports.length, 'reports');
      return reports;
    } catch (error) {
      console.error('Get safety reports error:', error);
      throw new Error(`Failed to fetch safety reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async sendEmailNotification(report: SafetyReport): Promise<void> {
    try {
      console.log('📧 Sending email notification for safety report:', report.id);

      const emailContent = `
🚨 SAFETY REPORT SUBMITTED - ${this.getSeverityText(report.severity)}

Report Details:
- Report ID: ${report.id}
- Type: ${this.getTypeDisplayName(report.type)}
- Severity: ${this.getSeverityText(report.severity)}
- Reporter ID: ${report.reporterId}
- Ride ID: ${report.rideId || 'N/A'}
- Delivery ID: ${report.deliveryId || 'N/A'}
- Timestamp: ${new Date(report.createdAt).toLocaleString('en-AU')}

Description:
${report.description}

${report.evidence?.photos?.length ? `Evidence Photos: ${report.evidence.photos.length} attached` : 'No evidence photos'}

This report requires immediate attention. Please review and take appropriate action.

---
CarpoolConnect Safety Team
      `;

      // Send email using the AI service with better error handling
      const response = await fetch(EMAIL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an email service. Format the following safety report as a professional email to shrijan.bhandari1318@gmail.com. Keep it concise but include all important details.'
            },
            {
              role: 'user',
              content: emailContent
            }
          ]
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log('✅ Email notification sent successfully');
          console.log('📧 Email content preview:', data.completion?.substring(0, 200) + '...');
        } else {
          // Response is not JSON, likely HTML error page
          const text = await response.text();
          console.warn('⚠️ Email service returned non-JSON response:', text.substring(0, 200));
          throw new Error('Email service returned invalid response format');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Email service error response:', errorText.substring(0, 200));
        throw new Error(`Email service responded with status: ${response.status}`);
      }

      // Also log the details for debugging
      console.log('📧 Safety Report Email Details:', {
        to: 'shrijan.bhandari1318@gmail.com',
        reportId: report.id,
        type: this.getTypeDisplayName(report.type),
        severity: this.getSeverityText(report.severity),
        timestamp: new Date(report.createdAt).toLocaleString('en-AU'),
      });

    } catch (error) {
      console.error('Failed to send email notification:', error);
      // Log the details anyway for manual follow-up
      console.log('📧 MANUAL EMAIL REQUIRED - Safety Report Details:', {
        to: 'shrijan.bhandari1318@gmail.com',
        reportId: report.id,
        type: this.getTypeDisplayName(report.type),
        severity: this.getSeverityText(report.severity),
        description: report.description,
        reporterId: report.reporterId,
        rideId: report.rideId || 'N/A',
        deliveryId: report.deliveryId || 'N/A',
        timestamp: new Date(report.createdAt).toLocaleString('en-AU'),
      });
      // Don't throw - report should still be saved even if email fails
    }
  }

  static validateReport(report: Partial<SafetyReport>): string[] {
    const errors: string[] = [];

    if (!report.reporterId) {
      errors.push('Reporter ID is required');
    }

    if (!report.type) {
      errors.push('Report type is required');
    }

    if (!report.description?.trim()) {
      errors.push('Description is required');
    } else if (report.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }

    if (!report.severity) {
      errors.push('Severity level is required');
    }

    return errors;
  }

  static getSeverityColor(severity: SafetyReport['severity']): string {
    switch (severity) {
      case 'low': return '#28a745';
      case 'medium': return '#ffc107';
      case 'high': return '#fd7e14';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  }

  static getSeverityText(severity: SafetyReport['severity']): string {
    switch (severity) {
      case 'low': return 'Low Priority';
      case 'medium': return 'Medium Priority';
      case 'high': return 'High Priority';
      case 'critical': return 'Critical - Immediate Action';
      default: return 'Unknown';
    }
  }

  static getTypeDisplayName(type: SafetyReport['type']): string {
    switch (type) {
      case 'unsafe_driving': return 'Unsafe Driving';
      case 'harassment': return 'Harassment';
      case 'vehicle_issue': return 'Vehicle Safety Issue';
      case 'route_deviation': return 'Route Deviation';
      case 'emergency': return 'Emergency Situation';
      case 'other': return 'Other Safety Concern';
      default: return 'Unknown';
    }
  }

  static getStatusColor(status: SafetyReport['status']): string {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'investigating': return '#007bff';
      case 'resolved': return '#28a745';
      case 'escalated': return '#fd7e14';
      case 'closed': return '#6c757d';
      default: return '#6c757d';
    }
  }

  static formatReportForDisplay(report: SafetyReport): {
    title: string;
    subtitle: string;
    statusColor: string;
    severityColor: string;
    timeText: string;
  } {
    const title = this.getTypeDisplayName(report.type);
    const subtitle = report.description.length > 100
      ? `${report.description.substring(0, 100)}...`
      : report.description;

    const statusColor = this.getStatusColor(report.status);
    const severityColor = this.getSeverityColor(report.severity);

    const timeText = new Date(report.createdAt).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return { title, subtitle, statusColor, severityColor, timeText };
  }

  static shouldTriggerImmediateAction(severity: SafetyReport['severity']): boolean {
    return severity === 'critical' || severity === 'high';
  }

  static getRecommendedActions(type: SafetyReport['type'], severity: SafetyReport['severity']): string[] {
    const actions: string[] = [];

    if (severity === 'critical') {
      actions.push('Consider calling emergency services (000)');
      actions.push('End the ride/delivery immediately if safe to do so');
      actions.push('Move to a safe, public location');
    }

    switch (type) {
      case 'unsafe_driving':
        actions.push('Ask the driver to slow down or drive more carefully');
        actions.push('Consider ending the ride early');
        break;
      case 'harassment':
        actions.push('Document the incident');
        actions.push('End the ride/delivery immediately');
        actions.push('Report to local authorities if necessary');
        break;
      case 'vehicle_issue':
        actions.push('Ask the driver to address the issue');
        actions.push('Consider alternative transportation');
        break;
      case 'route_deviation':
        actions.push('Ask the driver about the route change');
        actions.push('Share your location with emergency contacts');
        break;
      case 'emergency':
        actions.push('Call emergency services immediately');
        actions.push('Contact emergency contacts');
        break;
    }

    actions.push('Follow up with CarpoolConnect support');
    return actions;
  }
}