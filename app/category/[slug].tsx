import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import AIAdviceCard from '../../components/AIAdviceCard';
import OutfitCard from '../../components/OutfitCard';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import categoryData from '../../data/categoryData';
import { getOutfitSuggestions, OutfitSuggestion } from '../../services/outfitService';
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

  // Advice state
  const [adviceData, setAdviceData] = useState<any[] | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(true);
  const [adviceError, setAdviceError] = useState(false);


  // Outfit suggestions state
  const [outfitSuggestions, setOutfitSuggestions] = useState<OutfitSuggestion[]>([]);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [outfitError, setOutfitError] = useState(false);

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

  // Fetch advice.json from Firebase Storage
  const fetchAdvice = useCallback(async () => {
    setLoadingAdvice(true);
    setAdviceError(false);
    try {
      const url =
        `https://firebasestorage.googleapis.com/v0/b/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app/o/advice.json?alt=media&token=b40ba6ea-0f83-4298-842e-5bf9ba9e1b84`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch advice data');
      const data = await response.json();
      setAdviceData(data);
    } catch (error) {
      setAdviceData(null);
      setAdviceError(true);
    } finally {
      setLoadingAdvice(false);
    }
  }, []);

  // Fetch outfit suggestions
  const fetchOutfitSuggestions = useCallback(async () => {
    if (!userProfile || !profileComplete || !slug) return;

    // Redirect twinning categories to new twinning screen
    if (slug.toString().toLowerCase().includes('twinning')) {
      router.replace('/twinning');
      return;
    }

    setLoadingOutfits(true);
    setOutfitError(false);
    try {
      console.log('🔍 Fetching outfit suggestions for:', { 
        userProfile: {
          ...userProfile,
          gender: userProfile?.gender
        }, 
        slug: slug.toString(),
        slugType: typeof slug
      });
      const suggestions = await getOutfitSuggestions(userProfile, slug.toString());
      console.log('🔍 Got outfit suggestions:', suggestions.length, 'suggestions');
      setOutfitSuggestions(suggestions);
    } catch (error) {
      console.error('Error fetching outfit suggestions:', error);
      setOutfitError(true);
      setOutfitSuggestions([]);
    } finally {
      setLoadingOutfits(false);
    }
  }, [userProfile, profileComplete, slug]);

  useEffect(() => {
    loadUserData();
    fetchAdvice();
  }, [loadUserData, fetchAdvice, user?.uid]); // Added user?.uid to ensure reload on user change

  // Fetch outfit suggestions when profile is complete
  useEffect(() => {
    if (profileComplete && userProfile) {
      console.log('🔄 Profile changed, refetching outfit suggestions with gender:', userProfile.gender);
      fetchOutfitSuggestions();
    }
  }, [fetchOutfitSuggestions, profileComplete, userProfile]);

  // Use useFocusEffect to handle screen focus properly
  useFocusEffect(
    useCallback(() => {
      // Reset animation values when screen comes into focus
      resetAnimationValues();
      startEntranceAnimations();
      
      // Reload user data when screen comes into focus (e.g., after profile edit)
      loadUserData();

      return () => {
        // Cleanup when screen loses focus
        setIsExiting(false);
      };
    }, [loadUserData])
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
      fetchAdvice(),
      profileComplete ? fetchOutfitSuggestions() : Promise.resolve()
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

  // --- Enhanced Advice Filtering Logic ---
  function extractGenderFromCategorySlug(categorySlug: string): string | null {
    const categoryLower = categorySlug.toLowerCase();
    
    if (categoryLower.includes('male-') || categoryLower.startsWith('male')) {
      return 'male';
    }
    
    if (categoryLower.includes('female-') || categoryLower.startsWith('female')) {
      return 'female';
    }
    
    return null;
  }

  function normalizeHeight(height: string | number): string {
    const num = Number(height);
    if (!isNaN(num)) {
      if (num < 165) return 'short';
      if (num <= 180) return 'average';
      return 'tall';
    }
    return '';
  }

  function normalizeBodyType(bodyType: string): string {
    if (!bodyType) return 'slim';
    const type = bodyType.toLowerCase();
    // Map bodyType to weight categories used in database
    switch (type) {
      case 'slim':
      case 'thin':
      case 'skinny':
        return 'slim';
      case 'athletic':
      case 'muscular':
      case 'fit':
        return 'average';
      case 'heavy':
      case 'chubby':
      case 'plus':
        return 'heavy';
      case 'obese':
        return 'obese';
      default:
        return 'slim';
    }
  }

  function mapCategoryToStyle(categorySlug: string): string {
    // Map current category to style based on category
    const slug = categorySlug.toLowerCase();
    
    if (slug.includes('street')) return 'street';
    if (slug.includes('formal')) return 'formal';
    if (slug.includes('ethnic')) return 'ethnic';
    if (slug.includes('party')) return 'party';
    if (slug.includes('gym')) return 'gym';
    if (slug.includes('office')) return 'formal';
    if (slug.includes('elegant')) return 'elegant';
    
    // Direct mappings
    const mappings: { [key: string]: string } = {
      'street-style': 'street',
      'formal-wear': 'formal',
      'ethnic-wear': 'ethnic',
      'party-wear': 'party',
      'gym-wear': 'gym',
      'office-wear': 'formal',
      'elegant-wear': 'elegant'
    };
    
    return mappings[slug] || 'casual';
  }

  function mapCategorySlugToDbCategory(categorySlug: string): string {
    // Map URL slugs to database category names
    const slug = categorySlug.toLowerCase();

    // Handle combined slugs like "male-street-style" -> "street style"
    if (slug.includes('street')) {
      return 'street style';
    }
    if (slug.includes('formal')) {
      return 'formal wear';
    }
    if (slug.includes('ethnic')) {
      return 'ethnic wear';
    }
    if (slug.includes('party')) {
      return 'party wear';
    }
    if (slug.includes('gym')) {
      return 'gym wear';
    }
    if (slug.includes('office')) {
      return 'office wear';
    }
    if (slug.includes('elegant')) {
      return 'elegant wear';
    }

    // Direct mappings
    const mappings: { [key: string]: string } = {
      'street-style': 'street style',
      'formal-wear': 'formal wear',
      'ethnic-wear': 'ethnic wear',
      'party-wear': 'party wear',
      'gym-wear': 'gym wear',
      'office-wear': 'office wear',
      'elegant-wear': 'elegant wear'
    };

    return mappings[slug] || slug;
  }

  function filterAdvice(adviceArr: any[], userProfile: any, categorySlug: string) {
    console.log('🔍 Starting filter with:', {
      userProfile,
      categorySlug,
      totalAdviceEntries: adviceArr.length
    });

    // Step 1: Extract gender from category slug if present
    const categoryGender = extractGenderFromCategorySlug(categorySlug);
    const userGender = userProfile.gender ? userProfile.gender.toLowerCase() : 'male';
    const finalGender = categoryGender || userGender;

    console.log('🎯 Gender extraction:', {
      categorySlug,
      categoryGender,
      userGender,
      finalGender
    });

    // Step 2: Map category slug to database category name
    const dbCategory = mapCategorySlugToDbCategory(categorySlug);
    console.log('🗂️ Mapped category:', categorySlug, '->', dbCategory);
    
    // Debug: Show all available categories in database
    const availableCategories = [...new Set(adviceArr.map(entry => entry.category))];
    console.log('📋 Available categories in database:', availableCategories);

    // Step 3: Filter by category first - try exact match first
    let categoryMatches = adviceArr.filter(entry =>
      entry.category && entry.category.toLowerCase() === dbCategory.toLowerCase()
    );

    console.log('📂 Exact category matches found:', categoryMatches.length);

    // If no exact matches, try partial matches
    if (categoryMatches.length === 0) {
      console.log('❌ No exact category matches, trying partial matches...');
      categoryMatches = adviceArr.filter(entry =>
        entry.category && entry.category.toLowerCase().includes(dbCategory.toLowerCase())
      );
      console.log('📂 Partial category matches found:', categoryMatches.length);
    }

    // If still no matches, try reverse partial matching (database category contains slug)
    if (categoryMatches.length === 0) {
      console.log('❌ No partial matches, trying reverse matching...');
      const categoryKeywords = dbCategory.toLowerCase().split(' ');
      categoryMatches = adviceArr.filter(entry => {
        if (!entry.category) return false;
        const entryCategory = entry.category.toLowerCase();
        return categoryKeywords.some(keyword => entryCategory.includes(keyword));
      });
      console.log('📂 Reverse matches found:', categoryMatches.length);
    }

    if (categoryMatches.length === 0) {
      console.log('❌ No category matches found at all');
      return null;
    }

    // Step 4: Build user attributes for matching (using extracted gender)
    const userAttributes = {
      gender: finalGender,
      height: userProfile.height ? normalizeHeight(userProfile.height) : 'short',
      weight: normalizeBodyType(userProfile.bodyType),
      skinTone: userProfile.skinTone ? userProfile.skinTone.toLowerCase() : 'fair',
      style: mapCategoryToStyle(categorySlug) // Use category-based style
    };

    console.log('👤 User attributes:', userAttributes);

    // Step 3: Score each category match
    let bestMatch = null;
    let maxScore = 0;
    let allMatches = [];

    for (const entry of categoryMatches) {
      const forArr = entry.for ? entry.for.map((f: string) => f.toLowerCase()) : [];
      let score = 0;
      let matchDetails = [];

      // Check each attribute match (database structure: [gender, height, weight, skinTone, style])
      if (forArr.length >= 5) {
        // Gender match
        if (forArr[0] === userAttributes.gender) {
          score += 10;
          matchDetails.push(`gender: ${userAttributes.gender}`);
        }

        // Height match
        if (forArr[1] === userAttributes.height) {
          score += 8;
          matchDetails.push(`height: ${userAttributes.height}`);
        }

        // Weight/Body type match
        if (forArr[2] === userAttributes.weight) {
          score += 15; // Higher weight for body type as it's most important
          matchDetails.push(`weight: ${userAttributes.weight}`);
        }

        // Skin tone match
        if (forArr[3] === userAttributes.skinTone) {
          score += 12;
          matchDetails.push(`skinTone: ${userAttributes.skinTone}`);
        }

        // Style match
        if (forArr[4] === userAttributes.style) {
          score += 5;
          matchDetails.push(`style: ${userAttributes.style}`);
        }
      }

      allMatches.push({
        entry,
        score,
        matchDetails,
        forFields: forArr,
        userAttributes
      });

      if (score > maxScore) {
        maxScore = score;
        bestMatch = entry;
      }
    }

    // Sort by score for debugging
    allMatches.sort((a, b) => b.score - a.score);
    console.log('🎯 Top 3 matches:', allMatches.slice(0, 3).map(m => ({
      score: m.score,
      matches: m.matchDetails,
      forFields: m.forFields,
      category: m.entry.category,
      advicePreview: m.entry.advice?.slice(0, 1) // Show first advice item
    })));
    console.log('🏆 Best Match Score:', maxScore);
    console.log('🥇 Selected Advice Category:', bestMatch?.category);
    console.log('🎯 Selected Advice Preview:', bestMatch?.advice?.slice(0, 2));

    // Return best match if we have a good score, otherwise first category match
    const finalResult = bestMatch && maxScore > 0 ? bestMatch : categoryMatches[0];
    
    console.log('✅ Final result:', {
      category: finalResult?.category,
      score: bestMatch === finalResult ? maxScore : 0,
      adviceCount: finalResult?.advice?.length || 0
    });
    
    return finalResult;
  }

  const filteredAdviceObj =
    adviceData && profileComplete && userProfile
      ? filterAdvice(adviceData, userProfile, slug as string)
      : null;

  const filteredAdvice = filteredAdviceObj ? filteredAdviceObj.advice : [];
  const adviceSources = filteredAdviceObj ? filteredAdviceObj.source : [];

  // All outfit-related functions removed - focusing on AI advice only

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
            {/* AI Advice Section */}
            {loadingAdvice ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.text }]}>
                  Loading your personalized AI advice...
                </Text>
              </View>
            ) : adviceError ? (
              <View style={styles.loaderContainer}>
                <Text style={[styles.loadingText, { color: theme.text }]}>
                  Could not load AI advice.
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={fetchAdvice}
                >
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text
                    style={{
                      color: '#fff',
                      fontWeight: 'bold',
                      marginLeft: 6,
                    }}
                  >
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <AIAdviceCard
                advice={filteredAdvice}
                sources={adviceSources}
                isProfileComplete={!!profileComplete}
                theme={theme}
              />
            )}

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
                      onPress={fetchOutfitSuggestions}
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
              <Text style={[styles.aiOnlyMessage, { color: theme.primary }]}>
                🤖 Get personalized AI advice for this style category
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
