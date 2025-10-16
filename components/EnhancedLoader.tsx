import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import GlassmorphismCard from './GlassmorphismCard';

const { width: screenWidth } = Dimensions.get('window');

interface EnhancedLoaderProps {
    message?: string;
    submessage?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    gradient?: string[];
    showProgress?: boolean;
    progress?: number;
}

export const EnhancedLoader: React.FC<EnhancedLoaderProps> = ({
    message = 'Loading...',
    submessage = 'Please wait while we process your request',
    icon = 'sparkles',
    gradient,
    showProgress = false,
    progress = 0,
}) => {
    const { theme } = useTheme();

    // Animation values
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);
    const progressWidth = useSharedValue(0);

    // Particle animations
    const particle1 = useSharedValue(0);
    const particle2 = useSharedValue(0);
    const particle3 = useSharedValue(0);

    // Dot animations
    const dot1Scale = useSharedValue(1);
    const dot2Scale = useSharedValue(1);
    const dot3Scale = useSharedValue(1);

    useEffect(() => {
        // Main entrance animation
        opacity.value = withTiming(1, { duration: 500 });
        translateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });

        // Continuous rotation
        rotation.value = withRepeat(
            withTiming(360, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );

        // Pulsing scale
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Floating particles
        particle1.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        particle2.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        particle3.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Staggered dot animations
        const dotAnimation = withRepeat(
            withSequence(
                withTiming(1.5, { duration: 600, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Start animations with delays
        setTimeout(() => {
            dot1Scale.value = dotAnimation;
        }, 0);
        
        setTimeout(() => {
            dot2Scale.value = dotAnimation;
        }, 200);
        
        setTimeout(() => {
            dot3Scale.value = dotAnimation;
        }, 400);
    }, []);

    useEffect(() => {
        if (showProgress) {
            progressWidth.value = withTiming(progress, { duration: 300 });
        }
    }, [progress, showProgress]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` },
            { scale: scale.value },
        ],
    }));

    const particle1Style = useAnimatedStyle(() => ({
        transform: [
            { translateY: particle1.value * -30 },
            { translateX: particle1.value * 20 },
        ],
        opacity: particle1.value,
    }));

    const particle2Style = useAnimatedStyle(() => ({
        transform: [
            { translateY: particle2.value * -40 },
            { translateX: particle2.value * -15 },
        ],
        opacity: particle2.value,
    }));

    const particle3Style = useAnimatedStyle(() => ({
        transform: [
            { translateY: particle3.value * -25 },
            { translateX: particle3.value * 30 },
        ],
        opacity: particle3.value,
    }));

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progressWidth.value}%`,
    }));

    const dot1Style = useAnimatedStyle(() => ({
        transform: [{ scale: dot1Scale.value }],
    }));

    const dot2Style = useAnimatedStyle(() => ({
        transform: [{ scale: dot2Scale.value }],
    }));

    const dot3Style = useAnimatedStyle(() => ({
        transform: [{ scale: dot3Scale.value }],
    }));

    const defaultGradient = gradient || theme.gradientHome;
    const safeGradient = defaultGradient && defaultGradient.length >= 2
        ? defaultGradient as [string, string, ...string[]]
        : ['#667eea', '#764ba2'] as [string, string]; // Fallback gradient

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={safeGradient}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Floating particles */}
            <Animated.View style={[styles.particle, styles.particle1, particle1Style]}>
                <Ionicons name="diamond" size={8} color="rgba(255,255,255,0.6)" />
            </Animated.View>
            <Animated.View style={[styles.particle, styles.particle2, particle2Style]}>
                <Ionicons name="star" size={6} color="rgba(255,255,255,0.4)" />
            </Animated.View>
            <Animated.View style={[styles.particle, styles.particle3, particle3Style]}>
                <Ionicons name="sparkles" size={10} color="rgba(255,255,255,0.5)" />
            </Animated.View>

            <Animated.View style={[styles.content, containerStyle]}>
                <GlassmorphismCard
                    style={styles.card}
                    intensity={30}
                    tint="light"
                    borderRadius={24}
                    shadowRadius={20}
                    shadowOpacity={0.3}
                    animated
                >
                    <View style={styles.cardContent}>
                        {/* Main icon */}
                        <Animated.View style={[styles.iconContainer, iconStyle]}>
                            <Ionicons name={icon} size={48} color="#fff" />
                        </Animated.View>

                        {/* Messages */}
                        <Text style={styles.message}>{message}</Text>
                        <Text style={styles.submessage}>{submessage}</Text>

                        {/* Progress bar */}
                        {showProgress && (
                            <View style={styles.progressContainer}>
                                <View style={styles.progressTrack}>
                                    <Animated.View style={[styles.progressBar, progressStyle]} />
                                </View>
                                <Text style={styles.progressText}>{Math.round(progress)}%</Text>
                            </View>
                        )}

                        {/* Loading dots */}
                        <View style={styles.dotsContainer}>
                            <Animated.View style={[styles.dot, dot1Style]} />
                            <Animated.View style={[styles.dot, dot2Style]} />
                            <Animated.View style={[styles.dot, dot3Style]} />
                        </View>
                    </View>
                </GlassmorphismCard>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    card: {
        paddingHorizontal: 32,
        paddingVertical: 40,
        minWidth: screenWidth * 0.8,
        maxWidth: 320,
    },
    cardContent: {
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 24,
        padding: 16,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    message: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    submessage: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    progressContainer: {
        width: '100%',
        marginBottom: 20,
    },
    progressTrack: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        marginHorizontal: 4,
    },
    particle: {
        position: 'absolute',
    },
    particle1: {
        top: '20%',
        left: '15%',
    },
    particle2: {
        top: '30%',
        right: '20%',
    },
    particle3: {
        top: '60%',
        left: '25%',
    },
});

export default EnhancedLoader;