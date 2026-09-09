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
    badge: 'WELCOME TO UPTRENDS',
    icon: 'sparkles',
    title: 'Your Personal AI Stylist',
    subtitle: 'Tailored specifically for your body type, skin tone, location, and lifestyle.',
    highlights: [
      'Body-shape and skin-tone aware fashion logic',
      'Real-time weather and location context',
      'Zero subscription fees & instant AI styling',
    ],
    gradient: ['#6366f1', '#a855f7'],
  },
  {
    id: 'ootd',
    badge: 'DAILY SMART OUTFITS',
    icon: 'partly-sunny',
    title: 'Never Ask "What to Wear?"',
    subtitle: 'Get instant, climate-perfect recommendations every morning based on live GPS data.',
    highlights: [
      'Monsoon, winter, or summer temperature adaptations',
      'Local city fashion trends and cultural awareness',
      'One-tap Pinterest & shopping link inspiration',
    ],
    gradient: ['#3b82f6', '#06b6d4'],
  },
  {
    id: 'wardrobe',
    badge: 'WARDROBE & MIX & MATCH',
    icon: 'shirt',
    title: 'Digitize & Re-Imagine Clothes',
    subtitle: 'Upload photos of your clothes and discover endless new outfit combinations.',
    highlights: [
      'Interactive 3-lane Mix & Match canvas',
      'AI Color Harmony Score for every outfit combo',
      'Maximize existing clothes without buying new ones',
    ],
    gradient: ['#ec4899', '#f43f5e'],
  },
  {
    id: 'style-check',
    badge: 'STYLE CHECK & RECREATE',
    icon: 'camera-outline',
    title: 'Instant Styling Feedback',
    subtitle: 'Snap a selfie to get a professional AI score or recreate celebrity looks you love.',
    highlights: [
      'Detailed breakdown of fit, color, and proportion',
      'Upload aesthetic photos to discover matching items',
      'Smart guardrails filtering non-clothing photos',
    ],
    gradient: ['#10b981', '#14b8a6'],
  },
  {
    id: 'buddy',
    badge: 'AI COACH & TWINNING',
    icon: 'chatbubbles',
    title: '24/7 Consultation & Couples',
    subtitle: 'Ask any fashion question anytime or create perfectly matched couple outfits.',
    highlights: [
      'Instant answers on fabric, fit, and accessories',
      'Twinning couple outfit coordination for dates',
      'Party, formal, date, and gym occasion styling',
    ],
    gradient: ['#f59e0b', '#ef4444'],
  },
];

export default function AppTourModal({ visible, onClose }: AppTourModalProps) {
  const { theme, isDark } = useTheme();
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
