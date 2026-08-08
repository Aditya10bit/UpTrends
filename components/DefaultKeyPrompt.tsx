import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import KeyUpgradeModal from './KeyUpgradeModal';

// Shows a small auto-dismissing banner on app launch when the user is still on
// the shared default API key, nudging them to add their own. Tapping it opens
// the full KeyUpgradeModal (reused — no duplicated UI).
//
// NOTE: We check AsyncStorage directly here (same key + validity rule as
// geminiService.ts) rather than importing getActiveKeySource, so the huge
// geminiService module isn't pulled into the app's initial startup bundle.
const CUSTOM_KEY_STORAGE_KEY = 'user_gemini_api_key';
const SHOW_DELAY_MS = 600;   // after splash completes
const BANNER_DURATION_MS = 4000;

export default function DefaultKeyPrompt() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  // One cheap AsyncStorage read on launch. No saved key = on the default key.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    AsyncStorage.getItem(CUSTOM_KEY_STORAGE_KEY)
      .then((customKey) => {
        const trimmed = (customKey || '').trim();
        const hasOwnKey = !!(trimmed && trimmed.length > 10);
        if (!hasOwnKey) {
          timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
        }
      })
      .catch(() => {});
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Auto-dismiss after a few seconds.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), BANNER_DURATION_MS);
    return () => clearTimeout(t);
  }, [visible]);

  // Keep the banner mounted while animating; unmount once fully hidden.
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    Animated.spring(progress, {
      toValue: visible ? 1 : 0,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  const openModal = () => {
    setVisible(false);
    setShowModal(true);
  };

  if (!mounted && !showModal) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [140, 0] });

  return (
    <>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.wrap,
          {
            bottom: insets.bottom + 16,
            opacity: progress,
            transform: [{ translateY }],
          },
        ]}
      >
        <Pressable
          onPress={openModal}
          style={({ pressed }) => [
            styles.banner,
            {
              backgroundColor: theme.card,
              borderColor: theme.borderLight,
              shadowColor: theme.shadow,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <View style={styles.iconBadge}>
            <Ionicons name="key" size={16} color="#fff" />
          </View>
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              Shared AI key in use
            </Text>
            <Text style={[styles.message, { color: theme.textSecondary }]} numberOfLines={1}>
              Tap to add your free Gemini key — faster & personal
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setVisible(false)}
            style={styles.close}
            hitSlop={10}
          >
            <Ionicons name="close" size={15} color={theme.textTertiary} />
          </TouchableOpacity>
        </Pressable>
      </Animated.View>

      <KeyUpgradeModal visible={showModal} onClose={() => setShowModal(false)} theme={theme} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
    elevation: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 12,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d97706',
    marginRight: 11,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  message: {
    fontSize: 12,
    marginTop: 1,
  },
  close: {
    padding: 2,
  },
});
