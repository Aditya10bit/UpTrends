import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getUserProfile } from '../services/userService';

const { width: screenWidth } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / 375;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

const categoriesByGender = {
  male: [
    { id: 1, name: 'Street Style', icon: '🕶️', colors: ['#667eea', '#764ba2'], trend: 'Hot', description: 'Urban vibes' },
    { id: 2, name: 'Formal Wear', icon: '👔', colors: ['#2c3e50', '#34495e'], trend: 'Classic', description: 'Professional look' },
    { id: 3, name: 'Gym Wear', icon: '💪', colors: ['#ff6b6b', '#ee5a24'], trend: 'Trending', description: 'Fitness first' },
    { id: 4, name: 'Date Night', icon: '💕', colors: ['#ff9ff3', '#f368e0'], trend: 'Popular', description: 'Romance ready' },
    { id: 5, name: 'Party Wear', icon: '🎉', colors: ['#feca57', '#ff9ff3'], trend: 'Hot', description: 'Party perfect' },
    { id: 6, name: 'Old Money', icon: '💎', colors: ['#3c6382', '#40739e'], trend: 'Luxury', description: 'Timeless elegance' },
{ id: 7, name: 'Twinning', icon: '👫', colors: ['#ff6b9d', '#c44569'], trend: 'New', description: 'Couple goals' },
    { id: 8, name: 'Make Me an Outfit', icon: '👗', colors: ['#ff9ff3', '#f368e0'], trend: 'Custom', description: 'Create your look' },
    { id: 9, name: 'Upload Aesthetic', icon: '🎨', colors: ['#667eea', '#764ba2'], trend: 'Trendy', description: 'Style for venues' }
  ],
  female: [
    { id: 1, name: 'Street Style', icon: '👗', colors: ['#667eea', '#764ba2'], trend: 'Hot', description: 'Chic & edgy' },
    { id: 2, name: 'Office Wear', icon: '👩‍💼', colors: ['#2c3e50', '#34495e'], trend: 'Classic', description: 'Boss babe' },
    { id: 3, name: 'Gym Wear', icon: '🏃‍♀️', colors: ['#ff6b6b', '#ee5a24'], trend: 'Trending', description: 'Fit & fabulous' },
    { id: 4, name: 'Date Night', icon: '💃', colors: ['#ff9ff3', '#f368e0'], trend: 'Popular', description: 'Date ready' },
    { id: 5, name: 'Party Wear', icon: '✨', colors: ['#feca57', '#ff9ff3'], trend: 'Hot', description: 'Sparkle & shine' },
    { id: 6, name: 'Elegant', icon: '👑', colors: ['#3c6382', '#40739e'], trend: 'Luxury', description: 'Royal vibes' },
{ id: 7, name: 'Twinning', icon: '👫', colors: ['#ff6b9d', '#c44569'], trend: 'New', description: 'Match made' },
    { id: 8, name: 'Make Me an Outfit', icon: '👗', colors: ['#ff9ff3', '#f368e0'], trend: 'Custom', description: 'Create your look' },
    { id: 9, name: 'Upload Aesthetic', icon: '🎨', colors: ['#667eea', '#764ba2'], trend: 'Trendy', description: 'Style for venues' }
  ]
};

