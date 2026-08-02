import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OutfitAnalysisChart from '../components/OutfitAnalysisChart';
import ShoppingLinks from '../components/ShoppingLinks';
import StyleRatingCard from '../components/StyleRatingCard';
import StyleRecommendations from '../components/StyleRecommendations';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { analyzeOutfitRating, StyleCheckResult } from '../services/styleCheckService';
import { getUserProfile } from '../services/userService';
import { checkUserGender, promptForGender } from '../utils/genderUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;

export default function StyleCheck() {
  const { theme } = useTheme();
  const isDark = theme.background === '#0f172a';
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [outfitImage, setOutfitImage] = useState<string | null>(null);
  const [venueImage, setVenueImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<StyleCheckResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const resultsSlideAnim = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    loadUserProfile();
    startEntranceAnimation();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const startEntranceAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Pulsing animation for analyze button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isAnalyzing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAnalyzing]);

  const pickImage = async (type: 'outfit' | 'venue') => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'outfit' ? [3, 4] : [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        if (type === 'outfit') {
          setOutfitImage(result.assets[0].uri);
        } else {
          setVenueImage(result.assets[0].uri);
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const analyzeStyle = async () => {
    if (isAnalyzing) return;
    if (!outfitImage) {
      Alert.alert('Missing Photo', 'Please upload your outfit photo to get started.');
      return;
    }

    // Check if user has complete profile
    const genderCheck = await checkUserGender(user?.uid);
    if (!genderCheck.hasGender) {
      promptForGender(() => loadUserProfile());
      return;
    }

    if (!userProfile?.height || !userProfile?.weight || !userProfile?.bodyType || !userProfile?.skinTone) {
      Alert.alert(
        'Complete Your Profile',
        'Please complete your profile (height, weight, body type, skin tone) for accurate analysis.',
        [
          { text: 'Complete Profile', onPress: () => router.push('/profile-edit') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    try {
      setIsAnalyzing(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const result = await analyzeOutfitRating({
        outfitImage,
        venueImage: venueImage || undefined,
        userProfile,
      });

      setAnalysisResult(result);
      setShowResults(true);

      // Animate results in
      Animated.spring(resultsSlideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error analyzing style:', error);
      let errorMessage = 'Unable to analyze your style. Please try again.';
      if (error instanceof Error && error.message.includes('Invalid Image')) {
        errorMessage = error.message.replace('Error: ', '');
      }
      Alert.alert('Analysis Failed', errorMessage);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const closeResults = () => {
    Animated.timing(resultsSlideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowResults(false);
      setAnalysisResult(null);
    });
  };

  return (
    <PremiumBackground variant="styleCheck">
    <SafeAreaView style={[styles.container]}>
      <StatusBar barStyle={theme.background === '#0f172a' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: theme.card }]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Style Check ✨
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            AI-Powered Outfit Analysis
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Upload Section */}
        <Animated.View
          style={[
            styles.uploadSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
            }
          ]}
        >
          <BlurView
            intensity={isDark ? 30 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={styles.uploadContainer}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              📸 Upload Photos
            </Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Add an outfit and optional venue for context
            </Text>

            <View style={styles.photoRow}>
              {/* Outfit Photo */}
              <View style={styles.photoSection}>
                <TouchableOpacity
                  onPress={() => pickImage('outfit')}
                  style={[
                    styles.photoUpload,
                    {
                      borderColor: outfitImage ? theme.primary : theme.border,
                      backgroundColor: outfitImage ? theme.primary + '15' : 'transparent'
                    }
                  ]}
                >
                  {outfitImage ? (
                    <Image source={{ uri: outfitImage }} style={styles.compactImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="shirt-outline" size={32} color={theme.primary} />
                      <Text style={[styles.photoPlaceholderTitle, { color: theme.text }]}>Outfit *</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Venue Photo */}
              <View style={styles.photoSection}>
                <TouchableOpacity
                  onPress={() => pickImage('venue')}
                  style={[
                    styles.photoUpload,
                    {
                      borderColor: venueImage ? theme.accent : theme.border,
                      backgroundColor: venueImage ? theme.accent + '15' : 'transparent'
                    }
                  ]}
                >
                  {venueImage ? (
                    <Image source={{ uri: venueImage }} style={styles.compactImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="location-outline" size={32} color={theme.accent} />
                      <Text style={[styles.photoPlaceholderTitle, { color: theme.text }]}>Venue</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* Analyze Button */}
        <Animated.View
          style={[
            styles.analyzeButtonContainer,
            {
              opacity: isAnalyzing ? pulseAnim : fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <TouchableOpacity
            onPress={analyzeStyle}
            disabled={isAnalyzing || !outfitImage}
            style={styles.analyzeButton}
          >
            <LinearGradient
              colors={outfitImage ? [theme.primary, theme.accent] : [theme.border, theme.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.analyzeButtonGradient}
            >
              {isAnalyzing ? (
                <View style={styles.analyzeButtonContent}>
                  <Ionicons name="scan-circle" size={24} color="#fff" style={styles.analyzeButtonIcon} />
                  <Text style={styles.analyzeButtonText}>Scanning Style...</Text>
                </View>
              ) : (
                <View style={styles.analyzeButtonContent}>
                  <Ionicons name="sparkles" size={24} color="#fff" style={styles.analyzeButtonIcon} />
                  <Text style={styles.analyzeButtonText}>Analyze My Style</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Features Preview */}
        <Animated.View
          style={[
            styles.featuresSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={[styles.featuresTitle, { color: theme.text }]}>
            🎯 What You'll Get
          </Text>

          <View style={styles.featuresList}>
            {[
              { icon: '📊', title: 'Detailed Rating', desc: 'Overall score with category breakdowns' },
              { icon: '🎨', title: 'Color Analysis', desc: 'Color harmony and skin tone matching' },
              { icon: '👔', title: 'Fit Assessment', desc: 'Silhouette and proportion analysis' },
              { icon: '🏢', title: 'Occasion Match', desc: 'Venue appropriateness scoring' },
              { icon: '💎', title: 'Style Recommendations', desc: 'Personalized improvement suggestions' },
              { icon: '🛍️', title: 'Shopping Links', desc: 'Direct links to recommended items' },
            ].map((feature, index) => (
              <View
                key={index}
                style={[styles.featureItem, { backgroundColor: theme.card }]}
              >
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureTitle, { color: theme.text }]}>
                    {feature.title}
                  </Text>
                  <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>
                    {feature.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Results Modal */}
      {showResults && analysisResult && (
        <Animated.View
          style={[
            styles.resultsModal,
            {
              transform: [{ translateY: resultsSlideAnim }]
            }
          ]}
        >
          <View style={styles.resultsContainer}>
            <View
              style={[styles.resultsContent, { backgroundColor: theme.background }]}
            >
              {/* Results Header */}
              <View style={[styles.resultsHeader, { borderColor: theme.border }]}>
                <Text style={[styles.resultsTitle, { color: theme.text }]}>
                  Your Style Analysis
                </Text>
                <TouchableOpacity
                  onPress={closeResults}
                  style={[styles.closeButton, { backgroundColor: theme.card }]}
                >
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
                <StyleRatingCard result={analysisResult} theme={theme} />
                <OutfitAnalysisChart result={analysisResult} theme={theme} />
                <StyleRecommendations result={analysisResult} theme={theme} />
                <ShoppingLinks result={analysisResult} theme={theme} />
                <View style={styles.resultsBottom} />
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: getResponsiveSize(24),
    paddingVertical: getResponsiveSize(16),
  },
  backButton: {
    width: getResponsiveSize(48),
    height: getResponsiveSize(48),
    borderRadius: getResponsiveSize(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: getResponsiveSize(24),
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: getResponsiveSize(14),
    marginTop: 2,
  },
  headerSpacer: {
    width: getResponsiveSize(48),
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: getResponsiveSize(24),
  },
  scrollContent: {
    paddingBottom: 100,
  },
  uploadSection: {
    marginBottom: getResponsiveSize(32),
  },
  uploadContainer: {
    borderRadius: getResponsiveSize(24),
    padding: getResponsiveSize(20),
    marginBottom: getResponsiveSize(24),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: getResponsiveSize(20),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(4),
  },
  sectionDescription: {
    fontSize: getResponsiveSize(14),
    marginBottom: getResponsiveSize(20),
  },
  photoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: getResponsiveSize(12),
  },
  photoSection: {
    flex: 1,
  },
  photoUpload: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: getResponsiveSize(16),
    height: getResponsiveSize(140),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderTitle: {
    fontSize: getResponsiveSize(14),
    fontWeight: '600',
    marginTop: getResponsiveSize(8),
  },
  analyzeButtonContainer: {
    marginBottom: getResponsiveSize(32),
  },
  analyzeButton: {
    borderRadius: getResponsiveSize(16),
  },
  analyzeButtonGradient: {
    borderRadius: getResponsiveSize(16),
    padding: getResponsiveSize(16),
    alignItems: 'center',
  },
  analyzeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyzeButtonIcon: {
    marginRight: getResponsiveSize(12),
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: getResponsiveSize(18),
    fontWeight: 'bold',
  },
  featuresSection: {
    marginBottom: getResponsiveSize(32),
  },
  featuresTitle: {
    fontSize: getResponsiveSize(20),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(16),
  },
  featuresList: {
    gap: getResponsiveSize(16),
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: getResponsiveSize(16),
    borderRadius: getResponsiveSize(16),
    marginBottom: getResponsiveSize(12),
  },
  featureIcon: {
    fontSize: getResponsiveSize(24),
    marginRight: getResponsiveSize(16),
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: '600',
    fontSize: getResponsiveSize(16),
  },
  featureDesc: {
    fontSize: getResponsiveSize(14),
    marginTop: getResponsiveSize(4),
  },
  resultsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  resultsContainer: {
    flex: 1,
    marginTop: getResponsiveSize(80),
  },
  resultsContent: {
    flex: 1,
    borderTopLeftRadius: getResponsiveSize(24),
    borderTopRightRadius: getResponsiveSize(24),
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: getResponsiveSize(24),
    borderBottomWidth: 1,
  },
  resultsTitle: {
    fontSize: getResponsiveSize(24),
    fontWeight: 'bold',
  },
  closeButton: {
    width: getResponsiveSize(40),
    height: getResponsiveSize(40),
    borderRadius: getResponsiveSize(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsScroll: {
    flex: 1,
  },
  resultsBottom: {
    height: getResponsiveSize(80),
  },
});