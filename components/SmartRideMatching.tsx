import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Star, MapPin, Clock, Users, Zap } from 'lucide-react-native';
import { smartMatchingService, SmartMatchResult, UserPreferences } from '@/services/smart-matching';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface SmartRideMatchingProps {
  userId: string;
  fromLocation: { latitude: number; longitude: number; address: string };
  toLocation: { latitude: number; longitude: number; address: string };
  departureTime: Date;
  onRideSelect: (rideId: string) => void;
}

export const SmartRideMatching: React.FC<SmartRideMatchingProps> = ({
  userId,
  fromLocation,
  toLocation,
  departureTime,
  onRideSelect,
}) => {
  const [matches, setMatches] = useState<SmartMatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    smokingAllowed: false,
    musicPreference: 'moderate',
    conversationLevel: 'moderate',
    petFriendly: false,
    temperaturePreference: 'moderate',
    punctualityImportance: 'moderate',
  });
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    findMatches();
  }, [userId, fromLocation, toLocation, departureTime]);

  const findMatches = async () => {
    setLoading(true);
    try {
      const results = await smartMatchingService.findCompatibleRides(
        userId,
        fromLocation,
        toLocation,
        departureTime
      );
      setMatches(results);
    } catch (error) {
      console.error('Error finding matches:', error);
      Alert.alert('Error', 'Failed to find compatible rides');
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async () => {
    try {
      await smartMatchingService.updateUserPreferences(userId, preferences);
      setShowPreferences(false);
      findMatches(); // Refresh matches with new preferences
    } catch (error) {
      console.error('Error updating preferences:', error);
      Alert.alert('Error', 'Failed to update preferences');
    }
  };

  const getCompatibilityColor = (score: number) => {
    if (score >= 0.8) return '#10B981'; // Green
    if (score >= 0.6) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getCompatibilityLabel = (score: number) => {
    if (score >= 0.9) return 'Perfect Match';
    if (score >= 0.8) return 'Excellent Match';
    if (score >= 0.7) return 'Great Match';
    if (score >= 0.6) return 'Good Match';
    return 'Fair Match';
  };

  const renderPreferencesModal = () => (
    <View style={styles.preferencesModal}>
      <Text style={styles.preferencesTitle}>Ride Preferences</Text>
      
      <View style={styles.preferenceItem}>
        <Text style={styles.preferenceLabel}>Smoking Allowed</Text>
        <TouchableOpacity
          style={[styles.toggle, preferences.smokingAllowed && styles.toggleActive]}
          onPress={() => setPreferences(prev => ({ ...prev, smokingAllowed: !prev.smokingAllowed }))}
        >
          <Text style={[styles.toggleText, preferences.smokingAllowed && styles.toggleTextActive]}>
            {preferences.smokingAllowed ? 'Yes' : 'No'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.preferenceItem}>
        <Text style={styles.preferenceLabel}>Music Level</Text>
        <View style={styles.optionGroup}>
          {['quiet', 'low', 'moderate', 'loud'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.option, preferences.musicPreference === level && styles.optionActive]}
              onPress={() => setPreferences(prev => ({ ...prev, musicPreference: level as any }))}
            >
              <Text style={[styles.optionText, preferences.musicPreference === level && styles.optionTextActive]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.preferenceItem}>
        <Text style={styles.preferenceLabel}>Conversation Level</Text>
        <View style={styles.optionGroup}>
          {['minimal', 'moderate', 'chatty'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.option, preferences.conversationLevel === level && styles.optionActive]}
              onPress={() => setPreferences(prev => ({ ...prev, conversationLevel: level as any }))}
            >
              <Text style={[styles.optionText, preferences.conversationLevel === level && styles.optionTextActive]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.preferenceButtons}>
        <Button
          title="Cancel"
          onPress={() => setShowPreferences(false)}
          variant="outline"
          style={styles.preferenceButton}
        />
        <Button
          title="Save"
          onPress={updatePreferences}
          style={styles.preferenceButton}
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Finding your perfect ride matches...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Smart Matches</Text>
        <TouchableOpacity
          style={styles.preferencesButton}
          onPress={() => setShowPreferences(true)}
        >
          <Zap size={20} color="#007AFF" />
          <Text style={styles.preferencesButtonText}>Preferences</Text>
        </TouchableOpacity>
      </View>

      {showPreferences && renderPreferencesModal()}

      <ScrollView style={styles.matchesList} showsVerticalScrollIndicator={false}>
        {matches.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Compatible Rides Found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your preferences or search criteria
            </Text>
          </View>
        ) : (
          matches.map((match) => (
            <Card key={match.rideId} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <View style={styles.compatibilityBadge}>
                  <View
                    style={[
                      styles.compatibilityDot,
                      { backgroundColor: getCompatibilityColor(match.compatibilityScore.overall) }
                    ]}
                  />
                  <Text style={styles.compatibilityText}>
                    {getCompatibilityLabel(match.compatibilityScore.overall)}
                  </Text>
                </View>
                <Text style={styles.compatibilityScore}>
                  {Math.round(match.compatibilityScore.overall * 100)}%
                </Text>
              </View>

              <View style={styles.matchDetails}>
                <View style={styles.detailRow}>
                  <Clock size={16} color="#666" />
                  <Text style={styles.detailText}>
                    Pickup: {match.estimatedPickupTime.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <MapPin size={16} color="#666" />
                  <Text style={styles.detailText}>
                    Detour: {match.detourDistance.toFixed(1)} km
                  </Text>
                </View>

                {match.priceAdjustment !== 0 && (
                  <View style={styles.detailRow}>
                    <Text style={[
                      styles.priceAdjustment,
                      { color: match.priceAdjustment > 0 ? '#EF4444' : '#10B981' }
                    ]}>
                      {match.priceAdjustment > 0 ? '+' : ''}
                      {Math.round(match.priceAdjustment * 100)}% price adjustment
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.reasonsList}>
                {match.compatibilityScore.reasons.slice(0, 3).map((reason, index) => (
                  <View key={index} style={styles.reasonItem}>
                    <View style={styles.reasonDot} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.scoreBreakdown}>
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>Preferences</Text>
                  <View style={styles.scoreBar}>
                    <View
                      style={[
                        styles.scoreBarFill,
                        { width: `${match.compatibilityScore.breakdown.preferences * 100}%` }
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>Ratings</Text>
                  <View style={styles.scoreBar}>
                    <View
                      style={[
                        styles.scoreBarFill,
                        { width: `${match.compatibilityScore.breakdown.ratings * 100}%` }
                      ]}
                    />
                  </View>
                </View>
              </View>

              <Button
                title="Select This Ride"
                onPress={() => onRideSelect(match.rideId)}
                style={styles.selectButton}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  preferencesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
  },
  preferencesButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  matchesList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  matchCard: {
    marginBottom: 16,
    padding: 16,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  compatibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compatibilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compatibilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  compatibilityScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  matchDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceAdjustment: {
    fontSize: 14,
    fontWeight: '600',
  },
  reasonsList: {
    gap: 4,
    marginBottom: 12,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reasonDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  reasonText: {
    fontSize: 12,
    color: '#6B7280',
  },
  scoreBreakdown: {
    gap: 8,
    marginBottom: 16,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 80,
  },
  scoreBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  selectButton: {
    marginTop: 8,
  },
  preferencesModal: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  preferencesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
  },
  preferenceItem: {
    marginBottom: 20,
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  toggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  toggleActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    fontSize: 14,
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  optionActive: {
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 12,
    color: '#6B7280',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  preferenceButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  preferenceButton: {
    flex: 1,
  },
});