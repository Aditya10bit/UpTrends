import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const baseWidth = 375;

const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / baseWidth;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

// Glassmorphism component
interface GlassCardProps {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
}

const GlassCard = ({ children, style, intensity = 20, tint = 'light' }: GlassCardProps) => {
  if (Platform.OS === 'web') {
    return (
      <View style={[{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
      }, style]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={[{
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    }, style]}>
      {children}
    </BlurView>
  );
};

export default function MainScreen() {
  const { theme } = useTheme();
  const { user, loading } = useAuth();

  // Enhanced Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(-100)).current;
  const cardAnim1 = useRef(new Animated.Value(0)).current;
  const cardAnim2 = useRef(new Animated.Value(0)).current;
  const cardAnim3 = useRef(new Animated.Value(0)).current;
  const cardAnim4 = useRef(new Animated.Value(0)).current;

  const floatingAnim1 = useRef(new Animated.Value(0)).current;
  const floatingAnim2 = useRef(new Animated.Value(0)).current;
  const floatingAnim3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const particleAnim1 = useRef(new Animated.Value(0)).current;
  const particleAnim2 = useRef(new Animated.Value(0)).current;
  const particleAnim3 = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const morphAnim = useRef(new Animated.Value(0)).current;

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    startContinuousAnimations();
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  // Use useFocusEffect to handle screen focus properly
  useFocusEffect(
    useCallback(() => {
      // Reset animation values to initial state when screen comes into focus
      resetAnimationValues();
      startEntranceAnimations();

      return () => {
        // Cleanup function when screen loses focus
        setIsExiting(false);
        setIsNavigating(false);
      };
    }, [])
  );

  const resetAnimationValues = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    scaleAnim.setValue(0.9);
    headerAnim.setValue(-100);
    cardAnim1.setValue(0);
    cardAnim2.setValue(0);
    cardAnim3.setValue(0);
    cardAnim4.setValue(0);

    glowAnim.setValue(0);
    morphAnim.setValue(0);
  };

  const startExitAnimation = (callback: () => void) => {
    if (isExiting) return;
    setIsExiting(true);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
    });
  };

  const startEntranceAnimations = () => {
    Animated.sequence([
      // Header entrance with elastic effect
      Animated.timing(headerAnim, {
        toValue: 0,
        duration: 1200,
        easing: Easing.out(Easing.elastic(1.2)),
        useNativeDriver: true,
      }),
      // Main content fade and slide
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      // Staggered card animations with bounce
      Animated.stagger(150, [
        Animated.spring(cardAnim1, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(cardAnim2, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(cardAnim3, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(cardAnim4, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Final elements
      Animated.parallel([

        Animated.timing(morphAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const startContinuousAnimations = () => {
    // Smooth rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Wave animation for background
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Multiple floating animations with different speeds
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim1, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnim1, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim2, {
          toValue: 1,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnim2, {
          toValue: 0,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim3, {
          toValue: 1,
          duration: 5500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnim3, {
          toValue: 0,
          duration: 5500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Gentle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Particle animations
    Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim1, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim2, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim2, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim3, {
          toValue: 1,
          duration: 7000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim3, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={{
          transform: [{
            rotate: rotateAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            })
          }]
        }}>
          <Ionicons name="shirt-outline" size={40} color={theme.primary} />
        </Animated.View>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return null;
  }

  const navigateToFashion = async () => {
    if (isNavigating || isExiting) return;
    setIsNavigating(true);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.spring(cardAnim1, {
        toValue: 0.92,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim1, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startExitAnimation(() => {
        router.push('/fashion');
        setTimeout(() => setIsNavigating(false), 500);
      });
    });
  };

  const navigateToProfile = async () => {
    if (isNavigating || isExiting) return;
    setIsNavigating(true);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.spring(cardAnim2, {
        toValue: 0.92,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim2, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startExitAnimation(() => {
        router.push('/profile');
        setTimeout(() => setIsNavigating(false), 500);
      });
    });
  };

  const navigateToUploadAesthetic = async () => {
    if (isNavigating || isExiting) return;
    setIsNavigating(true);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.spring(cardAnim3, {
        toValue: 0.92,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim3, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startExitAnimation(() => {
        router.push('/upload-aesthetic');
        setTimeout(() => setIsNavigating(false), 500);
      });
    });
  };

  const navigateToStyleCheck = async () => {
    if (isNavigating || isExiting) return;
    setIsNavigating(true);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.spring(cardAnim4, {
        toValue: 0.92,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim4, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startExitAnimation(() => {
        router.push('/style-check');
        setTimeout(() => setIsNavigating(false), 500);
      });
    });
  };

  const navigateToMakeOutfit = async () => {
    if (isNavigating || isExiting) return;
    setIsNavigating(true);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.spring(cardAnim4, {
        toValue: 0.92,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim4, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startExitAnimation(() => {
        router.push('/make-outfit');
        setTimeout(() => setIsNavigating(false), 500);
      });
    });
  };

  const navigateToBodyAnalysis = async () => {
    if (isNavigating || isExiting) return;
    setIsNavigating(true);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.spring(cardAnim4, {
        toValue: 0.92,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim4, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startExitAnimation(() => {
        router.push('/body-analysis');
        setTimeout(() => setIsNavigating(false), 500);
      });
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Animated Background with Gradient */}
      <Animated.View style={[
        StyleSheet.absoluteFillObject,
        {
          transform: [{
            translateY: waveAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -20]
            })
          }]
        }
      ]}>
        <LinearGradient
          colors={[
            theme.background === '#18181b'
              ? '#1a1a2e'
              : '#667eea',
            theme.background === '#18181b'
              ? '#16213e'
              : '#764ba2',
            theme.background === '#18181b'
              ? '#0f3460'
              : '#f093fb'
          ]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Floating Particles */}
      <Animated.View style={[
        styles.particle,
        {
          top: '10%',
          left: '20%',
          transform: [
            {
              translateY: particleAnim1.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -screenHeight * 1.2]
              })
            },
            {
              rotate: particleAnim1.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              })
            }
          ],
          opacity: particleAnim1.interpolate({
            inputRange: [0, 0.1, 0.9, 1],
            outputRange: [0, 1, 1, 0]
          })
        }
      ]}>
        <Ionicons name="diamond" size={8} color="rgba(255,255,255,0.3)" />
      </Animated.View>

      <Animated.View style={[
        styles.particle,
        {
          top: '20%',
          right: '15%',
          transform: [
            {
              translateY: particleAnim2.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -screenHeight * 1.2]
              })
            },
            {
              rotate: particleAnim2.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '-360deg']
              })
            }
          ],
          opacity: particleAnim2.interpolate({
            inputRange: [0, 0.1, 0.9, 1],
            outputRange: [0, 1, 1, 0]
          })
        }
      ]}>
        <Ionicons name="star" size={6} color="rgba(255,255,255,0.4)" />
      </Animated.View>

      <Animated.View style={[
        styles.particle,
        {
          top: '30%',
          left: '80%',
          transform: [
            {
              translateY: particleAnim3.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -screenHeight * 1.2]
              })
            },
            {
              scale: particleAnim3.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.5, 1.2, 0.5]
              })
            }
          ],
          opacity: particleAnim3.interpolate({
            inputRange: [0, 0.1, 0.9, 1],
            outputRange: [0, 1, 1, 0]
          })
        }
      ]}>
        <Ionicons name="sparkles" size={10} color="rgba(255,255,255,0.2)" />
      </Animated.View>

      <SafeAreaView style={styles.safeArea}>
        {/* Header with Glassmorphism */}
        <Animated.View style={[
          styles.headerContainer,
          {
            transform: [{ translateY: headerAnim }],
            opacity: glowAnim
          }
        ]}>
          <GlassCard style={styles.headerGlass} intensity={80} tint="dark">
            <View style={styles.headerContent}>
              {/* Time Display */}
              <Animated.View style={[
                styles.timeContainer,
                {
                  transform: [{
                    scale: pulseAnim
                  }]
                }
              ]}>
                <Text style={styles.timeText}>{formatTime()}</Text>
                <Text style={styles.dateText}>{currentTime.toLocaleDateString()}</Text>
              </Animated.View>

              {/* Main Title with Floating Elements */}
              <View style={styles.titleContainer}>
                <Animated.View style={[
                  styles.floatingIcon,
                  {
                    transform: [
                      {
                        translateY: floatingAnim1.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -8]
                        })
                      },
                      {
                        rotate: rotateAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })
                      }
                    ]
                  }
                ]}>
                  <Ionicons name="diamond-outline" size={24} color="rgba(255,255,255,0.6)" />
                </Animated.View>

                <Animated.View style={{
                  transform: [{ scale: pulseAnim }]
                }}>
                  <Text style={styles.mainTitle}>UpTrends</Text>
                  <Text style={styles.subtitle}>{getGreeting()}, Fashion Explorer!</Text>
                </Animated.View>

                <Animated.View style={[
                  styles.floatingIcon2,
                  {
                    transform: [
                      {
                        translateY: floatingAnim2.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 6]
                        })
                      },
                      { scale: pulseAnim }
                    ]
                  }
                ]}>
                  <Ionicons name="sparkles" size={20} color="rgba(255,255,255,0.4)" />
                </Animated.View>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Main Content */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[
            styles.mainContent,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}>
            {/* Navigation Grid with Glassmorphism Cards */}
            <View style={styles.gridContainer}>
              {/* Fashion Card */}
              <Animated.View style={[
                styles.cardContainer,
                {
                  transform: [
                    { scale: cardAnim1 },
                    {
                      rotateY: morphAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '2deg']
                      })
                    }
                  ]
                }
              ]}>
                <TouchableOpacity
                  onPress={navigateToFashion}
                  activeOpacity={0.9}
                  style={styles.cardTouchable}
                >
                  <GlassCard style={styles.navCard} intensity={60} tint="light">
                    <LinearGradient
                      colors={['rgba(102, 126, 234, 0.8)', 'rgba(118, 75, 162, 0.8)']}
                      style={styles.cardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Animated.View style={[
                        styles.cardIconContainer,
                        {
                          transform: [{
                            rotate: floatingAnim1.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '5deg']
                            })
                          }]
                        }
                      ]}>
                        <Ionicons name="shirt-outline" size={32} color="#fff" />
                      </Animated.View>
                      <Text style={styles.cardTitle}>Explore Fashion</Text>
                      <Text style={styles.cardDescription}>Discover trending outfits</Text>
                      <View style={styles.cardGlow} />
                    </LinearGradient>
                  </GlassCard>
                </TouchableOpacity>
              </Animated.View>

              {/* Profile Card */}
              <Animated.View style={[
                styles.cardContainer,
                {
                  transform: [
                    { scale: cardAnim2 },
                    {
                      rotateY: morphAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '-2deg']
                      })
                    }
                  ]
                }
              ]}>
                <TouchableOpacity
                  onPress={navigateToProfile}
                  activeOpacity={0.9}
                  style={styles.cardTouchable}
                >
                  <GlassCard style={styles.navCard} intensity={60} tint="light">
                    <LinearGradient
                      colors={['rgba(240, 147, 251, 0.8)', 'rgba(245, 101, 101, 0.8)']}
                      style={styles.cardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Animated.View style={[
                        styles.cardIconContainer,
                        {
                          transform: [{
                            scale: floatingAnim2.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.1]
                            })
                          }]
                        }
                      ]}>
                        <Ionicons name="person-outline" size={32} color="#fff" />
                      </Animated.View>
                      <Text style={styles.cardTitle}>My Profile</Text>
                      <Text style={styles.cardDescription}>Manage your style</Text>
                      <View style={styles.cardGlow} />
                    </LinearGradient>
                  </GlassCard>
                </TouchableOpacity>
              </Animated.View>

              {/* Style Check Card */}
              <Animated.View style={[
                styles.cardContainer,
                {
                  transform: [
                    { scale: cardAnim3 },
                    {
                      rotateX: morphAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '2deg']
                      })
                    }
                  ]
                }
              ]}>
                <TouchableOpacity
                  onPress={navigateToStyleCheck}
                  activeOpacity={0.9}
                  style={styles.cardTouchable}
                >
                  <GlassCard style={styles.navCard} intensity={60} tint="light">
                    <LinearGradient
                      colors={['rgba(255, 107, 107, 0.8)', 'rgba(255, 142, 83, 0.8)']}
                      style={styles.cardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Animated.View style={[
                        styles.cardIconContainer,
                        {
                          transform: [{
                            rotate: floatingAnim3.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '-5deg']
                            })
                          }]
                        }
                      ]}>
                        <Ionicons name="sparkles" size={32} color="#fff" />
                      </Animated.View>
                      <Text style={styles.cardTitle}>Style Check</Text>
                      <Text style={styles.cardDescription}>AI outfit analysis</Text>
                      <View style={styles.cardGlow} />
                    </LinearGradient>
                  </GlassCard>
                </TouchableOpacity>
              </Animated.View>

              {/* Upload Aesthetic Card */}
              <Animated.View style={[
                styles.cardContainer,
                {
                  transform: [
                    { scale: cardAnim3 },
                    {
                      rotateX: morphAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '2deg']
                      })
                    }
                  ]
                }
              ]}>
                <TouchableOpacity
                  onPress={navigateToUploadAesthetic}
                  activeOpacity={0.9}
                  style={styles.cardTouchable}
                >
                  <GlassCard style={styles.navCard} intensity={60} tint="light">
                    <LinearGradient
                      colors={['rgba(72, 187, 120, 0.8)', 'rgba(56, 178, 172, 0.8)']}
                      style={styles.cardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Animated.View style={[
                        styles.cardIconContainer,
                        {
                          transform: [{
                            rotate: floatingAnim3.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '-5deg']
                            })
                          }]
                        }
                      ]}>
                        <Ionicons name="camera-outline" size={32} color="#fff" />
                      </Animated.View>
                      <Text style={styles.cardTitle}>Upload Style</Text>
                      <Text style={styles.cardDescription}>Share your aesthetic</Text>
                      <View style={styles.cardGlow} />
                    </LinearGradient>
                  </GlassCard>
                </TouchableOpacity>
              </Animated.View>

              {/* Body Analysis Card */}
              <Animated.View style={[
                styles.cardContainer,
                {
                  transform: [
                    { scale: cardAnim4 },
                    {
                      rotateX: morphAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '-2deg']
                      })
                    }
                  ]
                }
              ]}>
                <TouchableOpacity
                  onPress={navigateToBodyAnalysis}
                  activeOpacity={0.9}
                  style={styles.cardTouchable}
                >
                  <GlassCard style={styles.navCard} intensity={60} tint="light">
                    <LinearGradient
                      colors={['rgba(168, 85, 247, 0.8)', 'rgba(139, 92, 246, 0.8)']}
                      style={styles.cardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Animated.View style={[
                        styles.cardIconContainer,
                        {
                          transform: [{
                            scale: pulseAnim
                          }]
                        }
                      ]}>
                        <Ionicons name="body-outline" size={32} color="#fff" />
                      </Animated.View>
                      <Text style={styles.cardTitle}>Learn About Your Body</Text>
                      <Text style={styles.cardDescription}>Get personalized tips</Text>
                      <View style={styles.cardGlow} />
                    </LinearGradient>
                  </GlassCard>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>


      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  loadingText: {
    fontSize: getResponsiveFontSize(18),
    color: '#fff',
    marginTop: 16,
  },

  // Particles
  particle: {
    position: 'absolute',
    zIndex: 1,
  },

  // Header Styles
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerGlass: {
    padding: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    padding: 24,
    alignItems: 'center',
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  titleContainer: {
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  floatingIcon: {
    position: 'absolute',
    top: -10,
    left: 20,
  },
  floatingIcon2: {
    position: 'absolute',
    top: -5,
    right: 30,
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },

  // ScrollView Container
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },

  // Main Content
  mainContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  // Grid Container
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  cardContainer: {
    width: '48%',
    marginBottom: 16,
    aspectRatio: 1,
  },
  cardTouchable: {
    flex: 1,
  },
  navCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 20,
  },
  cardIconContainer: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.5,
  },


  userInfoCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  userInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  statusIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },


});
