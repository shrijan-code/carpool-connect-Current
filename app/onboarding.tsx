import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, PanResponder, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Car, Users, Shield, MapPin, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';

const onboardingData = [
  {
    id: 'share-ride',
    icon: Car,
    title: 'Share Your Ride',
    description: 'Connect with people going your way and split the cost of travel.',
  },
  {
    id: 'meet-people',
    icon: Users,
    title: 'Meet New People',
    description: 'Build connections with fellow travelers in your community.',
  },
  {
    id: 'safe-secure',
    icon: Shield,
    title: 'Safe & Secure',
    description: 'All users are verified with ratings and reviews for peace of mind.',
  },
  {
    id: 'easy-navigation',
    icon: MapPin,
    title: 'Easy Navigation',
    description: 'Find rides or passengers with our smart matching system.',
  },
];

export default function OnboardingScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const { completeOnboarding } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useSettingsStore((s) => s.settings.currentTheme);
  const { width: screenWidth } = useWindowDimensions();
  
  // Modern gradient colors inspired by the attached image
  const gradientColors = (theme === 'dark' 
    ? ['#1a1a2e', '#16213e', '#0f3460'] 
    : ['#667eea', '#764ba2', '#f093fb']) as [string, string, ...string[]];

  const handleNext = () => {
    if (currentPage < onboardingData.length - 1) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      scrollViewRef.current?.scrollTo({ x: nextPage * screenWidth, animated: true });
    } else {
      handleGetStarted();
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      scrollViewRef.current?.scrollTo({ x: prevPage * screenWidth, animated: true });
    }
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(contentOffsetX / screenWidth);
    if (pageIndex !== currentPage && pageIndex >= 0 && pageIndex < onboardingData.length) {
      setCurrentPage(pageIndex);
    }
  };

  // Pan responder for swipe gestures
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 30;
    },
    onPanResponderGrant: () => {
      // Prevent ScrollView from handling the gesture
      return true;
    },
    onPanResponderMove: (evt, gestureState) => {
      // Optional: Add visual feedback during swipe
      return true;
    },
    onPanResponderRelease: (evt, gestureState) => {
      const swipeThreshold = screenWidth * 0.25; // 25% of screen width
      
      if (gestureState.dx > swipeThreshold && currentPage > 0) {
        handlePrevious();
      } else if (gestureState.dx < -swipeThreshold && currentPage < onboardingData.length - 1) {
        handleNext();
      }
    },
  });

  const handleGetStarted = async () => {
    await completeOnboarding();
    router.replace('./auth');
  };

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.navButton, currentPage === 0 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentPage === 0}
          >
            <ChevronLeft size={24} color={currentPage === 0 ? 'rgba(255,255,255,0.3)' : '#FFFFFF'} />
          </TouchableOpacity>
          
          <View style={styles.pagination}>
            {onboardingData.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.dot,
                  index === currentPage && styles.activeDot,
                ]}
                onPress={() => {
                  setCurrentPage(index);
                  scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
                }}
              />
            ))}
          </View>
          
          <TouchableOpacity 
            style={[styles.navButton, currentPage === onboardingData.length - 1 && styles.navButtonDisabled]}
            onPress={handleNext}
            disabled={currentPage === onboardingData.length - 1}
          >
            <ChevronRight size={24} color={currentPage === onboardingData.length - 1 ? 'rgba(255,255,255,0.3)' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>

        <View style={styles.scrollContainer} {...panResponder.panHandlers}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ width: screenWidth * onboardingData.length }}
          >
            {onboardingData.map((data, index) => {
              const IconComponent = data.icon;
              return (
                <View key={data.id} style={[styles.page, { width: screenWidth }]}>
                  <View style={styles.content}>
                    <View style={styles.iconContainer}>
                      <View style={styles.iconBackground}>
                        <IconComponent size={64} color={theme === 'dark' ? '#8B5CF6' : '#6366F1'} />
                      </View>
                    </View>

                    <View style={styles.textContainer}>
                      <Text style={styles.title}>{data.title}</Text>
                      <Text style={styles.description}>{data.description}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.footer}>
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <LinearGradient
              colors={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressBar,
                { width: `${((currentPage + 1) / onboardingData.length) * 100}%` }
              ]}
            />
          </View>
          
          <TouchableOpacity
            style={styles.modernButton}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F8F9FA']}
              style={styles.modernButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Text style={styles.modernButtonText}>
                {currentPage === onboardingData.length - 1 ? 'Get Started' : 'Next'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          
          {currentPage < onboardingData.length - 1 && (
            <TouchableOpacity
              onPress={handleGetStarted}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollContainer: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 48,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  description: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
    marginHorizontal: 4,
  },
  activeDot: {
    opacity: 1,
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  modernButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modernButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  modernButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#4A5568',
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipText: {
    color: '#FFFFFF',
    fontWeight: '500' as const,
    fontSize: 16,
    opacity: 0.8,
  },
});