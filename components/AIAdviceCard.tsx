import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

type AIAdviceCardProps = {
  advice: string[] | null;
  onExpand: () => void;
  isProfileComplete: boolean;
  theme: {
    card: string;
    primary: string;
    text: string;
    dark?: boolean;
  };
};

export default function AIAdviceCard({
  advice,
  onExpand,
  isProfileComplete,
  theme,
}: AIAdviceCardProps) {
  const colorScheme = useColorScheme();
  const isDark = theme?.dark ?? colorScheme === 'dark';

  return (
    <Animated.View
      entering={FadeInDown.duration(700)}
      style={[
        styles.card,
        {
          backgroundColor: isDark
            ? 'rgba(30,32,40,0.65)'
            : 'rgba(255,255,255,0.65)',
          borderColor: isDark ? '#444' : '#e0e0e0',
          shadowColor: isDark ? '#222' : '#bbb',
        },
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ['#2e2e4d', '#232336']
            : ['#f9fafb', '#e0e7ff']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.iconRow}>
        <Text style={styles.glowBulb}>💡</Text>
        <Text
          style={[
            styles.title,
            { color: isDark ? '#ffd700' : '#6d28d9' },
          ]}
        >
          AI Style Tip
        </Text>
      </View>
      <Text
        style={[
          styles.text,
          { color: isDark ? '#fff' : '#2d2d2d' },
        ]}
        numberOfLines={2}
      >
        {isProfileComplete
          ? advice?.slice(0, 2).join(' ') ||
            'No advice found for your profile.'
          : 'Please fill your profile for personalized AI advice.'}
      </Text>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: isDark ? '#6d28d9' : '#6366f1',
            shadowColor: isDark ? '#ffd700' : '#6366f1',
          },
        ]}
        activeOpacity={0.85}
        onPress={onExpand}
      >
        <Ionicons
          name="arrow-forward-circle"
          size={20}
          color="#fff"
          style={{ marginRight: 6 }}
        />
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
          See More
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
    position: 'relative',
    zIndex: 10,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  glowBulb: {
    fontSize: 30,
    marginRight: 10,
    textShadowColor: '#ffe066',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    shadowOpacity: 0.7,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  text: {
    fontSize: 15.5,
    marginBottom: 16,
    marginTop: 2,
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
});
