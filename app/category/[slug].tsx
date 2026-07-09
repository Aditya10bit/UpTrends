import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OutfitCard from '../../components/OutfitCard';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import categoryData from '../../data/categoryData';
import { getOutfitSuggestions, OutfitSuggestion } from '../../services/outfitService';
import { getActiveKeySource } from '../../services/geminiService';
import {
    getUserProfile
} from '../../services/userService';

// Responsive utilities
const { width: screenWidth } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / 375;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

// PAGE_SIZE removed - no longer needed without dummy outfits

export default function CategoryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // User profile state
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Advice feature removed - using only Gemini outfit suggestions


  // Outfit suggestions state
  const [outfitSuggestions, setOutfitSuggestions] = useState<OutfitSuggestion[]>([]);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [outfitError, setOutfitError] = useState(false);

  // Caching state
  const [cachedData, setCachedData] = useState<{
    [key: string]: {
      suggestions: OutfitSuggestion[];
      timestamp: number;
      userProfileHash: string;
    }
  }>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const screenOpacity = useSharedValue(1);
  const screenTranslateY = useSharedValue(0);

  // BackHandler removed to fix compatibility issues with React Native 0.79.4
  // The default back navigation behavior will work fine without custom handling

  const profileComplete =
    userProfile?.height && userProfile?.weight && userProfile?.bodyType && userProfile?.skinTone && userProfile?.gender;

  console.log('🔍 Profile Completeness Check:');
  console.log('  - userProfile:', userProfile);
  console.log('  - height:', userProfile?.height);
  console.log('  - weight:', userProfile?.weight);
  console.log('  - bodyType:', userProfile?.bodyType);
  console.log('  - skinTone:', userProfile?.skinTone);
  console.log('  - gender:', userProfile?.gender);
  console.log('  - profileComplete:', profileComplete);

  // Load user profile
  const loadUserData = useCallback(async () => {
    if (!user?.uid) {
      setLoadingProfile(false);
      return;
    }
    try {
      const profile = await getUserProfile(user.uid);
      console.log('🔍 DEBUG: Loaded user profile:', profile);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.uid]);

  // fetchAdvice removed - no longer fetching from Firebase

  // Helper function to create user profile hash for cache validation
  const createUserProfileHash = useCallback((profile: any): string => {
    if (!profile) return '';
    return `${profile.gender}-${profile.height}-${profile.weight}-${profile.bodyType}-${profile.skinTone}`;
  }, []);

  // Fetch outfit suggestions with caching
  const fetchOutfitSuggestions = useCallback(async (forceRefresh: boolean = false) => {
    if (!userProfile || !profileComplete || !slug) return;

    // Redirect twinning categories to new twinning screen
    if (slug.toString().toLowerCase().includes('twinning')) {
      router.replace('/twinning');
      return;
    }

    const cacheKey = `${slug.toString()}-${user?.uid}`;
    const userProfileHash = createUserProfileHash(userProfile);
    const now = Date.now();
    const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

    // Check if we have valid cached data
    const cached = cachedData[cacheKey];
    if (!forceRefresh && cached &&
      (now - cached.timestamp < CACHE_DURATION) &&
      cached.userProfileHash === userProfileHash &&
      cached.suggestions.length > 0) {
      console.log('🎯 Using cached outfit suggestions for:', slug.toString());
      setOutfitSuggestions(cached.suggestions);
      setOutfitError(false);
      return;
    }

    // Only fetch if we haven't fetched recently (prevent rapid refetches)
    if (!forceRefresh && (now - lastFetchTime < 5000)) { // 5 seconds cooldown
      console.log('⏱️ Skipping fetch - too recent');
      return;
    }

    setLoadingOutfits(true);
    setOutfitError(false);
    setLastFetchTime(now);

    try {
      console.log('🔍 Fetching outfit suggestions for:', {
        userProfile: {
          ...userProfile,
          gender: userProfile?.gender
        },
        slug: slug.toString(),
        slugType: typeof slug,
        cached: !!cached,
        forceRefresh
      });

      const suggestions = await getOutfitSuggestions(userProfile, slug.toString());
      console.log('🔍 Got outfit suggestions:', suggestions.length, 'suggestions');

      setOutfitSuggestions(suggestions);

      // Cache the results
      setCachedData(prev => ({
        ...prev,
        [cacheKey]: {
          suggestions,
          timestamp: now,
          userProfileHash
        }
      }));

    } catch (error: any) {
      console.error('Error fetching outfit suggestions:', error);
      const errorMsg = error?.message || '';
      const isQuotaError = errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Max retries exceeded');
      if (isQuotaError) {
        const keySource = await getActiveKeySource();
        if (keySource === 'default') {
          Alert.alert(
            'AI Limit Reached \u26a1',
            'The shared AI quota has been reached. Set up your own free API key for unlimited access!\n\nIt only takes 1 minute.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Set Up My Key', onPress: () => router.push('/profile') }
            ]
          );
        } else {
          Alert.alert('Quota Exceeded', 'Your API key has hit its rate limit. Please wait a moment and try again.', [{ text: 'OK' }]);
        }
      }
      setOutfitError(true);
      setOutfitSuggestions([]);
    } finally {
      setLoadingOutfits(false);
    }
  }, [userProfile, profileComplete, slug, cachedData, createUserProfileHash, user?.uid, lastFetchTime]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData, user?.uid]);

  // Fetch outfit suggestions when profile is complete
  useEffect(() => {
    if (profileComplete && userProfile) {
      console.log('🔄 Profile changed, checking cached outfit suggestions with gender:', userProfile.gender);
      fetchOutfitSuggestions(false); // Don't force refresh, use cache if available
    }
  }, [fetchOutfitSuggestions, profileComplete, userProfile]);

  // Use useFocusEffect to handle screen focus properly
  useFocusEffect(
    useCallback(() => {
      // Reset animation values when screen comes into focus
      resetAnimationValues();
      startEntranceAnimations();

      // Only reload user data if we don't have it, don't refetch outfit suggestions
      if (!userProfile) {
        loadUserData();
      }

      return () => {
        // Cleanup when screen loses focus
        setIsExiting(false);
      };
    }, [loadUserData, userProfile])
  );

  const resetAnimationValues = () => {
    screenOpacity.value = 1;
    screenTranslateY.value = 0;
    fadeAnim.value = 0;
    slideAnim.value = 50;
  };

  const startEntranceAnimations = () => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
  };

  const startExitAnimation = (callback: () => void) => {
    if (isExiting) return;
    setIsExiting(true);

    screenOpacity.value = withTiming(0, { duration: 250 });
    screenTranslateY.value = withTiming(-30, { duration: 250 });

    setTimeout(() => {
      callback();
    }, 250);
  };

  const handleOutfitPress = (outfit: any) => {
    if (isExiting) return; // Prevent double-tap

    router.push({
      pathname: '/outfit-detail',
      params: {
        outfit: JSON.stringify(outfit),
      },
    });
  };

  const category = categoryData[slug as string];

  // No more dummy outfits - focusing on AI advice only

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserData(),
      profileComplete ? fetchOutfitSuggestions(true) : Promise.resolve()
    ]);
    setRefreshing(false);
  };

  // Outfit favorites functionality removed - focusing on AI advice only

  if (!category) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <Text style={{ color: theme.text, fontSize: 18 }}>
          Category not found!
        </Text>
      </View>
    );
  }

  // Helper functions removed - no longer needed for advice filtering

  // filterAdvice function removed - no longer using Firebase advice data

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.container, { backgroundColor: theme.background }, screenAnimatedStyle]}>
        <StatusBar
          barStyle={
            theme.background === '#18181b' ? 'light-content' : 'dark-content'
          }
          backgroundColor={theme.background}
        />
        {/* Header */}
        <View style={[styles.modernHeader, { paddingTop: insets.top + 8 }]}>
          <LinearGradient
            colors={category.colors}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              <Ionicons
                name="arrow-back"
                size={24}
                color="#fff"
                onPress={() => {
                  if (isExiting) return;
                  startExitAnimation(() => {
                    router.back();
                  });
                }}
                style={styles.backButton}
              />
              <View style={styles.headerTitleSection}>
                <Text style={styles.headerIcon}>{category.icon}</Text>
                <Text style={[styles.headerTitle, { color: '#fff' }]}>
                  {category.title}
                </Text>
                <Text
                  style={[
                    styles.headerDescription,
                    { color: 'rgba(255,255,255,0.9)' },
                  ]}
                >
                  {category.description}
                </Text>
              </View>
              <View style={styles.headerBadge}>
                <Text style={styles.trendBadge}>{category.trend}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
        {/* Main Content */}
        <Animated.View style={{ flex: 1 }}>
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
                title="Refreshing..."
                titleColor={theme.primary}
              />
            }
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Outfit Suggestions */}
            {!slug?.toString().toLowerCase().includes('twinning') && (
              <>
                {loadingOutfits ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.loadingText, { color: theme.text }]}>
                      Generating personalized outfit suggestions...
                    </Text>
                  </View>
                ) : outfitError ? (
                  <View style={styles.loaderContainer}>
                    <Ionicons name="cloud-offline" size={48} color={theme.textSecondary} />
                    <Text style={[styles.loadingText, { color: theme.text, textAlign: 'center', marginTop: 12 }]}>
                      AI service is temporarily busy. {'\n'}Showing fallback suggestions instead.
                    </Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => fetchOutfitSuggestions(true)}
                    >
                      <Ionicons name="refresh" size={18} color="#fff" />
                      <Text
                        style={{
                          color: '#fff',
                          fontWeight: 'bold',
                          marginLeft: 6,
                        }}
                      >
                        Try Again
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : outfitSuggestions.length > 0 ? (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Personalized Outfit Suggestions
                      </Text>
                      {outfitSuggestions.some(outfit => outfit.id?.includes('fallback')) && (
                        <View style={[styles.fallbackNotice, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                          <Ionicons name="information-circle" size={16} color={theme.primary} />
                          <Text style={[styles.fallbackText, { color: theme.textSecondary }]}>
                            AI is busy - showing curated suggestions
                          </Text>
                        </View>
                      )}
                    </View>
                    {outfitSuggestions.map((outfit, index) => (
                      <OutfitCard
                        key={outfit.id || index}
                        outfit={outfit}
                        index={index}
                        onPress={handleOutfitPress}
                        theme={theme}
                      />
                    ))}
                  </>
                ) : profileComplete ? (
                  <View style={styles.loaderContainer}>
                    <Text style={[styles.loadingText, { color: theme.text }]}>
                      No outfit suggestions available for this category.
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            {/* Category Info */}
            <View style={[styles.categoryInfo, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
              <Text style={[styles.categoryTitle, { color: theme.text }]}>
                {category.title}
              </Text>
              <Text style={[styles.categoryDescription, { color: theme.textSecondary }]}>
                {category.description}
              </Text>
            </View>

            <View style={styles.bottomSpacing} />
          </ScrollView>
        </Animated.View>

      </Animated.View>


    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modernHeader: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  headerGradient: {
    paddingHorizontal: getResponsiveSize(20),
    paddingVertical: getResponsiveSize(16),
    paddingBottom: getResponsiveSize(20),
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
    marginHorizontal: getResponsiveSize(15),
  },
  headerIcon: {
    fontSize: getResponsiveFontSize(40),
    marginBottom: getResponsiveSize(8),
  },
  headerTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(4),
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerDescription: {
    fontSize: getResponsiveFontSize(14),
    textAlign: 'center',
  },
  headerBadge: { alignItems: 'flex-end' },
  trendBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scrollContent: {
    paddingTop: getResponsiveSize(16),
    paddingBottom: getResponsiveSize(100),
    paddingHorizontal: getResponsiveSize(4)
  },
  categoryInfo: {
    marginHorizontal: getResponsiveSize(16),
    marginVertical: getResponsiveSize(12),
    padding: getResponsiveSize(16),
    borderRadius: getResponsiveSize(12),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(8),
    textAlign: 'center',
  },
  categoryDescription: {
    fontSize: getResponsiveFontSize(16),
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: getResponsiveSize(16),
  },
  aiOnlyMessage: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getResponsiveSize(32),
    paddingHorizontal: getResponsiveSize(16),
    marginHorizontal: getResponsiveSize(16),
  },
  loadingText: {
    fontSize: getResponsiveFontSize(16),
    marginTop: getResponsiveSize(12),
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: getResponsiveSize(20),
    paddingVertical: getResponsiveSize(10),
    borderRadius: getResponsiveSize(20),
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: getResponsiveSize(16),
  },
  bottomSpacing: {
    height: getResponsiveSize(80),
  },
  profileLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: getResponsiveSize(16),
    marginBottom: 10,
  },
  profileLoadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  profileIncompleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: getResponsiveSize(16),
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  profileIncompleteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  statCard: {
    padding: getResponsiveSize(16),
    borderRadius: getResponsiveSize(16),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    minWidth: getResponsiveSize(80),
  },
  statNumber: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(4),
  },
  statLabel: {
    fontSize: getResponsiveFontSize(12),
    fontWeight: '500',
  },
  sectionHeader: {
    marginHorizontal: getResponsiveSize(16),
    marginTop: getResponsiveSize(8),
    marginBottom: getResponsiveSize(12),
  },
  sectionTitle: {
    fontSize: getResponsiveFontSize(22),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(12),
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: getResponsiveSize(12),
    borderRadius: getResponsiveSize(8),
    borderWidth: 1,
    gap: 8,
  },
  fallbackText: {
    fontSize: getResponsiveFontSize(13),
    fontWeight: '500',
  },
  outfitCard: {
    borderRadius: getResponsiveSize(16),
    marginBottom: getResponsiveSize(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    marginHorizontal: getResponsiveSize(16),
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outfitInfo: {
    flex: 1,
    marginRight: 12,
  },
  outfitName: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
    marginBottom: 4,
  },
  outfitItems: {
    fontSize: getResponsiveFontSize(14),
    marginBottom: 6,
  },
  outfitPrice: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: 'bold',
    marginBottom: 4,
  },
  trendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  trendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardActions: {
    alignItems: 'center',
    gap: 8,
  },
  heartButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

});
