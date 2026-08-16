// components/StyleRatingCard.tsx
// Glassmorphism style-score card. All value animations run on the UI thread via
// reanimated (lower memory than RN's JS-thread Animated), with an SVG gradient
// score ring, animated count-up numbers, and gradient category bars.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useId, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

interface StyleRatingCardProps {
  result: {
    overallRating: number;
    categoryRatings: {
      colorHarmony: number;
      fitAndSilhouette: number;
      occasionAppropriate: number;
      accessoriesBalance: number;
      styleCoherence: number;
    };
  };
  theme: any;
}

// ─── Rating tiers ─────────────────────────────────────────────────────────────
const TIER_GREEN = { main: '#10b981', gradient: ['#6ee7b7', '#059669'] };
const TIER_AMBER = { main: '#f59e0b', gradient: ['#fcd34d', '#d97706'] };
const TIER_RED = { main: '#ef4444', gradient: ['#fca5a5', '#dc2626'] };

const getTier = (rating: number) =>
  rating >= 80 ? TIER_GREEN : rating >= 60 ? TIER_AMBER : TIER_RED;

const getVerdict = (rating: number) => {
  if (rating >= 90) return 'Excellent';
  if (rating >= 80) return 'Great';
  if (rating >= 70) return 'Good';
  if (rating >= 60) return 'Fair';
  return 'Needs Work';
};

const CATEGORY_LABELS = {
  colorHarmony: 'Color Harmony',
  fitAndSilhouette: 'Fit & Silhouette',
  occasionAppropriate: 'Occasion Match',
  accessoriesBalance: 'Accessories',
  styleCoherence: 'Style Coherence',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Score ring + count-up number, both driven by one shared value. The ring animates
// on the UI thread (animatedProps); the number is synced to React state because
// reanimated can't update a Text's `text` prop directly.
const CircularProgress: React.FC<{
  size: number;
  strokeWidth: number;
  progress: SharedValue<number>;
  tier: typeof TIER_GREEN;
  trackColor: string;
}> = ({ size, strokeWidth, progress, tier, trackColor }) => {
  const gradId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const [score, setScore] = useState(0);

  const ringProps = useAnimatedProps<any>(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
  }));

  // Count the number up by syncing integer steps to React state (only fires when
  // the rounded value actually changes, so it's not a per-frame re-render).
  useAnimatedReaction(
    () => Math.round(progress.value),
    (value, prev) => {
      if (value !== prev) runOnJS(setScore)(value);
    },
    [progress]
  );

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={tier.gradient[0]} />
            <Stop offset="100%" stopColor={tier.gradient[1]} />
          </SvgGradient>
        </Defs>
        {/* soft halo behind the ring */}
        <Circle
          stroke={tier.main}
          opacity={0.16}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth * 0.5}
        />
        {/* track */}
        <Circle
          stroke={trackColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* progress */}
        <AnimatedCircle
          stroke={`url(#${gradId})`}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={ringProps}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 40,
            fontWeight: '800',
            color: tier.main,
            fontVariant: ['tabular-nums'],
          }}
        >
          {score}
        </Text>
        <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '700', letterSpacing: 3 }}>
          SCORE
        </Text>
      </View>
    </View>
  );
};

// Single category row: fill scales on the GPU (transform, native-driver friendly)
// and the percentage counts up — both UI-thread.
interface CategoryRowProps {
  label: string;
  rating: number;
  index: number;
  theme: any;
}

