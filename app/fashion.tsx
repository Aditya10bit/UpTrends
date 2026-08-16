import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getUserProfile, updateUserProfile } from '../services/userService';

const { width: screenWidth } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / 375;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

const categoriesByGender = {
  male: [
    { id: 0, name: "Today's Outfit", icon: '🌤️', colors: ['#FF6B35', '#F7931E'], trend: 'Weather', description: 'Perfect for today' },
    { id: 1, name: 'Street Style', icon: '🕶️', colors: ['#667eea', '#764ba2'], trend: 'Hot', description: 'Urban vibes' },
    { id: 2, name: 'Formal Wear', icon: '👔', colors: ['#2c3e50', '#34495e'], trend: 'Classic', description: 'Professional look' },
    { id: 3, name: 'Gym Wear', icon: '💪', colors: ['#ff6b6b', '#ee5a24'], trend: 'Trending', description: 'Fitness first' },
    { id: 4, name: 'Date Night', icon: '💕', colors: ['#ff9ff3', '#f368e0'], trend: 'Popular', description: 'Romance ready' },
    { id: 5, name: 'Party Wear', icon: '🎉', colors: ['#feca57', '#ff9ff3'], trend: 'Hot', description: 'Party perfect' },
    { id: 6, name: 'Old Money', icon: '💎', colors: ['#3c6382', '#40739e'], trend: 'Luxury', description: 'Timeless elegance' },
    { id: 7, name: 'Twinning', icon: '👫', colors: ['#ff6b9d', '#c44569'], trend: 'New', description: 'Couple goals' },
    { id: 8, name: 'Make Me an Outfit', icon: '👗', colors: ['#ff9ff3', '#f368e0'], trend: 'Custom', description: 'Create your look' },
    { id: 9, name: 'Upload Aesthetic', icon: '🎨', colors: ['#667eea', '#764ba2'], trend: 'Trendy', description: 'Style for venues' },
    { id: 10, name: 'My Closet', icon: '👚', colors: ['#f472b6', '#fb7185'], trend: 'New', description: 'Your digital wardrobe' }
  ],
  female: [

    { id: 0, name: "Today's Outfit", icon: '🌤️', colors: ['#FF6B35', '#F7931E'], trend: 'Weather', description: 'Perfect for today' },
    { id: 1, name: 'Street Style', icon: '👗', colors: ['#667eea', '#764ba2'], trend: 'Hot', description: 'Chic & edgy' },
    { id: 2, name: 'Office Wear', icon: '👩‍💼', colors: ['#2c3e50', '#34495e'], trend: 'Classic', description: 'Boss babe' },
    { id: 3, name: 'Gym Wear', icon: '🏃‍♀️', colors: ['#ff6b6b', '#ee5a24'], trend: 'Trending', description: 'Fit & fabulous' },
    { id: 4, name: 'Date Night', icon: '💃', colors: ['#ff9ff3', '#f368e0'], trend: 'Popular', description: 'Date ready' },
    { id: 5, name: 'Party Wear', icon: '✨', colors: ['#feca57', '#ff9ff3'], trend: 'Hot', description: 'Sparkle & shine' },
    { id: 6, name: 'Elegant', icon: '👑', colors: ['#3c6382', '#40739e'], trend: 'Luxury', description: 'Royal vibes' },
    { id: 7, name: 'Twinning', icon: '👫', colors: ['#ff6b9d', '#c44569'], trend: 'New', description: 'Match made' },
    { id: 8, name: 'Make Me an Outfit', icon: '👗', colors: ['#ff9ff3', '#f368e0'], trend: 'Custom', description: 'Create your look' },
    { id: 9, name: 'Upload Aesthetic', icon: '🎨', colors: ['#667eea', '#764ba2'], trend: 'Trendy', description: 'Style for venues' },
    { id: 10, name: 'My Closet', icon: '👚', colors: ['#f472b6', '#fb7185'], trend: 'New', description: 'Your digital wardrobe' }
  ]
};