const TrendingBadge = ({ trend }: { trend: string }) => {
  const { theme } = useTheme();
  const getBadgeColors = (): [string, string] => {
    switch (trend) {
      case 'Hot': return [theme.trending, '#ff3742'];
      case 'Trending': return [theme.primary, theme.primary];
      case 'Popular': return [theme.warning, '#e67e22'];
      case 'New': return [theme.accent, '#27ae60'];
      case 'Luxury': return [theme.secondary, '#9b59b6'];
      case 'Custom': return ['#ff9ff3', '#f368e0'];
      case 'Trendy': return ['#667eea', '#764ba2'];
      default: return [theme.textTertiary, theme.textSecondary];
    }
  };
  const getIcon = () => {
    switch (trend) {
      case 'Hot': return '🔥';
      case 'Trending': return '📈';
      case 'Popular': return '⭐';
      case 'New': return '✨';
      case 'Luxury': return '💎';
      case 'Custom': return '🎨';
      case 'Trendy': return '🌟';
      default: return '👍';
    }
  };
  return (
    <LinearGradient
      colors={getBadgeColors()}
      style={styles.trendBadge}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.trendIcon}>{getIcon()}</Text>
      <Text style={styles.trendText}>{trend}</Text>
    </LinearGradient>
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

const ScrollSafeCategoryCard = ({
  category, index, onPress
}: any) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const floatValue = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Start floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatValue, {
          toValue: 1,
          duration: 3000 + (index * 200),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatValue, {
          toValue: 0,
          duration: 3000 + (index * 200),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Start shimmer animation
    Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const handleLongPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Pulse animation
    Animated.sequence([
      Animated.timing(pulseValue, {
        toValue: 1.15,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pulseValue, {
        toValue: 1,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleValidPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: 400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => { onPress(); }, 100);
      setTimeout(() => {
        scaleValue.setValue(1);
        rotateValue.setValue(0);
        opacityValue.setValue(1);
      }, 500);
    });
  };
  const floatingTransform = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const shimmerOpacity = shimmerValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  const animatedStyle = {
    transform: [
      { scale: Animated.multiply(scaleValue, pulseValue) },
      { translateY: floatingTransform },
      {
        rotateZ: rotateValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
    opacity: opacityValue,
  };
  return (
    <Animated.View style={[styles.categoryCard, animatedStyle]}>
      <ScrollSafeTouchable 
        onPress={handleValidPress} 
        onLongPress={handleLongPress}
        style={styles.touchableCard}
      >
        <LinearGradient
          colors={category.colors}
          style={styles.gradientCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.floatingElements}>
            <Animated.View style={[styles.floatingDot, styles.dot1, { opacity: shimmerOpacity }]} />
            <Animated.View style={[styles.floatingDot, styles.dot2, { opacity: shimmerOpacity }]} />
            <Animated.View 
              style={[styles.shimmerOverlay, {
                opacity: shimmerValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.3, 0],
                }),
                transform: [{
                  translateX: shimmerValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 200],
                  })
                }]
              }]}
            />
          </View>
          <View style={styles.badgeContainer}>
            <TrendingBadge trend={category.trend} />
          </View>
          <View style={styles.iconContainer}>
            <View style={styles.iconGlow}>
              <Text style={styles.categoryIcon}>{category.icon}</Text>
            </View>
          </View>
          <Text style={styles.categoryText}>{category.name}</Text>
          <Text style={styles.categoryDescription}>{category.description}</Text>
          <View style={styles.bottomIndicator}>
            <View style={styles.indicatorLine} />
          </View>
        </LinearGradient>
      </ScrollSafeTouchable>
    </Animated.View>
  );
};

