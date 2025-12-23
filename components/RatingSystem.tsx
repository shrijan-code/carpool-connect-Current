import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Star, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';

interface RatingSystemProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  title: string;
  subtitle?: string;
  recipientName?: string;
  isLoading?: boolean;
}

export function RatingSystem({
  visible,
  onClose,
  onSubmit,
  title,
  subtitle,
  recipientName,
  isLoading = false
}: RatingSystemProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }
    onSubmit(rating, comment.trim());
    // Reset form
    setRating(0);
    setComment('');
    setHoveredStar(0);
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    setHoveredStar(0);
    onClose();
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const isActive = i <= (hoveredStar || rating);
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setRating(i)}
          onPressIn={() => setHoveredStar(i)}
          onPressOut={() => setHoveredStar(0)}
          style={styles.starButton}
          testID={`star-${i}`}
        >
          <Star
            size={32}
            color={isActive ? Colors.warning : Colors.border}
            fill={isActive ? Colors.warning : 'transparent'}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'Tap to rate';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              testID="close-rating-modal"
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {subtitle && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}

            {recipientName && (
              <Text style={styles.recipientName}>
                Rate your experience with {recipientName}
              </Text>
            )}

            <View style={styles.starsContainer}>
              <View style={styles.starsRow}>
                {renderStars()}
              </View>
              <Text style={styles.ratingText}>
                {getRatingText(hoveredStar || rating)}
              </Text>
            </View>

            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>
                Share your experience (optional)
              </Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Tell us about your experience..."
                placeholderTextColor={Colors.textSecondary}
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
                testID="rating-comment-input"
                blurOnSubmit={true}
                returnKeyType="done"
              />
              <Text style={styles.characterCount}>
                {comment.length}/500
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title="Skip"
                onPress={handleClose}
                style={styles.skipButton}
                textStyle={styles.skipButtonText}
              />
              <Button
                title="Submit Rating"
                onPress={handleSubmit}
                style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
                disabled={rating === 0 || isLoading}
                loading={isLoading}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

interface StarDisplayProps {
  rating: number;
  size?: number;
  showNumber?: boolean;
  totalRatings?: number;
  recentRatingsCount?: number;
}

export function StarDisplay({
  rating,
  size = 16,
  showNumber = true,
  totalRatings,
  recentRatingsCount,
}: StarDisplayProps) {
  if (typeof totalRatings === 'number' && totalRatings === 0) {
    return (
      <View style={styles.starDisplayContainer} testID="no-reviews">
        <Text style={[styles.noReviewsText, { fontSize: size * 0.9 }]}>No reviews yet</Text>
      </View>
    );
  }

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <View style={styles.starDisplayContainer}>
      <View style={styles.starDisplayRow}>
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            size={size}
            color={Colors.warning}
            fill={Colors.warning}
          />
        ))}
        {hasHalfStar && (
          <View style={styles.halfStarContainer}>
            <Star
              size={size}
              color={Colors.border}
              fill="transparent"
              style={styles.halfStarBackground}
            />
            <View style={[styles.halfStarOverlay, { width: size / 2 }]}>
              <Star
                size={size}
                color={Colors.warning}
                fill={Colors.warning}
              />
            </View>
          </View>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star
            key={`empty-${i}`}
            size={size}
            color={Colors.border}
            fill="transparent"
          />
        ))}
      </View>
      {showNumber && (
        <Text style={[styles.ratingNumber, { fontSize: size * 0.75 }]}>
          {rating.toFixed(1)}
          {typeof totalRatings === 'number' && totalRatings > 0 && (
            <Text style={styles.totalRatings}> ({totalRatings})</Text>
          )}
          {typeof recentRatingsCount === 'number' && recentRatingsCount > 0 && (
            <Text style={styles.totalRatings}> avg of last {recentRatingsCount}</Text>
          )}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 32,
  },
  starsContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  commentSection: {
    marginBottom: 32,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipButtonText: {
    color: Colors.text,
  },
  submitButton: {
    flex: 2,
    backgroundColor: Colors.primary,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.border,
  },
  // Star Display Styles
  starDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starDisplayRow: {
    flexDirection: 'row',
    gap: 2,
  },
  halfStarContainer: {
    position: 'relative',
  },
  halfStarBackground: {
    position: 'absolute',
  },
  halfStarOverlay: {
    overflow: 'hidden',
  },
  ratingNumber: {
    fontWeight: '600' as const,
    color: Colors.text,
  },
  totalRatings: {
    fontWeight: '400' as const,
    color: Colors.textSecondary,
  },
  noReviewsText: {
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  }
});