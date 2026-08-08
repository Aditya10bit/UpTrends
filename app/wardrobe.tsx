import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router, Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumBackground from '../components/PremiumBackground';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  addWardrobeItem,
  analyzeWardrobeIntelligence,
  ClosetInsight,
  deleteWardrobeItem,
  generateOutfitsFromWardrobe,
  getFallbackClosetInsight,
  getItemPairings,
  getWardrobe,
  getWardrobeStats,
  toggleFavorite,
  WardrobeItem,
  WardrobeOutfitCombo,
  WardrobeStats,
} from '../services/digitalWardrobeService';
import { getUserProfile } from '../services/userService';
import { getCurrentWeather, WeatherData } from '../services/weatherService';
import { safeApiCall } from '../utils/apiSafeguards';
import { getColorCode } from '../utils/colorResolver';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / 375;
  return Math.max(12, Math.min(size * scale, size * 1.3));
};

const ITEM_SIZE = (screenWidth - 48) / 3;

type FilterType = 'all' | 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory' | 'dress' | 'ethnic' | 'activewear';
type ViewMode = 'grid' | 'outfits' | 'stats';

const filterLabels: Record<FilterType, { label: string; icon: string }> = {
  all: { label: 'All', icon: '👕' },
  top: { label: 'Tops', icon: '👔' },
  bottom: { label: 'Bottoms', icon: '👖' },
  outerwear: { label: 'Jackets', icon: '🧥' },

  footwear: { label: 'Shoes', icon: '👟' },
  accessory: { label: 'Accessories', icon: '⌚' },
  dress: { label: 'Dresses', icon: '👗' },
  ethnic: { label: 'Ethnic', icon: '🪷' },
  activewear: { label: 'Active', icon: '🏃' },
};

const suggestionChips = [
  { label: '☕ Coffee Date', value: 'Casual coffee date vibe' },
  { label: '💼 Board Meeting', value: 'Formal boardroom business meeting' },
  { label: '🌧️ Rainy Day', value: 'Rainy day cozy and waterproof' },
  { label: '🎉 Night Out', value: 'Edgy party night out style' },
  { label: '🏋️ Gym Workout', value: 'Sporty active athletic outfit' },
  { label: '✈️ Travel Vibe', value: 'Comfortable airport travel look' },
];

