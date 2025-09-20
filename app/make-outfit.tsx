import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
    Linking,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import {
    analyzeOutfitCompatibility,
    generateWardrobeBasedOutfits,
    validateMultipleClothingImages
} from '../services/geminiService';
import { getLocationTopography } from '../services/topographyService';
import { getUserProfile } from '../services/userService';
import { checkUserGender, promptForGender } from '../utils/genderUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / 375;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

export default function MakeOutfit() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutfit, setGeneratedOutfit] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [topography, setTopography] = useState<any>(null);
  const [isValidatingImages, setIsValidatingImages] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startEntranceAnimations();
    loadUserProfile();
    loadTopographyData();
  }, []);

  const loadUserProfile = async () => {
    try {
      // Get current user's profile from Firebase
      const profile = await getUserProfile();
      if (profile) {
        setUserProfile(profile);
      } else {
        // Set default profile if no profile exists
        setUserProfile({
          height: 170,
          weight: 65,
          skinTone: 'Fair',
          bodyType: 'Average',
          gender: 'Male'
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Set default profile if loading fails
      setUserProfile({
        height: 170,
        weight: 65,
        skinTone: 'Fair',
        bodyType: 'Average',
        gender: 'Male'
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadTopographyData = async () => {
    try {
      // Request location permission first
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);

      if (status === 'granted') {
        try {
          // Get user's current location
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          console.log('📍 Got user location:', location.coords);

          // Get topography for user's actual location
          const topographyData = await getLocationTopography(location.coords.latitude, location.coords.longitude);
          setTopography(topographyData);
        } catch (locationError) {
          console.error('Error getting user location:', locationError);
          // Fallback to default location
          const topographyData = await getLocationTopography();
          setTopography(topographyData);
        }
      } else {
        console.log('❌ Location permission denied, using default location');
        // Use default location when permission denied
        const topographyData = await getLocationTopography();
        setTopography(topographyData);
      }
    } catch (error) {
      console.error('Error loading topography data:', error);
      // Fallback to default location
      try {
        const topographyData = await getLocationTopography();
        setTopography(topographyData);
      } catch (fallbackError) {
        console.error('Fallback topography also failed:', fallbackError);
      }
    }
  };

  const startEntranceAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const selectImage = async () => {
    if (selectedImages.length >= 12) {
      Alert.alert('Limit Reached', 'You can upload maximum 12 images');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = result.assets.slice(0, 12 - selectedImages.length).map(asset => asset.uri);
      setSelectedImages(prev => [...prev, ...newImages]);

      // Animate image addition
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -10,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const removeImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);

    // Clear validation results when images change
    if (validationResults) {
      setValidationResults(null);
    }
  };

  const showShoppingLinks = (suggestions: any[]) => {
    // Create a formatted message with shopping links
    const message = suggestions.map(suggestion =>
      `${suggestion.item}:\n${suggestion.shoppingLinks.map((link: any) => `• ${link.platform}: ${link.description}`).join('\n')}`
    ).join('\n\n');

    Alert.alert(
      'Shopping Suggestions',
      message,
      [
        { text: 'Open Amazon', onPress: () => openShoppingLink(suggestions[0]?.shoppingLinks?.find((l: any) => l.platform === 'Amazon')?.url) },
        { text: 'Open Pinterest', onPress: () => openShoppingLink(suggestions[0]?.shoppingLinks?.find((l: any) => l.platform === 'Pinterest')?.url) },
        { text: 'Continue with Current Items', onPress: () => proceedWithCurrentItems(null) },
        { text: 'Cancel' }
      ]
    );
  };

  const openShoppingLink = async (url: string) => {
    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error('Error opening shopping link:', error);
        Alert.alert('Error', 'Unable to open shopping link');
      }
    }
  };

  const proceedWithCurrentItems = (wardrobeAnalysis: any) => {
    if (wardrobeAnalysis) {
      setGeneratedOutfit({
        name: "Your Wardrobe Outfits",
        description: `${wardrobeAnalysis.availableOutfits.length} outfits created from your wardrobe`,
        analysis: wardrobeAnalysis,
        combinations: wardrobeAnalysis.availableOutfits.map((outfit: any) =>
          `${outfit.name}: ${outfit.items.join(' + ')}`
        ),
        styleScore: wardrobeAnalysis.wardrobeAnalysis.completenessScore,
        colorHarmony: "Based on your available items",
        bodyTypeMatch: 85,
        locationInfo: topography ? {
          location: topography.location,
          region: topography.region,
          climate: topography.climate,
          culturalStyle: topography.culturalStyle,
          considerations: `Outfits created from your wardrobe, suitable for ${topography.location}'s ${topography.climate} climate`
        } : null,
        wardrobeAnalysis: wardrobeAnalysis
      });
    }
  };

  const validateImages = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Images', 'Please upload at least one image to validate');
      return;
    }

    setIsValidatingImages(true);
    try {
      const results = await validateMultipleClothingImages(selectedImages);
      setValidationResults(results);

      if (results.invalidImages.length > 0) {
        setShowValidationAlert(true);
      }
    } catch (error) {
      console.error('Error validating images:', error);
      Alert.alert('Validation Error', 'Unable to validate images. Please try again.');
    } finally {
      setIsValidatingImages(false);
    }
  };

  const generateOutfit = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Images', 'Please upload at least one image to generate an outfit');
      return;
    }

    if (!userProfile) {
      Alert.alert('Profile Loading', 'Please wait for your profile to load');
      return;
    }

    // Check if user has gender set
    try {
      const genderCheck = await checkUserGender();
      if (!genderCheck.hasGender) {
        promptForGender(() => {
          // Reload profile after gender is set
          loadUserProfile();
        });
        return;
      }
    } catch (error) {
      console.error('Error checking gender:', error);
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsGenerating(true);

    // Start enhanced rotation animation for generate button
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Add pulse animation during generation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    try {
      // First, analyze outfit compatibility
      const compatibilityAnalysis = await analyzeOutfitCompatibility(selectedImages, userProfile);

      if (!compatibilityAnalysis.canFormOutfits) {
        // Show alert with recommendations
        Alert.alert(
          'Insufficient Items for Complete Outfits',
          `Your current items can't form complete outfits. Here's what you need:\n\n${compatibilityAnalysis.recommendations.join('\n')}`,
          [
            { text: 'OK' },
            { text: 'Upload More Items', onPress: () => selectImage() }
          ]
        );
        return;
      }

      // Generate wardrobe-based outfits from user's actual clothes
      const wardrobeAnalysis = await generateWardrobeBasedOutfits(selectedImages, userProfile, topography);

      // Check if we have enough items for complete outfits
      if (wardrobeAnalysis.wardrobeAnalysis.completenessScore < 50) {
        // Show alert with suggestions for missing items
        Alert.alert(
          'Wardrobe Needs Enhancement',
          `Your current wardrobe can create ${wardrobeAnalysis.availableOutfits.length} outfits, but adding a few key pieces would unlock many more combinations!\n\nTop suggestions:\n${wardrobeAnalysis.suggestions.slice(0, 3).map(s => `• ${s.item}: ${s.reason}`).join('\n')}`,
          [
            { text: 'Show Me Shopping Links', onPress: () => showShoppingLinks(wardrobeAnalysis.suggestions) },
            { text: 'Create with Current Items', onPress: () => proceedWithCurrentItems(wardrobeAnalysis) },
            { text: 'Cancel' }
          ]
        );
        return;
      }

      const analysis = wardrobeAnalysis;

      // Handle the wardrobe analysis result properly
      if ('availableOutfits' in analysis) {
        // This is a wardrobe analysis result
        setGeneratedOutfit({
          name: "Your Wardrobe Outfits",
          description: `${analysis.availableOutfits.length} outfits created from your wardrobe`,
          analysis: analysis,
          combinations: analysis.availableOutfits.map((outfit: any) =>
            `${outfit.name}: ${outfit.items.join(' + ')}`
          ),
          styleScore: analysis.wardrobeAnalysis?.completenessScore || 85,
          colorHarmony: "Based on your available items",
          bodyTypeMatch: 85,
          locationInfo: topography ? {
            location: topography.location,
            region: topography.region,
            climate: topography.climate,
            culturalStyle: topography.culturalStyle,
            considerations: `Outfits created from your wardrobe, suitable for ${topography.location}'s ${topography.climate} climate`
          } : null,
          compatibility: compatibilityAnalysis,
          wardrobeAnalysis: analysis
        });
      } else {
        // This is a regular analysis result
        setGeneratedOutfit({
          name: topography ? "Location-Aware AI Outfits" : "AI-Curated Wardrobe Outfits",
          description: topography
            ? `Personalized combinations for ${topography.climate} climate in ${topography.location}, ${topography.region}`
            : `Personalized combinations based on your ${userProfile.bodyType || 'body type'} and ${userProfile.skinTone || 'skin tone'}`,
          analysis: analysis,
          combinations: 'combinations' in analysis && Array.isArray((analysis as any).combinations)
            ? (analysis as any).combinations.map((combo: any) =>
              `${combo.name}: ${combo.items.join(' + ')}`
            )
            : 'recommendations' in analysis && Array.isArray((analysis as any).recommendations)
              ? (analysis as any).recommendations.map((rec: any) =>
                `${rec.style}: ${rec.outfit}`
              )
              : [],
          styleScore: 'overallScore' in analysis ? (analysis as any).overallScore : 85,
          colorHarmony: "Optimized for your skin tone",
          bodyTypeMatch: 'combinations' in analysis && Array.isArray((analysis as any).combinations) && (analysis as any).combinations.length > 0
            ? Math.round((analysis as any).combinations.reduce((acc: number, combo: any) => acc + (combo.bodyTypeMatch || 80), 0) / (analysis as any).combinations.length)
            : 80,
          locationInfo: topography ? {
            location: topography.location,
            region: topography.region,
            climate: topography.climate,
            culturalStyle: topography.culturalStyle,
            considerations: 'locationConsiderations' in analysis ? (analysis as any).locationConsiderations : null
          } : null,
          compatibility: compatibilityAnalysis
        });
      }

      // Success animation
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error generating outfit:', error);
      Alert.alert(
        'Generation Failed',
        'Unable to generate outfit combinations. Please try again.',
        [{ text: 'OK' }]
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['#ff6b9d', '#c44569', '#ff9ff3']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={getResponsiveSize(24)} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerIcon}>👗</Text>
            <Text style={styles.headerTitle}>Make Me an Outfit</Text>
            <Text style={styles.headerSubtitle}>Upload your clothes & get styled</Text>
          </View>

          <View style={styles.placeholder} />
        </LinearGradient>
      </Animated.View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Location & Culture Section */}
          {topography && (
            <View style={[styles.weatherSection, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
              <View style={styles.weatherHeader}>
                <Ionicons name="location" size={getResponsiveSize(20)} color={theme.primary} />
                <Text style={[styles.weatherTitle, { color: theme.text }]}>Location & Culture</Text>
              </View>
              <View style={styles.weatherInfo}>
                <Text style={[styles.weatherTemp, { color: theme.primary }]}>{topography.location}</Text>
                <Text style={[styles.weatherCondition, { color: theme.textSecondary }]}>{topography.region}</Text>
                <Text style={[styles.weatherLocation, { color: theme.textTertiary }]}>{topography.climate} • {topography.culturalStyle}</Text>
              </View>
              <Text style={[styles.weatherNote, { color: theme.textSecondary }]}>
                🎨 Outfits will be tailored for your location's culture and climate
              </Text>

              {/* Local Fashion Trends */}
              {topography.localFashionTrends && topography.localFashionTrends.length > 0 && (
                <View style={styles.trendsContainer}>
                  <Text style={[styles.trendsTitle, { color: theme.text }]}>Local Trends:</Text>
                  <View style={styles.trendsChips}>
                    {topography.localFashionTrends.slice(0, 3).map((trend: string, index: number) => (
                      <View key={index} style={[styles.trendChip, { backgroundColor: theme.background, borderColor: theme.borderLight }]}>
                        <Text style={[styles.trendChipText, { color: theme.textSecondary }]}>{trend}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Location Status and Update Button */}
              {locationPermission === 'denied' && (
                <Text style={[styles.weatherNote, { color: theme.accent, fontSize: getResponsiveFontSize(10) }]}>
                  📍 Location access denied. Using default location.
                </Text>
              )}

              <TouchableOpacity
                style={[styles.locationButton, { backgroundColor: theme.primary }]}
                onPress={loadTopographyData}
              >
                <Ionicons name="location" size={getResponsiveSize(16)} color="#fff" />
                <Text style={styles.locationButtonText}>
                  {locationPermission === 'granted' ? 'Refresh Location' : 'Enable Location'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Upload Section */}
          <View style={styles.uploadSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Upload Your Clothes</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Add up to 12 photos of your clothes for AI-powered, location-aware outfit combinations
            </Text>

            {userProfile && !loadingProfile && (
              <View style={[styles.profileSummary, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                <Text style={[styles.profileTitle, { color: theme.text }]}>👤 Your Style Profile</Text>
                <View style={styles.profileDetails}>
                  <Text style={[styles.profileDetail, { color: theme.textSecondary }]}>
                    {userProfile.bodyType || 'Average'} • {userProfile.skinTone || 'Fair'} • {userProfile.gender || 'Male'}
                  </Text>
                  <Text style={[styles.profileDetail, { color: theme.textSecondary }]}>
                    {userProfile.height || 170}cm • {userProfile.weight || 65}kg
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.imageGrid}>
              {Array.from({ length: 12 }).map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.imageSlot,
                    {
                      backgroundColor: selectedImages[index] ? theme.card : theme.background,
                      borderColor: theme.borderLight,
                    }
                  ]}
                  onPress={selectedImages[index] ? () => removeImage(index) : selectImage}
                  onLongPress={() => {
                    if (selectedImages[index]) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      removeImage(index);
                    }
                  }}
                >
                  {selectedImages[index] ? (
                    <>
                      <Image source={{ uri: selectedImages[index] }} style={styles.uploadedImage} />
                      <View style={styles.removeButton}>
                        <Ionicons name="close" size={16} color="#fff" />
                      </View>
                    </>
                  ) : (
                    <View style={styles.emptySlot}>
                      <Ionicons name="add" size={getResponsiveSize(24)} color={theme.textTertiary} />
                      <Text style={[styles.emptySlotText, { color: theme.textTertiary }]}>
                        {index === 0 ? "Tap to add" : ""}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.imageCounter, { color: theme.textSecondary }]}>
              {selectedImages.length}/12 images uploaded
            </Text>

            {/* Validation Button */}
            {selectedImages.length > 0 && (
              <TouchableOpacity
                style={[styles.validateButton, { backgroundColor: theme.primary }]}
                onPress={validateImages}
                disabled={isValidatingImages}
              >
                <Ionicons
                  name={isValidatingImages ? "sync" : "checkmark-circle"}
                  size={getResponsiveSize(16)}
                  color="#fff"
                />
                <Text style={styles.validateButtonText}>
                  {isValidatingImages ? 'Validating...' : 'Validate Images'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Validation Results */}
            {validationResults && (
              <View style={[styles.validationResults, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                <Text style={[styles.validationTitle, { color: theme.text }]}>
                  📸 Image Validation Results
                </Text>
                <View style={styles.validationStats}>
                  <Text style={[styles.validationStat, { color: theme.primary }]}>
                    ✅ {validationResults.validImages.length} Valid
                  </Text>
                  <Text style={[styles.validationStat, { color: theme.accent }]}>
                    ❌ {validationResults.invalidImages.length} Invalid
                  </Text>
                </View>
                {validationResults.invalidImages.length > 0 && (
                  <Text style={[styles.validationNote, { color: theme.textSecondary }]}>
                    Some images don't appear to be clothing items. Please upload clear photos of clothes only.
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Generate Button */}
          <Animated.View style={[styles.generateSection, { transform: [{ scale: isGenerating ? pulseAnim : 1 }] }]}>
            <TouchableOpacity
              style={[styles.generateButton, { opacity: selectedImages.length > 0 ? 1 : 0.5 }]}
              onPress={generateOutfit}
              disabled={isGenerating || selectedImages.length === 0 || loadingProfile}
              onPressIn={() => {
                if (selectedImages.length > 0 && !isGenerating && !loadingProfile) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                }
              }}
            >
              <LinearGradient
                colors={isGenerating
                  ? ['#667eea', '#764ba2']
                  : selectedImages.length > 0
                    ? ['#ff6b9d', '#c44569']
                    : ['#6c757d', '#495057']
                }
                style={styles.generateButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isGenerating ? (
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="sync" size={getResponsiveSize(24)} color="#fff" />
                  </Animated.View>
                ) : loadingProfile ? (
                  <Ionicons name="hourglass" size={getResponsiveSize(24)} color="#fff" />
                ) : (
                  <Ionicons name="sparkles" size={getResponsiveSize(24)} color="#fff" />
                )}
                <Text style={styles.generateButtonText}>
                  {isGenerating
                    ? 'AI Generating...'
                    : loadingProfile
                      ? 'Loading Profile...'
                      : selectedImages.length > 0
                        ? topography ? 'Generate Location-Aware Outfits' : 'Generate Smart Outfits'
                        : 'Upload Images First'
                  }
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {isGenerating && (
              <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  {topography
                    ? `🤖 AI is analyzing your wardrobe with location intelligence for ${topography.climate} climate in ${topography.location}...`
                    : '🤖 AI is analyzing your wardrobe with body-type intelligence...'
                  }
                </Text>
                <View style={styles.loadingSteps}>
                  <Text style={[styles.loadingStep, { color: theme.textTertiary }]}>
                    • Analyzing clothing items and colors
                  </Text>
                  <Text style={[styles.loadingStep, { color: theme.textTertiary }]}>
                    • Matching with your body type and skin tone
                  </Text>
                  {topography && (
                    <Text style={[styles.loadingStep, { color: theme.textTertiary }]}>
                      • Considering location climate and cultural style
                    </Text>
                  )}
                  <Text style={[styles.loadingStep, { color: theme.textTertiary }]}>
                    • Creating personalized combinations
                  </Text>
                </View>
              </Animated.View>
            )}

            {loadingProfile && !isGenerating && (
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                📋 Loading your style profile...
              </Text>
            )}
          </Animated.View>

          {/* Results Section */}
          {generatedOutfit && (
            <Animated.View
              style={[
                styles.resultsSection,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.borderLight,
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <View style={styles.resultHeader}>
                <Ionicons name="checkmark-circle" size={getResponsiveSize(24)} color="#27ae60" />
                <Text style={[styles.resultTitle, { color: theme.text }]}>Outfit Generated!</Text>
              </View>

              <View style={styles.outfitDetails}>
                <Text style={[styles.outfitName, { color: theme.text }]}>{generatedOutfit.name}</Text>
                <Text style={[styles.outfitDescription, { color: theme.textSecondary }]}>
                  {generatedOutfit.description}
                </Text>

                {/* Location Information */}
                {generatedOutfit.locationInfo && (
                  <View style={[styles.weatherInfoCard, { backgroundColor: theme.background, borderColor: theme.borderLight }]}>
                    <Text style={[styles.weatherInfoTitle, { color: theme.primary }]}>
                      🌍 Location Considerations
                    </Text>
                    <Text style={[styles.weatherInfoText, { color: theme.textSecondary }]}>
                      {generatedOutfit.locationInfo.considerations}
                    </Text>
                  </View>
                )}

                {/* Compatibility Analysis */}
                {generatedOutfit.compatibility && (
                  <View style={[styles.compatibilityCard, { backgroundColor: theme.background, borderColor: theme.borderLight }]}>
                    <Text style={[styles.compatibilityTitle, { color: theme.primary }]}>
                      🎯 Outfit Compatibility
                    </Text>
                    <Text style={[styles.compatibilityScore, { color: theme.accent }]}>
                      {generatedOutfit.compatibility.compatibilityScore}% Compatible
                    </Text>
                    <Text style={[styles.compatibilityText, { color: theme.textSecondary }]}>
                      Your items can create: {generatedOutfit.compatibility.outfitTypes.join(', ')}
                    </Text>
                  </View>
                )}

                {/* Wardrobe-Based Outfit Combinations */}
                {generatedOutfit.wardrobeAnalysis && (
                  <View style={styles.detailedCombinations}>
                    <Text style={[styles.combinationsTitle, { color: theme.text }]}>Your Wardrobe Outfits:</Text>

                    {generatedOutfit.wardrobeAnalysis.availableOutfits.map((outfit: any, index: number) => (
                      <View key={index} style={[styles.smartComboCard, { backgroundColor: theme.background, borderColor: theme.borderLight }]}>
                        <View style={styles.comboHeader}>
                          <Text style={[styles.comboName, { color: theme.primary }]}>{outfit.name}</Text>
                          <View style={styles.comboRatings}>
                            <Text style={[styles.comboRating, { color: theme.accent }]}>{outfit.completeness}% Complete</Text>
                          </View>
                        </View>

                        <Text style={[styles.comboItems, { color: theme.text }]}>
                          {outfit.items.join(' + ')}
                        </Text>

                        <View style={styles.comboColors}>
                          <Text style={[styles.comboColorsLabel, { color: theme.textSecondary }]}>Colors: </Text>
                          {outfit.colors.map((color: string, colorIndex: number) => (
                            <View key={colorIndex} style={[styles.colorChip, { backgroundColor: theme.card }]}>
                              <Text style={[styles.colorChipText, { color: theme.text }]}>{color}</Text>
                            </View>
                          ))}
                        </View>

                        <Text style={[styles.comboOccasion, { color: theme.textSecondary }]}>
                          Perfect for: {outfit.occasion}
                        </Text>

                        {/* Missing Items Section */}
                        {outfit.missingItems && outfit.missingItems.length > 0 && (
                          <View style={[styles.missingItemsSection, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                            <Text style={[styles.missingItemsTitle, { color: theme.accent }]}>
                              💡 To Complete This Look:
                            </Text>
                            {outfit.missingItems.map((missing: any, missingIndex: number) => (
                              <View key={missingIndex} style={styles.missingItem}>
                                <Text style={[styles.missingItemName, { color: theme.text }]}>
                                  • {missing.item}
                                </Text>
                                <Text style={[styles.missingItemReason, { color: theme.textSecondary }]}>
                                  {missing.reason}
                                </Text>
                                <View style={styles.shoppingLinksContainer}>
                                  {missing.shoppingLinks.map((link: any, linkIndex: number) => (
                                    <TouchableOpacity
                                      key={linkIndex}
                                      style={[styles.shoppingLinkButton, { backgroundColor: theme.primary }]}
                                      onPress={() => openShoppingLink(link.url)}
                                    >
                                      <Text style={styles.shoppingLinkText}>
                                        {link.platform}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Outfit Inspiration Links */}
                        <View style={styles.outfitLinksContainer}>
                          {outfit.outfitLinks.map((link: any, linkIndex: number) => (
                            <TouchableOpacity
                              key={linkIndex}
                              style={[styles.inspirationLinkButton, { backgroundColor: theme.background, borderColor: theme.primary }]}
                              onPress={() => openShoppingLink(link.url)}
                            >
                              <Ionicons name="camera" size={16} color={theme.primary} />
                              <Text style={[styles.inspirationLinkText, { color: theme.primary }]}>
                                Get Inspiration
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))}

                    {/* Wardrobe Suggestions */}
                    {generatedOutfit.wardrobeAnalysis.suggestions && generatedOutfit.wardrobeAnalysis.suggestions.length > 0 && (
                      <View style={[styles.suggestionsSection, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                        <Text style={[styles.suggestionsTitle, { color: theme.text }]}>
                          🛍️ Unlock More Outfits
                        </Text>
                        <Text style={[styles.suggestionsSubtitle, { color: theme.textSecondary }]}>
                          Add these items to create many more outfit combinations:
                        </Text>
                        {generatedOutfit.wardrobeAnalysis.suggestions.slice(0, 3).map((suggestion: any, index: number) => (
                          <View key={index} style={styles.suggestionItem}>
                            <View style={styles.suggestionHeader}>
                              <Text style={[styles.suggestionName, { color: theme.primary }]}>
                                {suggestion.item}
                              </Text>
                              <View style={[styles.priorityBadge, {
                                backgroundColor: suggestion.priority === 'high' ? theme.accent :
                                  suggestion.priority === 'medium' ? theme.primary : theme.textTertiary
                              }]}>
                                <Text style={styles.priorityText}>{suggestion.priority}</Text>
                              </View>
                            </View>
                            <Text style={[styles.suggestionReason, { color: theme.textSecondary }]}>
                              {suggestion.reason}
                            </Text>
                            <View style={styles.shoppingLinksContainer}>
                              {suggestion.shoppingLinks.map((link: any, linkIndex: number) => (
                                <TouchableOpacity
                                  key={linkIndex}
                                  style={[styles.shoppingLinkButton, { backgroundColor: theme.primary }]}
                                  onPress={() => openShoppingLink(link.url)}
                                >
                                  <Text style={styles.shoppingLinkText}>
                                    Shop on {link.platform}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Detailed Outfit Combinations */}
                {generatedOutfit.analysis && !generatedOutfit.wardrobeAnalysis && (
                  <View style={styles.detailedCombinations}>
                    <Text style={[styles.combinationsTitle, { color: theme.text }]}>Smart Outfit Combinations:</Text>

                    {/* Handle both combinations (wardrobe) and recommendations (weather-aware) */}
                    {('combinations' in generatedOutfit.analysis && generatedOutfit.analysis.combinations) ? (
                      // Wardrobe analysis format
                      generatedOutfit.analysis.combinations.map((combo: any, index: number) => (
                        <View key={index} style={[styles.smartComboCard, { backgroundColor: theme.background, borderColor: theme.borderLight }]}>
                          <View style={styles.comboHeader}>
                            <Text style={[styles.comboName, { color: theme.primary }]}>{combo.name}</Text>
                            <View style={styles.comboRatings}>
                              <Text style={[styles.comboRating, { color: theme.accent }]}>{combo.bodyTypeMatch}% Body Match</Text>
                            </View>
                          </View>

                          <Text style={[styles.comboItems, { color: theme.text }]}>
                            {combo.items.join(' + ')}
                          </Text>

                          <View style={styles.comboColors}>
                            <Text style={[styles.comboColorsLabel, { color: theme.textSecondary }]}>Colors: </Text>
                            {combo.colors.map((color: string, colorIndex: number) => (
                              <View key={colorIndex} style={[styles.colorChip, { backgroundColor: theme.card }]}>
                                <Text style={[styles.colorChipText, { color: theme.text }]}>{color}</Text>
                              </View>
                            ))}
                          </View>

                          <Text style={[styles.comboReasoning, { color: theme.textSecondary }]}>
                            💡 {combo.reasoning}
                          </Text>

                          {combo.stylingTips && combo.stylingTips.length > 0 && (
                            <View style={styles.stylingTips}>
                              <Text style={[styles.stylingTipsTitle, { color: theme.text }]}>Styling Tips:</Text>
                              {combo.stylingTips.map((tip: string, tipIndex: number) => (
                                <Text key={tipIndex} style={[styles.stylingTip, { color: theme.textSecondary }]}>
                                  • {tip}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      ))
                    ) : ('recommendations' in generatedOutfit.analysis && generatedOutfit.analysis.recommendations) ? (
                      // Weather-aware analysis format
                      generatedOutfit.analysis.recommendations.map((rec: any, index: number) => (
                        <View key={index} style={[styles.smartComboCard, { backgroundColor: theme.background, borderColor: theme.borderLight }]}>
                          <View style={styles.comboHeader}>
                            <Text style={[styles.comboName, { color: theme.primary }]}>{rec.style}</Text>
                            <View style={styles.comboRatings}>
                              <Text style={[styles.comboRating, { color: theme.accent }]}>Weather Optimized</Text>
                            </View>
                          </View>

                          <Text style={[styles.comboItems, { color: theme.text }]}>
                            {rec.outfit}
                          </Text>

                          <View style={styles.comboColors}>
                            <Text style={[styles.comboColorsLabel, { color: theme.textSecondary }]}>Colors: </Text>
                            {rec.colors.map((color: string, colorIndex: number) => (
                              <View key={colorIndex} style={[styles.colorChip, { backgroundColor: theme.card }]}>
                                <Text style={[styles.colorChipText, { color: theme.text }]}>{color}</Text>
                              </View>
                            ))}
                          </View>

                          <Text style={[styles.comboReasoning, { color: theme.textSecondary }]}>
                            💡 {rec.reasoning}
                          </Text>

                          <Text style={[styles.comboReasoning, { color: theme.textSecondary }]}>
                            🎯 {rec.mood}
                          </Text>

                          {rec.accessories && (
                            <Text style={[styles.comboReasoning, { color: theme.textSecondary }]}>
                              ✨ Accessories: {rec.accessories}
                            </Text>
                          )}
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.comboReasoning, { color: theme.textSecondary }]}>
                        No outfit combinations available. Please try again.
                      </Text>
                    )}
                  </View>
                )}

                {/* Body Type Recommendations */}
                {generatedOutfit.analysis?.bodyTypeRecommendations && (
                  <View style={styles.bodyTypeSection}>
                    <Text style={[styles.bodyTypeSectionTitle, { color: theme.text }]}>
                      🎯 Personalized for Your Body Type
                    </Text>
                    {generatedOutfit.analysis.bodyTypeRecommendations.map((rec: string, index: number) => (
                      <View key={index} style={styles.bodyTypeRec}>
                        <Ionicons name="fitness" size={14} color={theme.primary} />
                        <Text style={[styles.bodyTypeRecText, { color: theme.textSecondary }]}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Missing Items Suggestions */}
                {generatedOutfit.analysis?.missingItems && generatedOutfit.analysis.missingItems.length > 0 && (
                  <View style={styles.missingItemsSection}>
                    <Text style={[styles.missingItemsTitle, { color: theme.text }]}>
                      🛍️ Suggested Additions
                    </Text>
                    <View style={styles.missingItemsList}>
                      {generatedOutfit.analysis.missingItems.map((item: string, index: number) => (
                        <View key={index} style={[styles.missingItem, { backgroundColor: theme.card }]}>
                          <Text style={[styles.missingItemText, { color: theme.text }]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.metricsContainer}>
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: theme.primary }]}>{generatedOutfit.styleScore}%</Text>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Overall Score</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: theme.primary }]}>{generatedOutfit.bodyTypeMatch}%</Text>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Body Match</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: theme.primary }]}>{generatedOutfit.analysis?.totalItems || 12}</Text>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Items</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          <View style={styles.bottomSpacing} />
        </Animated.View>
      </ScrollView>

      {/* Validation Alert */}
      {showValidationAlert && validationResults && (
        <View style={[styles.validationAlert, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
          <Text style={[styles.validationAlertTitle, { color: theme.text }]}>
            ⚠️ Some Images Need Attention
          </Text>
          <Text style={[styles.validationAlertText, { color: theme.textSecondary }]}>
            {validationResults.invalidImages.length} of your uploaded images don't appear to be clothing items.
          </Text>
          <View style={styles.validationAlertActions}>
            <TouchableOpacity
              style={[styles.validationAlertButton, { backgroundColor: theme.background }]}
              onPress={() => setShowValidationAlert(false)}
            >
              <Text style={[styles.validationAlertButtonText, { color: theme.text }]}>Continue Anyway</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.validationAlertButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setShowValidationAlert(false);
                // Remove invalid images
                const validUris = validationResults.validImages;
                setSelectedImages(validUris);
                setValidationResults(null);
              }}
            >
              <Text style={[styles.validationAlertButtonText, { color: '#fff' }]}>Remove Invalid</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: getResponsiveSize(20),
    paddingVertical: getResponsiveSize(15),
    borderBottomLeftRadius: getResponsiveSize(25),
    borderBottomRightRadius: getResponsiveSize(25),
  },
  backButton: { padding: getResponsiveSize(8) },
  headerTitleContainer: { alignItems: 'center', flex: 1 },
  headerIcon: { fontSize: getResponsiveFontSize(32), marginBottom: 4 },
  headerTitle: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: getResponsiveFontSize(12),
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  placeholder: { width: getResponsiveSize(40) },
  scrollView: { flex: 1 },
  content: { padding: getResponsiveSize(20) },
  uploadSection: { marginBottom: getResponsiveSize(30) },
  sectionTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(8),
  },
  sectionSubtitle: {
    fontSize: getResponsiveFontSize(14),
    marginBottom: getResponsiveSize(20),
    lineHeight: 20,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: getResponsiveSize(10),
  },
  imageSlot: {
    width: (screenWidth - getResponsiveSize(60)) / 4,
    height: (screenWidth - getResponsiveSize(60)) / 4,
    borderRadius: getResponsiveSize(12),
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: getResponsiveSize(10),
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: getResponsiveSize(10),
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySlot: { alignItems: 'center' },
  emptySlotText: {
    fontSize: getResponsiveFontSize(10),
    marginTop: 4,
  },
  imageCounter: {
    textAlign: 'center',
    fontSize: getResponsiveFontSize(12),
    marginTop: getResponsiveSize(10),
  },
  generateSection: { marginBottom: getResponsiveSize(30) },
  generateButton: {
    borderRadius: getResponsiveSize(25),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getResponsiveSize(18),
    paddingHorizontal: getResponsiveSize(30),
    gap: getResponsiveSize(10),
  },
  generateButtonText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: getResponsiveFontSize(14),
    marginTop: getResponsiveSize(10),
    fontStyle: 'italic',
  },
  loadingSteps: {
    marginTop: getResponsiveSize(15),
    paddingHorizontal: getResponsiveSize(20),
  },
  loadingStep: {
    fontSize: getResponsiveFontSize(12),
    textAlign: 'center',
    marginBottom: getResponsiveSize(5),
    fontStyle: 'italic',
  },
  resultsSection: {
    borderRadius: getResponsiveSize(20),
    padding: getResponsiveSize(20),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: getResponsiveSize(15),
    gap: getResponsiveSize(10),
  },
  resultTitle: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
  },
  outfitDetails: {},
  outfitName: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(8),
  },
  outfitDescription: {
    fontSize: getResponsiveFontSize(14),
    marginBottom: getResponsiveSize(20),
    lineHeight: 20,
  },
  combinationsContainer: { marginBottom: getResponsiveSize(20) },
  combinationsTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(10),
  },
  combinationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: getResponsiveSize(12),
    borderRadius: getResponsiveSize(10),
    marginBottom: getResponsiveSize(8),
    gap: getResponsiveSize(10),
  },
  combinationText: {
    fontSize: getResponsiveFontSize(14),
    flex: 1,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: { alignItems: 'center' },
  metricValue: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
  },
  metricLabel: {
    fontSize: getResponsiveFontSize(12),
    marginTop: 4,
  },
  bottomSpacing: { height: getResponsiveSize(50) },
  profileSummary: {
    borderRadius: getResponsiveSize(12),
    padding: getResponsiveSize(15),
    marginBottom: getResponsiveSize(20),
    borderWidth: 1,
  },
  profileTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(8),
  },
  profileDetails: {
    gap: getResponsiveSize(4),
  },
  profileDetail: {
    fontSize: getResponsiveFontSize(13),
  },
  detailedCombinations: {
    marginBottom: getResponsiveSize(20),
  },
  smartComboCard: {
    borderRadius: getResponsiveSize(12),
    padding: getResponsiveSize(15),
    marginBottom: getResponsiveSize(15),
    borderWidth: 1,
  },
  comboHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getResponsiveSize(8),
  },
  comboName: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: 'bold',
    flex: 1,
  },
  comboRatings: {
    alignItems: 'flex-end',
  },
  comboRating: {
    fontSize: getResponsiveFontSize(11),
    fontWeight: '600',
  },
  comboItems: {
    fontSize: getResponsiveFontSize(14),
    marginBottom: getResponsiveSize(10),
    fontWeight: '500',
  },
  comboColors: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: getResponsiveSize(10),
  },
  comboColorsLabel: {
    fontSize: getResponsiveFontSize(12),
    marginRight: getResponsiveSize(8),
  },
  colorChip: {
    borderRadius: getResponsiveSize(8),
    paddingHorizontal: getResponsiveSize(8),
    paddingVertical: getResponsiveSize(4),
    marginRight: getResponsiveSize(6),
    marginBottom: getResponsiveSize(4),
  },
  colorChipText: {
    fontSize: getResponsiveFontSize(10),
    fontWeight: '500',
  },
  comboReasoning: {
    fontSize: getResponsiveFontSize(12),
    fontStyle: 'italic',
    marginBottom: getResponsiveSize(10),
    lineHeight: 18,
  },
  stylingTips: {
    marginTop: getResponsiveSize(8),
  },
  stylingTipsTitle: {
    fontSize: getResponsiveFontSize(13),
    fontWeight: '600',
    marginBottom: getResponsiveSize(6),
  },
  stylingTip: {
    fontSize: getResponsiveFontSize(11),
    lineHeight: 16,
    marginBottom: getResponsiveSize(2),
  },
  bodyTypeSection: {
    marginBottom: getResponsiveSize(20),
  },
  bodyTypeSectionTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(10),
  },
  bodyTypeRec: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: getResponsiveSize(8),
    gap: getResponsiveSize(8),
  },
  bodyTypeRecText: {
    fontSize: getResponsiveFontSize(12),
    flex: 1,
    lineHeight: 18,
  },
  missingItemsSection: {
    marginBottom: getResponsiveSize(20),
  },
  missingItemsTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(10),
  },
  missingItemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getResponsiveSize(8),
  },
  missingItem: {
    borderRadius: getResponsiveSize(15),
    paddingHorizontal: getResponsiveSize(12),
    paddingVertical: getResponsiveSize(6),
  },
  missingItemText: {
    fontSize: getResponsiveFontSize(12),
    fontWeight: '500',
  },
  weatherSection: {
    borderRadius: getResponsiveSize(15),
    padding: getResponsiveSize(15),
    marginBottom: getResponsiveSize(20),
    borderWidth: 1,
    alignItems: 'center',
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: getResponsiveSize(10),
  },
  weatherTitle: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
    marginLeft: getResponsiveSize(8),
  },
  weatherInfo: {
    alignItems: 'center',
    marginBottom: getResponsiveSize(10),
  },
  weatherTemp: {
    fontSize: getResponsiveFontSize(28),
    fontWeight: 'bold',
  },
  weatherCondition: {
    fontSize: getResponsiveFontSize(16),
    marginTop: getResponsiveSize(5),
  },
  weatherLocation: {
    fontSize: getResponsiveFontSize(14),
    marginTop: getResponsiveSize(5),
  },
  weatherNote: {
    fontSize: getResponsiveFontSize(12),
    textAlign: 'center',
    paddingHorizontal: getResponsiveSize(10),
  },
  weatherInfoCard: {
    borderRadius: getResponsiveSize(12),
    padding: getResponsiveSize(15),
    marginBottom: getResponsiveSize(15),
    borderWidth: 1,
  },
  weatherInfoTitle: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
    marginBottom: getResponsiveSize(8),
  },
  weatherInfoText: {
    fontSize: getResponsiveFontSize(12),
    lineHeight: 18,
  },
  compatibilityCard: {
    borderRadius: getResponsiveSize(12),
    padding: getResponsiveSize(15),
    marginBottom: getResponsiveSize(15),
    borderWidth: 1,
  },
  compatibilityTitle: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
    marginBottom: getResponsiveSize(8),
  },
  compatibilityScore: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(5),
  },
  compatibilityText: {
    fontSize: getResponsiveFontSize(12),
    lineHeight: 18,
  },
  validationResults: {
    borderRadius: getResponsiveSize(12),
    padding: getResponsiveSize(15),
    marginBottom: getResponsiveSize(20),
    borderWidth: 1,
  },
  validationTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(10),
  },
  validationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: getResponsiveSize(10),
  },
  validationStat: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
  },
  validationNote: {
    fontSize: getResponsiveFontSize(12),
    textAlign: 'center',
    paddingHorizontal: getResponsiveSize(10),
  },
  validationAlert: {
    borderRadius: getResponsiveSize(15),
    padding: getResponsiveSize(15),
    marginHorizontal: getResponsiveSize(20),
    marginBottom: getResponsiveSize(20),
    borderWidth: 1,
    alignItems: 'center',
  },
  validationAlertTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(10),
  },
  validationAlertText: {
    fontSize: getResponsiveFontSize(13),
    textAlign: 'center',
    marginBottom: getResponsiveSize(15),
  },
  validationAlertActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  validationAlertButton: {
    borderRadius: getResponsiveSize(10),
    paddingVertical: getResponsiveSize(10),
    paddingHorizontal: getResponsiveSize(20),
    borderWidth: 1,
  },
  validationAlertButtonText: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
  },
  validateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getResponsiveSize(12),
    paddingHorizontal: getResponsiveSize(20),
    borderRadius: getResponsiveSize(10),
    marginTop: getResponsiveSize(15),
    gap: getResponsiveSize(8),
  },
  validateButtonText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getResponsiveSize(8),
    paddingHorizontal: getResponsiveSize(16),
    borderRadius: getResponsiveSize(8),
    marginTop: getResponsiveSize(10),
    gap: getResponsiveSize(6),
  },
  locationButtonText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(12),
    fontWeight: '600',
  },
  trendsContainer: {
    marginTop: getResponsiveSize(8),
  },
  trendsTitle: {
    fontSize: getResponsiveFontSize(12),
    fontWeight: '600',
    marginBottom: getResponsiveSize(4),
  },
  trendsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getResponsiveSize(6),
  },
  trendChip: {
    paddingHorizontal: getResponsiveSize(8),
    paddingVertical: getResponsiveSize(4),
    borderRadius: getResponsiveSize(12),
    borderWidth: 1,
  },
  trendChipText: {
    fontSize: getResponsiveFontSize(10),
    fontWeight: '500',
  },
  comboOccasion: {
    fontSize: getResponsiveFontSize(12),
    fontStyle: 'italic',
    marginTop: getResponsiveSize(4),
  },
  missingItemName: {
    fontSize: getResponsiveFontSize(13),
    fontWeight: '600',
    marginBottom: getResponsiveSize(2),
  },
  missingItemReason: {
    fontSize: getResponsiveFontSize(11),
    marginBottom: getResponsiveSize(6),
  },
  shoppingLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getResponsiveSize(6),
  },
  shoppingLinkButton: {
    paddingHorizontal: getResponsiveSize(12),
    paddingVertical: getResponsiveSize(6),
    borderRadius: getResponsiveSize(15),
  },
  shoppingLinkText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(10),
    fontWeight: '600',
  },
  outfitLinksContainer: {
    marginTop: getResponsiveSize(8),
    flexDirection: 'row',
    gap: getResponsiveSize(8),
  },
  inspirationLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSize(12),
    paddingVertical: getResponsiveSize(6),
    borderRadius: getResponsiveSize(15),
    borderWidth: 1,
    gap: getResponsiveSize(4),
  },
  inspirationLinkText: {
    fontSize: getResponsiveFontSize(10),
    fontWeight: '600',
  },
  suggestionsSection: {
    marginTop: getResponsiveSize(16),
    padding: getResponsiveSize(16),
    borderRadius: getResponsiveSize(12),
    borderWidth: 1,
  },
  suggestionsTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(4),
  },
  suggestionsSubtitle: {
    fontSize: getResponsiveFontSize(12),
    marginBottom: getResponsiveSize(12),
  },
  suggestionItem: {
    marginBottom: getResponsiveSize(12),
    paddingBottom: getResponsiveSize(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getResponsiveSize(4),
  },
  suggestionName: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: getResponsiveSize(8),
    paddingVertical: getResponsiveSize(2),
    borderRadius: getResponsiveSize(10),
  },
  priorityText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(9),
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  suggestionReason: {
    fontSize: getResponsiveFontSize(11),
    marginBottom: getResponsiveSize(8),
  },
});
