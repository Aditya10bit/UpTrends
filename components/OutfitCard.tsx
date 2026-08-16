import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { OutfitSuggestion } from '../services/outfitService';
import { getColorCode } from '../utils/colorResolver';
import { openExternalUrl } from '../utils/openExternalUrl';

type OutfitCardProps = {
  outfit: OutfitSuggestion;
  index: number;
  onPress: (outfit: OutfitSuggestion) => void;
  // Full theme object (light/dark palette) — colors resolve per mode, so the
  // card renders correctly in both obsidian (dark) and ivory (light).
  theme: any;
};

// "Obsidian Editorial" outfit card — monochrome glass panel, hairline border,
// label-caps micro-labels, one lavender accent. No rainbow gradient header.
export default function OutfitCard({
  outfit,
  index,
  onPress,
  theme,
}: OutfitCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(index * 80)}
      style={styles.container}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: theme.borderLight,
            shadowColor: '#000',
          },
        ]}
        activeOpacity={0.85}
        onPress={() => onPress(outfit)}
      >
        {/* Occasion micro-label + title */}
        <View style={styles.header}>
          <Text
            style={[styles.occasion, { color: theme.textAccent }]}
            numberOfLines={1}
          >
            {(outfit.occasion || 'Styled').toUpperCase()}
          </Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
            {outfit.title}
          </Text>
        </View>

        <Text
          style={[styles.description, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {outfit.description}
        </Text>

        <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

        {/* Includes — glass chips */}
        <View style={styles.itemsContainer}>
          <Text style={[styles.itemsLabel, { color: theme.textTertiary }]}>
            Includes
          </Text>
          <View style={styles.itemsList}>
            {outfit.items.slice(0, 3).map((item, idx) => (
              <View
                key={idx}
                style={[styles.itemChip, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '22' }]}
              >
                <Text style={[styles.itemText, { color: theme.textAccent }]}>
                  {item}
                </Text>
              </View>
            ))}
            {outfit.items.length > 3 && (
              <View
                style={[styles.itemChip, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '22' }]}
              >
                <Text style={[styles.itemText, { color: theme.textAccent }]}>
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
                  { backgroundColor: getColorCode(color), borderColor: theme.borderLight },
                ]}
              />
            ))}
          </View>

          <View style={styles.priceContainer}>
            <Ionicons name="pricetag" size={14} color={theme.textAccent} />
            <Text style={[styles.priceText, { color: theme.textAccent }]}>
              {outfit.price_range}
            </Text>
          </View>
        </View>

        {/* Reference Links */}
        {(outfit.shopping_links || outfit.reference_links) && (
          <View style={[styles.linksContainer, { borderTopColor: theme.borderLight }]}>
            <Text style={[styles.linksTitle, { color: theme.textTertiary }]}>
              Quick Links
            </Text>
            <View style={styles.linksRow}>
              {outfit.shopping_links?.slice(0, 2).map((link, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.linkButton, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '20' }]}
                  onPress={() => openExternalUrl(link.url)}
                >
                  <Ionicons
                    name={link.icon as any}
                    size={13}
                    color={theme.textAccent}
                  />
                  <Text style={[styles.linkText, { color: theme.textAccent }]}>
                    {link.platform}
                  </Text>
                </TouchableOpacity>
              ))}
              {outfit.reference_links?.slice(0, 1).map((link, idx) => (
                <TouchableOpacity
                  key={`ref-${idx}`}
                  style={[styles.linkButton, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '20' }]}
                  onPress={() => openExternalUrl(link.url)}
                >
                  <Ionicons
                    name={link.icon as any}
                    size={13}
                    color={theme.textAccent}
                  />
                  <Text style={[styles.linkText, { color: theme.textAccent }]}>
                    {link.platform}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.viewButton, { backgroundColor: theme.primary }]}
          onPress={() => onPress(outfit)}
        >
          <Ionicons name="eye" size={16} color="#fff" />
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}



const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    marginBottom: 8,
  },
  occasion: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  itemsContainer: {
    marginBottom: 14,
  },
  itemsLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  itemText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  colorsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  viewButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  linksContainer: {
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  linksTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  linkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
});
