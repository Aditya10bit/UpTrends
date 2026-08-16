import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    Share,
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
import { useTheme } from '../contexts/ThemeContext';
import { OutfitSuggestion } from '../services/outfitService';
import { getColorCode, hexToHSL, detectHarmony } from '../utils/colorResolver';
import { openExternalUrl } from '../utils/openExternalUrl';
import Svg, { Circle, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OutfitDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // Parse the outfit data from params
  const outfit: OutfitSuggestion = params.outfit ? JSON.parse(params.outfit as string) : null;

  // Checklist State & Persistence
  const [ownedItems, setOwnedItems] = useState<{ [key: string]: boolean }>({});
  
  // Color Swatch Modal State
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [colorModalVisible, setColorModalVisible] = useState(false);

  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const screenOpacity = useSharedValue(1);
  const screenTranslateY = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
  }, []);

  // Load owned items checklist state
  useEffect(() => {
    const loadOwnedItems = async () => {
      if (!outfit?.id) return;
      try {
        const stored = await AsyncStorage.getItem(`uptrends_owned_${outfit.id}`);
        if (stored) {
          setOwnedItems(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading owned items:', error);
      }
    };
    loadOwnedItems();
  }, [outfit?.id]);

  // Toggle owned items checklist
  const toggleItemOwned = async (item: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = { ...ownedItems, [item]: !ownedItems[item] };
      setOwnedItems(updated);
      if (outfit?.id) {
        await AsyncStorage.setItem(`uptrends_owned_${outfit.id}`, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error saving owned items:', error);
    }
  };

  const totalItemsCount = outfit?.items?.length || 0;
  const ownedItemsCount = outfit?.items?.filter(item => ownedItems[item])?.length || 0;
  const progressPercentage = totalItemsCount > 0 ? (ownedItemsCount / totalItemsCount) * 100 : 0;

  const handleShare = async () => {
    if (!outfit) return;
    try {
      const shareText = `Check out this ${outfit.title} outfit:\n\n${outfit.description}\n\nItems: ${outfit.items.join(', ')}\n\nStyle Tips: ${outfit.style_tips.join(', ')}`;
      await Share.share({
        message: shareText,
      });
    } catch (error) {
      console.error('Error sharing outfit:', error);
    }
  };

  const handleBack = () => {
    screenOpacity.value = withTiming(0, { duration: 250 });
    screenTranslateY.value = withTiming(-30, { duration: 250 });
    setTimeout(() => {
      router.back();
    }, 250);
  };

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));

  if (!outfit) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>
          Outfit not found
        </Text>
      </View>
    );
  }

  const gradientColors = ['#667eea', '#764ba2'] as const;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.container, { backgroundColor: theme.background }, screenAnimatedStyle]}>
        <StatusBar
          barStyle={theme.background === '#0e0e0e' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={gradientColors}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTitleSection}>
                <Text style={styles.headerTitle}>{outfit.title}</Text>
                <Text style={styles.headerSubtitle}>{outfit.occasion}</Text>
              </View>
              <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                <Ionicons name="share-social" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Description */}
          <Animated.View
            style={[
              styles.section,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              Description
            </Text>
            <Text style={[styles.description, { color: theme.text }]}>
              {outfit.description}
            </Text>
          </Animated.View>

          {/* Items */}
          <Animated.View
            style={[
              styles.section,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.primary, marginBottom: 0 }]}>
                Outfit Items
              </Text>
              <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                {ownedItemsCount} of {totalItemsCount} owned
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBarBg, { backgroundColor: theme.borderLight }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      backgroundColor: theme.primary, 
                      width: `${progressPercentage}%` 
                    }
                  ]} 
                />
              </View>
            </View>

            {outfit.items.map((item, index) => {
              const isOwned = !!ownedItems[item];
              return (
                <TouchableOpacity 
                  key={index} 
                  style={styles.itemRow}
                  onPress={() => toggleItemOwned(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isOwned ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={isOwned ? "#10B981" : theme.textSecondary}
                  />
                  <Text 
                    style={[
                      styles.itemText, 
                      { 
                        color: isOwned ? theme.textSecondary : theme.text,
                        textDecorationLine: isOwned ? 'line-through' : 'none'
                      }
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* Colors */}
          <Animated.View
            style={[
              styles.section,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              Color Palette
            </Text>
            <Text style={[styles.colorTip, { color: theme.textSecondary, marginBottom: 12 }]}>
              💡 Tap any swatch to see styling advice and color harmonies
            </Text>
            <View style={styles.colorsContainer}>
              {outfit.colors.map((color, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.colorItem}
                  activeOpacity={0.75}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedColor(color);
                    setColorModalVisible(true);
                  }}
                >
                  <View
                    style={[
                      styles.colorCircle,
                      { backgroundColor: getColorCode(color) },
                    ]}
                  />
                  <Text style={[styles.colorName, { color: theme.text }]}>
                    {color}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Color Harmony Wheel */}
          <Animated.View
            style={[
              styles.section,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              Color Harmony Wheel
            </Text>
            
            <View style={styles.harmonyContainer}>
              {/* SVG Color Wheel */}
              <View style={styles.wheelWrapper}>
                <Svg width={140} height={140} viewBox="0 0 180 180">
                  {/* Wheel Background Spectrum Ring */}
                  <Circle
                    cx="90"
                    cy="90"
                    r="75"
                    fill="none"
                    stroke={theme.borderLight}
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                  />
                  
                  {/* Outer Spectrum Ring for reference */}
                  {[...Array(12)].map((_, i) => {
                    const angle = (i * 30 - 90) * Math.PI / 180;
                    const h = i * 30;
                    const x = 90 + 75 * Math.cos(angle);
                    const y = 90 + 75 * Math.sin(angle);
                    return (
                      <Circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="3.5"
                        fill={`hsl(${h}, 80%, 60%)`}
                      />
                    );
                  })}

                  {/* Draw Connecting Lines and Dots */}
                  {(() => {
                    const vibrantHSL = outfit.colors
                      .map(c => {
                        const code = getColorCode(c);
                        const hsl = hexToHSL(code);
                        return { code, hsl };
                      })
                      .filter(item => item.hsl.s > 15 && item.hsl.l > 15 && item.hsl.l < 85);
                    
                    const coords = vibrantHSL.map(item => {
                      const angle = (item.hsl.h - 90) * Math.PI / 180;
                      const x = 90 + 75 * Math.cos(angle);
                      const y = 90 + 75 * Math.sin(angle);
                      return { x, y, code: item.code };
                    });

                    // Draw connecting lines between dots
                    const lines = [];
                    for (let i = 0; i < coords.length; i++) {
                      for (let j = i + 1; j < coords.length; j++) {
                        lines.push(
                          <Line
                            key={`${i}-${j}`}
                            x1={coords[i].x}
                            y1={coords[i].y}
                            x2={coords[j].x}
                            y2={coords[j].y}
                            stroke={theme.textSecondary}
                            strokeWidth="1.5"
                            strokeOpacity="0.4"
                          />
                        );
                      }
                    }

                    // Draw lines from center for each dot
                    const centerLines = coords.map((c, idx) => (
                      <Line
                        key={`center-${idx}`}
                        x1="90"
                        y1="90"
                        x2={c.x}
                        y2={c.y}
                        stroke={c.code}
                        strokeWidth="2"
                        strokeOpacity="0.6"
                      />
                    ));

                    // Draw outer dots for each color
                    const dots = coords.map((c, idx) => (
                      <Circle
                        key={`dot-${idx}`}
                        cx={c.x}
                        cy={c.y}
                        r="8"
                        fill={c.code}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    ));

                    return (
                      <>
                        {lines}
                        {centerLines}
                        {dots}
                      </>
                    );
                  })()}

                  {/* Center Hub */}
                  <Circle cx="90" cy="90" r="5" fill={theme.text} />
                </Svg>
              </View>

              {/* Harmony Info Details */}
              <View style={styles.harmonyDetails}>
                <View style={[styles.harmonyBadge, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
                  <Ionicons name="color-palette-outline" size={14} color={theme.primary} />
                  <Text style={[styles.harmonyBadgeText, { color: theme.primary }]} numberOfLines={1}>
                    {detectHarmony(outfit.colors).type}
                  </Text>
                </View>
                <Text style={[styles.harmonyDescriptionText, { color: theme.textSecondary }]}>
                  {detectHarmony(outfit.colors).description}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Style Tips */}
          <Animated.View
            style={[
              styles.section,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              Style Tips
            </Text>
            {outfit.style_tips.map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <Ionicons
                  name="bulb"
                  size={18}
                  color={theme.primary}
                />
                <Text style={[styles.tipText, { color: theme.text }]}>
                  {tip}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Shopping & Reference Links */}
          {(outfit.shopping_links || outfit.reference_links) && (
            <Animated.View
              style={[
                styles.section,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.borderLight,
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.primary }]}>
                Shop & Learn More
              </Text>
              
              {outfit.shopping_links && outfit.shopping_links.length > 0 && (
                <View style={styles.linksSection}>
                  <Text style={[styles.linksSectionTitle, { color: theme.text }]}>
                    🛍️ Shopping Links
                  </Text>
                  <View style={styles.linksGrid}>
                    {outfit.shopping_links.map((link, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.linkCard, { backgroundColor: theme.background, borderColor: theme.borderLight }]}
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          await openExternalUrl(link.url);
                        }}
                      >
                        <View style={[styles.linkIconContainer, { backgroundColor: theme.primary }]}>
                          <Ionicons name={link.icon as any} size={20} color="#fff" />
                        </View>
                        <View style={styles.linkContent}>
                          <Text style={[styles.linkPlatform, { color: theme.text }]}>
                            {link.platform}
                          </Text>
                          <Text style={[styles.linkDescription, { color: theme.textSecondary }]}>
                            {link.description}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {outfit.reference_links && outfit.reference_links.length > 0 && (
                <View style={styles.linksSection}>
                  <Text style={[styles.linksSectionTitle, { color: theme.text }]}>
                    📚 Style References
                  </Text>
                  <View style={styles.linksGrid}>
                    {outfit.reference_links.map((link, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.linkCard, { backgroundColor: theme.background, borderColor: theme.borderLight }]}
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          await openExternalUrl(link.url);
                        }}
                      >
                        <View style={[styles.linkIconContainer, { backgroundColor: theme.primary }]}>
                          <Ionicons name={link.icon as any} size={20} color="#fff" />
                        </View>
                        <View style={styles.linkContent}>
                          <Text style={[styles.linkPlatform, { color: theme.text }]}>
                            {link.platform}
                          </Text>
                          <Text style={[styles.linkDescription, { color: theme.textSecondary }]}>
                            {link.description}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* Details */}
          <Animated.View
            style={[
              styles.section,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              Details
            </Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Ionicons name="calendar" size={18} color={theme.primary} />
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Season
                </Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {outfit.season}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="pricetag" size={18} color={theme.primary} />
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Price Range
                </Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {outfit.price_range}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Image Description */}
          <Animated.View
            style={[
              styles.section,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              How It Looks
            </Text>
            <Text style={[styles.imageDescription, { color: theme.text }]}>
              {outfit.image_description}
            </Text>
          </Animated.View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </Animated.View>

      {/* Color Advice Modal */}
      <Modal
        visible={colorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setColorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setColorModalVisible(false)}
          />
          <View style={[styles.colorModalContent, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
            <View style={styles.modalHeader}>
              <View 
                style={[
                  styles.modalColorIndicator, 
                  { backgroundColor: selectedColor ? getColorCode(selectedColor) : '#6b7280' }
                ]} 
              />
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {selectedColor || 'Color Info'}
              </Text>
            </View>
            <Text style={[styles.modalAdviceText, { color: theme.text }]}>
              {selectedColor ? getColorStylingAdvice(selectedColor) : ''}
            </Text>
            <TouchableOpacity 
              style={[styles.modalCloseButton, { backgroundColor: theme.primary }]}
              onPress={() => setColorModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getColorStylingAdvice = (colorName: string): string => {
  const adviceMap: { [key: string]: string } = {
    red: 'Red is a powerful, energetic color. Use it as a statement piece or pop of color against neutral tones like gray, navy, or black.',
    blue: 'Blue is calming and universally flattering. Pair lighter shades with beige or white; pair dark navy with brown leather or tan.',
    green: 'Green is fresh and natural. Olive and sage greens act as excellent earthy neutrals. Pair green with cream, white, or navy.',
    yellow: 'Yellow adds brightness and optimism. Use soft pastel yellows for a subtle warmth, or bright yellow as a statement highlight color.',
    purple: 'Purple is luxurious and royal. Deep plum and violet pair beautifully with charcoal gray, navy, or gold accessories.',
    pink: 'Pink is soft and stylish. Dusty rose and blush pink pair perfectly with gray, white, beige, or olive green for a modern contrast.',
    orange: 'Orange is warm and vibrant. Terracotta and rust oranges look highly sophisticated when paired with cream, olive, or dark denim.',
    black: 'Black is timeless and sleek. Creates a high-fashion, slimming silhouette. Combine different textures (e.g., leather + cotton) to keep it interesting.',
    white: 'White is crisp, clean, and acts as a canvas. Pair with absolutely any color. Great for high-contrast monochromatic outfits.',
    gray: 'Gray is a versatile, polished neutral. Excellent for layering. Pair cool grays with white, or warm charcoal grays with rich tan or navy.',
    grey: 'Gray is a versatile, polished neutral. Excellent for layering. Pair cool grays with white, or warm charcoal grays with rich tan or navy.',
    brown: 'Brown is warm and rich. Dark chocolate browns pair elegantly with light cream, gold jewelry, or contrast nicely with denim and navy.',
    navy: 'Navy is smart and classic. It serves as an alternative to black with a softer feel. Coordinates beautifully with beige, white, or red.',
    beige: 'Beige is an elegant neutral. Perfect for clean, minimalist aesthetics. Layer tones of beige and cream for an expensive-looking monochromatic style.',
    cream: 'Cream is warmer and softer than white. Gives a cozy, premium feel to knitwear and shirts. Pair with beige, brown, or light wash denim.',
    gold: 'Gold is warm and glamorous. Best used for jewelry, watch details, or metallic hardware on bags to elevate neutral outfits.',
    silver: 'Silver is sleek and modern. Ideal for cool-toned outfits. Matches gray, black, white, and cool blues perfectly.',
    maroon: 'Maroon is rich and sophisticated. A classic autumn/winter color. Looks exceptional with beige, cream, dark gray, or navy blue.',
    olive: 'Olive is a rugged, military-inspired green. Functions as a neutral. Pairs beautifully with black, white, tan, and soft orange.',
    teal: 'Teal is rich and unique. Combines the depth of blue and green. Looks stunning with mustard yellow, cream, or gold accents.',
    coral: 'Coral is lively and summery. A warm pink-orange that complements gold jewelry. Best styled with white, beige, or light blue denim.',
    lavender: 'Lavender is fresh and modern. A soft pastel tone that looks great paired with white, light gray, or dark wash indigo jeans.',
    mint: 'Mint is cool and refreshing. A bright pastel green that looks crisp when paired with white, beige, or soft gray.',
    peach: 'Peach is warm and delicate. Soft orange-pink that adds warmth. Pair with cream, ivory, light denim, or beige.',
    turquoise: 'Turquoise is bold and tropical. Perfect for accent accessories or summer resort wear. Best paired with clean white or cream.',
    burgundy: 'Burgundy is deep, warm, and elegant. Excellent for outerwear, shoes, or knits. Pairs beautifully with navy, cream, gray, and brown.',
    khaki: 'Khaki is a practical utility neutral. Works great for casual pants or jackets. Pair with navy, forest green, or crisp white.',
    salmon: 'Salmon is a cheerful, warm pink. Pairs beautifully with white linen, light gray, beige, and summer neutrals.',
    ivory: 'Ivory is luxurious and warm off-white. Ideal for classic tailoring and knitwear. Looks best paired with warm neutrals like tan and brown.',
    charcoal: 'Charcoal is a deep, smart gray. Almost as formal as black but softer. Looks great with crisp white shirts and light gray layers.'
  };

  const key = colorName.toLowerCase().trim();
  return adviceMap[key] || `${colorName} is a great addition to this outfit. Combine it with neutral basics to make this color stand out beautifully.`;
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  headerTitleSection: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 30,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemText: {
    fontSize: 15,
    marginLeft: 10,
    flex: 1,
  },
  colorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorItem: {
    alignItems: 'center',
    marginBottom: 8,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  colorName: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 15,
    marginLeft: 10,
    flex: 1,
    lineHeight: 22,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  imageDescription: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  bottomSpacing: {
    height: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  linksSection: {
    marginBottom: 20,
  },
  linksSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  linksGrid: {
    gap: 8,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  linkIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkContent: {
    flex: 1,
  },
  linkPlatform: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  linkDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  colorTip: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  colorModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalColorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  modalAdviceText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalCloseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  harmonyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  wheelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  harmonyDetails: {
    flex: 1,
    gap: 8,
  },
  harmonyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 6,
  },
  harmonyBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  harmonyDescriptionText: {
    fontSize: 13,
    lineHeight: 18,
  },
});