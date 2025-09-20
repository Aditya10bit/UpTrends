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

// Animated Progress Component
interface AnimatedProgressProps {
  steps: string[];
  currentStep: number;
  completedSteps: string[];
  theme: any;
  primaryColor: string;
}

export function AnimatedProgress({ steps, currentStep, completedSteps, theme, primaryColor }: AnimatedProgressProps) {
  // Safety checks for props
  if (!theme || !primaryColor) {
    return null;
  }
  
  const safeSteps = steps || [];
  const safeCompletedSteps = completedSteps || [];
  const safeCurrentStep = currentStep || 0;

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.stepsContainer}>
        {safeCompletedSteps
          .filter(step => step && typeof step === 'string')
          .map((step, index) => (
            <AnimatedProgressStep
              key={index}
              step={step}
              index={index}
              isActive={index === safeCurrentStep}
              isCompleted={index < safeCurrentStep}
              theme={theme}
              primaryColor={primaryColor}
            />
          ))}
      </View>

      <View style={progressStyles.progressBarContainer}>
        <View style={[progressStyles.progressBar, { backgroundColor: `${primaryColor}20` }]}>
          <Animated.View
            style={[
              progressStyles.progressFill,
              {
                width: `${(safeCurrentStep / Math.max((safeSteps?.length || 1) - 1, 1)) * 100}%`,
                backgroundColor: primaryColor
              }
            ]}
          />
        </View>
        <Text style={[progressStyles.progressText, { color: theme.textSecondary }]}>
          {safeCurrentStep + 1} of {safeSteps?.length || 0} steps completed
        </Text>
      </View>
    </View>
  );
}

interface AnimatedProgressStepProps {
  step: string;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  theme: any;
  primaryColor: string;
}

function AnimatedProgressStep({ step, index, isActive, isCompleted, theme, primaryColor }: AnimatedProgressStepProps) {
  // Safety check: if step is invalid, don't render anything
  if (!step || typeof step !== 'string') {
    return null;
  }

  // Safety check: ensure theme and primaryColor are valid
  if (!theme || !primaryColor) {
    return null;
  }

  const slideAnim = useSharedValue(50);
  const opacityAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.8);
  const pulseAnim = useSharedValue(1);

  // Check if this is the AI recommendations step
  const isAIStep = step.includes('🤖 Getting AI fashion recommendations');

  useEffect(() => {
    // Animate in from bottom
    slideAnim.value = withSpring(0, { damping: 15, stiffness: 300 });
    opacityAnim.value = withTiming(1, { duration: 500 });
    scaleAnim.value = withSpring(1, { damping: 12, stiffness: 200 });

    // Special pulsing animation for AI step
    if (isActive && isAIStep) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 300 });
    }

    // If completed, animate out after a delay
    if (isCompleted && !isActive) {
      setTimeout(() => {
        slideAnim.value = withSpring(-20, { damping: 15, stiffness: 300 });
        opacityAnim.value = withTiming(0.6, { duration: 300 });
        scaleAnim.value = withSpring(0.9, { damping: 12, stiffness: 200 });
      }, 1000);
    }
  }, [isActive, isCompleted, isAIStep]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: slideAnim.value },
      { scale: scaleAnim.value * pulseAnim.value }
    ],
    opacity: opacityAnim.value,
  }));

  return (
    <Animated.View style={[progressStyles.stepContainer, animatedStyle]}>
      <View style={progressStyles.stepContent}>
        <View style={[
          progressStyles.stepIcon,
          {
            backgroundColor: isActive ? primaryColor : isCompleted ? '#22c55e' : `${primaryColor}20`,
          }
        ]}>
          {isCompleted ? (
            <Ionicons name="checkmark" size={16} color="#fff" />
          ) : isActive && isAIStep ? (
            <Ionicons name="flash" size={16} color="#fff" />
          ) : (
            <View style={[progressStyles.stepDot, { backgroundColor: isActive ? '#fff' : primaryColor }]} />
          )}
        </View>
        <Text style={[
          progressStyles.stepText,
          {
            color: isActive ? theme.text : theme.textSecondary,
            fontWeight: isActive ? '600' : '400'
          }
        ]}>
          {step || 'Processing...'}
        </Text>
      </View>
    </Animated.View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  stepsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  stepContainer: {
    marginBottom: 16,
  },
  stepContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  progressBarContainer: {
    paddingTop: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
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