// Editorial line icon per category (replaces the old emoji headers). Every
// card keeps the SAME single lavender accent — no per-category rainbow.
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "Today's Outfit": 'partly-sunny-outline',
  'Street Style': 'glasses-outline',
  'Formal Wear': 'shirt-outline',
  'Gym Wear': 'barbell-outline',
  'Date Night': 'heart-outline',
  'Party Wear': 'sparkles-outline',
  'Old Money': 'diamond-outline',
  'Twinning': 'people-outline',
  'Make Me an Outfit': 'color-wand-outline',
  'Upload Aesthetic': 'camera-outline',
  'My Closet': 'grid-outline',
  'Office Wear': 'briefcase-outline',
  'Elegant': 'star-outline',
};

const TrendingBadge = ({ trend }: { trend: string }) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.trendBadge,
        { backgroundColor: theme.primary + '14', borderColor: theme.primary + '22' },
      ]}
    >
      <Ionicons name="flame-outline" size={10} color={theme.textAccent} />
      <Text style={[styles.trendText, { color: theme.textAccent }]}>
        {trend.toUpperCase()}
      </Text>
    </View>
  );
};

const ScrollSafeTouchable = ({ onPress, onLongPress, children, style }: any) => {
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, time: 0 });
  const [isValidTap, setIsValidTap] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const moveThreshold = 15;
  const timeThreshold = 300;
  const longPressThreshold = 500;
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    setTouchStart({ x: pageX, y: pageY, time: Date.now() });
    setIsValidTap(true);
    setLongPressTriggered(false);

    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if (isValidTap && !longPressTriggered) {
          setLongPressTriggered(true);
          onLongPress();
        }
      }, longPressThreshold);
    }
  };

  const handleTouchMove = (e: any) => {
    if (!isValidTap) return;
    const { pageX, pageY } = e.nativeEvent;
    const moveX = Math.abs(pageX - touchStart.x);
    const moveY = Math.abs(pageY - touchStart.y);
    if (moveX > moveThreshold || moveY > moveThreshold) {
      setIsValidTap(false);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const duration = Date.now() - touchStart.time;
    if (isValidTap && !longPressTriggered && duration < timeThreshold && duration > 50) {
      onPress();
    }
    setIsValidTap(false);
    setLongPressTriggered(false);
  };
  return (
    <View
      style={style}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </View>
  );
};

const ScrollSafeCategoryCard = ({ category, index, onPress }: any) => {
  const { theme } = useTheme();

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Reanimated.View
      entering={FadeInDown.duration(380).delay(index * 60)}
      style={styles.categoryCard}
    >
      <ScrollSafeTouchable onPress={handlePress} style={styles.touchableCard}>
        <View
          style={[
            styles.categoryCardInner,
            { backgroundColor: theme.card, borderColor: theme.borderLight },
          ]}
        >
          {/* Trend pill */}
          <View style={styles.badgeContainer}>
            <TrendingBadge trend={category.trend} />
          </View>

          {/* Larger line icon in a glass circle — bigger than the home rail */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight },
            ]}
          >
            <Ionicons
              name={CATEGORY_ICONS[category.name] || 'shirt-outline'}
              size={28}
              color={theme.textAccent}
            />
          </View>

          <Text style={[styles.categoryText, { color: theme.text }]}>
            {category.name}
          </Text>
          <Text
            style={[styles.categoryDescription, { color: theme.textTertiary }]}
            numberOfLines={2}
          >
            {category.description}
          </Text>
        </View>
      </ScrollSafeTouchable>
    </Reanimated.View>
  );
};