export default function WardrobeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [stats, setStats] = useState<WardrobeStats | null>(null);
  const [closetInsight, setClosetInsight] = useState<ClosetInsight | null>(null);
  const [analyzingInsight, setAnalyzingInsight] = useState(false);
  const [outfitCombos, setOutfitCombos] = useState<WardrobeOutfitCombo[]>([]);
  const [generatingOutfits, setGeneratingOutfits] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemPairings, setItemPairings] = useState<WardrobeOutfitCombo[]>([]);
  const [loadingPairings, setLoadingPairings] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [customContext, setCustomContext] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startEntryAnimations();
    loadData();
  }, []);

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredItems(wardrobeItems);
    } else {
      setFilteredItems(wardrobeItems.filter(i => i.type === activeFilter));
    }
  }, [activeFilter, wardrobeItems]);

  useEffect(() => {
    if (wardrobeItems.length > 0) {
      setStats(getWardrobeStats(wardrobeItems));
    }
  }, [wardrobeItems]);

  const startEntryAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();

    // FAB pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(fabScale, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(fabScale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [items, profile] = await Promise.all([
        getWardrobe(),
        getUserProfile(),
      ]);
      setWardrobeItems(items);
      setUserProfile(profile);

      // Async fetch weather
      try {
        setLoadingWeather(true);
        let lat = undefined;
        let lon = undefined;

        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          let finalStatus = status;
          if (finalStatus !== 'granted') {
            const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
            finalStatus = reqStatus;
          }
          if (finalStatus === 'granted') {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            lat = loc.coords.latitude;
            lon = loc.coords.longitude;
            console.log('📍 Wardrobe screen got user coordinates:', { lat, lon });
          }
        } catch (locErr) {
          console.log('Location permission or fetching failed, using default:', locErr);
        }

        const weather = await getCurrentWeather(lat, lon);
        setWeatherData(weather);
      } catch (weatherErr) {
        console.error('Failed to load weather in wardrobe:', weatherErr);
      } finally {
        setLoadingWeather(false);
      }
    } catch (error) {
      console.error('Failed to load wardrobe:', error);
    } finally {
      setLoading(false);
    }
  };

  // Runs the one-call AI closet audit. safeApiCall guarantees a fallback (never a crash).
  const runClosetAudit = async () => {
    if (analyzingInsight || wardrobeItems.length === 0) return;
    setAnalyzingInsight(true);
    try {
      const gender = userProfile?.gender || 'male';
      const insight = await safeApiCall(
        () => analyzeWardrobeIntelligence(wardrobeItems, gender),
        getFallbackClosetInsight(wardrobeItems),
        { timeout: 20000, showErrorAlert: false }
      );
      setClosetInsight(insight);
    } catch (error) {
      console.error('Closet audit failed:', error);
      setClosetInsight(getFallbackClosetInsight(wardrobeItems));
    } finally {
      setAnalyzingInsight(false);
    }
  };

  const handleAddItem = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) return;

      setAdding(true);
      const imageUri = result.assets[0].uri;
      const gender = userProfile?.gender || 'male';

      const newItem = await addWardrobeItem(imageUri, gender);
      setWardrobeItems(prev => [newItem, ...prev]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✨ Item Added!',
        `"${newItem.name}" has been added to your closet.\n\nType: ${newItem.subType}\nColor: ${newItem.primaryColor}\nFormality: ${newItem.formality}`,
        [{ text: 'Nice!' }]
      );
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to add item';
      if (errorMessage.includes('Invalid Image')) {
        errorMessage = errorMessage.replace('Error: ', '');
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setAdding(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow camera access to photograph your clothes.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) return;

      setAdding(true);
      const imageUri = result.assets[0].uri;
      const gender = userProfile?.gender || 'male';

      const newItem = await addWardrobeItem(imageUri, gender);
      setWardrobeItems(prev => [newItem, ...prev]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✨ Item Added!',
        `"${newItem.name}" has been added to your closet.`,
        [{ text: 'Nice!' }]
      );
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to add item';
      if (errorMessage.includes('Invalid Image')) {
        errorMessage = errorMessage.replace('Error: ', '');
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = (item: WardrobeItem) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from your wardrobe?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteWardrobeItem(item.id);
            setWardrobeItems(prev => prev.filter(i => i.id !== item.id));
            setShowItemModal(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async (item: WardrobeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newFav = await toggleFavorite(item.id);
    setWardrobeItems(prev =>
      prev.map(i => (i.id === item.id ? { ...i, favorite: newFav } : i))
    );
    if (selectedItem?.id === item.id) {
      setSelectedItem({ ...item, favorite: newFav });
    }
  };

  const handleGenerateOutfits = async (overrideContext?: string) => {
    if (wardrobeItems.length < 2) {
      Alert.alert('Need More Items', 'Add at least 2 items to generate outfit combinations.');
      return;
    }

    try {
      setGeneratingOutfits(true);
      setViewMode('outfits');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const activeContext = overrideContext !== undefined ? overrideContext : customContext;

      let weatherStr = undefined;
      if (weatherData) {
        weatherStr = `${weatherData.temperature}°C, ${weatherData.condition} (${weatherData.description})`;
      }

      const combos = await generateOutfitsFromWardrobe(
        wardrobeItems,
        activeContext.trim() || undefined,
        weatherStr,
        userProfile
      );
      setOutfitCombos(combos);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate outfits');
    } finally {
      setGeneratingOutfits(false);
    }
  };

  const handleItemPress = async (item: WardrobeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
    setShowItemModal(true);
    setItemPairings([]);
  };

  const handleGetPairings = async () => {
    if (!selectedItem) return;
    try {
      setLoadingPairings(true);
      const pairings = await getItemPairings(selectedItem, wardrobeItems, userProfile);
      setItemPairings(pairings);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get pairings');
    } finally {
      setLoadingPairings(false);
    }
  };

  const showAddOptions = () => {
    Alert.alert(
      '📸 Add to Closet',
      'How would you like to add a clothing item?',
      [
        { text: '📷 Take Photo', onPress: handleTakePhoto },
        { text: '🖼️ From Gallery', onPress: handleAddItem },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ─── Render Helpers ─────────────────────────────────────────────────────────

  const resolveImageSource = (item: WardrobeItem) => {
    if (item.imageUri && (item.imageUri.startsWith('http') || item.imageUri.startsWith('file:') || item.imageUri.startsWith('content:'))) {
      return { uri: item.imageUri };
    }
    if (item.imageBase64) {
      return { uri: `data:image/jpeg;base64,${item.imageBase64}` };
    }
    return { uri: item.imageUri };
  };

  const renderWardrobeItem = ({ item, index }: { item: WardrobeItem; index: number }) => {
    const itemAnim = new Animated.Value(0);
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();

    const colorCode = getColorCode(item.primaryColor) || '#888';

    return (
      <Animated.View
        style={{
          opacity: itemAnim,
          transform: [{ scale: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        }}
      >
        <TouchableOpacity
          style={[styles.gridItem, { backgroundColor: theme.card }]}
          onPress={() => handleItemPress(item)}
          activeOpacity={0.8}
        >
          <Image source={resolveImageSource(item)} style={styles.gridImage} />

          {/* Color indicator dot */}
          <View style={[styles.colorDot, { backgroundColor: colorCode }]} />

          {/* Favorite badge */}
          {item.favorite && (
            <View style={styles.favBadge}>
              <Text style={{ fontSize: 10 }}>❤️</Text>
            </View>
          )}

          {/* Item info */}
          <View style={styles.gridItemInfo}>
            <Text
              style={[styles.gridItemName, { color: theme.text }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              style={[styles.gridItemType, { color: theme.textTertiary }]}
              numberOfLines={1}
            >
              {item.subType}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderOutfitCombo = (combo: WardrobeOutfitCombo, index: number) => (
    <View
      key={combo.id}
      style={[styles.comboCard, { backgroundColor: theme.card }]}
    >
      <View style={styles.comboHeader}>
        <Text style={[styles.comboName, { color: theme.text }]}>{combo.name}</Text>
        <View style={[styles.ratingBadge, { backgroundColor: combo.rating >= 80 ? theme.success + '20' : theme.warning + '20' }]}>
          <Text style={{ color: combo.rating >= 80 ? theme.success : theme.warning, fontWeight: '700', fontSize: 13 }}>
            {combo.rating}/100
          </Text>
        </View>
      </View>

      {/* Item thumbnails */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.comboItems}>
        {combo.items.map((item, i) => (
          <View key={`${combo.id}-item-${i}`} style={styles.comboItemThumb}>
            <Image source={resolveImageSource(item)} style={styles.comboImage} />
            <Text style={[styles.comboItemLabel, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Reasoning */}
      <Text style={[styles.comboReasoning, { color: theme.textSecondary }]}>
        {combo.reasoning}
      </Text>

      {/* Styling tips */}
      {combo.stylingTips.length > 0 && (
        <View style={styles.tipsContainer}>
          {combo.stylingTips.slice(0, 2).map((tip, i) => (
            <View key={i} style={[styles.tipChip, { backgroundColor: theme.primary + '15' }]}>
              <Text style={[styles.tipText, { color: theme.primary }]}>💡 {tip}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.comboMeta}>
        <View style={[styles.metaChip, { backgroundColor: theme.accent + '20' }]}>
          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '600' }}>
            {combo.occasion.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <View style={[styles.metaChip, { backgroundColor: theme.secondary + '15' }]}>
          <Text style={{ color: theme.secondary, fontSize: 11, fontWeight: '600' }}>
            🎨 {combo.colorHarmony}
          </Text>
        </View>
        {combo.weatherSuitability ? (
          <View style={[styles.metaChip, { backgroundColor: '#f9731615' }]}>
            <Text style={{ color: '#f97316', fontSize: 11, fontWeight: '600' }}>
              🌡️ {combo.weatherSuitability}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderStats = () => {
    if (!stats) return null;

    return (
      <ScrollView style={styles.statsContainer} showsVerticalScrollIndicator={false}>
        {/* AI Closet Intelligence */}
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>🔮 Closet Intelligence</Text>
            {closetInsight && (
              <TouchableOpacity onPress={runClosetAudit} hitSlop={8} disabled={analyzingInsight}>
                <Ionicons name="refresh" size={18} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>

          {analyzingInsight ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.insightText, { color: theme.textSecondary, marginTop: 12 }]}>
                AI is auditing your closet...
              </Text>
            </View>
          ) : closetInsight ? (
            <View>
              {/* Archetype badge */}
              <View style={[styles.archetypeBadge, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                <Text style={{ fontSize: 28 }}>{closetInsight.archetypeEmoji}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.insightArchetype, { color: theme.text }]}>
                    {closetInsight.archetype}
                  </Text>
                  <Text style={[styles.insightMood, { color: theme.textSecondary }]}>
                    {closetInsight.colorMood}
                  </Text>
                </View>
              </View>

              {/* Strengths */}
              <Text style={[styles.insightSectionLabel, { color: theme.text }]}>💪 Strengths</Text>
              {closetInsight.strengths.map((s, i) => (
                <View key={`str-${i}`} style={styles.insightRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} style={{ marginTop: 2 }} />
                  <Text style={[styles.insightText, { color: theme.textSecondary }]}>{s}</Text>
                </View>
              ))}

              {/* Opportunities */}
              <Text style={[styles.insightSectionLabel, { color: theme.text }]}>💡 Level-Up Tips</Text>
              {closetInsight.opportunities.map((o, i) => (
                <View key={`opp-${i}`} style={styles.insightRow}>
                  <Ionicons name="bulb" size={16} color={theme.warning} style={{ marginTop: 2 }} />
                  <Text style={[styles.insightText, { color: theme.textSecondary }]}>{o}</Text>
                </View>
              ))}

              {/* Signature Look */}
              {closetInsight.signatureLook ? (
                <View style={[styles.signatureBox, { backgroundColor: '#8b5cf6' + '12', borderColor: '#8b5cf6' + '30' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#8b5cf6' }}>✨ Signature Look</Text>
                  <Text style={[styles.insightText, { color: theme.text, marginTop: 5, lineHeight: 20 }]}>
                    {closetInsight.signatureLook}
                  </Text>
                </View>
              ) : null}

              {/* Shopping priority */}
              {closetInsight.shoppingPriority.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={[styles.insightSectionLabel, { color: theme.text }]}>🛍️ Smart Shopping List</Text>
                  {closetInsight.shoppingPriority.map((p, i) => (
                    <View key={`shop-${i}`} style={[styles.priorityRow, { backgroundColor: theme.borderLight + '40' }]}>
                      <Text style={[
                        styles.priorityChip,
                        {
                          backgroundColor: p.priority === 'high' ? theme.error + '20' : p.priority === 'medium' ? theme.warning + '20' : theme.success + '20',
                          color: p.priority === 'high' ? theme.error : p.priority === 'medium' ? theme.warning : theme.success,
                        },
                      ]}>
                        {p.priority.toUpperCase()}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.priorityItem, { color: theme.text }]}>{p.item}</Text>
                        {p.reason ? (
                          <Text style={[styles.priorityReason, { color: theme.textSecondary }]}>{p.reason}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View>
              <Text style={[styles.insightText, { color: theme.textSecondary, lineHeight: 20 }]}>
                One-tap style report: your fashion archetype, strengths, hidden gaps and a smart
                shopping list — built from your actual pieces.
              </Text>
              <TouchableOpacity
                onPress={runClosetAudit}
                disabled={wardrobeItems.length === 0}
                style={[styles.auditBtn, { backgroundColor: theme.primary, opacity: wardrobeItems.length === 0 ? 0.5 : 1 }]}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.auditBtnText}>Analyze My Closet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Outfit Potential */}
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>🧩 Outfit Potential</Text>
            <Text style={[styles.insightMood, { color: theme.textTertiary }]}>distinct looks</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={[styles.outfitCount, { color: theme.primary }]}>{stats.outfitCount}</Text>
            <Text style={[styles.outfitCountLabel, { color: theme.textSecondary, marginBottom: 8, marginLeft: 8 }]}>
              {stats.outfitCount === 1 ? 'outfit you can create today' : 'outfits you can create today'}
            </Text>
          </View>
          <Text style={[styles.insightMood, { color: theme.textSecondary, marginTop: 6 }]}>
            {stats.outfitFormula}
          </Text>
        </View>

        {/* Wardrobe Score */}
        <View style={[styles.scoreCard, { backgroundColor: theme.card }]}>
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scoreGradient}
          >
            <Text style={styles.scoreNumber}>{stats.wardrobeScore}</Text>
            <Text style={styles.scoreLabel}>Wardrobe Score</Text>
          </LinearGradient>
          <View style={styles.scoreDetails}>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreDetailLabel, { color: theme.textSecondary }]}>Items</Text>
              <Text style={[styles.scoreDetailValue, { color: theme.text }]}>{stats.totalItems}</Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreDetailLabel, { color: theme.textSecondary }]}>Versatility</Text>
              <Text style={[styles.scoreDetailValue, { color: theme.text }]}>{stats.versatilityScore}%</Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreDetailLabel, { color: theme.textSecondary }]}>Colors</Text>
              <Text style={[styles.scoreDetailValue, { color: theme.text }]}>{stats.colorDistribution.length}</Text>
            </View>
          </View>
        </View>

        {/* Color Distribution */}
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>🎨 Color Palette</Text>
          <View style={styles.colorPalette}>
            {stats.colorDistribution.slice(0, 8).map((c, i) => (
              <View key={i} style={styles.colorChip}>
                <View style={[styles.colorSwatch, { backgroundColor: getColorCode(c.color) || '#888' }]} />
                <Text style={[styles.colorName, { color: theme.textSecondary }]} numberOfLines={1}>
                  {c.color}
                </Text>
                <Text style={[styles.colorPercent, { color: theme.textTertiary }]}>{c.percentage}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Item Distribution */}
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>📊 Item Breakdown</Text>
          {Object.entries(stats.byType).map(([type, count]) => (
            <View key={type} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: theme.textSecondary }]}>
                {filterLabels[type as FilterType]?.icon || '👕'} {type}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: theme.borderLight }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min((count / stats.totalItems) * 100, 100)}%`,
                      backgroundColor: theme.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barCount, { color: theme.text }]}>{count}</Text>
            </View>
          ))}
        </View>

        {/* Season Readiness */}
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>🌤️ Season Readiness</Text>
          {stats.seasonReadiness.map((s, i) => (
            <View key={i} style={styles.seasonRow}>
              <Text style={[styles.seasonName, { color: theme.text }]}>
                {s.season.charAt(0).toUpperCase() + s.season.slice(1)}
              </Text>
              <View style={[styles.seasonBar, { backgroundColor: theme.borderLight }]}>
                <View
                  style={[
                    styles.seasonFill,
                    {
                      width: `${s.score}%`,
                      backgroundColor: s.score >= 70 ? theme.success : s.score >= 40 ? theme.warning : theme.error,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.seasonPercent, { color: theme.textSecondary }]}>{s.score}%</Text>
            </View>
          ))}
        </View>

        {/* Best Value (cost per wear) */}
        {stats.costPerWear.length > 0 && (
          <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>💎 Best Value Picks</Text>
            {stats.costPerWear.slice(0, 3).map((cpw, i) => (
              <View key={i} style={styles.gapItem}>
                <Ionicons name="pricetag" size={16} color={theme.success} />
                <Text style={[styles.gapText, { color: theme.textSecondary }]}>
                  {cpw.itemName} — spent {cpw.cost} across {cpw.wears} wears ({cpw.cpw}/wear)
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Gap Analysis */}
        {stats.gapAnalysis.length > 0 && (
          <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>🎯 Wardrobe Gaps</Text>
            {stats.gapAnalysis.map((gap, i) => (
              <View key={i} style={[styles.gapItem, { backgroundColor: theme.warning + '10' }]}>
                <Ionicons name="alert-circle" size={16} color={theme.warning} />
                <Text style={[styles.gapText, { color: theme.textSecondary }]}>{gap}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Duplicates */}
        {stats.duplicates.length > 0 && (
          <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>🔁 Similar Items</Text>
            {stats.duplicates.map((dup, i) => (
              <View key={i} style={[styles.gapItem, { backgroundColor: theme.info + '10' }]}>
                <Ionicons name="copy-outline" size={16} color={theme.info} />
                <Text style={[styles.gapText, { color: theme.textSecondary }]}>{dup}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    );
  };

  // ─── Item Detail Modal ──────────────────────────────────────────────────────

  const renderItemModal = () => {
    if (!selectedItem) return null;

    return (
      <Modal
        visible={showItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <StatusBar barStyle="light-content" />

          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowItemModal(false)}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>
              {selectedItem.name}
            </Text>
            <TouchableOpacity onPress={() => handleDeleteItem(selectedItem)}>
              <Ionicons name="trash-outline" size={24} color={theme.error} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Image */}
            <Image source={resolveImageSource(selectedItem)} style={styles.modalImage} />

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: selectedItem.favorite ? theme.error + '20' : theme.card }]}
                onPress={() => handleToggleFavorite(selectedItem)}
              >
                <Ionicons
                  name={selectedItem.favorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={selectedItem.favorite ? theme.error : theme.textSecondary}
                />
                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>
                  {selectedItem.favorite ? 'Loved' : 'Love'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.primary + '15' }]}
                onPress={handleGetPairings}
                disabled={loadingPairings}
              >
                {loadingPairings ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="shuffle" size={20} color={theme.primary} />
                )}
                <Text style={[styles.actionLabel, { color: theme.primary }]}>
                  What goes with this?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Item Details */}
            <View style={[styles.detailSection, { backgroundColor: theme.card }]}>
              <Text style={[styles.detailTitle, { color: theme.text }]}>Details</Text>

              <View style={styles.detailGrid}>
                {[
                  { icon: '👕', label: 'Type', value: selectedItem.subType },
                  { icon: '🎨', label: 'Color', value: selectedItem.colors.join(', ') },
                  { icon: '🔲', label: 'Pattern', value: selectedItem.pattern },
                  { icon: '🧵', label: 'Fabric', value: selectedItem.fabric },
                  { icon: '👔', label: 'Formality', value: selectedItem.formality.replace('_', ' ') },
                  { icon: '🌤️', label: 'Seasons', value: selectedItem.seasons.join(', ') },
                  { icon: '🎭', label: 'Style', value: selectedItem.stylePersonality },
                  { icon: '📊', label: 'Condition', value: selectedItem.condition },
                ].map((detail, i) => (
                  <View key={i} style={styles.detailRow}>
                    <Text style={styles.detailIcon}>{detail.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>{detail.label}</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>{detail.value}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {selectedItem.brand && (
                <View style={[styles.brandBadge, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={[styles.brandText, { color: theme.primary }]}>🏷️ {selectedItem.brand}</Text>
                </View>
              )}
            </View>

            {/* Occasions */}
            <View style={[styles.detailSection, { backgroundColor: theme.card }]}>
              <Text style={[styles.detailTitle, { color: theme.text }]}>Best For</Text>
              <View style={styles.chipRow}>
                {selectedItem.occasions.map((occ, i) => (
                  <View key={i} style={[styles.occasionChip, { backgroundColor: theme.accent + '15' }]}>
                    <Text style={[styles.chipText, { color: theme.accent }]}>
                      {occ.replace('_', ' ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Pairing Suggestions */}
            {itemPairings.length > 0 && (
              <View style={[styles.detailSection, { backgroundColor: theme.card }]}>
                <Text style={[styles.detailTitle, { color: theme.text }]}>✨ Goes Great With</Text>
                {itemPairings.map((combo, i) => renderOutfitCombo(combo, i))}
              </View>
            )}

            {/* Styling Tips */}
            {selectedItem.pairsWellWith.length > 0 && (
              <View style={[styles.detailSection, { backgroundColor: theme.card }]}>
                <Text style={[styles.detailTitle, { color: theme.text }]}>💡 Pairs Well With</Text>
                {selectedItem.pairsWellWith.map((tip, i) => (
                  <Text key={i} style={[styles.pairTip, { color: theme.textSecondary }]}>
                    • {tip}
                  </Text>
                ))}
              </View>
            )}

            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // ─── Empty State ────────────────────────────────────────────────────────────

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={[theme.primary + '20', theme.accent + '10']}
          style={styles.emptyCard}
        >
          <Text style={styles.emptyEmoji}>👗</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Your Closet is Empty
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Start by photographing your clothes. AI will auto-tag everything — colors, fabric, formality, and more!
          </Text>

          <TouchableOpacity
            style={[styles.emptyButton]}
            onPress={showAddOptions}
          >
            <LinearGradient
              colors={[theme.primary, theme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyButtonGradient}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Add First Item</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <PremiumBackground variant="wardrobe">
      <View style={[styles.container]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <Animated.View style={{ opacity: headerOpacity }}>
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 8 }]}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>My Closet</Text>
                <Text style={styles.headerSubtitle}>
                  {wardrobeItems.length} item{wardrobeItems.length !== 1 ? 's' : ''} • Score: {stats?.wardrobeScore || 0}/100
                </Text>
              </View>
              {wardrobeItems.length >= 2 && (
                <TouchableOpacity
                  style={styles.generateBtn}
                  onPress={() => handleGenerateOutfits()}
                  disabled={generatingOutfits}
                >
                  {generatingOutfits ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="sparkles" size={20} color="#fff" />
                  )}
                  <Text style={styles.generateBtnText}>
                    {generatingOutfits ? 'Creating...' : 'Make Outfits'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* View Mode Tabs */}
            <View style={styles.viewTabs}>
              {([
                { key: 'grid', label: 'Closet', icon: 'grid-outline' },
                { key: 'outfits', label: 'Outfits', icon: 'shirt-outline' },
                { key: 'stats', label: 'Analytics', icon: 'analytics-outline' },
              ] as const).map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.viewTab, viewMode === tab.key && styles.viewTabActive]}
                  onPress={() => {
                    setViewMode(tab.key);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={viewMode === tab.key ? '#fff' : 'rgba(255,255,255,0.6)'}
                  />
                  <Text style={[styles.viewTabText, viewMode === tab.key && styles.viewTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Loading Overlay */}
        {(loading || adding) && (
          <View style={styles.loadingOverlay}>
            <View style={[styles.loadingCard, { backgroundColor: theme.card }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.text }]}>
                {adding ? '🧠 AI is analyzing your clothing...' : 'Loading wardrobe...'}
              </Text>
              {adding && (
                <Text style={[styles.loadingSubtext, { color: theme.textTertiary }]}>
                  Detecting colors, fabric, style, and more
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Content */}
        {!loading && wardrobeItems.length === 0 ? (
          renderEmptyState()
        ) : viewMode === 'grid' ? (
          <>
            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContainer}
            >
              {(Object.keys(filterLabels) as FilterType[]).map(key => {
                const info = filterLabels[key];
                const count = key === 'all'
                  ? wardrobeItems.length
                  : wardrobeItems.filter(i => i.type === key).length;
                if (key !== 'all' && count === 0) return null;

                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: activeFilter === key ? theme.primary : theme.card,
                        borderColor: activeFilter === key ? theme.primary : theme.borderLight,
                      },
                    ]}
                    onPress={() => {
                      setActiveFilter(key);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{info.icon}</Text>
                    <Text
                      style={[
                        styles.filterLabel,
                        { color: activeFilter === key ? '#fff' : theme.textSecondary },
                      ]}
                    >
                      {info.label}
                    </Text>
                    <View style={[styles.filterCount, { backgroundColor: activeFilter === key ? 'rgba(255,255,255,0.3)' : theme.borderLight }]}>
                      <Text style={{ color: activeFilter === key ? '#fff' : theme.textTertiary, fontSize: 10, fontWeight: '700' }}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Grid */}
            <FlatList
              data={filteredItems}
              renderItem={renderWardrobeItem}
              keyExtractor={item => item.id}
              numColumns={3}
              contentContainerStyle={styles.gridContainer}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={<View style={{ height: 100 }} />}
            />
          </>
        ) : viewMode === 'outfits' ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {weatherData && (
              <View style={[styles.weatherBanner, { backgroundColor: theme.card }]}>
                <Text style={styles.weatherIcon}>{weatherData.icon || '🌤️'}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.weatherText, { color: theme.text }]}>
                    Live Weather: {weatherData.location}
                  </Text>
                  <Text style={[styles.weatherDesc, { color: theme.textSecondary }]}>
                    {weatherData.temperature}°C, {weatherData.description}. AI matches are optimized for today.
                  </Text>
                </View>
              </View>
            )}

            {/* AI Stylist Request Card */}
            <View style={[styles.aiRequestCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.aiRequestTitle, { color: theme.text }]}>
                🪄 Context-Aware AI Stylist
              </Text>
              <Text style={[styles.aiRequestSubtitle, { color: theme.textSecondary }]}>
                What's the occasion, weather, or style vibe today?
              </Text>

              <View style={[styles.inputContainer, { borderColor: theme.borderLight }]}>
                <TextInput
                  style={[styles.contextInput, { color: theme.text }]}
                  placeholder="e.g. coffee date on a chilly day..."
                  placeholderTextColor={theme.textTertiary}
                  value={customContext}
                  onChangeText={setCustomContext}
                  onSubmitEditing={() => handleGenerateOutfits()}
                />
                {customContext ? (
                  <TouchableOpacity onPress={() => setCustomContext('')} style={styles.clearInputBtn}>
                    <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Quick Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.suggestionChipsScroll}
                contentContainerStyle={styles.suggestionChipsContainer}
              >
                {suggestionChips.map((chip, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.suggestionChip, { backgroundColor: theme.primary + '15' }]}
                    onPress={() => {
                      setCustomContext(chip.value);
                      handleGenerateOutfits(chip.value);
                    }}
                  >
                    <Text style={[styles.suggestionChipText, { color: theme.primary }]}>{chip.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.generateActionButton}
                onPress={() => handleGenerateOutfits()}
                disabled={generatingOutfits}
              >
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.generateActionButtonGradient}
                >
                  {generatingOutfits ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color="#fff" />
                      <Text style={styles.generateActionButtonText}>Style Me Now</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {generatingOutfits ? (
              <View style={styles.generatingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.generatingText, { color: theme.text }]}>
                  ✨ AI is crafting outfits for your vibe...
                </Text>
              </View>
            ) : outfitCombos.length > 0 ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
                    🔥 AI Recommended Outfits
                  </Text>
                </View>
                {outfitCombos.map((combo, i) => renderOutfitCombo(combo, i))}
                <View style={{ height: 100 }} />
              </>
            ) : (
              <View style={styles.emptyOutfits}>
                <Text style={{ fontSize: 48 }}>👔</Text>
                <Text style={[styles.emptyTitle, { color: theme.text, fontSize: 18 }]}>
                  No Outfits Styled Yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary, fontSize: 14 }]}>
                  Type a custom vibe above or tap a quick chip to generate style matches from your closet.
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          renderStats()
        )}

        {/* FAB */}
        {!loading && wardrobeItems.length > 0 && viewMode === 'grid' && (
          <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
            <TouchableOpacity onPress={showAddOptions} activeOpacity={0.85}>
              <LinearGradient
                colors={[theme.primary, theme.accent]}
                style={styles.fabGradient}
              >
                <Ionicons name="add" size={28} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {renderItemModal()}
      </View>
    </PremiumBackground>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginTop: 2 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  generateBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  viewTabs: { flexDirection: 'row', gap: 6 },
  viewTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, gap: 5, backgroundColor: 'rgba(255,255,255,0.1)' },
  viewTabActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  viewTabText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  viewTabTextActive: { color: '#fff' },

  filterScroll: { flexGrow: 0, minHeight: 55, marginBottom: 4 },
  filterContainer: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, gap: 5, borderWidth: 1 },
  filterLabel: { fontSize: 12, fontWeight: '600' },
  filterCount: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  gridContainer: { padding: 8 },
  gridItem: { width: ITEM_SIZE, margin: 4, borderRadius: 14, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  gridImage: { width: '100%', height: ITEM_SIZE * 1.2, resizeMode: 'cover' },
  gridItemInfo: { padding: 8 },
  gridItemName: { fontSize: 11, fontWeight: '700', letterSpacing: -0.2 },
  gridItemType: { fontSize: 9, fontWeight: '500', marginTop: 2 },
  colorDot: { position: 'absolute', top: 8, left: 8, width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  favBadge: { position: 'absolute', top: 6, right: 6 },

  fab: { position: 'absolute', bottom: 24, right: 20, zIndex: 100 },
  fabGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 },
  loadingCard: { padding: 32, borderRadius: 20, alignItems: 'center', width: screenWidth * 0.8, gap: 16 },
  loadingText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  loadingSubtext: { fontSize: 13, textAlign: 'center' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyCard: { borderRadius: 24, padding: 40, alignItems: 'center', width: screenWidth - 48 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyButton: { borderRadius: 16, overflow: 'hidden' },
  emptyButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, gap: 8 },
  emptyButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Outfit Combos
  comboCard: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  comboHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  comboName: { fontSize: 17, fontWeight: '800', flex: 1, letterSpacing: -0.3 },
  ratingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  comboItems: { marginBottom: 12 },
  comboItemThumb: { alignItems: 'center', marginRight: 12, width: 72 },
  comboImage: { width: 68, height: 85, borderRadius: 10, resizeMode: 'cover', marginBottom: 4 },
  comboItemLabel: { fontSize: 10, textAlign: 'center', fontWeight: '500' },
  comboReasoning: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  tipsContainer: { gap: 6, marginBottom: 10 },
  tipChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tipText: { fontSize: 12, fontWeight: '500' },
  comboMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, letterSpacing: -0.3 },
  emptyOutfits: { alignItems: 'center', paddingTop: 80 },
  generatingContainer: { alignItems: 'center', paddingTop: 80, gap: 16 },
  generatingText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },

  // Stats
  statsContainer: { flex: 1, padding: 16 },
  scoreCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6 },
  scoreGradient: { padding: 24, alignItems: 'center' },
  scoreNumber: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  scoreLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', marginTop: 4 },
  scoreDetails: { padding: 16, gap: 8 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreDetailLabel: { fontSize: 14, fontWeight: '500' },
  scoreDetailValue: { fontSize: 14, fontWeight: '700' },

  statsCard: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statsTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14, letterSpacing: -0.3 },
  colorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorChip: { alignItems: 'center', width: (screenWidth - 80) / 4 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, marginBottom: 4, elevation: 1 },
  colorName: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  colorPercent: { fontSize: 9, fontWeight: '500' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  barLabel: { fontSize: 12, fontWeight: '500', width: 80 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { fontSize: 12, fontWeight: '700', width: 20, textAlign: 'right' },
  seasonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  seasonName: { fontSize: 13, fontWeight: '600', width: 70 },
  seasonBar: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  seasonFill: { height: '100%', borderRadius: 5 },
  seasonPercent: { fontSize: 12, fontWeight: '600', width: 30, textAlign: 'right' },
  gapItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8, gap: 10 },
  gapText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Closet Intelligence
  archetypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  insightArchetype: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  insightMood: { fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  insightSectionLabel: { fontSize: 13, fontWeight: '800', marginTop: 8, marginBottom: 7, letterSpacing: -0.2 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7, gap: 9 },
  insightText: { fontSize: 13, flex: 1, lineHeight: 18 },
  signatureBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    marginTop: 12,
  },
  priorityRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 11, marginBottom: 8, gap: 10 },
  priorityChip: { fontSize: 10, fontWeight: '800', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', marginTop: 2 },
  priorityItem: { fontSize: 13.5, fontWeight: '700' },
  priorityReason: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  auditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  auditBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 8 },
  outfitCount: { fontSize: 52, fontWeight: '900', letterSpacing: -2 },
  outfitCountLabel: { fontSize: 13, fontWeight: '600', flex: 1 },

  // Item Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.1)' },
  modalTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  modalImage: { width: screenWidth, height: screenWidth * 1.2, resizeMode: 'cover' },
  quickActions: { flexDirection: 'row', padding: 16, gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, gap: 8 },
  actionLabel: { fontSize: 13, fontWeight: '600' },

  detailSection: { margin: 16, marginTop: 0, borderRadius: 16, padding: 16 },
  detailTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  detailGrid: { gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: { fontSize: 16 },
  detailLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  brandBadge: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start' },
  brandText: { fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  occasionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  chipText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  pairTip: { fontSize: 13, lineHeight: 20, marginBottom: 4 },

  // AI Request Card Styles
  aiRequestCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  aiRequestTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  aiRequestSubtitle: {
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
  },
  contextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  clearInputBtn: {
    padding: 4,
  },
  suggestionChipsScroll: {
    maxHeight: 40,
    marginBottom: 16,
  },
  suggestionChipsContainer: {
    gap: 8,
    alignItems: 'center',
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  generateActionButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  generateActionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 8,
  },
  generateActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeVibeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    maxWidth: screenWidth * 0.4,
  },
  activeVibeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  weatherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  weatherIcon: {
    fontSize: 28,
  },
  weatherText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  weatherDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
