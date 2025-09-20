import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    Linking,
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

export default function OutfitDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // Parse the outfit data from params
  const outfit: OutfitSuggestion = params.outfit ? JSON.parse(params.outfit as string) : null;

  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const screenOpacity = useSharedValue(1);
  const screenTranslateY = useSharedValue(0);

  React.useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
  }, []);

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
          barStyle={theme.background === '#18181b' ? 'light-content' : 'dark-content'}
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
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              Outfit Items
            </Text>
            {outfit.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.primary}
                />
                <Text style={[styles.itemText, { color: theme.text }]}>
                  {item}
                </Text>
              </View>
            ))}
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
            <View style={styles.colorsContainer}>
              {outfit.colors.map((color, index) => (
                <View key={index} style={styles.colorItem}>
                  <View
                    style={[
                      styles.colorCircle,
                      { backgroundColor: getColorCode(color) },
                    ]}
                  />
                  <Text style={[styles.colorName, { color: theme.text }]}>
                    {color}
                  </Text>
                </View>
              ))}
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
                        onPress={() => Linking.openURL(link.url)}
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
                        onPress={() => Linking.openURL(link.url)}
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
    </>
  );
}

const getColorCode = (colorName: string): string => {
  const colorMap: { [key: string]: string } = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#f59e0b',
    purple: '#8b5cf6',
    pink: '#ec4899',
    orange: '#f97316',
    black: '#1f2937',
    white: '#f9fafb',
    gray: '#6b7280',
    grey: '#6b7280',
    brown: '#92400e',
    navy: '#1e3a8a',
    beige: '#d2b48c',
    cream: '#fef7cd',
    gold: '#fbbf24',
    silver: '#9ca3af',
    maroon: '#7f1d1d',
    olive: '#65a30d',
    teal: '#0d9488',
    coral: '#fb7185',
    lavender: '#c084fc',
    mint: '#6ee7b7',
    peach: '#fed7aa',
    turquoise: '#06b6d4',
    burgundy: '#7c2d12',
    khaki: '#a3a3a3',
    salmon: '#fca5a5',
    ivory: '#fffbeb',
    charcoal: '#374151',
  };

  const normalizedColor = colorName.toLowerCase().trim();
  return colorMap[normalizedColor] || '#6b7280';
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
});