const CategoryRowInner: React.FC<CategoryRowProps> = ({ label, rating, index, theme }) => {
  const tier = getTier(rating);
  const fill = useSharedValue(0);
  const [value, setValue] = useState(0);

  const fillStyle = useAnimatedStyle(() => ({
    transformOrigin: 'left',
    transform: [{ scaleX: fill.value / 100 }],
  }));

  // Sync the count-up percentage to React state (only on integer changes).
  useAnimatedReaction(
    () => Math.round(fill.value),
    (v, prev) => {
      if (v !== prev) runOnJS(setValue)(v);
    },
    [fill]
  );

  useEffect(() => {
    fill.value = 0;
    fill.value = withDelay(
      200 + index * 120,
      withTiming(rating, { duration: 900, easing: Easing.out(Easing.cubic) })
    );
  }, [fill, index, rating]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ flex: 1.1, color: theme.text, fontSize: 13.5, fontWeight: '600' }}>
        {label}
      </Text>
      <View
        style={{
          flex: 1.6,
          height: 10,
          borderRadius: 5,
          backgroundColor: theme.surfaceTertiary,
          overflow: 'hidden',
          marginHorizontal: 12,
        }}
      >
        <Animated.View
          style={[
            {
              width: '100%',
              height: '100%',
              borderRadius: 5,
              backgroundColor: tier.main,
            },
            fillStyle,
          ]}
        />
      </View>
      <Text
        style={{
          width: 38,
          textAlign: 'right',
          fontSize: 13,
          fontWeight: '700',
          color: tier.main,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
};

const CategoryRow = memo(CategoryRowInner);

const StyleRatingCard: React.FC<StyleRatingCardProps> = ({ result, theme }) => {
  const overallTier = getTier(result.overallRating);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const progress = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    translateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [opacity, translateY]);

  // Re-run the ring animation whenever a new analysis result arrives.
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      150,
      withTiming(result.overallRating, { duration: 1500, easing: Easing.out(Easing.cubic) })
    );
  }, [progress, result.overallRating]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const categories = Object.entries(result.categoryRatings) as [
    keyof typeof CATEGORY_LABELS,
    number
  ][];

  return (
    <Animated.View style={[{ marginHorizontal: 24, marginBottom: 24 }, entranceStyle]}>
      <LinearGradient
        colors={[theme.surfaceElevated, theme.cardSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 24,
          overflow: 'hidden',
          shadowColor: theme.shadow,
          shadowOpacity: theme.background === '#0e0e0e' ? 0.45 : 0.6,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
        }}
      >
        {/* decorative corner glow (static — zero animation cost) */}
        <LinearGradient
          pointerEvents="none"
          colors={[overallTier.main + '1f', 'transparent']}
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: 80,
          }}
        />

        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles" size={18} color={overallTier.main} />
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, letterSpacing: 0.3 }}>
              Overall Style Score
            </Text>
          </View>
          <Text style={{ marginTop: 4, fontSize: 12.5, color: theme.textTertiary, fontWeight: '500' }}>
            How well this look works for you
          </Text>
        </View>

        {/* Score ring */}
        <View style={{ alignItems: 'center' }}>
          <CircularProgress
            size={156}
            strokeWidth={11}
            progress={progress}
            tier={overallTier}
            trackColor={theme.surfaceTertiary}
          />
        </View>

        {/* Glowing verdict pill */}
        <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 22 }}>
          <LinearGradient
            colors={[overallTier.main + '3d', overallTier.main + '0d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 22,
              paddingVertical: 9,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: overallTier.main + '80',
              shadowColor: overallTier.main,
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <View
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: overallTier.main }}
            />
            <Text
              style={{ color: overallTier.main, fontWeight: '800', fontSize: 14, letterSpacing: 1.5 }}
            >
              {getVerdict(result.overallRating).toUpperCase()}
            </Text>
          </LinearGradient>
        </View>

        <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 18, opacity: 0.7 }} />

        {/* Category breakdown */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View
            style={{
              width: 4,
              height: 16,
              borderRadius: 2,
              backgroundColor: overallTier.main,
              marginRight: 8,
            }}
          />
          <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>
            Category Breakdown
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          {categories.map(([key, rating], index) => (
            <CategoryRow
              key={key}
              label={CATEGORY_LABELS[key]}
              rating={rating}
              index={index}
              theme={theme}
            />
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

export default StyleRatingCard;
