import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');
const baseWidth = 375;

const getResponsiveSize = (size: number) => (screenWidth / baseWidth) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / baseWidth;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

export default function MainScreen() {
  const { theme } = useTheme();
  const { user, logout, loading } = useAuth();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(-100)).current;
  const cardAnim1 = useRef(new Animated.Value(1)).current;
  const cardAnim2 = useRef(new Animated.Value(1)).current;
  const userInfoAnim = useRef(new Animated.Value(0)).current;
  const logoutAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startEntranceAnimations();
    startContinuousAnimations();
  }, []);

  const startEntranceAnimations = () => {
    Animated.sequence([
      Animated.timing(headerAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(200, [
        Animated.timing(cardAnim1, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(cardAnim2, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(userInfoAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(logoutAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const startContinuousAnimations = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
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

  const navigateToFashion = () => {
    Animated.sequence([
      Animated.timing(cardAnim1, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim1, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/fashion');
    });
  };

  const navigateToProfile = () => {
    Animated.sequence([
      Animated.timing(cardAnim2, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim2, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/profile');
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} backgroundColor={theme.primary} />
      <Animated.View style={{
        transform: [{ translateY: headerAnim }]
      }}>
        <LinearGradient
          colors={[theme.primary, theme.secondary]}
          style={styles.header}
        >
          <Text style={[styles.title, { color: theme.text }]}>UpTrends</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Your Fashion Companion</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[
        styles.content,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ]
        }
      ]}>
        <View style={styles.navigationGrid}>
          {/* Fashion Screen */}
          <Animated.View style={[
            styles.cardWrapper,
            {
              transform: [
                { scale: cardAnim1 },
                { rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '1deg']
                }) }
              ]
            }
          ]}>
            <TouchableOpacity
              style={styles.navCard}
              onPress={navigateToFashion}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[theme.primary, theme.secondary]}
                style={styles.cardGradient}
                start={{ x: 0.1, y: 0.1 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="shirt-outline" size={getResponsiveSize(40)} color={theme.background} />
                <Text style={[styles.cardTitle, { color: theme.background }]}>Explore Fashion</Text>
                <Text style={[styles.cardSubtitle, { color: theme.background + '99' }]}>Discover new outfits</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Profile Screen */}
          <Animated.View style={[
            styles.cardWrapper,
            {
              transform: [
                { scale: cardAnim2 },
                { rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-1deg']
                }) }
              ]
            }
          ]}>
            <TouchableOpacity
              style={styles.navCard}
              onPress={navigateToProfile}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[theme.secondary, theme.primary]}
                style={styles.cardGradient}
                start={{ x: 0.1, y: 0.1 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="person-outline" size={getResponsiveSize(40)} color={theme.background} />
                <Text style={[styles.cardTitle, { color: theme.background }]}>My Profile</Text>
                <Text style={[styles.cardSubtitle, { color: theme.background + '99' }]}>View saved favorites</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* User Info */}
        <Animated.View style={[
          styles.userInfo,
          { backgroundColor: theme.card },
          {
            opacity: userInfoAnim,
            transform: [{ translateY: userInfoAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            }) }]
          }
        ]}>
          <Text style={[styles.welcomeText, { color: theme.text }]}>Welcome back!</Text>
          <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user?.email}</Text>
        </Animated.View>

        {/* Logout Button */}
        <Animated.View style={{
          opacity: logoutAnim,
          transform: [{ scale: logoutAnim }]
        }}>
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.error }]} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: getResponsiveFontSize(18),
  },
  header: {
    paddingTop: getResponsiveSize(40),
    paddingBottom: getResponsiveSize(40),
    paddingHorizontal: getResponsiveSize(20),
    alignItems: 'center',
  },
  title: {
    fontSize: getResponsiveFontSize(32),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(8),
  },
  subtitle: {
    fontSize: getResponsiveFontSize(16),
  },
  content: {
    flex: 1,
    padding: getResponsiveSize(20),
  },
  navigationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: getResponsiveSize(40),
    width: '100%',
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: getResponsiveSize(6),
    minWidth: getResponsiveSize(150),
    maxWidth: getResponsiveSize(180),
  },
  navCard: {
    borderRadius: getResponsiveSize(16),
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
    minHeight: getResponsiveSize(150),
    maxHeight: getResponsiveSize(200),
  },
  cardGradient: {
    flex: 1,
    padding: getResponsiveSize(24),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: getResponsiveSize(150),
    width: '100%',
  },
  cardTitle: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
    marginTop: getResponsiveSize(12),
    marginBottom: getResponsiveSize(4),
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: getResponsiveFontSize(14),
    textAlign: 'center',
  },
  userInfo: {
    padding: getResponsiveSize(20),
    borderRadius: getResponsiveSize(12),
    marginBottom: getResponsiveSize(20),
    width: '100%',
  },
  welcomeText: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(4),
  },
  userEmail: {
    fontSize: getResponsiveFontSize(16),
  },
  logoutButton: {
    padding: getResponsiveSize(16),
    borderRadius: getResponsiveSize(12),
    alignItems: 'center',
    width: '100%',
  },
  logoutText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
  },
});
