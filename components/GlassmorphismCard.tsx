import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

interface GlassmorphismCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    intensity?: number;
    tint?: 'light' | 'dark' | 'default';
    gradient?: string[];
    borderRadius?: number;
    borderWidth?: number;
    shadowColor?: string;
    shadowOpacity?: number;
    shadowRadius?: number;
    elevation?: number;
    animated?: boolean;
    pressable?: boolean;
    onPress?: () => void;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const GlassmorphismCard: React.FC<GlassmorphismCardProps> = ({
    children,
    style,
    intensity = 25,
    tint = 'light',
    gradient,
    borderRadius = 20,
    borderWidth = 1,
    shadowColor = 'rgba(0, 0, 0, 0.1)',
    shadowOpacity = 0.1,
    shadowRadius = 10,
    elevation = 5,
    animated = false,
    pressable = false,
    onPress,
}) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = () => {
        if (pressable) {
            scale.value = withSpring(0.98);
            opacity.value = withTiming(0.8, { duration: 150 });
        }
    };

    const handlePressOut = () => {
        if (pressable) {
            scale.value = withSpring(1);
            opacity.value = withTiming(1, { duration: 150 });
            onPress?.();
        }
    };

    const cardStyle = [
        styles.card,
        {
            borderRadius,
            borderWidth,
            shadowColor,
            shadowOpacity,
            shadowRadius,
            elevation,
            shadowOffset: { width: 0, height: shadowRadius / 2 },
        },
        style,
    ];

    if (Platform.OS === 'web') {
        // Web fallback with CSS backdrop-filter
        return (
            <Animated.View
                style={[
                    cardStyle,
                    animated && animatedStyle,
                    {
                        backgroundColor: gradient
                            ? 'transparent'
                            : tint === 'dark'
                                ? 'rgba(0, 0, 0, 0.3)'
                                : 'rgba(255, 255, 255, 0.25)',
                        borderColor: tint === 'dark'
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(255, 255, 255, 0.2)',
                    } as any,
                    Platform.OS === 'web' && {
                        backdropFilter: `blur(${intensity}px)`,
                    } as any,
                ]}
                onTouchStart={handlePressIn}
                onTouchEnd={handlePressOut}
            >
                {gradient && gradient.length >= 2 && (
                    <AnimatedLinearGradient
                        colors={gradient as [string, string, ...string[]]}
                        style={[StyleSheet.absoluteFillObject, { borderRadius }]}
                    />
                )}
                <View style={styles.content}>
                    {children}
                </View>
            </Animated.View>
        );
    }

    // Native implementation with BlurView
    return (
        <Animated.View style={[animated && animatedStyle]}>
            <AnimatedBlurView
                intensity={intensity}
                tint={tint}
                style={[
                    cardStyle,
                    {
                        borderColor: tint === 'dark'
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(255, 255, 255, 0.2)',
                    },
                ]}
                onTouchStart={handlePressIn}
                onTouchEnd={handlePressOut}
            >
                {gradient && gradient.length >= 2 && (
                    <AnimatedLinearGradient
                        colors={gradient as [string, string, ...string[]]}
                        style={[StyleSheet.absoluteFillObject, { borderRadius }]}
                    />
                )}
                <View style={styles.content}>
                    {children}
                </View>
            </AnimatedBlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        overflow: 'hidden',
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
});

export default GlassmorphismCard;