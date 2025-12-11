/**
 * Security Monitoring Dashboard Component
 * Displays real-time security metrics and alerts
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Shield, AlertTriangle, Activity, Users, Clock, Ban } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import SecurityManager from '@/security/SecurityManager';
import SecureApiClient from '@/security/SecureApiClient';

interface SecurityMetrics {
  rateLimitViolations: number;
  failedLoginAttempts: number;
  suspiciousActivities: number;
  blockedIPs: number;
  activeUsers: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastUpdated: string;
}

interface SecurityEvent {
  id: string;
  type: 'rate_limit_exceeded' | 'suspicious_activity' | 'login_attempt' | 'system_alert';
  timestamp: string;
  userId?: string;
  ip?: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const SecurityMonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      // Get security status from SecurityManager
      const securityStatus = SecurityManager.getSecurityStatus();
      
      // Get API client status
      const apiStatus = SecureApiClient.getSecurityStatus();

      // Fetch system health from Cloud Functions
      const healthResponse = await SecureApiClient.secureRequest(
        'https://your-project.cloudfunctions.net/healthCheck',
        { method: 'GET' }
      );

      // Fetch recent security events
      const eventsResponse = await SecureApiClient.secureFirebaseCall(
        'getSecurityEvents',
        { limit: 20 }
      );

      const currentMetrics: SecurityMetrics = {
        rateLimitViolations: securityStatus.rateLimitViolations,
        failedLoginAttempts: securityStatus.failedLoginAttempts,
        suspiciousActivities: securityStatus.suspiciousActivities,
        blockedIPs: 0, // This would come from Cloud Functions
        activeUsers: apiStatus.activeRequests,
        systemHealth: healthResponse.success ? 'healthy' : 'warning',
        lastUpdated: new Date().toISOString()
      };

      setMetrics(currentMetrics);
      
      if (eventsResponse.success) {
        setRecentEvents(eventsResponse.data || []);
      }

    } catch (error) {
      console.error('[SecurityDashboard] Failed to load security data:', error);
      Alert.alert('Error', 'Failed to load security data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSecurityData();
  };

  const handleEmergencyLockdown = () => {
    Alert.alert(
      'Emergency Lockdown',
      'This will temporarily block all non-admin access. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecurityManager.emergencyLockdown('Admin initiated emergency lockdown');
              Alert.alert('Success', 'Emergency lockdown activated');
              loadSecurityData();
            } catch (error) {
              Alert.alert('Error', 'Failed to activate emergency lockdown');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    loadSecurityData();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(loadSecurityData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'high': return '#F97316';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading && !metrics) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Activity size={48} color="#3B82F6" />
          <Text style={styles.loadingText}>Loading security data...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Shield size={32} color="#3B82F6" />
          <View style={styles.headerText}>
            <Text style={styles.title}>Security Monitoring</Text>
            <Text style={styles.subtitle}>
              Last updated: {metrics ? formatTimestamp(metrics.lastUpdated) : 'Never'}
            </Text>
          </View>
        </View>
        
        <Button
          title="Emergency Lockdown"
          onPress={handleEmergencyLockdown}
          style={[styles.emergencyButton, { backgroundColor: '#EF4444' }]}
          textStyle={{ color: 'white' }}
        />
      </View>

      {/* System Health Status */}
      <Card style={styles.healthCard}>
        <View style={styles.healthHeader}>
          <Text style={styles.cardTitle}>System Health</Text>
          <View style={[styles.healthIndicator, { backgroundColor: getHealthColor(metrics?.systemHealth || 'warning') }]}>
            <Text style={styles.healthText}>
              {metrics?.systemHealth?.toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Security Metrics Grid */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <AlertTriangle size={24} color="#F59E0B" />
          <Text style={styles.metricValue}>{metrics?.rateLimitViolations || 0}</Text>
          <Text style={styles.metricLabel}>Rate Limit Violations</Text>
        </Card>

        <Card style={styles.metricCard}>
          <Ban size={24} color="#EF4444" />
          <Text style={styles.metricValue}>{metrics?.failedLoginAttempts || 0}</Text>
          <Text style={styles.metricLabel}>Failed Logins</Text>
        </Card>

        <Card style={styles.metricCard}>
          <Shield size={24} color="#F97316" />
          <Text style={styles.metricValue}>{metrics?.suspiciousActivities || 0}</Text>
          <Text style={styles.metricLabel}>Suspicious Activities</Text>
        </Card>

        <Card style={styles.metricCard}>
          <Users size={24} color="#10B981" />
          <Text style={styles.metricValue}>{metrics?.activeUsers || 0}</Text>
          <Text style={styles.metricLabel}>Active Requests</Text>
        </Card>
      </View>

      {/* Recent Security Events */}
      <Card style={styles.eventsCard}>
        <Text style={styles.cardTitle}>Recent Security Events</Text>
        
        {recentEvents.length === 0 ? (
          <View style={styles.noEventsContainer}>
            <Shield size={48} color="#10B981" />
            <Text style={styles.noEventsText}>No recent security events</Text>
            <Text style={styles.noEventsSubtext}>Your system is secure</Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {recentEvents.map((event) => (
              <View key={event.id} style={styles.eventItem}>
                <View style={styles.eventHeader}>
                  <View style={[styles.severityDot, { backgroundColor: getSeverityColor(event.severity) }]} />
                  <Text style={styles.eventType}>{event.type.replace(/_/g, ' ').toUpperCase()}</Text>
                  <Text style={styles.eventTime}>{formatTimestamp(event.timestamp)}</Text>
                </View>
                
                <Text style={styles.eventDetails}>
                  {event.ip && `IP: ${event.ip} • `}
                  {event.userId && `User: ${event.userId.substring(0, 8)}... • `}
                  {JSON.stringify(event.details)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Security Actions */}
      <Card style={styles.actionsCard}>
        <Text style={styles.cardTitle}>Security Actions</Text>
        
        <View style={styles.actionButtons}>
          <Button
            title="View Full Logs"
            onPress={() => {
              // Navigate to full security logs
              Alert.alert('Info', 'Full security logs would open here');
            }}
            style={styles.actionButton}
          />
          
          <Button
            title="Export Report"
            onPress={() => {
              // Export security report
              Alert.alert('Info', 'Security report export would start here');
            }}
            style={styles.actionButton}
          />
          
          <Button
            title="Configure Alerts"
            onPress={() => {
              // Configure security alerts
              Alert.alert('Info', 'Security alert configuration would open here');
            }}
            style={styles.actionButton}
          />
        </View>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  emergencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  healthCard: {
    margin: 20,
    marginBottom: 10,
    padding: 20,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  healthText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  eventsCard: {
    margin: 20,
    marginBottom: 10,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noEventsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 12,
  },
  noEventsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  eventsList: {
    gap: 12,
  },
  eventItem: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  eventTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  eventDetails: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  actionsCard: {
    margin: 20,
    padding: 20,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    borderWidth: 1,
  },
});

export default SecurityMonitoringDashboard;