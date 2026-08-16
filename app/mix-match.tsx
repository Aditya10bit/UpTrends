import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getOutfitSuggestions, OutfitSuggestion } from '../services/outfitService';
import { getActiveKeySource } from '../services/geminiService';
import { getUserProfile } from '../services/userService';
import { getColorCode, hexToHSL, colorMap } from '../utils/colorResolver';
import { openExternalUrl } from '../utils/openExternalUrl';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');

interface LaneItem {
  name: string;
  colors: string[];
}

export default function MixMatchScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories] = useState([
    { id: 'street-style', name: 'Street Wear', icon: 'shirt-outline' },
    { id: 'formal-wear', name: 'Formal', icon: 'business-outline' },
    { id: 'old-money', name: 'Old Money', icon: 'diamond-outline' },
    { id: 'gym-wear', name: 'Gym Wear', icon: 'barbell-outline' },
    { id: 'party-wear', name: 'Party Wear', icon: 'wine-outline' },
  ]);
  
  const [selectedCategory, setSelectedCategory] = useState('street-style');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Categorized items
  const [tops, setTops] = useState<LaneItem[]>([]);
  const [bottoms, setBottoms] = useState<LaneItem[]>([]);
  const [shoes, setShoes] = useState<LaneItem[]>([]);

  // Current selections
  const [topIdx, setTopIdx] = useState(0);
  const [bottomIdx, setBottomIdx] = useState(0);
  const [shoeIdx, setShoeIdx] = useState(0);

  // Locked lanes
  const [topLocked, setTopLocked] = useState(false);
  const [bottomLocked, setBottomLocked] = useState(false);
  const [shoeLocked, setShoeLocked] = useState(false);

  useEffect(() => {
    loadProfileAndSuggestions();
  }, [selectedCategory]);

  const loadProfileAndSuggestions = async () => {
    setLoading(true);
    try {
      let profile = userProfile;
      if (!profile) {
        profile = await getUserProfile();
        if (!profile) {
          profile = { gender: 'male', skinTone: 'Fair', bodyType: 'Average', height: 175, weight: 70 };
        }
        setUserProfile(profile);
      }

      const suggestions = await getOutfitSuggestions(profile, selectedCategory);
      
      // Parse items into 3 categories
      const tempTops: LaneItem[] = [];
      const tempBottoms: LaneItem[] = [];
      const tempShoes: LaneItem[] = [];

      suggestions.forEach((outfit: OutfitSuggestion) => {
        outfit.items.forEach(item => {
          const lower = item.toLowerCase();
          let itemColors = outfit.colors.filter(c => lower.includes(c.toLowerCase()));
          
          // If the AI forgot to list this item's color in outfit.colors,
          // let's extract it directly from the item description!
          if (itemColors.length === 0) {
            const matchedKeys = Object.keys(colorMap).filter(colorName => 
              lower.includes(colorName)
            );
            if (matchedKeys.length > 0) {
              // Prefer more specific color names (longest first)
              matchedKeys.sort((a, b) => b.length - a.length);
              itemColors = [matchedKeys[0]];
            }
          }

          const defaultColor = outfit.colors[0] || 'black';
          const resolvedColors = itemColors.length > 0 ? itemColors : [defaultColor];

          const itemObj = { name: item, colors: resolvedColors };

          if (
            lower.includes('pants') || 
            lower.includes('jeans') || 
            lower.includes('shorts') || 
            lower.includes('trousers') || 
            lower.includes('bottom') || 
            lower.includes('skirt') || 
            lower.includes('joggers') || 
            lower.includes('sweatpants')
          ) {
            tempBottoms.push(itemObj);
          } else if (
            lower.includes('shoes') || 
            lower.includes('sneakers') || 
            lower.includes('boots') || 
            lower.includes('loafers') || 
            lower.includes('heels') || 
            lower.includes('footwear') ||
            lower.includes('slides')
          ) {
            tempShoes.push(itemObj);
          } else {
            tempTops.push(itemObj);
          }
        });
      });

      // Fallback defaults if categorized lists are empty
      if (tempTops.length === 0) {
        tempTops.push({ name: 'Classic T-shirt', colors: ['white'] });
        tempTops.push({ name: 'Comfortable Hoodie', colors: ['gray'] });
      }
      if (tempBottoms.length === 0) {
        tempBottoms.push({ name: 'Straight Fit Jeans', colors: ['blue'] });
        tempBottoms.push({ name: 'Casual Chinos', colors: ['beige'] });
      }
      if (tempShoes.length === 0) {
        tempShoes.push({ name: 'Minimal Sneakers', colors: ['white'] });
        tempShoes.push({ name: 'Leather Boots', colors: ['brown'] });
      }

      setTops(tempTops);
      setBottoms(tempBottoms);
      setShoes(tempShoes);

      // Reset selection indexes if not locked
      if (!topLocked) setTopIdx(0);
      if (!bottomLocked) setBottomIdx(0);
      if (!shoeLocked) setShoeIdx(0);

    } catch (error: any) {
      console.error('Error loading mix & match options:', error);
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
    } finally {
      setLoading(false);
    }
  };

  const cycleLane = (lane: 'top' | 'bottom' | 'shoe', direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (lane === 'top' && !topLocked) {
      const len = tops.length;
      if (direction === 'next') setTopIdx(prev => (prev + 1) % len);
      else setTopIdx(prev => (prev - 1 + len) % len);
    } else if (lane === 'bottom' && !bottomLocked) {
      const len = bottoms.length;
      if (direction === 'next') setBottomIdx(prev => (prev + 1) % len);
      else setBottomIdx(prev => (prev - 1 + len) % len);
    } else if (lane === 'shoe' && !shoeLocked) {
      const len = shoes.length;
      if (direction === 'next') setShoeIdx(prev => (prev + 1) % len);
      else setShoeIdx(prev => (prev - 1 + len) % len);
    }
  };

  // Dynamic Stylist Coordination Score Calculator
  const calculateCoordination = () => {
    if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) return { score: 70, feedback: 'Loading styling...' };

    const topColors = tops[topIdx]?.colors || [];
    const bottomColors = bottoms[bottomIdx]?.colors || [];
    const shoeColors = shoes[shoeIdx]?.colors || [];

    const allColors = [...topColors, ...bottomColors, ...shoeColors];
    const resolvedHex = allColors.map(c => getColorCode(c));
    const hslList = resolvedHex.map(hex => hexToHSL(hex));

    // Count neutrals
    const neutrals = ['#1f2937', '#f9fafb', '#6b7280', '#d2b48c', '#fffdd0', '#fffff0', '#1e3a8a', '#92400e']; // black, white, gray, beige, cream, ivory, navy, brown
    const neutralCount = resolvedHex.filter(hex => neutrals.includes(hex)).length;

    // Filter vibrant hues
    const vibrantHues = hslList
      .filter(hsl => hsl.s > 15 && hsl.l > 15 && hsl.l < 85)
      .map(hsl => hsl.h);

    if (vibrantHues.length === 0) {
      return { score: 90, feedback: 'Classic Neutrals: Perfect, versatile styling.' };
    }

    if (vibrantHues.length === 1) {
      return { score: 95, feedback: 'Neutral Pop: Clean look highlighted by a single accent.' };
    }

    if (vibrantHues.length === 2) {
      const diff = Math.abs(vibrantHues[0] - vibrantHues[1]);
      const shortestDiff = Math.min(diff, 360 - diff);
      if (shortestDiff > 140 && shortestDiff < 220) {
        return { score: 98, feedback: 'Complementary: Bold opposites that coordinate perfectly.' };
      }
      if (shortestDiff < 60) {
        return { score: 92, feedback: 'Analogous: Harmonious adjacent colors blending together.' };
      }
      return { score: 82, feedback: 'Contrasting: Vibrant contrast. Ground with accessories.' };
    }

    // 3 or more vibrant colors
    return { score: 68, feedback: 'High Contrast: Consider replacing one item with a neutral.' };
  };

  const harmonyInfo = calculateCoordination();

  const handleShopSelection = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const topName = tops[topIdx]?.name || '';
    const bottomName = bottoms[bottomIdx]?.name || '';
    const query = `men ${topName} ${bottomName} outfit`;
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
    await openExternalUrl(searchUrl);
  };

  const selectCategory = (catId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(catId);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.background === '#0e0e0e' ? 'light-content' : 'dark-content'} />
        
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mix & Match Canvas</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Category Picker */}
        <View style={styles.categoryPicker}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor: selectedCategory === cat.id ? theme.primary : theme.card,
                    borderColor: theme.borderLight
                  }
                ]}
                onPress={() => selectCategory(cat.id)}
              >
                <Ionicons 
                  name={cat.icon as any} 
                  size={16} 
                  color={selectedCategory === cat.id ? '#fff' : theme.textSecondary} 
                />
                <Text 
                  style={[
                    styles.categoryTabText, 
                    { color: selectedCategory === cat.id ? '#fff' : theme.text }
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Curating wardrobe items...</Text>
          </View>
        ) : (
          <ScrollView style={styles.canvasContainer} contentContainerStyle={styles.canvasContent}>
            
            {/* Lane 1: Tops */}
            <View style={[styles.laneCard, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
              <View style={styles.laneHeader}>
                <View style={styles.laneTitleRow}>
                  <Ionicons name="shirt-outline" size={18} color={theme.primary} />
                  <Text style={[styles.laneTitle, { color: theme.text }]}>Tops / Outerwear</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTopLocked(!topLocked);
                  }}
                  style={styles.lockButton}
                >
                  <Ionicons 
                    name={topLocked ? "lock-closed" : "lock-open-outline"} 
                    size={20} 
                    color={topLocked ? "#ffd700" : theme.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.swipeContainer}>
                <TouchableOpacity 
                  onPress={() => cycleLane('top', 'prev')} 
                  disabled={topLocked} 
                  style={[styles.arrowButton, topLocked && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                
                <View style={styles.itemHolder}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
                    {tops[topIdx]?.name}
                  </Text>
                  <View style={styles.colorRow}>
                    {tops[topIdx]?.colors.map((c, i) => (
                      <View 
                        key={i} 
                        style={[styles.colorIndicator, { backgroundColor: getColorCode(c) }]} 
                      />
                    ))}
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={() => cycleLane('top', 'next')} 
                  disabled={topLocked} 
                  style={[styles.arrowButton, topLocked && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-forward" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lane 2: Bottoms */}
            <View style={[styles.laneCard, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
              <View style={styles.laneHeader}>
                <View style={styles.laneTitleRow}>
                  <Ionicons name="body-outline" size={18} color={theme.primary} />
                  <Text style={[styles.laneTitle, { color: theme.text }]}>Bottoms</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setBottomLocked(!bottomLocked);
                  }}
                  style={styles.lockButton}
                >
                  <Ionicons 
                    name={bottomLocked ? "lock-closed" : "lock-open-outline"} 
                    size={20} 
                    color={bottomLocked ? "#ffd700" : theme.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.swipeContainer}>
                <TouchableOpacity 
                  onPress={() => cycleLane('bottom', 'prev')} 
                  disabled={bottomLocked} 
                  style={[styles.arrowButton, bottomLocked && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                
                <View style={styles.itemHolder}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
                    {bottoms[bottomIdx]?.name}
                  </Text>
                  <View style={styles.colorRow}>
                    {bottoms[bottomIdx]?.colors.map((c, i) => (
                      <View 
                        key={i} 
                        style={[styles.colorIndicator, { backgroundColor: getColorCode(c) }]} 
                      />
                    ))}
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={() => cycleLane('bottom', 'next')} 
                  disabled={bottomLocked} 
                  style={[styles.arrowButton, bottomLocked && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-forward" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lane 3: Shoes */}
            <View style={[styles.laneCard, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
              <View style={styles.laneHeader}>
                <View style={styles.laneTitleRow}>
                  <Ionicons name="footsteps-outline" size={18} color={theme.primary} />
                  <Text style={[styles.laneTitle, { color: theme.text }]}>Footwear</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShoeLocked(!shoeLocked);
                  }}
                  style={styles.lockButton}
                >
                  <Ionicons 
                    name={shoeLocked ? "lock-closed" : "lock-open-outline"} 
                    size={20} 
                    color={shoeLocked ? "#ffd700" : theme.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.swipeContainer}>
                <TouchableOpacity 
                  onPress={() => cycleLane('shoe', 'prev')} 
                  disabled={shoeLocked} 
                  style={[styles.arrowButton, shoeLocked && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                
                <View style={styles.itemHolder}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
                    {shoes[shoeIdx]?.name}
                  </Text>
                  <View style={styles.colorRow}>
                    {shoes[shoeIdx]?.colors.map((c, i) => (
                      <View 
                        key={i} 
                        style={[styles.colorIndicator, { backgroundColor: getColorCode(c) }]} 
                      />
                    ))}
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={() => cycleLane('shoe', 'next')} 
                  disabled={shoeLocked} 
                  style={[styles.arrowButton, shoeLocked && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-forward" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Coordination Score Panel */}
            <View style={[styles.scoreCard, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
              <View style={styles.scoreRow}>
                <View style={[styles.scoreCircularBg, { borderColor: theme.primary + '30' }]}>
                  <LinearGradient 
                    colors={[theme.primary, '#9f7aea']} 
                    style={styles.scoreGradient}
                  >
                    <Text style={styles.scoreNumber}>{harmonyInfo.score}%</Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.scoreFeedbackContainer}>
                  <Text style={[styles.scoreTitle, { color: theme.text }]}>Styling Match Level</Text>
                  <Text style={[styles.scoreFeedback, { color: theme.textSecondary }]}>
                    {harmonyInfo.feedback}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.shopButton, { backgroundColor: theme.primary }]}
                onPress={handleShopSelection}
              >
                <Ionicons name="logo-pinterest" size={20} color="#fff" />
                <Text style={styles.shopButtonText}>Shop This Combination</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        )}
      </View>
    </>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoryPicker: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  canvasContainer: {
    flex: 1,
  },
  canvasContent: {
    padding: 16,
    gap: 16,
  },
  laneCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  laneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  laneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  laneTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  lockButton: {
    padding: 4,
  },
  swipeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowButton: {
    padding: 8,
  },
  itemHolder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircularBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  scoreGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreFeedbackContainer: {
    flex: 1,
    gap: 4,
  },
  scoreTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  scoreFeedback: {
    fontSize: 13,
    lineHeight: 18,
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
