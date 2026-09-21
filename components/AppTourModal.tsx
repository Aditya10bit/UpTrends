import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const HAS_SEEN_TOUR_STORAGE_KEY = 'has_seen_app_tour_v1';

interface AppTourModalProps {
  visible: boolean;
  onClose: () => void;
}

interface TourSlide {
  id: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  highlights: string[];
  gradient: [string, string];
}

const TOUR_SLIDES: TourSlide[] = [
  {
    id: 'welcome',
    badge: 'WELCOME TO UPTRENDS ✨',
    icon: 'sparkles',
    title: 'Your Personal AI Stylist',
    subtitle: 'Body-type, skin-tone & weather-aware fashion intelligence — personalized just for you.',
    highlights: [
      'Tailored to YOUR unique body shape & skin tone',
      'Real-time weather & location-aware outfits',
      'Free forever — zero subscriptions needed',
    ],
    gradient: ['#6366f1', '#a855f7'],
  },
  {
    id: 'ootd',
    badge: 'OUTFIT OF THE DAY',
    icon: 'partly-sunny',
    title: 'Perfect Outfits Every Morning',
    subtitle: 'Get climate-ready recommendations instantly, powered by your live GPS location.',
    highlights: [
      'Weather-adapted styling: monsoon, winter, summer',
      'Local city trends & cultural fashion awareness',
      'One-tap Pinterest & Amazon shopping links',
    ],
    gradient: ['#3b82f6', '#06b6d4'],
  },
  {
    id: 'stylist-chat',
    badge: 'AI STYLIST CHAT',
    icon: 'chatbubbles',
    title: 'Your 24/7 Fashion Coach',
    subtitle: 'Ask anything — from "what matches this?" to deep styling advice — and get instant expert answers.',
    highlights: [
      'Ask about colors, fits, fabrics & accessories',
      'Styling advice for any body type or occasion',
      'Saves chat history for ongoing consultations',
    ],
    gradient: ['#8b5cf6', '#d946ef'],
  },
  {
    id: 'wardrobe',
    badge: 'MY DIGITAL CLOSET',
    icon: 'shirt',
    title: 'Digitize Your Wardrobe',
    subtitle: 'Upload all your clothes once and let AI manage your closet — smarter than ever.',
    highlights: [
      'Auto-categorizes by type, color & occasion',
      'Discover what goes with each item instantly',
      'Find underused pieces and build better combos',
    ],
    gradient: ['#ec4899', '#f43f5e'],
  },
  {
    id: 'mix-match',
    badge: 'MIX & MATCH CANVAS',
    icon: 'color-palette',
    title: 'Remix Your Style',
    subtitle: 'Swipe through tops, bottoms & shoes on an interactive 3-lane canvas to discover combos.',
    highlights: [
      'AI Color Harmony Score for every outfit combo',
      'Lock favorite items while cycling through others',
      'Shop the exact look on Pinterest with one tap',
    ],
    gradient: ['#f59e0b', '#f97316'],
  },
  {
    id: 'style-check',
    badge: 'STYLE CHECK',
    icon: 'analytics',
    title: 'Instant Outfit Ratings',
    subtitle: 'Snap a selfie and get a professional AI score with actionable tips to level up your look.',
    highlights: [
      'Scores from 0-100 with specific improvement tips',
      'Detailed feedback on fit, color & proportion',
      'Track your styling improvement over time',
    ],
    gradient: ['#10b981', '#14b8a6'],
  },
  {
    id: 'upload-aesthetic',
    badge: 'STEAL THE LOOK',
    icon: 'camera',
    title: 'Recreate Any Look',
    subtitle: 'Upload a celebrity, influencer or Pinterest photo and get a version tailored to YOUR body.',
    highlights: [
      'AI breaks down exactly what makes the look work',
      'Adapted to your body type and skin tone',
      'Find exact items on Amazon & Pinterest to buy',
    ],
    gradient: ['#6366f1', '#3b82f6'],
  },
  {
    id: 'twinning',
    badge: 'TWINNING MODE',
    icon: 'people',
    title: 'Matching Couple Outfits',
    subtitle: 'Create perfectly coordinated couple looks for dates, parties, and special moments together.',
    highlights: [
      'Color harmony analysis for both partners',
      'Venue & occasion-specific couple looks',
      'Shopping links for both outfits instantly',
    ],
    gradient: ['#ec4899', '#a855f7'],
  },
  {
    id: 'body-analysis',
    badge: 'BODY ANALYSIS',
    icon: 'body',
    title: 'Know Your Proportions',
    subtitle: 'Understand your body shape and unlock styling rules designed specifically for your figure.',
    highlights: [
      'Identify your body type & shape profile',
      'Rules for flattering cuts, fits & silhouettes',
      'Powers all your personalized AI recommendations',
    ],
    gradient: ['#14b8a6', '#10b981'],
  },
];

export default function AppTourModal({ visible, onClose }: AppTourModalProps) {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  if (!visible) return null;

  const currentSlide = TOUR_SLIDES[currentSlideIndex];
  const isLastSlide = currentSlideIndex === TOUR_SLIDES.length - 1;

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await AsyncStorage.setItem(HAS_SEEN_TOUR_STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('[AppTourModal] Failed to save tour state:', e);
    }
    onClose();
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLastSlide) {
      handleFinish();
    } else {
      setCurrentSlideIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleFinish();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" />

        {/* Tour Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={[styles.badge, { backgroundColor: currentSlide.gradient[0] + '22' }]}>
              <Text style={[styles.badgeText, { color: currentSlide.gradient[0] }]}>
                {currentSlide.badge}
              </Text>
            </View>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: theme.textTertiary }]}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Icon with Dynamic Gradient Glow */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={currentSlide.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name={currentSlide.icon} size={44} color="#ffffff" />
            </LinearGradient>
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <Text style={[styles.title, { color: theme.text }]}>{currentSlide.title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {currentSlide.subtitle}
            </Text>

            {/* Feature Highlights */}
            <View style={styles.highlightsContainer}>
              {currentSlide.highlights.map((highlight, index) => (
                <View key={index} style={styles.highlightRow}>
                  <View style={[styles.bullet, { backgroundColor: currentSlide.gradient[0] }]} />
                  <Text style={[styles.highlightText, { color: theme.text }]}>
                    {highlight}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Footer Controls */}
          <View style={styles.footer}>
            {/* Slide Pagination Dots */}
            <View style={styles.paginationDots}>
              {TOUR_SLIDES.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCurrentSlideIndex(index);
                  }}
                  style={[
                    styles.dot,
                    index === currentSlideIndex
                      ? [styles.activeDot, { backgroundColor: currentSlide.gradient[0] }]
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' },
                  ]}
                />
              ))}
            </View>

            {/* Action Button */}
            <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
              <LinearGradient
                colors={currentSlide.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButton}
              >
                <Text style={styles.nextButtonText}>
                  {isLastSlide ? 'Get Started 🚀' : 'Next'}
                </Text>
                {!isLastSlide && <Ionicons name="arrow-forward" size={18} color="#ffffff" />}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  skipButton: {
    padding: 6,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  iconGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  contentContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  highlightsContainer: {
    width: '100%',
    gap: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  highlightText: {
    fontSize: 13.5,
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    gap: 18,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
