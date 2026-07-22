// Shared components for twinning screens
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';


interface PhotoSlot {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  image?: string;
  required: boolean;
  needsName?: boolean;
  placeholder: string;
}

interface ContextInputCardProps {
  title: string;
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  theme: any;
  primaryColor: string;
  required?: boolean;
  multiline?: boolean;
}

export function ContextInputCard({
  title,
  icon,
  placeholder,
  value,
  onChangeText,
  theme,
  primaryColor,
  required = false,
  multiline = false
}: ContextInputCardProps) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withSpring(isFocused ? 1 : 0, { damping: 15, stiffness: 300 });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: isFocused
      ? primaryColor
      : value
        ? '#22c55e'
        : theme.borderLight,
    borderWidth: isFocused ? 2 : 1,
    transform: [{ scale: withSpring(isFocused ? 1.02 : 1, { damping: 15, stiffness: 300 }) }],
  }));

  return (
    <Animated.View style={[styles.contextCard, animatedStyle]}>
      <View style={styles.contextHeader}>
        <View style={[styles.contextIconContainer, { backgroundColor: `${primaryColor}15` }]}>
          <Ionicons name={icon as any} size={20} color={primaryColor} />
        </View>
        <Text style={[styles.contextTitle, { color: theme.text }]}>
          {title}
          {required && <Text style={{ color: primaryColor }}> *</Text>}
        </Text>
      </View>

      <TextInput
        style={[
          styles.contextInput,
          multiline && styles.contextInputMultiline,
          {
            backgroundColor: theme.card,
            color: theme.text,
            borderColor: isFocused ? primaryColor : 'transparent'
          }
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        returnKeyType={multiline ? 'default' : 'done'}
      />

      {value && (
        <View style={styles.contextSuccessIndicator}>
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contextCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contextIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  contextInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    minHeight: 44,
  },
  contextInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  contextSuccessIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});
// Enhanced loading animation component
export function LoadingDots() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      dot1.value = withSpring(1, { duration: 600 }, () => {
        dot1.value = withSpring(0, { duration: 600 });
      });

      setTimeout(() => {
        dot2.value = withSpring(1, { duration: 600 }, () => {
          dot2.value = withSpring(0, { duration: 600 });
        });
      }, 200);

      setTimeout(() => {
        dot3.value = withSpring(1, { duration: 600 }, () => {
          dot3.value = withSpring(0, { duration: 600 });
        });
      }, 400);
    };

    animate();
    const interval = setInterval(animate, 1800);
    return () => clearInterval(interval);
  }, []);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.5 + dot1.value * 0.5 }],
    opacity: 0.3 + dot1.value * 0.7,
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.5 + dot2.value * 0.5 }],
    opacity: 0.3 + dot2.value * 0.7,
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.5 + dot3.value * 0.5 }],
    opacity: 0.3 + dot3.value * 0.7,
  }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
      <Animated.View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', marginHorizontal: 4 }, dot1Style]} />
      <Animated.View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', marginHorizontal: 4 }, dot2Style]} />
      <Animated.View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', marginHorizontal: 4 }, dot3Style]} />
    </View>
  );
}

// Smooth fade-in text component
export function FadeInText({ text, style, delay = 0 }: { text: string; style: any; delay?: number }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withSpring(1, { duration: 800 });
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={style}>{text}</Text>
    </Animated.View>
  );
}

// Gender Toggle Component
interface GenderToggleProps {
  gender: 'male' | 'female';
  onGenderChange: (gender: 'male' | 'female') => void;
  theme: any;
}

