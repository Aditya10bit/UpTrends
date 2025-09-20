import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface TwinningCategory {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  gradient: string[];
  route: string;
  trending?: boolean;
  new?: boolean;
}

const twinningCategories: TwinningCategory[] = [
  {
    id: 'date',
    title: 'Twin for Date',
    subtitle: 'Romantic coordination',
    description: 'Perfect couple outfits for romantic dates and special moments together',
    icon: '💕',
    gradient: ['#ff6b9d', '#c44569'],
    route: '/twinning/date',
    trending: true,
  },
  {
    id: 'friends',
    title: 'Twin with Friends',
    subtitle: 'Squad goals unlocked',
    description: 'Matching styles for friend groups, hangouts, and memorable moments',
    icon: '👯‍♀️',
    gradient: ['#4facfe', '#00f2fe'],
    route: '/twinning/friends',
    new: true,
  },
];

export default function TwinningScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const scaleAnim = useSharedValue(0.8);

  useEffect(() => {
    startAnimations();
  }, []);

  const startAnimations = () => {
    fadeAnim.value = withTiming(1, { duration: 800 });
    slideAnim.value = withSpring(0, { damping: 15, stiffness: 150 });
    scaleAnim.value = withSpring(1, { damping: 12, stiffness: 100 });
  };

  const handleCategoryPress = (category: TwinningCategory) => {
    router.push(category.route as any);
  };

  const handleBack = () => {
    router.back();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [
      { translateY: slideAnim.value },
      { scale: scaleAnim.value },
    ],
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor="#ff6b9d" />

        {/* Header */}
        <LinearGradient
          colors={['#ff6b9d', '#c44569']}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleSection}>
              <Text style={styles.headerTitle}>Twinning</Text>
              <Text style={styles.headerSubtitle}>Perfect coordination made easy</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerIcon}>
                <Ionicons name="heart" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <Animated.View style={[styles.heroSection, animatedStyle]}>
            <LinearGradient
              colors={['rgba(255,107,157,0.1)', 'rgba(196,69,105,0.05)']}
              style={styles.heroGradient}
            >
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                Find Your Perfect Twin Look
              </Text>
              <Text style={[styles.heroDescription, { color: theme.textSecondary }]}>
                Upload photos and get AI-powered coordinated outfit suggestions for any occasion
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Categories Grid */}
          <View style={styles.categoriesContainer}>
            {twinningCategories.map((category, index) => (
              <TwinningCategoryCard
                key={category.id}
                category={category}
                index={index}
                onPress={() => handleCategoryPress(category)}
                theme={theme}
              />
            ))}
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </>
  );
}

interface TwinningCategoryCardProps {
  category: TwinningCategory;
  index: number;
  onPress: () => void;
  theme: any;
}

function TwinningCategoryCard({ category, index, onPress, theme }: TwinningCategoryCardProps) {
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(0);
  const shimmerAnim = useSharedValue(-1);

  useEffect(() => {
    // Staggered entrance animation
    cardOpacity.value = withDelay(
      index * 100,
      withTiming(1, { duration: 600 })
    );

    // Shimmer effect for trending items
    if (category.trending || category.new) {
      shimmerAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 }),
          withTiming(-1, { duration: 1500 })
        ),
        -1,
        true
      );
    }
  }, []);

  const handlePressIn = () => {
    cardScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    cardScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const shimmerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerAnim.value * 200 }],
  }));

  return (
    <Animated.View style={[styles.categoryCard, cardAnimatedStyle]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.categoryTouchable}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={category.gradient as any}
          style={styles.categoryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Shimmer effect for trending/new items */}
          {(category.trending || category.new) && (
            <Animated.View style={[styles.shimmerOverlay, shimmerAnimatedStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                style={styles.shimmerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </Animated.View>
          )}

          {/* Badge */}
          {(category.trending || category.new) && (
            <View style={[
              styles.badge,
              { backgroundColor: category.trending ? '#ff4757' : '#2ed573' }
            ]}>
              <Text style={styles.badgeText}>
                {category.trending ? 'TRENDING' : 'NEW'}
              </Text>
            </View>
          )}

          <View style={styles.categoryContent}>
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
            <Text style={styles.categoryDescription}>{category.description}</Text>
          </View>

          <View style={styles.categoryArrow}>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.8)" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitleSection: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerIcon: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  heroSection: {
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: 24,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  categoryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  categoryTouchable: {
    overflow: 'hidden',
  },
  categoryGradient: {
    padding: 20,
    minHeight: 120,
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: -200,
    right: 0,
    bottom: 0,
    width: 200,
  },
  shimmerGradient: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryContent: {
    flex: 1,
  },
  categoryIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 6,
  },
  categoryDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
  categoryArrow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  bottomSpacing: {
    height: 20,
  },
});