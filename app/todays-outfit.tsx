import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { generateTodaysOutfit } from '../services/geminiService';
import { getUserProfile } from '../services/userService';
import { clearWeatherCache, getCurrentWeather, getWeatherBasedTheme, WeatherData } from '../services/weatherService';
import { checkUserGender, promptForGender } from '../utils/genderUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TodaysOutfit {
  id: string;
  title: string;
  description: string;
  items: string[];
  colors: string[];
  style_tips: string[];
  weather_reason: string;
  shopping_links: Array<{
    platform: string;
    url: string;
    description: string;
    icon: string;
  }>;
  daily_quote: string;
  mood: string;
}

export default function TodaysOutfitScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [todaysOutfit, setTodaysOutfit] = useState<TodaysOutfit | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weatherTheme, setWeatherTheme] = useState<any>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Animations
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const pulseAnim = useSharedValue(1);
  const rotateAnim = useSharedValue(0);

  useEffect(() => {
    loadData();
    startAnimations();
  }, []);

  const startAnimations = () => {
    fadeAnim.value = withTiming(1, { duration: 800 });
    slideAnim.value = withSpring(0, { damping: 15, stiffness: 150 });

    // Pulse animation for weather icon
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );

    // Rotate animation for loading
    rotateAnim.value = withRepeat(
      withTiming(360, { duration: 2000 }),
      -1,
      false
    );
  };

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    console.log('📍 Location permission status:', status);
    setLocationPermission(status);

    if (status === 'undetermined') {
      console.log('❓ Location permission undetermined, showing modal');
      setShowPermissionModal(true);
      return false;
    }

    if (status === 'granted') {
      console.log('✅ Location permission already granted');
    } else {
      console.log('❌ Location permission denied');
    }

    return status === 'granted';
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status);
    setShowPermissionModal(false);

    if (status === 'granted') {
      console.log('✅ Location permission granted, getting user location');
      // Load with actual user location
      await loadWeatherAndOutfit(true);
    } else {
      console.log('❌ Location permission denied, using default location');
      // Load with default location (Delhi)
      await loadWeatherAndOutfit(false);
    }
  };

  const loadWeatherAndOutfit = async (useLocation: boolean) => {
    try {
      setLoading(true);

      let weatherData;
      
      if (useLocation && locationPermission === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          weatherData = await getCurrentWeather(location.coords.latitude, location.coords.longitude);
        } catch (locationError) {
          console.error('Error getting location:', locationError);
          // Fallback to default location
          weatherData = await getCurrentWeather();
        }
      } else {
        // Use default location (Delhi) when permission denied
        weatherData = await getCurrentWeather();
      }

      setWeather(weatherData);
      setWeatherTheme(getWeatherBasedTheme(weatherData.condition, weatherData.temperature));

      // Get user profile and generate outfit
      if (user?.uid) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);

        if (profile) {
          // Check if user has gender set
          const genderCheck = await checkUserGender(user.uid);
          if (!genderCheck.hasGender) {
            promptForGender();
            return;
          }

          const outfit = await generateTodaysOutfit(profile, weatherData);
          setTodaysOutfit(outfit);
        }
      }
    } catch (error) {
      console.error('Error loading weather and outfit:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeatherData = async (useLocation = false) => {
    try {
      let weatherData;

      if (useLocation && locationPermission === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          console.log('📍 Got user location:', location.coords);
          weatherData = await getCurrentWeather(location.coords.latitude, location.coords.longitude);
        } catch (locationError) {
          console.error('Error getting user location:', locationError);
          // Fallback to default location
          weatherData = await getCurrentWeather();
        }
      } else {
        // Explicitly use default location when not using user location
        console.log('📍 Using default location (Delhi)');
        weatherData = await getCurrentWeather();
      }

      setWeather(weatherData);
      setWeatherTheme(getWeatherBasedTheme(weatherData.condition, weatherData.temperature));
      return weatherData;
    } catch (error) {
      console.error('Error loading weather data:', error);
      return await getCurrentWeather(); // Fallback
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Check location permission first
      const hasPermission = await checkLocationPermission();

      if (hasPermission) {
        // Get actual user location and load weather data
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const weatherData = await getCurrentWeather(location.coords.latitude, location.coords.longitude);
          setWeather(weatherData);
          setWeatherTheme(getWeatherBasedTheme(weatherData.condition, weatherData.temperature));

          // Get user profile and generate outfit
          if (user?.uid) {
            const profile = await getUserProfile(user.uid);
            setUserProfile(profile);

            if (profile) {
              // Check if user has gender set
              const genderCheck = await checkUserGender(user.uid);
              if (!genderCheck.hasGender) {
                promptForGender();
                return;
              }

              const outfit = await generateTodaysOutfit(profile, weatherData);
              setTodaysOutfit(outfit);
            }
          }
        } catch (locationError) {
          console.error('Error getting user location:', locationError);
          // Fallback to default location if location fetch fails
          await loadWeatherAndOutfit(false);
        }
      }
      // If no permission, the permission modal will show
    } catch (error) {
      console.error('Error loading today\'s outfit data:', error);
    } finally {
      if (!showPermissionModal) {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Clear weather cache to get fresh data
    clearWeatherCache();
    await loadData();
    setRefreshing(false);
  };

  const handleBack = () => {
    router.back();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateAnim.value}deg` }],
  }));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          style={styles.loadingContainer}
        >
          <Animated.View style={rotateStyle}>
            <Ionicons name="sunny" size={60} color="#fff" />
          </Animated.View>
          <Text style={styles.loadingText}>Getting today's perfect outfit...</Text>
        </LinearGradient>
      </View>
    );
  }

  const gradientColors = weatherTheme ? weatherTheme.background : ['#6366f1', '#8b5cf6'];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={gradientColors[0]} />

        {/* Header */}
        <LinearGradient
          colors={gradientColors}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleSection}>
              <Text style={styles.headerTitle}>Today's Outfit</Text>
              <Text style={styles.headerSubtitle}>Perfect for the weather</Text>
            </View>
            <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
              <Ionicons name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={weatherTheme?.primary || theme.primary}
              colors={[weatherTheme?.primary || theme.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Weather Card */}
          {weather && (
            <Animated.View style={[styles.weatherCard, animatedStyle]}>
              <LinearGradient
                colors={gradientColors}
                style={styles.weatherGradient}
              >
                <View style={styles.weatherContent}>
                  <View style={styles.weatherLeft}>
                    <Animated.View style={pulseStyle}>
                      <Ionicons
                        name={weather.icon as any}
                        size={60}
                        color="#fff"
                      />
                    </Animated.View>
                    <View style={styles.weatherInfo}>
                      <Text style={styles.temperature}>{weather.temperature}°C</Text>
                      <Text style={styles.weatherCondition}>{weather.condition}</Text>
                      <Text style={styles.location}>{weather.location}</Text>
                    </View>
                  </View>
                  <View style={styles.forecastContainer}>
                    <Text style={styles.forecastTitle}>Today's Forecast</Text>
                    <View style={styles.forecastRow}>
                      <View style={styles.forecastItem}>
                        <Text style={styles.forecastTime}>Morning</Text>
                        <Text style={styles.forecastTemp}>{weather.forecast.morning.temp}°</Text>
                      </View>
                      <View style={styles.forecastItem}>
                        <Text style={styles.forecastTime}>Afternoon</Text>
                        <Text style={styles.forecastTemp}>{weather.forecast.afternoon.temp}°</Text>
                      </View>
                      <View style={styles.forecastItem}>
                        <Text style={styles.forecastTime}>Evening</Text>
                        <Text style={styles.forecastTemp}>{weather.forecast.evening.temp}°</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {/* Daily Quote */}
          {todaysOutfit?.daily_quote && (
            <Animated.View style={[styles.quoteCard, animatedStyle, { backgroundColor: theme.card }]}>
              <View style={styles.quoteHeader}>
                <Ionicons name="chatbubble-ellipses" size={24} color={weatherTheme?.primary || theme.primary} />
                <Text style={[styles.quoteTitle, { color: theme.text }]}>Quote of the Day</Text>
              </View>
              <Text style={[styles.quoteText, { color: theme.text }]}>
                "{todaysOutfit.daily_quote}"
              </Text>
              <Text style={[styles.quoteMood, { color: weatherTheme?.primary || theme.primary }]}>
                Mood: {todaysOutfit.mood}
              </Text>
            </Animated.View>
          )}

          {/* Today's Outfit */}
          {todaysOutfit && (
            <Animated.View style={[styles.outfitCard, animatedStyle]}>
              <LinearGradient
                colors={[weatherTheme?.primary || '#6366f1', weatherTheme?.secondary || '#8b5cf6']}
                style={styles.outfitHeader}
              >
                <View style={styles.outfitHeaderContent}>
                  <Ionicons name="shirt" size={32} color="#fff" />
                  <View style={styles.outfitTitleSection}>
                    <Text style={styles.outfitTitle}>{todaysOutfit.title}</Text>
                    <Text style={styles.outfitSubtitle}>Perfect for today's weather</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={[styles.outfitContent, { backgroundColor: theme.card }]}>
                <Text style={[styles.outfitDescription, { color: theme.text }]}>
                  {todaysOutfit.description}
                </Text>

                {/* Weather Reason */}
                <View style={styles.weatherReasonContainer}>
                  <Ionicons name="bulb" size={20} color={weatherTheme?.primary || theme.primary} />
                  <Text style={[styles.weatherReason, { color: theme.text }]}>
                    {todaysOutfit.weather_reason}
                  </Text>
                </View>

                {/* Outfit Items */}
                <View style={styles.itemsContainer}>
                  <Text style={[styles.sectionTitle, { color: weatherTheme?.primary || theme.primary }]}>
                    What to Wear
                  </Text>
                  {todaysOutfit.items.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <Ionicons name="checkmark-circle" size={18} color={weatherTheme?.primary || theme.primary} />
                      <Text style={[styles.itemText, { color: theme.text }]}>{item}</Text>
                    </View>
                  ))}
                </View>

                {/* Colors */}
                <View style={styles.colorsContainer}>
                  <Text style={[styles.sectionTitle, { color: weatherTheme?.primary || theme.primary }]}>
                    Recommended Colors
                  </Text>
                  <View style={styles.colorPalette}>
                    {todaysOutfit.colors.map((color, index) => (
                      <View key={index} style={styles.colorItem}>
                        <View
                          style={[
                            styles.colorCircle,
                            { backgroundColor: getColorCode(color) }
                          ]}
                        />
                        <Text style={[styles.colorName, { color: theme.text }]}>{color}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Style Tips */}
                <View style={styles.tipsContainer}>
                  <Text style={[styles.sectionTitle, { color: weatherTheme?.primary || theme.primary }]}>
                    Style Tips
                  </Text>
                  {todaysOutfit.style_tips.map((tip, index) => (
                    <View key={index} style={styles.tipRow}>
                      <Ionicons name="star" size={16} color={weatherTheme?.accent || theme.primary} />
                      <Text style={[styles.tipText, { color: theme.text }]}>{tip}</Text>
                    </View>
                  ))}
                </View>

                {/* Shopping Links */}
                <View style={styles.shoppingContainer}>
                  <Text style={[styles.sectionTitle, { color: weatherTheme?.primary || theme.primary }]}>
                    Shop the Look
                  </Text>
                  <View style={styles.shoppingGrid}>
                    {todaysOutfit.shopping_links.map((link, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.shoppingLink, { backgroundColor: theme.background, borderColor: theme.borderLight }]}
                        onPress={() => Linking.openURL(link.url)}
                      >
                        <View style={[styles.shoppingIconContainer, { backgroundColor: weatherTheme?.primary || theme.primary }]}>
                          <Ionicons name={link.icon as any} size={20} color="#fff" />
                        </View>
                        <View style={styles.shoppingContent}>
                          <Text style={[styles.shoppingPlatform, { color: theme.text }]}>
                            {link.platform}
                          </Text>
                          <Text style={[styles.shoppingDescription, { color: theme.textSecondary }]}>
                            {link.description}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Location Permission Modal */}
        <Modal
          visible={showPermissionModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPermissionModal(false)}
        >
          <View style={styles.permissionOverlay}>
            <Animated.View style={[styles.permissionModal, animatedStyle]}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.permissionGradient}
              >
                <View style={styles.permissionContent}>
                  <Animated.View style={pulseStyle}>
                    <Ionicons name="location" size={60} color="#fff" />
                  </Animated.View>
                  <Text style={styles.permissionTitle}>
                    Enable Location Access
                  </Text>
                  <Text style={styles.permissionDescription}>
                    We need your location to provide accurate weather-based outfit recommendations for your area.
                  </Text>
                  <View style={styles.permissionButtons}>
                    <TouchableOpacity
                      style={styles.permissionButtonSecondary}
                      onPress={() => {
                        console.log('🏙️ User chose to use default location (Delhi)');
                        setLocationPermission('denied');
                        setShowPermissionModal(false);
                        loadWeatherAndOutfit(false);
                      }}
                    >
                      <Text style={styles.permissionButtonSecondaryText}>
                        Use Delhi Weather
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.permissionButtonPrimary}
                      onPress={requestLocationPermission}
                    >
                      <Ionicons name="checkmark" size={20} color="#6366f1" />
                      <Text style={styles.permissionButtonPrimaryText}>
                        Allow Location
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const getColorCode = (colorName: string): string => {
  const colorMap: { [key: string]: string } = {
    // Basic colors
    red: '#ef4444', 
    blue: '#3b82f6', 
    green: '#10b981', 
    yellow: '#f59e0b',
    purple: '#8b5cf6', 
    pink: '#ec4899', 
    orange: '#f97316', 
    black: '#1f2937',
    white: '#f9fafb', 
    gray: '#6b7280', 
    grey: '#6b7280',
    brown: '#92400e', 
    navy: '#1e3a8a',
    beige: '#d2b48c', 
    cream: '#fef7cd', 
    gold: '#fbbf24', 
    silver: '#9ca3af',
    
    // Extended color variations
    'light blue': '#7dd3fc',
    'dark blue': '#1e40af',
    'navy blue': '#1e3a8a',
    'sky blue': '#0ea5e9',
    'royal blue': '#2563eb',
    
    'light green': '#4ade80',
    'dark green': '#15803d',
    'forest green': '#166534',
    'mint green': '#6ee7b7',
    'olive green': '#65a30d',
    
    'light red': '#f87171',
    'dark red': '#dc2626',
    'crimson': '#dc143c',
    'maroon': '#7f1d1d',
    
    'light pink': '#f9a8d4',
    'hot pink': '#ec4899',
    'rose': '#f43f5e',
    'magenta': '#d946ef',
    
    'light purple': '#c084fc',
    'dark purple': '#7c3aed',
    'violet': '#8b5cf6',
    'lavender': '#ddd6fe',
    
    'light yellow': '#fde047',
    'golden yellow': '#eab308',
    'mustard': '#ca8a04',
    
    'light orange': '#fb923c',
    'dark orange': '#ea580c',
    'coral': '#ff7f50',
    'peach': '#fed7aa',
    
    'light gray': '#d1d5db',
    'dark gray': '#374151',
    'charcoal': '#1f2937',
    'slate': '#64748b',
    
    'light brown': '#d2b48c',
    'dark brown': '#78350f',
    'tan': '#d2b48c',
    'khaki': '#f0e68c',
    
    'off white': '#fefefe',
    'ivory': '#fffff0',
    'pearl': '#f8f8ff',
    
    'turquoise': '#06b6d4',
    'teal': '#0d9488',
    'cyan': '#06b6d4',
    'aqua': '#00ffff',
    
    'burgundy': '#7f1d1d',
    'wine': '#722f37',
    'plum': '#86198f',
    
    'emerald': '#059669',
    'jade': '#10b981',
    'lime': '#84cc16',
    
    'indigo': '#4f46e5',
    'cobalt': '#1e40af',
    'sapphire': '#1e3a8a',
    
    'bronze': '#cd7f32',
    'copper': '#b87333',
    'rose gold': '#e8b4b8',
  };
  
  // Normalize the color name by removing extra spaces and converting to lowercase
  const normalizedColor = colorName.toLowerCase().trim();
  
  // First try exact match
  if (colorMap[normalizedColor]) {
    return colorMap[normalizedColor];
  }
  
  // Try to find partial matches for compound color names
  for (const [key, value] of Object.entries(colorMap)) {
    if (normalizedColor.includes(key) || key.includes(normalizedColor)) {
      return value;
    }
  }
  
  // If no match found, return a default color based on common color keywords
  if (normalizedColor.includes('blue')) return '#3b82f6';
  if (normalizedColor.includes('red')) return '#ef4444';
  if (normalizedColor.includes('green')) return '#10b981';
  if (normalizedColor.includes('yellow')) return '#f59e0b';
  if (normalizedColor.includes('purple') || normalizedColor.includes('violet')) return '#8b5cf6';
  if (normalizedColor.includes('pink')) return '#ec4899';
  if (normalizedColor.includes('orange')) return '#f97316';
  if (normalizedColor.includes('brown')) return '#92400e';
  if (normalizedColor.includes('gray') || normalizedColor.includes('grey')) return '#6b7280';
  if (normalizedColor.includes('black')) return '#1f2937';
  if (normalizedColor.includes('white')) return '#f9fafb';
  
  // Default fallback color (neutral gray)
  return '#6b7280';
};

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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  headerTitleSection: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 30,
  },
  weatherCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  weatherGradient: {
    padding: 20,
  },
  weatherContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  weatherInfo: {
    marginLeft: 16,
  },
  temperature: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  weatherCondition: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  location: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  forecastContainer: {
    alignItems: 'center',
  },
  forecastTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    fontWeight: '600',
  },
  forecastRow: {
    flexDirection: 'row',
    gap: 12,
  },
  forecastItem: {
    alignItems: 'center',
  },
  forecastTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  forecastTemp: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  quoteCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quoteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  quoteMood: {
    fontSize: 14,
    fontWeight: '600',
  },
  outfitCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  outfitHeader: {
    padding: 20,
  },
  outfitHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outfitTitleSection: {
    marginLeft: 16,
    flex: 1,
  },
  outfitTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  outfitSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  outfitContent: {
    padding: 20,
  },
  outfitDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  weatherReasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(99,102,241,0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  weatherReason: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  itemsContainer: {
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemText: {
    fontSize: 15,
    marginLeft: 8,
    flex: 1,
  },
  colorsContainer: {
    marginBottom: 20,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorItem: {
    alignItems: 'center',
    marginBottom: 8,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  colorName: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tipsContainer: {
    marginBottom: 20,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  shoppingContainer: {
    marginBottom: 10,
  },
  shoppingGrid: {
    gap: 8,
  },
  shoppingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  shoppingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shoppingContent: {
    flex: 1,
  },
  shoppingPlatform: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  shoppingDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  bottomSpacing: {
    height: 20,
  },
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionModal: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  permissionGradient: {
    padding: 30,
    alignItems: 'center',
  },
  permissionContent: {
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  permissionButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  permissionButtonSecondaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionButtonPrimary: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  permissionButtonPrimaryText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: 'bold',
  },
});