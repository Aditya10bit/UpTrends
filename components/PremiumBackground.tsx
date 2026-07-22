import React, { memo } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * PremiumBackground – A GPU‑efficient mesh‑gradient glass layer.
 *
 * In **light mode** it renders 4 large, soft gradient "blobs" positioned
 * around the screen and then applies a native BlurView over them.
 * The result is a beautiful, Apple‑visionOS‑style frosted mesh.
 *
 * In **dark mode** it is fully transparent so the regular dark theme
 * surfaces remain untouched.
 *
 * Usage: Wrap your screen content:
 *   <PremiumBackground>
 *     <ScrollView>…</ScrollView>
 *   </PremiumBackground>
 *
 * You can also pass a `variant` prop to tint the blobs per‑screen.
 */

export type PremiumVariant =
  | 'default'
  | 'profile'
  | 'wardrobe'
  | 'fashion'
  | 'twinning'
  | 'friends'
  | 'makeOutfit'
  | 'styleCheck'
  | 'bodyAnalysis'
  | 'todaysOutfit';

// Each variant defines 4 blob colours that blend with the blur.
const BLOB_PALETTES: Record<PremiumVariant, string[][]> = {
  default: [
    ['#c7d2fe', '#e0e7ff'], // indigo wash
    ['#ddd6fe', '#ede9fe'], // violet wash
    ['#fbcfe8', '#fce7f3'], // pink wash
    ['#a5f3fc', '#cffafe'], // cyan wash
  ],
  profile: [
    ['#a5f3fc', '#cffafe'],
    ['#bae6fd', '#e0f2fe'],
    ['#c4b5fd', '#ddd6fe'],
    ['#99f6e4', '#ccfbf1'],
  ],
  wardrobe: [
    ['#fbcfe8', '#fce7f3'],
    ['#fecdd3', '#ffe4e6'],
    ['#fed7aa', '#ffedd5'],
    ['#ddd6fe', '#ede9fe'],
  ],
  fashion: [
    ['#fde68a', '#fef3c7'],
    ['#fed7aa', '#ffedd5'],
    ['#fecdd3', '#ffe4e6'],
    ['#c7d2fe', '#e0e7ff'],
  ],
  twinning: [
    ['#fecdd3', '#ffe4e6'],
    ['#fbcfe8', '#fce7f3'],
    ['#ddd6fe', '#ede9fe'],
    ['#c7d2fe', '#e0e7ff'],
  ],
  friends: [
    ['#bfdbfe', '#dbeafe'],
    ['#a5f3fc', '#cffafe'],
    ['#bbf7d0', '#dcfce7'],
    ['#c7d2fe', '#e0e7ff'],
  ],
  makeOutfit: [
    ['#ddd6fe', '#ede9fe'],
    ['#fbcfe8', '#fce7f3'],
    ['#fde68a', '#fef3c7'],
    ['#c7d2fe', '#e0e7ff'],
  ],
  styleCheck: [
    ['#a7f3d0', '#d1fae5'],
    ['#6ee7b7', '#a7f3d0'],
    ['#bae6fd', '#e0f2fe'],
    ['#c7d2fe', '#e0e7ff'],
  ],
  bodyAnalysis: [
    ['#c4b5fd', '#ddd6fe'],
    ['#a5f3fc', '#cffafe'],
    ['#fbcfe8', '#fce7f3'],
    ['#fde68a', '#fef3c7'],
  ],
  todaysOutfit: [
    ['#c7d2fe', '#e0e7ff'],
    ['#fde68a', '#fef3c7'],
    ['#fbcfe8', '#fce7f3'],
    ['#a5f3fc', '#cffafe'],
  ],
};

interface PremiumBackgroundProps {
  children: React.ReactNode;
  variant?: PremiumVariant;
  /** Override the background colour applied behind the blobs. */
  baseColor?: string;
}

const PremiumBackground = memo(({
  children,
  variant = 'default',
  baseColor,
}: PremiumBackgroundProps) => {
  const { mode, theme } = useTheme();

  // In dark mode, just render a plain container – no overhead.
  if (mode === 'dark') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {children}
      </View>
    );
  }

  const palette = BLOB_PALETTES[variant] || BLOB_PALETTES.default;

  return (
    <View style={[styles.container, { backgroundColor: baseColor || '#f0f4ff' }]}>
      {/* Layer 1 – Gradient blobs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top-left blob */}
        <LinearGradient
          colors={palette[0] as [string, string]}
          style={[styles.blob, styles.blobTopLeft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* Top-right blob */}
        <LinearGradient
          colors={palette[1] as [string, string]}
          style={[styles.blob, styles.blobTopRight]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Bottom-left blob */}
        <LinearGradient
          colors={palette[2] as [string, string]}
          style={[styles.blob, styles.blobBottomLeft]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
        />
        {/* Bottom-right blob */}
        <LinearGradient
          colors={palette[3] as [string, string]}
          style={[styles.blob, styles.blobBottomRight]}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
        />
      </View>

      {/* Layer 2 – Native blur overlay that blends the blobs into a mesh */}
      {Platform.OS !== 'web' ? (
        <BlurView
          intensity={80}
          tint="light"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(255,255,255,0.55)' },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Layer 3 – Actual screen content */}
      {children}
    </View>
  );
});

PremiumBackground.displayName = 'PremiumBackground';
export default PremiumBackground;

const BLOB_SIZE = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.6;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    opacity: 0.6,
  },
  blobTopLeft: {
    top: -BLOB_SIZE * 0.3,
    left: -BLOB_SIZE * 0.25,
  },
  blobTopRight: {
    top: -BLOB_SIZE * 0.15,
    right: -BLOB_SIZE * 0.3,
  },
  blobBottomLeft: {
    bottom: -BLOB_SIZE * 0.25,
    left: -BLOB_SIZE * 0.2,
  },
  blobBottomRight: {
    bottom: -BLOB_SIZE * 0.35,
    right: -BLOB_SIZE * 0.25,
  },
});
