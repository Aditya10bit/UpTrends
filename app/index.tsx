import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getUserProfile } from '../services/userService';
import { resolveDisplayName } from '../utils/displayName';

// "Obsidian Editorial" home — calm, magazine-grade launcher.
// Playfair display type, Inter body, monochrome glass cards, one lavender
// accent, tight corners, hairline borders. No rainbow, no bounce, no particles.

interface Tile {
  key: string;
  route: string;
  title: string;
  desc?: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Primary tools shown in the horizontal "Style Toolkit" rail.
const TOOLKIT: Tile[] = [
  { key: 'chat', route: '/stylist-chat', title: 'Stylist Chat', desc: 'Consult your AI stylist', icon: 'chatbubbles-outline' },
  { key: 'closet', route: '/wardrobe', title: 'My Closet', desc: 'Your digital wardrobe', icon: 'grid-outline' },
  { key: 'outfit', route: '/make-outfit', title: 'Outfit Generator', desc: 'Create looks from your pieces', icon: 'sparkles-outline' },
];

// Remaining destinations as a compact editorial grid.
const TILES: Tile[] = [
  { key: 'fashion', route: '/fashion', title: 'Explore Fashion', desc: 'Discover trending outfits', icon: 'shirt-outline' },
  { key: 'profile', route: '/profile', title: 'My Profile', desc: 'Manage your style', icon: 'person-outline' },
  { key: 'stylecheck', route: '/style-check', title: 'Style Check', desc: 'AI rating for your look', icon: 'analytics-outline' },
  { key: 'upload', route: '/upload-aesthetic', title: 'Upload Style', desc: 'Share a look for feedback', icon: 'camera-outline' },
  { key: 'body', route: '/body-analysis', title: 'Body Analysis', desc: 'Know your proportions', icon: 'body-outline' },
  { key: 'mix', route: '/mix-match', title: 'Mix & Match', desc: 'Pair pieces together', icon: 'color-palette-outline' },
  { key: 'scanner', route: '/shopping-scanner', title: 'Will It Match', desc: 'Scan & compare', icon: 'scan-outline' },
  { key: 'shazam', route: '/style-shazam', title: 'Steal the Look', desc: 'Find outfits like yours', icon: 'flash-outline' },
];

export default function MainScreen() {
  const { theme, mode } = useTheme();
  const { user, loading } = useAuth();

  const [navigating, setNavigating] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // One calm entrance — fade + gentle rise, no bounce.
  const intro = useRef(new Animated.Value(0)).current;
  const runIntro = useCallback(() => {
    intro.setValue(0);
    Animated.timing(intro, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro]);
  useFocusEffect(useCallback(() => {
    runIntro();
    // Greet by the name the user set (stored in the Firestore profile), not just
    // the auth displayName. Refetch on focus so an edit in Profile shows up here.
    if (user) {
      getUserProfile().then((p) => setUserProfile(p)).catch(() => {});
    }
  }, [runIntro, user]));

  const go = async (route: string) => {
    Haptics.selectionAsync();
    if (navigating) return;
    setNavigating(route);
    router.push(route);
    // Release the guard after the transition settles so re-taps are allowed.
    setTimeout(() => setNavigating(null), 400);
  };

  const isDark = mode === 'dark';
  // Name they set → email → "Fashion Explorer". Emails are long, so the name
  // text below scales itself down to fit instead of clipping.
  const displayName = resolveDisplayName(user, userProfile);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.textAccent} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Top bar — wordmark + time */}
          <View style={styles.topBar}>
            <Text style={[styles.wordmark, { color: theme.text }]}>UpTrends</Text>
            <Text style={[styles.clock, { color: theme.textTertiary }]}>{now}</Text>
          </View>

          {/* Greeting */}
          <Animated.View
            style={{ opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}
          >
            <Text style={[styles.greetingLabel, { color: theme.textTertiary }]}>
              {greeting.toUpperCase()}
            </Text>
            <Text
              style={[styles.greetingName, { color: theme.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {displayName}
            </Text>
          </Animated.View>

          {/* Style Toolkit rail */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>Style Toolkit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {TOOLKIT.map((tile) => (
                <Animated.View
                  key={tile.key}
                  style={{
                    opacity: intro,
                    transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                  }}
                >
                  <EditorialCard tile={tile} theme={theme} onPress={() => go(tile.route)} />
                </Animated.View>
              ))}
            </ScrollView>
          </View>

          {/* Remaining destinations grid */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>Explore</Text>
            <View style={styles.grid}>
              {TILES.map((tile) => (
                <Animated.View
                  key={tile.key}
                  style={[
                    styles.gridCell,
                    {
                      opacity: intro,
                      transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
                    },
                  ]}
                >
                  <GridTile tile={tile} theme={theme} onPress={() => go(tile.route)} />
                </Animated.View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---- Editorial building blocks ----

interface CardProps {
  tile: Tile;
  theme: any;
  onPress: () => void;
}

/** Horizontal toolkit card — glass panel, icon circle, label-caps title. */
function EditorialCard({ tile, theme, onPress }: CardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.toolkitCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.borderLight,
          shadowColor: '#000',
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
        <Ionicons name={tile.icon} size={20} color={theme.textAccent} />
      </View>
      <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
        {tile.title}
      </Text>
      {tile.desc ? (
        <Text style={[styles.cardDesc, { color: theme.textTertiary }]} numberOfLines={2}>
          {tile.desc}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

/** Compact grid card — icon circle + label. */
function GridTile({ tile, theme, onPress }: CardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.gridCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.borderLight,
          shadowColor: '#000',
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
        <Ionicons name={tile.icon} size={18} color={theme.textAccent} />
      </View>
      <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={2}>
        {tile.title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 28,
  },
  wordmark: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  clock: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  greetingLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  greetingName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 38,
    letterSpacing: -0.5,
    lineHeight: 46,
  },

  section: { marginTop: 32 },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },

  rail: { gap: 12, paddingRight: 8 },
  toolkitCard: {
    width: 232,
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    // subtle platform shadow for depth on the obsidian/ivory base
    shadowOpacity: Platform.OS === 'ios' ? 0.10 : 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  gridCell: { width: '48.5%' },
  gridCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOpacity: Platform.OS === 'ios' ? 0.08 : 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  cardDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  gridTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    flex: 1,
  },
});
