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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const HAS_SEEN_AI_PRIVACY_KEY = 'has_seen_ai_privacy_consent_v1';

interface AIPrivacyConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

interface ConsentSlide {
  id: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  points: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }[];
  gradient: [string, string];
}

const CONSENT_SLIDES: ConsentSlide[] = [
  {
    id: 'intro',
    badge: 'YOUR PRIVACY MATTERS 🔒',
    icon: 'shield-checkmark',
    title: 'Before We Analyze Your Fit',
    subtitle: 'UpTrends uses AI to elevate your style. Here is exactly what happens to your data — real talk, no jargon.',
    points: [
      { icon: 'eye-outline', color: '#6366f1', text: 'Your outfit photo is sent to Google Gemini AI for styling analysis' },
      { icon: 'cloud-done-outline', color: '#a855f7', text: 'Your profile settings are securely stored in our cloud database' },
      { icon: 'lock-closed-outline', color: '#ec4899', text: 'Your results are private to your account' },
    ],
    gradient: ['#6366f1', '#a855f7'],
  },
  {
    id: 'ai-use',
    badge: 'HOW AI USES YOUR IMAGE 🤖',
    icon: 'sparkles',
    title: 'The AI Analysis Process',
    subtitle: 'We use Google\'s generative AI to process your clothing fit, color harmony, and proportions.',
    points: [
      { icon: 'checkmark-circle-outline', color: '#10b981', text: 'AI reads clothing fit, color & proportion only' },
      { icon: 'crop-outline', color: '#ef4444', text: 'Pro Tip: Feel free to crop your face out of photos for max privacy!' },
      { icon: 'server-outline', color: '#f59e0b', text: 'Processed under Google’s standard API terms (data may be used for model improvement)' },
    ],
    gradient: ['#8b5cf6', '#06b6d4'],
  },
  {
    id: 'your-control',
    badge: 'YOU\'RE IN CONTROL 💪',
    icon: 'person-circle',
    title: 'Your Rights & Controls',
    subtitle: 'You have complete control over your UpTrends account and data footprint.',
    points: [
      { icon: 'hand-left-outline', color: '#6366f1', text: 'You can stop using AI styling features anytime' },
      { icon: 'trash-outline', color: '#a855f7', text: 'Delete your account and cloud data directly from the app' },
      { icon: 'document-text-outline', color: '#ec4899', text: 'Subject to Google API Privacy Policy and local data laws' },
    ],
    gradient: ['#ec4899', '#f43f5e'],
  },
  {
    id: 'consent',
    badge: 'YOUR CONSENT 🤝',
    icon: 'heart-circle',
    title: 'We Ask, You Decide',
    subtitle: 'By continuing, you agree that UpTrends may process your selected photos via Google Gemini AI for style analysis.',
    points: [
      { icon: 'shield-outline', color: '#10b981', text: 'One-time consent — remembered for all future outfit checks' },
      { icon: 'settings-outline', color: '#3b82f6', text: 'Revoke access anytime in Profile → Privacy Settings' },
      { icon: 'happy-outline', color: '#f59e0b', text: 'No consent = no AI analysis, but basic app features remain active!' },
    ],
    gradient: ['#10b981', '#3b82f6'],
  },
];

export default function AIPrivacyConsentModal({
  visible,
  onAccept,
  onDecline,
}: AIPrivacyConsentModalProps) {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  if (!visible) return null;

  const currentSlide = CONSENT_SLIDES[currentSlideIndex];
  const isLastSlide = currentSlideIndex === CONSENT_SLIDES.length - 1;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLastSlide) {
      // Do not auto-accept on last slide — user must explicitly press Accept
      return;
    }
    setCurrentSlideIndex((prev) => prev + 1);
  };

  const handleAccept = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await AsyncStorage.setItem(HAS_SEEN_AI_PRIVACY_KEY, 'accepted');
    } catch (e) {
      console.warn('[AIPrivacyConsentModal] Failed to save consent:', e);
    }
    onAccept();
  };

  const handleDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDecline();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" />

        {/* Consent Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.headerBar}>
            <View style={[styles.badge, { backgroundColor: currentSlide.gradient[0] + '22' }]}>
              <Text style={[styles.badgeText, { color: currentSlide.gradient[0] }]}>
                {currentSlide.badge}
              </Text>
            </View>
            {/* Step indicator */}
            <Text style={[styles.stepText, { color: theme.textSecondary }]}>
              {currentSlideIndex + 1} / {CONSENT_SLIDES.length}
            </Text>
          </View>

          {/* Hero Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={currentSlide.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name={currentSlide.icon} size={44} color="#ffffff" />
            </LinearGradient>
            {/* Glow ring */}
            <View style={[styles.iconGlow, { borderColor: currentSlide.gradient[0] + '33' }]} />
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <Text style={[styles.title, { color: theme.text }]}>{currentSlide.title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {currentSlide.subtitle}
            </Text>

            {/* Consent Points */}
            <View style={styles.pointsContainer}>
              {currentSlide.points.map((point, index) => (
                <View
                  key={index}
                  style={[
                    styles.pointRow,
                    { backgroundColor: isDark ? point.color + '18' : point.color + '12' },
                  ]}
                >
                  <View style={[styles.pointIconWrap, { backgroundColor: point.color + '25' }]}>
                    <Ionicons name={point.icon} size={18} color={point.color} />
                  </View>
                  <Text style={[styles.pointText, { color: theme.text }]}>{point.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Pagination Dots */}
          <View style={styles.paginationDots}>
            {CONSENT_SLIDES.map((_, index) => (
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

          {/* Footer Actions */}
          <View style={styles.footer}>
            {isLastSlide ? (
              <>
                {/* Accept Button */}
                <TouchableOpacity onPress={handleAccept} activeOpacity={0.85}>
                  <LinearGradient
                    colors={currentSlide.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>I Understand & Accept</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Decline link */}
                <TouchableOpacity onPress={handleDecline} style={styles.declineButton}>
                  <Text style={[styles.declineText, { color: theme.textSecondary }]}>
                    No thanks, skip AI features
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
                <LinearGradient
                  colors={currentSlide.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionButtonText}>Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Fine print */}
          <Text style={[styles.finePrint, { color: theme.textSecondary }]}>
            Powered by Google Gemini API · Subject to{' '}
            <Text style={{ color: currentSlide.gradient[0] }}>Google API Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  card: {
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
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
    flexShrink: 1,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    position: 'relative',
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 1,
  },
  iconGlow: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
  },
  contentContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  subtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  pointsContainer: {
    gap: 10,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 12,
  },
  pointIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pointText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
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
  footer: {
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  declineButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  declineText: {
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  finePrint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});
