import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';

interface EnhancedButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
    size?: 'small' | 'medium' | 'large';
    icon?: keyof typeof Ionicons.glyphMap;
    iconPosition?: 'left' | 'right';
    loading?: boolean;
    disabled?: boolean;
    gradient?: string[];
    style?: ViewStyle;
    textStyle?: any;
    fullWidth?: boolean;
    hapticFeedback?: boolean;
    glowEffect?: boolean;
    pulseOnPress?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const EnhancedButton: React.FC<EnhancedButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    gradient,
    style,
    textStyle,
    fullWidth = false,
    hapticFeedback = true,
    glowEffect = false,
    pulseOnPress = true,
}) => {
    const { theme } = useTheme();

    // Animation values
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);
    const glowOpacity = useSharedValue(0);
    const rotation = useSharedValue(0);

    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return {
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    fontSize: 14,
                    iconSize: 16,
                    borderRadius: 12,
                };
            case 'large':
                return {
                    paddingHorizontal: 32,
                    paddingVertical: 16,
                    fontSize: 18,
                    iconSize: 24,
                    borderRadius: 20,
                };
            default:
                return {
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    fontSize: 16,
                    iconSize: 20,
                    borderRadius: 16,
                };
        }
    };

    const getVariantStyles = () => {
        const sizeStyles = getSizeStyles();

        switch (variant) {
            case 'secondary':
                return {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    borderWidth: 1,
                    textColor: theme.text,
                    gradient: gradient || [theme.cardSecondary, theme.card],
                };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderColor: theme.primary,
                    borderWidth: 2,
                    textColor: theme.primary,
                    gradient: null,
                };
            case 'ghost':
                return {
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    borderWidth: 0,
                    textColor: theme.primary,
                    gradient: null,
                };
            case 'glass':
                return {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    textColor: '#fff',
                    gradient: gradient || ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)'],
                };
            default:
                return {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                    borderWidth: 0,
                    textColor: '#fff',
                    gradient: gradient || theme.gradientHome,
                };
        }
    };

    const sizeStyles = getSizeStyles();
    const variantStyles = getVariantStyles();

    const handlePressIn = async () => {
        if (disabled || loading) return;

        if (hapticFeedback) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        if (pulseOnPress) {
            scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
            opacity.value = withTiming(0.8, { duration: 100 });
        }

        if (glowEffect) {
            glowOpacity.value = withTiming(1, { duration: 200 });
        }
    };

    const handlePressOut = () => {
        if (disabled || loading) return;

        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(1, { duration: 150 });

        if (glowEffect) {
            glowOpacity.value = withTiming(0, { duration: 300 });
        }

        onPress();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const loadingRotation = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    // Loading animation
    React.useEffect(() => {
        if (loading) {
            rotation.value = withTiming(360, { duration: 1000 }, () => {
                rotation.value = 0;
            });
        }
    }, [loading]);

    const buttonStyle = [
        styles.button,
        {
            paddingHorizontal: sizeStyles.paddingHorizontal,
            paddingVertical: sizeStyles.paddingVertical,
            borderRadius: sizeStyles.borderRadius,
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
            borderWidth: variantStyles.borderWidth,
            opacity: disabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
    ];

    const textStyles = [
        styles.text,
        {
            fontSize: sizeStyles.fontSize,
            color: variantStyles.textColor,
        },
        textStyle,
    ];

    return (
        <View style={styles.container}>
            {/* Glow effect */}
            {glowEffect && (
                <Animated.View
                    style={[
                        styles.glow,
                        {
                            borderRadius: sizeStyles.borderRadius + 4,
                            backgroundColor: theme.primaryGlow || theme.primary + '40',
                        },
                        glowStyle,
                    ]}
                />
            )}

            <AnimatedTouchableOpacity
                style={[buttonStyle, animatedStyle]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                activeOpacity={1}
            >
                {variantStyles.gradient && variantStyles.gradient.length >= 2 ? (
                    <AnimatedLinearGradient
                        colors={variantStyles.gradient as [string, string, ...string[]]}
                        style={[
                            StyleSheet.absoluteFillObject,
                            { borderRadius: sizeStyles.borderRadius },
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                ) : null}

                <View style={styles.content}>
                    {/* Left icon */}
                    {icon && iconPosition === 'left' && !loading && (
                        <Ionicons
                            name={icon}
                            size={sizeStyles.iconSize}
                            color={variantStyles.textColor}
                            style={styles.iconLeft}
                        />
                    )}

                    {/* Loading spinner */}
                    {loading && (
                        <Animated.View style={[styles.iconLeft, loadingRotation]}>
                            <Ionicons
                                name="sync"
                                size={sizeStyles.iconSize}
                                color={variantStyles.textColor}
                            />
                        </Animated.View>
                    )}

                    {/* Title */}
                    <Text style={textStyles} numberOfLines={1}>
                        {loading ? 'Loading...' : title}
                    </Text>

                    {/* Right icon */}
                    {icon && iconPosition === 'right' && !loading && (
                        <Ionicons
                            name={icon}
                            size={sizeStyles.iconSize}
                            color={variantStyles.textColor}
                            style={styles.iconRight}
                        />
                    )}
                </View>
            </AnimatedTouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    fullWidth: {
        width: '100%',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    text: {
        fontWeight: '600',
        textAlign: 'center',
    },
    iconLeft: {
        marginRight: 8,
    },
    iconRight: {
        marginLeft: 8,
    },
    glow: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        zIndex: -1,
    },
});

export default EnhancedButton;