export function GenderToggle({ gender, onGenderChange, theme }: GenderToggleProps) {
  return (
    <View style={genderStyles.genderToggleContainer}>
      <Text style={[genderStyles.genderLabel, { color: theme.text }]}>Gender</Text>
      <View style={[genderStyles.genderToggle, { borderColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[
            genderStyles.genderOption,
            gender === 'male' && genderStyles.genderOptionActive,
            { backgroundColor: gender === 'male' ? '#3b82f6' : theme.card }
          ]}
          onPress={() => onGenderChange('male')}
        >
          <Ionicons
            name="man"
            size={16}
            color={gender === 'male' ? '#fff' : theme.textSecondary}
          />
          <Text style={[
            genderStyles.genderOptionText,
            { color: gender === 'male' ? '#fff' : theme.textSecondary }
          ]}>
            Male
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            genderStyles.genderOption,
            gender === 'female' && genderStyles.genderOptionActive,
            { backgroundColor: gender === 'female' ? '#ec4899' : theme.card }
          ]}
          onPress={() => onGenderChange('female')}
        >
          <Ionicons
            name="woman"
            size={16}
            color={gender === 'female' ? '#fff' : theme.textSecondary}
          />
          <Text style={[
            genderStyles.genderOptionText,
            { color: gender === 'female' ? '#fff' : theme.textSecondary }
          ]}>
            Female
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Orbit Progress Indicator — Modern step-by-step progress UI
interface AnimatedProgressProps {
  steps: string[];
  currentStep: number;
  completedSteps: string[];
  theme: any;
  primaryColor: string;
}

export function AnimatedProgress({ steps, currentStep, completedSteps, theme, primaryColor }: AnimatedProgressProps) {
  if (!theme || !primaryColor) return null;
  
  const safeSteps = steps || [];
  const safeCompletedSteps = completedSteps || [];
  const safeCurrentStep = currentStep || 0;
  const totalSteps = Math.max(safeSteps.length, 1);
  const progressPercent = Math.min(Math.round((safeCurrentStep / Math.max(totalSteps - 1, 1)) * 100), 100);

  // Get the current active step text
  const activeStepText = safeCompletedSteps.length > 0 
    ? safeCompletedSteps[safeCompletedSteps.length - 1] 
    : safeSteps[0] || 'Starting...';

  return (
    <View style={progressStyles.container}>
      {/* Central Active Step */}
      <View style={progressStyles.activeStepContainer}>
        <ActiveStepIndicator 
          primaryColor={primaryColor} 
          isComplete={progressPercent >= 100} 
        />
        <Text style={[progressStyles.activeStepText, { color: theme.text }]} numberOfLines={2}>
          {activeStepText?.replace(/^[^\w]*/, '') || 'Processing...'}
        </Text>
      </View>

      {/* Dot Indicators */}
      <View style={progressStyles.dotsRow}>
        {safeSteps.slice(0, Math.min(safeSteps.length, 8)).map((_, index) => (
          <View
            key={index}
            style={[
              progressStyles.dot,
              {
                backgroundColor: index < safeCurrentStep 
                  ? '#22c55e' 
                  : index === safeCurrentStep 
                    ? primaryColor 
                    : `${primaryColor}30`,
                width: index === safeCurrentStep ? 12 : 8,
                height: index === safeCurrentStep ? 12 : 8,
                borderRadius: index === safeCurrentStep ? 6 : 4,
              }
            ]}
          />
        ))}
      </View>
      <Text style={[progressStyles.stepCounter, { color: theme.textSecondary }]}>
        Step {Math.min(safeCurrentStep + 1, totalSteps)} of {totalSteps}
      </Text>

      {/* Gradient Progress Bar */}
      <View style={progressStyles.progressBarContainer}>
        <View style={[progressStyles.progressBar, { backgroundColor: `${primaryColor}15` }]}>
          <Animated.View
            style={[
              progressStyles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: primaryColor,
              }
            ]}
          />
        </View>
        <Text style={[progressStyles.percentText, { color: primaryColor }]}>
          {progressPercent}%
        </Text>
      </View>

      {/* Completed Steps (compact list) */}
      {safeCompletedSteps.length > 1 && (
        <View style={progressStyles.completedContainer}>
          {safeCompletedSteps.slice(0, -1).slice(-4).map((step, index) => (
            <View key={index} style={progressStyles.completedRow}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text 
                style={[progressStyles.completedText, { color: theme.textSecondary }]} 
                numberOfLines={1}
              >
                {step?.replace(/^[^\w]*/, '') || ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Pulsing active step icon
function ActiveStepIndicator({ primaryColor, isComplete }: { primaryColor: string; isComplete: boolean }) {
  const pulseAnim = useSharedValue(1);
  const glowAnim = useSharedValue(0.3);

  useEffect(() => {
    if (!isComplete) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(0.2, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withSpring(1);
      glowAnim.value = withTiming(0);
    }
  }, [isComplete]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value,
  }));

  return (
    <View style={progressStyles.activeIconWrapper}>
      <Animated.View style={[progressStyles.activeGlow, glowStyle, { backgroundColor: primaryColor }]} />
      <Animated.View style={[progressStyles.activeIcon, pulseStyle, { backgroundColor: primaryColor }]}>
        <Ionicons 
          name={isComplete ? "checkmark" : "sparkles"} 
          size={24} 
          color="#fff" 
        />
      </Animated.View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Active step
  activeStepContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  activeStepText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  activeIconWrapper: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  activeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  // Dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    borderRadius: 6,
  },
  stepCounter: {
    fontSize: 13,
    marginBottom: 24,
    textAlign: 'center',
  },
  // Progress bar
  progressBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 38,
    textAlign: 'right',
  },
  // Completed steps
  completedContainer: {
    width: '100%',
    paddingHorizontal: 8,
    gap: 6,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  completedText: {
    fontSize: 13,
    flex: 1,
  },
});

const genderStyles = StyleSheet.create({
  genderToggleContainer: {
    marginTop: 12,
  },
  genderLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  genderToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  genderOptionActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});