export default function Fashion() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showGenderPrompt, setShowGenderPrompt] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const welcomeScale = useRef(new Animated.Value(0.8)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const userName = userProfile?.displayName ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'User');
  const currentCategories = categoriesByGender[selectedGender];

  useEffect(() => {
    loadUserProfile();
    startEntranceAnimations();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Ensure header is visible immediately when screen comes into focus
      headerOpacity.setValue(1);
      // Reset other animation values
      fadeAnim.setValue(1);
      contentSlideAnim.setValue(0);
      welcomeScale.setValue(1);
      
      loadUserProfile();

      return () => {
        // Cleanup when screen loses focus
        setIsExiting(false);
        setIsNavigating(false);
      };
    }, [])
  );

  const resetAnimationValues = () => {
    fadeAnim.setValue(1);
    contentSlideAnim.setValue(0);
    headerOpacity.setValue(1); // Keep header visible
    welcomeScale.setValue(0.8);
  };

  const loadUserProfile = async () => {
    try {
      setIsLoadingProfile(true);
      const profile = await getUserProfile();
      if (profile) {
        setUserProfile(profile);
        // Set gender based on user profile BEFORE showing UI
        if (profile.gender) {
          const userGender = profile.gender.toLowerCase();
          if (userGender === 'male' || userGender === 'female') {
            setSelectedGender(userGender as 'male' | 'female');
          } else {
            // If gender is 'Other', show prompt to choose
            setShowGenderPrompt(true);
          }
        } else {
          // No gender in profile, show prompt
          setShowGenderPrompt(true);
        }
      } else {
        setShowGenderPrompt(true);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setShowGenderPrompt(true);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const startExitAnimation = (callback: () => void) => {
    if (isExiting) return;
    setIsExiting(true);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(contentSlideAnim, {
        toValue: -30,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
    });
  };

  const startEntranceAnimations = () => {
    // Reset values for entrance
    fadeAnim.setValue(1);
    contentSlideAnim.setValue(0);

    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(welcomeScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCategoryPress = (categoryName: string) => {
    if (isNavigating || isExiting) return; // Prevent double-tap
    setIsNavigating(true);

    startExitAnimation(() => {
      if (categoryName === 'Make Me an Outfit') {
        router.push('/make-outfit');
      } else if (categoryName === 'Upload Aesthetic') {
        router.push('/upload-aesthetic');
      } else if (categoryName === "Today's Outfit") {
        router.push('/todays-outfit');
      } else if (categoryName === 'Twinning') {
        router.push('/twinning');
      } else if (categoryName === 'My Closet') {
        router.push('/wardrobe');
      } else {
        const categorySlug = `${selectedGender}-${categoryName.toLowerCase().replace(/\s+/g, '-')}`;
        router.push(`/category/${categorySlug}`);
      }
      setTimeout(() => setIsNavigating(false), 500);
    });
  };

  const handleGenderChange = (gender: 'male' | 'female') => setSelectedGender(gender);

  const handleGenderSelection = async (gender: 'male' | 'female') => {
    try {
      setSelectedGender(gender);
      setShowGenderPrompt(false);

      // Update user profile with selected gender
      if (user?.uid) {
        await updateUserProfile(user.uid, { gender: gender === 'male' ? 'Male' : 'Female' });
        // Reload profile to get updated data
        await loadUserProfile();
      }
    } catch (error) {
      console.error('Error updating gender:', error);
      Alert.alert('Error', 'Failed to save gender preference. Please try again.');
    }
  };

  // Show loading screen while profile is loading to prevent gender toggle flash
  if (isLoadingProfile) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.background === '#0e0e0e' ? "light-content" : "dark-content"} backgroundColor={theme.background} />
        <View style={styles.loadingContainer}>
          <View style={[styles.loadingCard, { backgroundColor: theme.card, borderColor: theme.borderLight, borderWidth: 1 }]}>
            <View style={[styles.loadingIconCircle, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
              <Ionicons name="sparkles-outline" size={28} color={theme.textAccent} />
            </View>
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading Fashion Categories</Text>
            <View style={[styles.loadingBar, { backgroundColor: theme.borderLight }]}>
              <Animated.View
                style={[
                  styles.loadingProgress,
                  { backgroundColor: theme.primary }
                ]}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.safeArea,
        {
          paddingTop: insets.top,
          opacity: fadeAnim,
          transform: [{ translateY: contentSlideAnim }],
          backgroundColor: theme.background,
        }
      ]}
    >
      <StatusBar barStyle={theme.background === '#0e0e0e' ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      <Animated.View style={[styles.container, { backgroundColor: theme.background }]}>
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <View
            style={[
              styles.headerGradient,
              {
                backgroundColor: theme.background,
                borderBottomColor: theme.borderLight,
                borderBottomWidth: 1,
              },
            ]}
          >
            <ScrollSafeTouchable
              style={[
                styles.backButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.borderLight,
                  borderWidth: 1,
                },
              ]}
              onPress={async () => {
                if (isNavigating || isExiting) return;
                setIsNavigating(true);
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                startExitAnimation(() => {
                  router.back();
                  setTimeout(() => setIsNavigating(false), 500);
                });
              }}
            >
              <Ionicons name="arrow-back" size={getResponsiveSize(22)} color={theme.text} />
            </ScrollSafeTouchable>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Fashion Categories</Text>
              <Text style={[styles.headerSubtitleText, { color: theme.textTertiary }]}>Find your look</Text>
            </View>
            <View style={styles.placeholder} />
          </View>
        </Animated.View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* GENDER TOGGLE - Only show if user has 'Other' gender or wants to switch */}
          {(userProfile?.gender === 'Other' || !userProfile?.gender) && (
            <View style={styles.genderToggleContainer}>
              <View style={[styles.genderToggle, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                <ScrollSafeTouchable
                  style={[
                    styles.toggleButton,
                    selectedGender === 'male'
                      ? { backgroundColor: theme.primary }
                      : { backgroundColor: 'transparent' }
                  ]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleGenderChange('male');
                  }}
                >
                  <Text style={[
                    styles.toggleLabel,
                    { color: selectedGender === 'male' ? '#fff' : theme.textSecondary }
                  ]}>
                    Men
                  </Text>
                </ScrollSafeTouchable>
                <ScrollSafeTouchable
                  style={[
                    styles.toggleButton,
                    selectedGender === 'female'
                      ? { backgroundColor: theme.primary }
                      : { backgroundColor: 'transparent' }
                  ]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleGenderChange('female');
                  }}
                >
                  <Text style={[
                    styles.toggleLabel,
                    { color: selectedGender === 'female' ? '#fff' : theme.textSecondary }
                  ]}>
                    Women
                  </Text>
                </ScrollSafeTouchable>
              </View>
            </View>
          )}
          {/* WELCOME TEXT */}
          <Animated.View style={[styles.welcomeContainer, { transform: [{ scale: welcomeScale }] }]}>
            <Text style={[styles.welcomeText, { color: theme.text }]}>Hi {userName}</Text>
            <Text style={[styles.welcomeSubtext, { color: theme.textSecondary }]}>{'What\'s your vibe today?'}</Text>
          </Animated.View>
          {/* CATEGORY GRID */}
          <View style={styles.categoryGrid}>
            {currentCategories.map((category, index) => (
              <ScrollSafeCategoryCard
                key={`${selectedGender}-${category.id}`}
                category={category}
                index={index}
                onPress={() => handleCategoryPress(category.name)}
              />
            ))}
          </View>
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </Animated.View>

      {/* Gender Selection Modal */}
      <Modal
        visible={showGenderPrompt}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Choose Your Style</Text>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Select your preferred fashion category to get personalized recommendations
              </Text>
            </View>

            <View style={styles.genderOptions}>
              <TouchableOpacity
                style={[styles.genderOption, { borderColor: theme.border }]}
                onPress={() => handleGenderSelection('male')}
              >
                <View style={[styles.genderOptionGradient, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '22' }]}>
                  <View style={[styles.genderOptionIcon, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
                    <Ionicons name="shirt-outline" size={22} color={theme.textAccent} />
                  </View>
                  <Text style={[styles.genderOptionText, { color: theme.text }]}>{'Men\'s Fashion'}</Text>
                  <Text style={[styles.genderOptionDesc, { color: theme.textSecondary }]}>Suits, streetwear, casual & more</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.genderOption, { borderColor: theme.border }]}
                onPress={() => handleGenderSelection('female')}
              >
                <View style={[styles.genderOptionGradient, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '22' }]}>
                  <View style={[styles.genderOptionIcon, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
                    <Ionicons name="woman-outline" size={22} color={theme.textAccent} />
                  </View>
                  <Text style={[styles.genderOptionText, { color: theme.text }]}>{'Women\'s Fashion'}</Text>
                  <Text style={[styles.genderOptionDesc, { color: theme.textSecondary }]}>Dresses, chic styles, elegant & more</Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalNote, { color: theme.textTertiary }]}>
              You can change this anytime in your profile settings
            </Text>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { position: 'relative', zIndex: 10 },
  headerGradient: {
    paddingHorizontal: getResponsiveSize(20),
    paddingVertical: getResponsiveSize(15),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backButton: {
    width: getResponsiveSize(40),
    height: getResponsiveSize(40),
    borderRadius: getResponsiveSize(20),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  headerTitleContainer: { alignItems: 'center', flex: 1 },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: getResponsiveFontSize(22),
    marginBottom: 2,
  },
  headerSubtitleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: getResponsiveFontSize(10),
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  placeholder: { width: getResponsiveSize(48) },
  scrollView: { flex: 1, paddingHorizontal: getResponsiveSize(20) },
  genderToggleContainer: {
    marginTop: getResponsiveSize(25),
    marginBottom: getResponsiveSize(20),
  },
  genderToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: getResponsiveSize(4),
    borderWidth: 1,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: getResponsiveSize(14),
    paddingHorizontal: getResponsiveSize(20),
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  welcomeContainer: { alignItems: 'center', marginBottom: getResponsiveSize(30) },
  welcomeText: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: getResponsiveFontSize(26),
    textAlign: 'center',
    marginBottom: getResponsiveSize(5),
  },
  welcomeSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    marginBottom: getResponsiveSize(20),
    borderRadius: 12,
  },
  touchableCard: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
  },
  categoryCardInner: {
    padding: getResponsiveSize(18),
    minHeight: getResponsiveSize(150),
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeContainer: {
    position: 'absolute', top: 12, left: 12, zIndex: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  trendText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: getResponsiveSize(28),
    marginBottom: 12,
  },
  categoryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: getResponsiveSize(6),
  },
  categoryDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  bottomSpacing: { height: getResponsiveSize(30) },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: getResponsiveSize(20),
  },
  modalContent: {
    borderRadius: 12,
    padding: getResponsiveSize(24),
    width: '100%',
    maxWidth: getResponsiveSize(400),
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: getResponsiveSize(24),
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: getResponsiveFontSize(20),
    marginBottom: getResponsiveSize(8),
  },
  modalSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  genderOptions: {
    gap: getResponsiveSize(16),
    marginBottom: getResponsiveSize(20),
  },
  genderOption: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  genderOptionGradient: {
    padding: getResponsiveSize(20),
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  genderOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: getResponsiveSize(10),
  },
  genderOptionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: getResponsiveFontSize(16),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: getResponsiveSize(4),
  },
  genderOptionDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
  },
  modalNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: getResponsiveSize(20),
  },
  loadingCard: {
    padding: getResponsiveSize(32),
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    minWidth: getResponsiveSize(200),
  },
  loadingIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: getResponsiveSize(16),
  },
  loadingText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: getResponsiveSize(20),
    textAlign: 'center',
  },
  loadingBar: {
    width: getResponsiveSize(150),
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    width: '70%',
    borderRadius: 2,
  },
});
