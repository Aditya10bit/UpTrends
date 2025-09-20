import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { OutfitSuggestion } from '../services/outfitService';

type OutfitCardProps = {
  outfit: OutfitSuggestion;
  index: number;
  onPress: (outfit: OutfitSuggestion) => void;
  theme: {
    card: string;
    primary: string;
    text: string;
    dark?: boolean;
  };
};

export default function OutfitCard({
  outfit,
  index,
  onPress,
  theme,
}: OutfitCardProps) {
  const colorScheme = useColorScheme();
  const isDark = theme?.dark ?? colorScheme === 'dark';

  const gradientColors = [
    ['#667eea', '#764ba2'] as const,
    ['#f093fb', '#f5576c'] as const,
    ['#4facfe', '#00f2fe'] as const,
    ['#43e97b', '#38f9d7'] as const,
    ['#fa709a', '#fee140'] as const,
  ];

  const currentGradient = gradientColors[index % gradientColors.length];

  return (
    <Animated.View
      entering={FadeInDown.duration(600).delay(index * 100)}
      style={styles.container}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(30, 41, 59, 0.9)'
              : 'rgba(255, 255, 255, 0.98)',
            borderColor: isDark ? '#475569' : '#cbd5e1',
            shadowColor: isDark ? '#000' : '#64748b',
          },
        ]}
        activeOpacity={0.85}
        onPress={() => onPress(outfit)}
      >
        <LinearGradient
          colors={currentGradient}
          style={styles.gradientHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <Text style={styles.outfitTitle}>{outfit.title}</Text>
            <View style={styles.occasionBadge}>
              <Text style={styles.occasionText}>{outfit.occasion}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <Text
            style={[
              styles.description,
              { color: isDark ? '#fff' : '#2d2d2d' },
            ]}
            numberOfLines={2}
          >
            {outfit.description}
          </Text>

          <View style={styles.itemsContainer}>
            <Text
              style={[
                styles.itemsLabel,
                { color: isDark ? '#ffd700' : '#6366f1' },
              ]}
            >
              Includes:
            </Text>
            <View style={styles.itemsList}>
              {outfit.items.slice(0, 3).map((item, idx) => (
                <View key={idx} style={styles.itemChip}>
                  <Text
                    style={[
                      styles.itemText,
                      { color: isDark ? '#fff' : '#2d2d2d' },
                    ]}
                  >
                    {item}
                  </Text>
                </View>
              ))}
              {outfit.items.length > 3 && (
                <View style={styles.itemChip}>
                  <Text
                    style={[
                      styles.itemText,
                      { color: isDark ? '#fff' : '#2d2d2d' },
                    ]}
                  >
                    +{outfit.items.length - 3} more
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.colorsContainer}>
              {outfit.colors.slice(0, 4).map((color, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.colorDot,
                    { backgroundColor: getColorCode(color) },
                  ]}
                />
              ))}
            </View>

            <View style={styles.priceContainer}>
              <Ionicons
                name="pricetag"
                size={16}
                color={isDark ? '#ffd700' : '#6366f1'}
              />
              <Text
                style={[
                  styles.priceText,
                  { color: isDark ? '#ffd700' : '#6366f1' },
                ]}
              >
                {outfit.price_range}
              </Text>
            </View>
          </View>

          {/* Reference Links */}
          {(outfit.shopping_links || outfit.reference_links) && (
            <View style={styles.linksContainer}>
              <Text style={[styles.linksTitle, { color: isDark ? '#ffd700' : '#6366f1' }]}>
                Quick Links
              </Text>
              <View style={styles.linksRow}>
                {outfit.shopping_links?.slice(0, 2).map((link, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.linkButton, { backgroundColor: isDark ? 'rgba(255,215,0,0.1)' : 'rgba(99,102,241,0.1)' }]}
                    onPress={() => Linking.openURL(link.url)}
                  >
                    <Ionicons
                      name={link.icon as any}
                      size={14}
                      color={isDark ? '#ffd700' : '#6366f1'}
                    />
                    <Text style={[styles.linkText, { color: isDark ? '#ffd700' : '#6366f1' }]}>
                      {link.platform}
                    </Text>
                  </TouchableOpacity>
                ))}
                {outfit.reference_links?.slice(0, 1).map((link, idx) => (
                  <TouchableOpacity
                    key={`ref-${idx}`}
                    style={[styles.linkButton, { backgroundColor: isDark ? 'rgba(255,215,0,0.1)' : 'rgba(99,102,241,0.1)' }]}
                    onPress={() => Linking.openURL(link.url)}
                  >
                    <Ionicons
                      name={link.icon as any}
                      size={14}
                      color={isDark ? '#ffd700' : '#6366f1'}
                    />
                    <Text style={[styles.linkText, { color: isDark ? '#ffd700' : '#6366f1' }]}>
                      {link.platform}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.viewButton,
              {
                backgroundColor: isDark ? '#6d28d9' : '#6366f1',
                shadowColor: isDark ? '#ffd700' : '#6366f1',
              },
            ]}
            onPress={() => onPress(outfit)}
          >
            <Ionicons name="eye" size={18} color="#fff" />
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
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
    marginHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  gradientHeader: {
    padding: 16,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  outfitTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  occasionBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  occasionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '500',
  },
  itemsContainer: {
    marginBottom: 16,
  },
  itemsLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  itemText: {
    fontSize: 11,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  linksContainer: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  linksTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    gap: 4,
  },
  linkText: {
    fontSize: 10,
    fontWeight: '600',
  },
});