export default function Fashion() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [userProfile, setUserProfile] = useState<any>(null);

  // Animations
  const animatedValue = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const welcomeScale = useRef(new Animated.Value(0.8)).current;

  const userName = userProfile?.displayName ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'User');
  const currentCategories = categoriesByGender[selectedGender];

  useEffect(() => {
    loadUserProfile();
    startEntranceAnimations();
    startBackgroundAnimation();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserProfile();
      startEntranceAnimations();
    }, [])
  );

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile();
      if (profile) setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const startEntranceAnimations = () => {
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

  const startBackgroundAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const handleCategoryPress = (categoryName: string) => {
    if (categoryName === 'Make Me an Outfit') {
      router.push('/make-outfit');
      return;
    }
    if (categoryName === 'Upload Aesthetic') {
      router.push('/upload-aesthetic');
      return;
    }
    const categorySlug = `${selectedGender}-${categoryName.toLowerCase().replace(/\s+/g, '-')}`;
    router.push(`/category/${categorySlug}`);
  };

  const handleGenderChange = (gender: 'male' | 'female') => setSelectedGender(gender);

  // DYNAMIC BACKGROUND COLORS (theme-based)
  const backgroundColor1 = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.background, theme.card],
  });

  const backgroundColor2 = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      theme.card,
      theme.background
    ],
  });

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      <Animated.View style={[styles.container, { backgroundColor: backgroundColor1 }]}>
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <View style={styles.headerBackground}>
            <Animated.View style={[styles.headerGradient, { backgroundColor: backgroundColor2 }]}>
              <ScrollSafeTouchable
                style={styles.backButton}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
              >
                <LinearGradient
                  colors={[theme.primary + '11', theme.secondary + '11']}
                  style={styles.backButtonGradient}
                >
                  <Ionicons name="arrow-back" size={getResponsiveSize(24)} color={theme.primary} />
                </LinearGradient>
              </ScrollSafeTouchable>
              <View style={styles.headerTitleContainer}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Fashion Categories</Text>
                <View style={styles.headerSubtitle}>
                  <Ionicons name="sparkles" size={14} color={theme.secondary} />
                  <Text style={[styles.headerSubtitleText, { color: theme.secondary }]}>YOU are the Trend ✨</Text>
                </View>
              </View>
              <View style={styles.placeholder} />
            </Animated.View>
          </View>
        </Animated.View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* GENDER TOGGLE */}
          <View style={styles.genderToggleContainer}>
            <LinearGradient
              colors={[theme.card, theme.background]}
              style={styles.genderToggle}
            >
              <ScrollSafeTouchable
                style={[
                  styles.toggleButton,
                  selectedGender === 'male'
                    ? { backgroundColor: theme.primary }
                    : { backgroundColor: theme.card }
                ]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleGenderChange('male');
                }}
              >
                <Text style={{
                  color: selectedGender === 'male' ? '#fff' : theme.text,
                  fontWeight: 'bold'
                }}>
                  👨 Men
                </Text>
              </ScrollSafeTouchable>
              <ScrollSafeTouchable
                style={[
                  styles.toggleButton,
                  selectedGender === 'female'
                    ? { backgroundColor: theme.primary }
                    : { backgroundColor: theme.card }
                ]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleGenderChange('female');
                }}
              >
                <Text style={{
                  color: selectedGender === 'female' ? '#fff' : theme.text,
                  fontWeight: 'bold'
                }}>
                  👩 Women
                </Text>
              </ScrollSafeTouchable>
            </LinearGradient>
          </View>
          {/* WELCOME TEXT */}
          <Animated.View style={[styles.welcomeContainer, { transform: [{ scale: welcomeScale }] }]}>
            <Text style={[styles.welcomeText, { color: theme.text }]}>Hi {userName}! 👋</Text>
            <Text style={[styles.welcomeSubtext, { color: theme.textSecondary }]}>What's your vibe today? ✨</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { position: 'relative', zIndex: 10 },
  headerBackground: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerGradient: {
    paddingHorizontal: getResponsiveSize(20),
    paddingVertical: getResponsiveSize(15),
    borderBottomLeftRadius: getResponsiveSize(25),
    borderBottomRightRadius: getResponsiveSize(25),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    borderRadius: getResponsiveSize(15),
    overflow: 'hidden',
  },
  backButtonGradient: {
    padding: getResponsiveSize(12),
    borderRadius: getResponsiveSize(15),
  },
  headerTitleContainer: { alignItems: 'center', flex: 1 },
  headerTitle: {
    fontSize: getResponsiveFontSize(22),
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubtitle: { flexDirection: 'row', alignItems: 'center' },
  headerSubtitleText: {
    fontSize: getResponsiveFontSize(12),
    marginLeft: 4,
    fontWeight: '600',
  },
  placeholder: { width: getResponsiveSize(48) },
  scrollView: { flex: 1, paddingHorizontal: getResponsiveSize(20) },
  genderToggleContainer: {
    marginTop: getResponsiveSize(25),
    marginBottom: getResponsiveSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  genderToggle: {
    flexDirection: 'row',
    borderRadius: getResponsiveSize(25),
    padding: getResponsiveSize(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: getResponsiveSize(14),
    paddingHorizontal: getResponsiveSize(20),
    borderRadius: getResponsiveSize(20),
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  welcomeContainer: { alignItems: 'center', marginBottom: getResponsiveSize(30) },
  welcomeText: {
    fontSize: getResponsiveFontSize(28),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: getResponsiveSize(5),
  },
  welcomeSubtext: {
    fontSize: getResponsiveFontSize(16),
    textAlign: 'center',
    fontWeight: '500',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    marginBottom: getResponsiveSize(20),
    borderRadius: getResponsiveSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  touchableCard: {
    borderRadius: getResponsiveSize(20),
    overflow: 'hidden',
    flex: 1,
  },
  gradientCard: {
    padding: getResponsiveSize(20),
    minHeight: getResponsiveSize(160),
    justifyContent: 'space-between',
    position: 'relative',
    borderRadius: getResponsiveSize(20),
  },
  floatingElements: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  floatingDot: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 50,
  },
  dot1: { width: 30, height: 30, top: 10, right: 10 },
  dot2: { width: 20, height: 20, bottom: 15, left: 15 },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: 50,
  },
  badgeContainer: {
    position: 'absolute', top: 12, left: 12, zIndex: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendIcon: { fontSize: 10, marginRight: 3 },
  trendText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  iconContainer: {
    alignItems: 'center',
    marginTop: getResponsiveSize(25),
    marginBottom: getResponsiveSize(10),
  },
  iconGlow: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
    padding: getResponsiveSize(8),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryIcon: { fontSize: getResponsiveFontSize(32) },
  categoryText: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: getResponsiveSize(4),
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  categoryDescription: {
    fontSize: getResponsiveFontSize(12),
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  bottomIndicator: { alignItems: 'center', marginTop: getResponsiveSize(12) },
  indicatorLine: {
    width: 30,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 2,
  },
  bottomSpacing: { height: getResponsiveSize(30) },
});
