import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AIAdviceCard from '../../components/AIAdviceCard';
import AIAdviceModal from '../../components/AIAdviceModal';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import categoryData from '../../data/categoryData';
import {
  getUserFavorites,
  getUserProfile,
  removeFavoriteOutfit,
  saveFavoriteOutfit,
} from '../../services/userService';

// Responsive utilities
const { width: screenWidth } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / 375;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

const PAGE_SIZE = 5;

export default function CategoryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // User profile & favorites state
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [userFavorites, setUserFavorites] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Advice state
  const [adviceData, setAdviceData] = useState<any[] | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(true);
  const [adviceError, setAdviceError] = useState(false);
  const [adviceModalVisible, setAdviceModalVisible] = useState(false);

  // Pagination state
  const [outfitPage, setOutfitPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);

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

  // Load user profile and favorites
  const loadUserData = useCallback(async () => {
    if (!user?.uid) {
      setLoadingProfile(false);
      return;
    }
    try {
      const [profile, favorites] = await Promise.all([
        getUserProfile(user.uid),
        getUserFavorites(user.uid),
      ]);
      console.log('🔍 DEBUG: Loaded user profile:', profile);
      setUserProfile(profile);
      setUserFavorites(favorites || []);
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
        'https://firebasestorage.googleapis.com/v0/b/uptrends-f893f.firebasestorage.app/o/advice.json?alt=media&token=b40ba6ea-0f83-4298-842e-5bf9ba9e1b84';
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

  useEffect(() => {
    loadUserData();
    fetchAdvice();
    fadeAnim.value = withTiming(1, { duration: 800 });
    slideAnim.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
  }, [loadUserData, fetchAdvice, fadeAnim, slideAnim]);

  const category = categoryData[slug as string];

  // Pagination logic for outfits
  const [paginatedOutfits, setPaginatedOutfits] = useState<any[]>([]);
  useEffect(() => {
    if (category?.outfits) {
      setPaginatedOutfits(category.outfits.slice(0, PAGE_SIZE));
      setOutfitPage(1);
    }
  }, [slug, category?.outfits]);

  const loadMoreOutfits = () => {
    if (!category?.outfits) return;
    const nextPage = outfitPage + 1;
    const nextOutfits = category.outfits.slice(0, nextPage * PAGE_SIZE);
    if (nextOutfits.length > paginatedOutfits.length) {
      setPaginatedOutfits(nextOutfits);
      setOutfitPage(nextPage);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserData(), fetchAdvice()]);
    if (category?.outfits) {
      setPaginatedOutfits(category.outfits.slice(0, PAGE_SIZE));
      setOutfitPage(1);
    }
    setRefreshing(false);
  };

  const isOutfitFavorited = useCallback(
    (outfit: any) => {
      const outfitId = outfit.id || outfit.name;
      const categorySlug = Array.isArray(slug) ? slug[0] : slug;
      return userFavorites.some(
        (fav) =>
          fav.id === outfitId ||
          fav.name === outfit.name ||
          (fav.categorySlug === categorySlug && fav.name === outfit.name)
      );
    },
    [userFavorites, slug]
  );

  const [isToggling, setIsToggling] = useState(false);

  const toggleFavorite = async (outfit: any) => {
    if (!user?.uid) {
      Alert.alert('Please Login', 'You need to login to save favorites');
      return;
    }
    if (isToggling) return;
    setIsToggling(true);
    const isFavorited = isOutfitFavorited(outfit);
    const categorySlug = Array.isArray(slug) ? slug[0] : slug;
    try {
      if (isFavorited) {
        const favoriteItem = userFavorites.find(
          (fav) =>
            fav.id === (outfit.id || outfit.name) ||
            fav.name === outfit.name ||
            (fav.categorySlug === categorySlug && fav.name === outfit.name)
        );
        if (favoriteItem?.id) {
          const success = await removeFavoriteOutfit(user.uid, favoriteItem.id);
          if (success) {
            setUserFavorites((prev) =>
              prev.filter((fav) => fav.id !== favoriteItem.id)
            );
            Alert.alert('Removed! 💔', `${outfit.name} removed from favorites`);
          } else {
            Alert.alert('Error', 'Failed to remove from favorites');
          }
        }
      } else {
        const alreadyExists = userFavorites.some(
          (fav) => fav.name === outfit.name && fav.categorySlug === categorySlug
        );
        if (alreadyExists) {
          Alert.alert(
            'Already Saved',
            `${outfit.name} is already in your favorites!`
          );
          return;
        }
        const uniqueId = `${categorySlug}_${outfit.name}_${Date.now()}`;
        const success = await saveFavoriteOutfit({
          ...outfit,
          category: category?.title || 'Fashion',
          categorySlug: categorySlug,
          id: uniqueId,
        });
        if (success) {
          const newFavorite = {
            ...outfit,
            category: category?.title || 'Fashion',
            categorySlug: categorySlug,
            savedAt: new Date(),
            id: uniqueId,
          };
          setUserFavorites((prev) => [...prev, newFavorite]);
          Alert.alert('Saved! 💖', `${outfit.name} added to favorites!`);
        } else {
          Alert.alert('Error', 'Failed to save to favorites');
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Something went wrong!');
    } finally {
      setIsToggling(false);
    }
  };

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

  function mapStylePreference(userProfile: any): string {
    // Map user's preferredStyle to database style categories
    const preferredStyle = userProfile.preferredStyle?.toLowerCase();
    switch (preferredStyle) {
      case 'formal':
        return 'formal';
      case 'casual':
        return 'casual';
      case 'street':
      case 'streetwear':
        return 'street';
      case 'ethnic':
      case 'traditional':
        return 'ethnic';
      case 'party':
      case 'festive':
        return 'party';
      case 'gym':
      case 'sports':
      case 'athletic':
        return 'gym';
      case 'elegant':
      case 'classy':
        return 'elegant';
      default:
        return 'casual'; // Default fallback
    }
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
    
    // Step 1: Map category slug to database category name
    const dbCategory = mapCategorySlugToDbCategory(categorySlug);
    console.log('🗂️ Mapped category:', categorySlug, '->', dbCategory);
    
    // Step 2: Filter by category first
    const categoryMatches = adviceArr.filter(entry => 
      entry.category && entry.category.toLowerCase() === dbCategory.toLowerCase()
    );
    
    console.log('📂 Category matches found:', categoryMatches.length);
    
    if (categoryMatches.length === 0) {
      console.log('❌ No exact category matches found, attempting partial match');
      return adviceArr.find(entry => entry.category && entry.category.toLowerCase().includes(dbCategory.toLowerCase())) || null;
    }
    
    // Step 2: Build user attributes for matching
    const userAttributes = {
      gender: userProfile.gender ? userProfile.gender.toLowerCase() : 'male',
      height: userProfile.height ? normalizeHeight(userProfile.height) : 'short',
      weight: normalizeBodyType(userProfile.bodyType),
      skinTone: userProfile.skinTone ? userProfile.skinTone.toLowerCase() : 'fair',
      style: mapStylePreference(userProfile)
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
        
        // Style preference match
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
      forFields: m.forFields
    })));
    console.log('🏆 Best Match Score:', maxScore);
    console.log('🥇 Selected Advice Category:', bestMatch?.category);
    
    // Return best match if we have a good score, otherwise first category match
    return bestMatch && maxScore > 0 ? bestMatch : categoryMatches[0];
  }

  const filteredAdviceObj =
    adviceData && profileComplete && userProfile
      ? filterAdvice(adviceData, userProfile, slug as string)
      : null;

  const filteredAdvice = filteredAdviceObj ? filteredAdviceObj.advice : [];
  const adviceSources = filteredAdviceObj ? filteredAdviceObj.source : [];

  const handleTryThis = (outfit: any) => {
    const isFavorited = isOutfitFavorited(outfit);
    Alert.alert(
      outfit.name,
      `Outfit Details:\n\nItems: ${outfit.items}\nPrice Range: ${outfit.price}\nPopularity: ${outfit.popularity}%\n\nTags: ${outfit.tags.join(
        ', '
      )}`,
      [
        {
          text: isFavorited
            ? '💔 Remove from Favorites'
            : '💖 Save to Favorites',
          onPress: () => toggleFavorite(outfit),
          style: isFavorited ? 'destructive' : 'default',
        },
        {
          text: '📱 Share',
          onPress: () => Alert.alert('Share', 'Coming soon! 📱'),
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  // Animated outfit card component
  const AnimatedOutfitCard = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const isFavorited = isOutfitFavorited(item);
    const heartScale = useSharedValue(1);
    const cardScale = useSharedValue(1);

    const animateHeart = () => {
      heartScale.value = withSpring(1.3, { damping: 10 }, () => {
        heartScale.value = withSpring(1);
      });
    };

    const heartAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: heartScale.value }],
    }));

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: cardScale.value }],
      opacity: fadeAnim.value,
    }));

    const handleHeartPress = () => {
      if (!isToggling) {
        animateHeart();
        runOnJS(toggleFavorite)(item);
      }
    };

    const handleCardPress = () => {
      cardScale.value = withSpring(0.95, { damping: 15 }, () => {
        cardScale.value = withSpring(1);
      });
      runOnJS(handleTryThis)(item);
    };

    return (
      <Animated.View
        style={[
          styles.outfitCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.borderLight,
          },
          cardAnimatedStyle,
        ]}
      >
        <TouchableOpacity
          style={styles.cardContent}
          onPress={handleCardPress}
          activeOpacity={0.9}
        >
          <View style={styles.outfitInfo}>
            <Text style={[styles.outfitName, { color: theme.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.outfitItems, { color: theme.textSecondary }]}>
              {item.items}
            </Text>
            <Text style={[styles.outfitPrice, { color: theme.primary }]}>
              {item.price}
            </Text>
            {item.trending && (
              <View
                style={[styles.trendingBadge, { backgroundColor: theme.error }]}
              >
                <Text style={styles.trendingText}>🔥 Trending</Text>
              </View>
            )}
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={handleHeartPress}
              style={[
                styles.heartButton,
                {
                  backgroundColor: isFavorited
                    ? theme.error + '20'
                    : theme.background,
                  borderColor: isFavorited ? theme.error : theme.borderLight,
                  borderWidth: isFavorited ? 2 : 1,
                },
              ]}
              activeOpacity={0.7}
            >
              <Animated.View style={heartAnimatedStyle}>
                <Ionicons
                  name={isFavorited ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isFavorited ? theme.error : theme.textTertiary}
                />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tryButton, { backgroundColor: theme.primary }]}
              onPress={handleCardPress}
              activeOpacity={0.8}
            >
              <Text style={styles.tryButtonText}>Try This</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderOutfitCard = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => <AnimatedOutfitCard item={item} index={index} />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar
          barStyle={
            theme.background === '#18181b' ? 'light-content' : 'dark-content'
          }
          backgroundColor={theme.background}
        />
        {/* Header */}
        <View style={[styles.modernHeader, { paddingTop: insets.top }]}>
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
                onPress={() => router.back()}
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
          <FlatList
            ListHeaderComponent={
              <>
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
                    onExpand={() => setAdviceModalVisible(true)}
                    isProfileComplete={!!profileComplete}
                    theme={theme}
                  />
                )}

                {/* Stats Section */}
                <View style={styles.statsSection}>
                  <View
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.borderLight,
                      },
                    ]}
                  >
                    <Text style={[styles.statNumber, { color: theme.primary }]}>
                      {category.outfits.length}
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: theme.textSecondary }]}
                    >
                      Outfits
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.borderLight,
                      },
                    ]}
                  >
                    <Text style={[styles.statNumber, { color: theme.primary }]}>
                      {Math.round(
                        category.outfits.reduce(
                          (acc: number, outfit: any) =>
                            acc + outfit.popularity,
                          0
                        ) / category.outfits.length
                      )}
                      %
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: theme.textSecondary }]}
                    >
                      Avg Rating
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.borderLight,
                      },
                    ]}
                  >
                    <Text style={[styles.statNumber, { color: theme.primary }]}>
                      {
                        category.outfits.filter(
                          (outfit: any) => outfit.trending
                        ).length
                      }
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: theme.textSecondary }]}
                    >
                      Trending
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Trending Outfits
                </Text>
              </>
            }
            data={paginatedOutfits}
            renderItem={renderOutfitCard}
            keyExtractor={(item, index) => `${item.id || item.name}_${index}`}
            onEndReached={loadMoreOutfits}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              paginatedOutfits.length < category.outfits.length ? (
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={{ color: theme.textTertiary, marginTop: 6 }}>
                    Loading more outfits...
                  </Text>
                </View>
              ) : (
                <View style={styles.bottomSpacing} />
              )
            }
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
          />
        </Animated.View>

        {/* AI Advice Modal (ALWAYS AT ROOT LEVEL!) */}
        <AIAdviceModal
          visible={adviceModalVisible}
          onClose={() => setAdviceModalVisible(false)}
          advice={filteredAdvice}
          sources={adviceSources}
          theme={theme}
        />
      </View>
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
    paddingVertical: getResponsiveSize(20),
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
  scrollContent: { paddingTop: getResponsiveSize(20), paddingBottom: 30 },
  profileLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: getResponsiveSize(20),
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
    marginHorizontal: getResponsiveSize(20),
    marginBottom: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  profileIncompleteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  loaderContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: getResponsiveSize(20),
    marginBottom: getResponsiveSize(30),
    marginTop: 10,
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
  sectionTitle: {
    fontSize: getResponsiveFontSize(22),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(20),
    marginLeft: getResponsiveSize(20),
  },
  outfitCard: {
    borderRadius: getResponsiveSize(20),
    marginBottom: getResponsiveSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    marginHorizontal: getResponsiveSize(20),
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
  bottomSpacing: {
    height: getResponsiveSize(40),
  },
});
