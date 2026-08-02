// components/AnimatedSplash.tsx
// Custom animated splash screen with light/dark mode support.
// All animations run on the UI thread via reanimated (zero JS-thread jank).
// Shows brand logo badge, app name, tagline, floating particles, and loading dots.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedSplashProps {
  isDark: boolean;
  onFinish: () => void;
}

// ─── Floating particle ─────────────────────────────────────────────────────────
// Lightweight circle that drifts upward from bottom to top in a loop.
const Particle: React.FC<{
  delay: number;
  startX: number;
  size: number;
  duration: number;
  isDark: boolean;
}> = ({ delay, startX, size, duration, isDark }) => {
  const y = useSharedValue(SCREEN_HEIGHT + 50);
  const opacity = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-50, { duration, easing: Easing.linear }),
          withTiming(SCREEN_HEIGHT + 50, { duration: 0 })
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(delay, withTiming(0.35, { duration: 800 }));
  }, []);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startX,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? 'rgba(165,180,252,0.3)' : 'rgba(102,126,234,0.25)',
        },
        style,
      ]}
    />
  );
};

// ─── Loading dots ──────────────────────────────────────────────────────────────
// Three dots that pulse in sequence, synced to React state via animatedReaction.
const LoadingDots: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const dot1 = useSharedValue(0.2);
  const dot2 = useSharedValue(0.2);
  const dot3 = useSharedValue(0.2);

  const [d1, setD1] = useState(0.2);
  const [d2, setD2] = useState(0.2);
  const [d3, setD3] = useState(0.2);

  useAnimatedReaction(() => dot1.value, (v) => runOnJS(setD1)(v));
  useAnimatedReaction(() => dot2.value, (v) => runOnJS(setD2)(v));
  useAnimatedReaction(() => dot3.value, (v) => runOnJS(setD3)(v));

  useEffect(() => {
    const pulse = (sv: Animated.SharedValue<number>, delayMs: number) => {
      sv.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.2, { duration: 420, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        )
      );
    };
    pulse(dot1, 0);
    pulse(dot2, 210);
    pulse(dot3, 420);
  }, []);

  const dotColor = isDark ? '#a5b4fc' : '#667eea';

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {[d1, d2, d3].map((opacity, i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dotColor,
            opacity,
          }}
        />
      ))}
    </View>
  );
};

// ─── Main splash ───────────────────────────────────────────────────────────────
const AnimatedSplashInner: React.FC<AnimatedSplashProps> = ({ isDark, onFinish }) => {
  // ── Shared values for entrance / exit ──
  const badgeScale = useSharedValue(0.3);
  const badgeOpacity = useSharedValue(0);
  const nameOpacity = useSharedValue(0);
  const nameY = useSharedValue(24);
  const taglineOpacity = useSharedValue(0);
  const dotsOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  // Container exit animation
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  const [done, setDone] = useState(false);

  // ── Animated styles ──
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: badgeOpacity.value,
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const dotsStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  // ── Entrance + exit timeline ──
  useEffect(() => {
    // Badge entrance
    badgeScale.value = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    badgeOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    glowOpacity.value = withDelay(350, withTiming(1, { duration: 600 }));

    // Continuous glow pulse
    pulseScale.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1.18, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // Text stagger
    nameOpacity.value = withDelay(550, withTiming(1, { duration: 500 }));
    nameY.value = withDelay(550, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    taglineOpacity.value = withDelay(850, withTiming(1, { duration: 500 }));
    dotsOpacity.value = withDelay(1050, withTiming(1, { duration: 400 }));

    // Exit after ~2.4 s
    const exitTimer = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) });
      containerScale.value = withTiming(
        1.06,
        { duration: 500, easing: Easing.in(Easing.cubic) },
        () => {
          runOnJS(setDone)(true);
          runOnJS(onFinish)();
        }
      );
    }, 2400);

    return () => clearTimeout(exitTimer);
  }, []);

  // Particle config — stable via useMemo (must be before early return)
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        delay: i * 280,
        startX: (i * SCREEN_WIDTH) / 14 + ((i % 3) * 18),
        size: 4 + (i % 4) * 1.5,
        duration: 4200 + (i % 3) * 800,
      })),
    []
  );

  if (done) return null;

  const gradientColors: [string, string, ...string[]] = isDark
    ? ['#0f172a', '#1e1b4b', '#0f172a']
    : ['#f0f4ff', '#e8eeff', '#f0f4ff'];

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          alignItems: 'center',
          justifyContent: 'center',
        },
        containerStyle,
      ]}
    >
      {/* Gradient background */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Dark-mode radial glow */}
      {isDark && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 360,
            height: 360,
            borderRadius: 180,
            backgroundColor: 'transparent',
            shadowColor: '#6366f1',
            shadowOpacity: 0.55,
            shadowRadius: 120,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      )}

      {/* Light-mode mesh blobs (static — zero cost) */}
      {!isDark && (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '12%',
              left: '-10%',
              width: 300,
              height: 300,
              borderRadius: 150,
              backgroundColor: 'rgba(244,114,182,0.12)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: '15%',
              right: '-8%',
              width: 260,
              height: 260,
              borderRadius: 130,
              backgroundColor: 'rgba(56,189,248,0.1)',
            }}
          />
        </>
      )}

      {/* Floating particles */}
      {particles.map((p) => (
        <Particle
          key={p.id}
          delay={p.delay}
          startX={p.startX}
          size={p.size}
          duration={p.duration}
          isDark={isDark}
        />
      ))}

      {/* Glow behind badge */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(102,126,234,0.13)',
            shadowColor: '#667eea',
            shadowOpacity: 0.6,
            shadowRadius: 60,
            shadowOffset: { width: 0, height: 0 },
          },
          glowStyle,
        ]}
      />

      {/* Brand badge */}
      <Animated.View
        style={[
          {
            width: 120,
            height: 120,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: isDark ? 'rgba(165,180,252,0.2)' : 'rgba(102,126,234,0.18)',
            backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.7)',
            shadowColor: '#667eea',
            shadowOpacity: isDark ? 0.5 : 0.35,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 10 },
          },
          badgeStyle,
        ]}
      >
        <Ionicons name="flame" size={56} color={isDark ? '#a5b4fc' : '#667eea'} />
      </Animated.View>

      {/* App name */}
      <Animated.View style={[{ marginTop: 28, alignItems: 'center' }, nameStyle]}>
        <Text
          style={{
            fontSize: 34,
            fontWeight: '800',
            color: isDark ? '#e2e8f0' : '#1e293b',
            letterSpacing: 0.5,
          }}
        >
          UpTrends
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[{ marginTop: 8, alignItems: 'center' }, taglineStyle]}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#94a3b8' : '#64748b',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Style  •  Analyze  •  Elevate
        </Text>
      </Animated.View>

      {/* Loading dots */}
      <Animated.View style={[{ marginTop: 52 }, dotsStyle]}>
        <LoadingDots isDark={isDark} />
      </Animated.View>
    </Animated.View>
  );
};

// Wrap with React.memo — splash props never change between renders.
const AnimatedSplash = React.memo(AnimatedSplashInner);

export default AnimatedSplash;
