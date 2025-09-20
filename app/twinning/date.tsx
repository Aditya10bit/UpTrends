import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedProgress } from '../../components/TwinningSharedComponents';
import { useTheme } from '../../contexts/ThemeContext';
import { analyzeTwinningPhotos, TwinningAnalysis } from '../../services/twinningService';

const { width: screenWidth } = Dimensions.get('window');

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

export default function DateTwinningScreen() {
  const { theme, setStatusBarColor } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Set status bar color for this screen
  useEffect(() => {
    setStatusBarColor('twinning');
  }, [setStatusBarColor]);

  // State
  const [photos, setPhotos] = useState<PhotoSlot[]>([
    {
      id: 'person1',
      title: 'First Person',
      subtitle: 'Upload a clear photo',
      icon: '👤',
      required: true,
      needsName: true,
      placeholder: 'Tap to add photo'
    },
    {
      id: 'person2',
      title: 'Second Person',
      subtitle: 'Upload a clear photo',
      icon: '👤',
      required: true,
      needsName: true,
      placeholder: 'Tap to add photo'
    },
    {
      id: 'together',
      title: 'Together Photo',
      subtitle: 'Both of you in one frame',
      icon: '👫',
      required: true,
      placeholder: 'Couple photo'
    },
    {
      id: 'place',
      title: 'Date Venue',
      subtitle: 'Where you\'re going',
      icon: '📍',
      required: true,
      placeholder: 'Venue/location photo'
    },
  ]);

  const [names, setNames] = useState<{ person1: string; person2: string }>({ person1: '', person2: '' });
  const [dateContext, setDateContext] = useState({
    dateType: '',
    venue: '',
    atmosphere: '',
    duration: '',
    specialOccasion: '',
    stylePreferences: ''
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TwinningAnalysis | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const pulseAnim = useSharedValue(1);
  const shimmerAnim = useSharedValue(-1);
  const rotationAnim = useSharedValue(0);

  useEffect(() => {
    startAnimations();
  }, []);

  const startAnimations = () => {
    fadeAnim.value = withTiming(1, { duration: 800 });
    slideAnim.value = withSpring(0, { damping: 15, stiffness: 150 });

    // Pulse animation for upload areas
    pulseAnim.value = withRepeat(
      withTiming(1.05, { duration: 2000 }),
      -1
    );

    // Shimmer effect
    shimmerAnim.value = withRepeat(
      withTiming(1, { duration: 4000 }),
      -1
    );
  };

  // Start rotation animation when analyzing
  useEffect(() => {
    if (analyzing) {
      rotationAnim.value = withRepeat(
        withTiming(360, { duration: 2000 }),
        -1
      );
    } else {
      rotationAnim.value = withTiming(0, { duration: 0 });
    }
  }, [analyzing]);

  const pickImage = async (photoId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photo library to upload images for analysis.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setPhotos(prev => prev.map(photo =>
          photo.id === photoId
            ? { ...photo, image: result.assets[0].uri }
            : photo
        ));
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
    }
  };

  const canAnalyze = () => {
    try {
      const requiredPhotos = photos.filter(p => p.required);
      const hasAllRequired = requiredPhotos.every(p => p.image);
      const hasNames = names.person1?.trim() && names.person2?.trim();
      const hasRequiredContext = dateContext.dateType?.trim() && dateContext.venue?.trim();

      console.log('🔍 Validation check:', {
        hasAllRequired,
        hasNames,
        hasRequiredContext,
        requiredPhotosCount: requiredPhotos.length,
        uploadedPhotosCount: requiredPhotos.filter(p => p.image).length,
        person1Name: names.person1,
        person2Name: names.person2,
        dateType: dateContext.dateType,
        venue: dateContext.venue
      });

      return hasAllRequired && hasNames && hasRequiredContext;
    } catch (error) {
      console.error('Error in canAnalyze:', error);
      return false;
    }
  };

  const simulateAnalysisProgress = () => {
    const initialSteps = [
      `🎯 Starting comprehensive analysis for your perfect date coordination...`,
      `👤 Analyzing ${names.person1 || 'Person 1'}'s style and body type...`,
      `🔍 Deep-diving into ${names.person1 || 'Person 1'}'s unique style profile...`,
      `📸 Processing ${names.person1 || 'Person 1'} photo with advanced AI analysis...`,
      `✅ Successfully analyzed ${names.person1 || 'Person 1'} - Getting body type and skin tone...`,
      `� Scanniing ${names.person2 || 'Person 2'}'s vibe and energy...`,
      `�  Deep-diving into ${names.person2 || 'Person 2'}'s unique style profile...`,
      `📸 Processing ${names.person2 || 'Person 2'} photo with advanced AI analysis...`,
      `✅ Successfully analyzed ${names.person2 || 'Person 2'} - Getting appearance details...`,
      `� Unde-rstanding your romantic chemistry and couple dynamic...`,
      `🏛️ Analyzing the ${dateContext?.dateType || 'date'} setting and atmosphere...`,
      `📍 Evaluating ${dateContext?.venue || 'venue'} requirements and dress code...`,
      `🎨 Creating romantic color schemes for perfect coordination...`,
      `🤖 Getting AI fashion recommendations for couples...`,
      `� EGenerating coordinated date outfits based on analysis...`,
      `🛍️ Creating specific shopping links for each outfit item...`,
      `💡 Developing personalized styling tips for your date...`,
      `✨ Finalizing your perfect romantic coordination...`
    ];

    // Different timing for different types of steps
    const stepTimings = [
      800,  // Starting
      1000, // Analyzing person 1
      1500, // Deep diving person 1
      2000, // Processing photo 1 (longer for AI)
      800,  // Success person 1
      1000, // Analyzing person 2
      1500, // Deep diving person 2
      2000, // Processing photo 2 (longer for AI)
      800,  // Success person 2
      1200, // Romantic chemistry
      1200, // Date setting analysis
      1200, // Venue requirements
      1000, // Color schemes
      2500, // Getting AI recommendations (longer)
      1500, // Generating outfits
      1000, // Shopping links
      800,  // Styling tips
      800   // Finalizing
    ];

    // Safety check: ensure initialSteps is valid
    if (!initialSteps || !Array.isArray(initialSteps) || initialSteps.length === 0) {
      console.error('Invalid initialSteps:', initialSteps);
      return {
        cleanup: () => { },
        addFinalStep: () => { }
      };
    }

    // Safety check: ensure stepTimings is valid and matches initialSteps length
    if (!stepTimings || !Array.isArray(stepTimings) || stepTimings.length !== initialSteps.length) {
      console.error('Invalid stepTimings or length mismatch:', stepTimings, initialSteps.length);
      return {
        cleanup: () => { },
        addFinalStep: () => { }
      };
    }

    setProgressSteps(initialSteps);
    setCurrentStep(0);
    setCompletedSteps([]);

    let stepIndex = 0;
    let timeoutId: NodeJS.Timeout;

    const showNextStep = () => {
      try {
        if (stepIndex < initialSteps.length) {
          const currentStepText = initialSteps[stepIndex];
          if (currentStepText && typeof currentStepText === 'string') {
            setCurrentStep(stepIndex);
            setCompletedSteps(prev => [...prev, currentStepText]);

            const nextStepIndex = stepIndex + 1;
            if (nextStepIndex < initialSteps.length) {
              const stepTiming = stepTimings[stepIndex];
              if (typeof stepTiming === 'number' && stepTiming > 0) {
                timeoutId = setTimeout(showNextStep, stepTiming);
              } else {
                timeoutId = setTimeout(showNextStep, 1000); // Default timing
              }
            }
            stepIndex++;
          } else {
            console.warn('Invalid step text at index:', stepIndex, currentStepText);
            stepIndex++;
          }
        }
      } catch (error) {
        console.error('Error in progress simulation:', error);
      }
    };

    showNextStep();

    return {
      cleanup: () => {
        try {
          if (timeoutId) clearTimeout(timeoutId);
        } catch (error) {
          console.error('Error in cleanup:', error);
        }
      },
      addFinalStep: () => {
        try {
          const finalStepText = `🎉 Your perfect date coordination is ready!`;
          if (finalStepText && typeof finalStepText === 'string') {
            setCompletedSteps(prev => [...prev, finalStepText]);
            setCurrentStep(prev => prev + 1);
          }
        } catch (error) {
          console.error('Error adding final step:', error);
        }
      }
    }
  };

  const handleAnalyze = async () => {
    if (!canAnalyze()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Missing Information',
        'Please upload all required photos and enter both names to continue.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setAnalyzing(true);

    // Show results screen immediately with analyzing state
    setShowResults(true);
    // Reset and animate slide
    slideAnim.value = 50;
    slideAnim.value = withSpring(0, { damping: 15, stiffness: 150 });

    // Start progress simulation
    let progressController;
    try {
      progressController = simulateAnalysisProgress();
    } catch (error) {
      console.error('Error starting progress simulation:', error);
      // Create a minimal progress controller
      progressController = {
        cleanup: () => {
          console.log('Minimal progress controller cleanup called');
        },
        addFinalStep: () => {
          console.log('Minimal progress controller addFinalStep called');
        }
      };
    }

    try {
      const photoData = {
        person1: photos.find(p => p.id === 'person1')?.image || '',
        person2: photos.find(p => p.id === 'person2')?.image || '',
        together: photos.find(p => p.id === 'together')?.image,
        place: photos.find(p => p.id === 'place')?.image || '',
      };

      // Validate photo data before sending to analysis
      if (!photoData.person1 || !photoData.person2 || !photoData.place) {
        throw new Error('Missing required photos for analysis');
      }

      const result = await analyzeTwinningPhotos(
        photoData,
        names,
        'date',
        `${dateContext.dateType} at ${dateContext.venue}`,
        dateContext
      );

      // Add final success step when analysis is complete
      if (progressController && typeof progressController.addFinalStep === 'function') {
        try {
          progressController.addFinalStep();
        } catch (error) {
          console.error('Error adding final step:', error);
        }
      }

      // Small delay to show the final step
      await new Promise(resolve => setTimeout(resolve, 1000));

      setAnalysis(result);
      // Keep results screen open to show the analysis results
    } catch (error) {
      console.error('Analysis error:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let errorMessage = 'Failed to analyze photos. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Missing required photos')) {
          errorMessage = 'Please upload all required photos before analyzing.';
        } else if (error.message.includes('Missing required names')) {
          errorMessage = 'Please enter both names before analyzing.';
        } else if (error.message.includes('Rate limit')) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (error.message.includes('overloaded') || error.message.includes('503')) {
          errorMessage = 'AI service is busy. Please try again in a few minutes.';
        }
      }

      Alert.alert('Analysis Error', errorMessage);
      // Close results screen on error
      setShowResults(false);
    } finally {
      if (progressController && typeof progressController.cleanup === 'function') {
        try {
          progressController.cleanup();
        } catch (error) {
          console.error('Error cleaning up progress controller:', error);
        }
      }
      setAnalyzing(false);
      // Only close results screen if there was an error (handled above)
    }
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

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerAnim.value * 200 }],
  }));

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationAnim.value}deg` }],
  }));

  // Safety check: ensure theme is valid
  if (!theme) {
    return (
      <View style={styles.container}>
        <Text>Loading theme...</Text>
      </View>
    );
  }

  // Safety check: ensure names object is valid
  if (!names || typeof names !== 'object') {
    return (
      <View style={styles.container}>
        <Text>Loading names...</Text>
      </View>
    );
  }

  // Safety check: ensure photos array is valid
  if (!photos || !Array.isArray(photos)) {
    return (
      <View style={styles.container}>
        <Text>Loading photos...</Text>
      </View>
    );
  }

  // Safety check: ensure dateContext object is valid
  if (!dateContext || typeof dateContext !== 'object') {
    return (
      <View style={styles.container}>
        <Text>Loading context...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.statusBar.twinning} />

        {/* Header */}
        <LinearGradient
          colors={theme.gradientTwinning as [string, string]}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleSection}>
              <Text style={styles.headerTitle}>Twin for Date</Text>
              <Text style={styles.headerSubtitle}>Perfect couple coordination</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerIcon}>
                <Ionicons name="heart" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Instructions */}
          <Animated.View style={[styles.instructionsCard, animatedStyle]}>
            <LinearGradient
              colors={[`${theme.twinningAccent}20`, `${theme.twinningAccent}10`] as [string, string]}
              style={styles.instructionsGradient}
            >
              <View style={styles.instructionsHeader}>
                <Ionicons name="information-circle" size={24} color={theme.twinningAccent} />
                <Text style={[styles.instructionsTitle, { color: theme.text }]}>
                  Date Coordination
                </Text>
              </View>
              <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
                Upload photos and get AI-powered coordinated outfit suggestions for your perfect date look
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Photo Upload Section */}
          <View style={styles.uploadSection}>
            {theme ? (
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Upload Photos
              </Text>
            ) : (
              <Text style={{ color: '#ff6b9d' }}>Upload Photos</Text>
            )}
            <View style={styles.photoGrid}>
              {(photos || [])
                .filter(photo => photo && photo.id)
                .map((photo, index) => (
                  theme ? (
                    <PhotoUploadCard
                      key={photo.id}
                      photo={photo}
                      index={index}
                      onPress={() => pickImage(photo.id)}
                      onNameChange={(name) => {
                        try {
                          if (photo.id === 'person1') {
                            setNames(prev => ({ ...prev, person1: name || '' }));
                          } else if (photo.id === 'person2') {
                            setNames(prev => ({ ...prev, person2: name || '' }));
                          }
                        } catch (error) {
                          console.error('Error updating name:', error);
                        }
                      }}
                      name={photo.id === 'person1' ? names.person1 : photo.id === 'person2' ? names.person2 : ''}
                      theme={theme}
                      pulseStyle={pulseStyle}
                      shimmerStyle={shimmerStyle}
                    />
                  ) : (
                    <View style={styles.photoCard}>
                      <Text>Loading theme...</Text>
                    </View>
                  )
                ))}
            </View>
          </View>

          {/* Date Context Section */}
          <View style={styles.contextSection}>
            {theme ? (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Tell us about your date
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Help us create the perfect coordinated look for your special moment
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: '#ff6b9d' }}>Tell us about your date</Text>
                <Text style={{ color: '#666' }}>Help us create the perfect coordinated look for your special moment</Text>
              </>
            )}

            <View style={styles.contextGrid}>
              {theme ? (
                <>
                  <ContextInputCard
                    title="Date Type"
                    icon="heart"
                    placeholder="e.g., Dinner date, Coffee meetup, Movie night..."
                    value={dateContext.dateType}
                    onChangeText={(text) => setDateContext(prev => ({ ...prev, dateType: text || '' }))}
                    theme={theme}
                    primaryColor="#ff6b9d"
                    required
                  />

                  <ContextInputCard
                    title="Venue Description"
                    icon="location"
                    placeholder="e.g., Rooftop restaurant, Cozy cafe, Beach walk..."
                    value={dateContext.venue}
                    onChangeText={(text) => setDateContext(prev => ({ ...prev, venue: text || '' }))}
                    theme={theme}
                    primaryColor="#ff6b9d"
                    required
                  />

                  <ContextInputCard
                    title="Atmosphere"
                    icon="sunny"
                    placeholder="e.g., Romantic, Casual, Elegant, Fun..."
                    value={dateContext.atmosphere}
                    onChangeText={(text) => setDateContext(prev => ({ ...prev, atmosphere: text || '' }))}
                    theme={theme}
                    primaryColor="#ff6b9d"
                  />

                  <ContextInputCard
                    title="Duration & Time"
                    icon="time"
                    placeholder="e.g., Evening dinner, Afternoon coffee, All day..."
                    value={dateContext.duration}
                    onChangeText={(text) => setDateContext(prev => ({ ...prev, duration: text || '' }))}
                    theme={theme}
                    primaryColor="#ff6b9d"
                  />

                  <ContextInputCard
                    title="Special Occasion"
                    icon="gift"
                    placeholder="e.g., Anniversary, First date, Birthday..."
                    value={dateContext.specialOccasion}
                    onChangeText={(text) => setDateContext(prev => ({ ...prev, specialOccasion: text || '' }))}
                    theme={theme}
                    primaryColor="#ff6b9d"
                    multiline
                  />

                  <ContextInputCard
                    title="Style Preferences"
                    icon="shirt"
                    placeholder="e.g., Matching colors, Complementary styles, Formal..."
                    value={dateContext.stylePreferences}
                    onChangeText={(text) => setDateContext(prev => ({ ...prev, stylePreferences: text || '' }))}
                    theme={theme}
                    primaryColor="#ff6b9d"
                    multiline
                  />
                </>
              ) : (
                <View style={styles.contextCard}>
                  <Text>Loading theme...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Analyze Button */}
          <Animated.View style={[styles.analyzeSection, animatedStyle]}>
            <TouchableOpacity
              style={[
                styles.analyzeButton,
                {
                  opacity: canAnalyze() ? 1 : 0.6,
                  transform: [{ scale: canAnalyze() ? 1 : 0.98 }]
                }
              ]}
              onPress={handleAnalyze}
              disabled={!canAnalyze() || analyzing}
              activeOpacity={0.8}
            >
              {canAnalyze() && (
                <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                    style={styles.shimmerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </Animated.View>
              )}
              <LinearGradient
                colors={canAnalyze()
                  ? ['#ff6b9d', '#c44569', '#ff6b9d', '#c44569']
                  : ['#9ca3af', '#6b7280', '#9ca3af', '#6b7280']
                }
                style={styles.analyzeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {analyzing ? (
                  <View style={styles.analyzingContent}>
                    <Animated.View style={styles.aiBrainContainer}>
                      <Animated.View style={[styles.spinningRing, rotationStyle]}>
                        <View style={styles.ringOuter} />
                        <View style={styles.ringMiddle} />
                        <View style={styles.ringInner} />
                      </Animated.View>
                      <View style={styles.aiIconContainer}>
                        <Ionicons name="sparkles" size={20} color="#fff" />
                      </View>
                    </Animated.View>
                    <View style={styles.analyzingTextContainer}>
                      <Text style={styles.analyzeButtonText}>AI is analyzing...</Text>
                      <View style={styles.progressDots}>
                        {[...Array(3)].map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.progressDot,
                              { opacity: 0.3 + (i * 0.2) }
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.analyzeContent}>
                    <Ionicons name="flash" size={26} color="#fff" />
                    <Text style={styles.analyzeButtonText}>
                      {canAnalyze() ? 'Generate Perfect Date Coordination' : 'Complete Required Fields'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.8)" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.progressIndicator}>
              {theme ? (
                <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                  {photos.filter(p => p.required && p.image).length} of {photos.filter(p => p.required).length} required photos uploaded
                </Text>
              ) : (
                <Text style={{ color: '#666' }}>
                  {photos.filter(p => p.required && p.image).length} of {photos.filter(p => p.required).length} required photos uploaded
                </Text>
              )}
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(photos.filter(p => p.required && p.image).length / photos.filter(p => p.required).length) * 100}%`,
                      backgroundColor: canAnalyze() ? '#22c55e' : '#ff6b9d'
                    }
                  ]}
                />
              </View>
            </View>
          </Animated.View>

          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Results Overlay */}
        {showResults && (
          <Animated.View
            style={[
              styles.resultsOverlay,
              animatedStyle
            ]}
          >
            {theme ? (
              <ResultsScreen
                analysis={analysis}
                analyzing={analyzing}
                progressSteps={progressSteps}
                currentStep={currentStep}
                completedSteps={completedSteps}
                onClose={() => {
                  slideAnim.value = withTiming(50, { duration: 300 });
                  setTimeout(() => setShowResults(false), 300);
                }}
                theme={theme}
                primaryColor="#ff6b9d"
              />
            ) : (
              <View style={styles.resultsContainer}>
                <Text>Loading theme...</Text>
              </View>
            )}
          </Animated.View>
        )}
      </View>
    </>
  );
}

// Component definitions copied from friends.tsx but adapted for date context
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

function ContextInputCard({
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

interface PhotoUploadCardProps {
  photo: PhotoSlot;
  index: number;
  onPress: () => void;
  onNameChange?: (name: string) => void;
  name?: string;
  theme: any;
  pulseStyle: any;
  shimmerStyle: any;
}

function PhotoUploadCard({
  photo,
  index,
  onPress,
  onNameChange,
  name,
  theme,
  pulseStyle,
  shimmerStyle
}: PhotoUploadCardProps) {
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  const borderAnim = useSharedValue(0);

  useEffect(() => {
    cardOpacity.value = withDelay(
      index * 100,
      withTiming(1, { duration: 800 })
    );
    cardScale.value = withDelay(
      index * 100,
      withSpring(1, { damping: 15, stiffness: 200 })
    );
  }, []);

  useEffect(() => {
    if (photo.image) {
      borderAnim.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  }, [photo.image]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: photo.image
      ? `rgba(34, 197, 94, ${0.5 + borderAnim.value * 0.5})`
      : photo.required
        ? '#ff6b9d'
        : theme.borderLight,
    borderWidth: photo.image ? 3 : 2,
  }));

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View style={[styles.photoCard, cardAnimatedStyle]}>
      <TouchableOpacity onPress={handlePress} style={styles.photoTouchable} activeOpacity={0.8}>
        <Animated.View style={[
          styles.photoContainer,
          borderAnimatedStyle,
          !photo.image && pulseStyle,
        ]}>
          {photo.image ? (
            <>
              <Image source={{ uri: photo.image }} style={styles.photoImage} />
              <View style={styles.photoOverlay}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handlePress}
                >
                  <Ionicons name="pencil" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,107,157,0.3)', 'transparent']}
                  style={styles.shimmerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </Animated.View>

              <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,107,157,0.1)' }]}>
                <Text style={styles.photoIcon}>{photo.icon}</Text>
              </View>

              <Text style={[styles.photoTitle, { color: theme.text }]}>{photo.title}</Text>
              <Text style={[styles.photoSubtitle, { color: theme.textSecondary }]}>
                {photo.subtitle}
              </Text>
              <Text style={[styles.photoPlaceholderText, { color: theme.textSecondary }]}>
                {photo.placeholder}
              </Text>

              {photo.required && (
                <View style={[styles.requiredBadge, { backgroundColor: '#ff6b9d' }]}>
                  <Text style={styles.requiredText}>Required</Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>

      {photo.needsName && onNameChange && (
        <View style={styles.nameInputContainer}>
          <Text style={[styles.nameLabel, { color: theme.text }]}>Who is this?</Text>
          <TextInput
            style={[styles.nameInput, {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: name ? '#22c55e' : theme.borderLight,
              borderWidth: name ? 2 : 1,
            }]}
            placeholder="Enter name..."
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={onNameChange}
            returnKeyType="done"
          />
        </View>
      )}
    </Animated.View>
  );
}

interface ResultsScreenProps {
  analysis: TwinningAnalysis | null;
  analyzing: boolean;
  progressSteps: string[];
  currentStep: number;
  completedSteps: string[];
  onClose: () => void;
  theme: any;
  primaryColor: string;
}

function ResultsScreen({
  analysis,
  analyzing,
  progressSteps,
  currentStep,
  completedSteps,
  onClose,
  theme,
  primaryColor
}: ResultsScreenProps) {
  const insets = useSafeAreaInsets();

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  if (analyzing) {
    return (
      <View style={[styles.resultsContainer, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

        <LinearGradient
          colors={[primaryColor, '#c44569'] as any}
          style={[styles.resultsHeader, { paddingTop: Math.max(insets.top, 20) }]}
        >
          <View style={styles.resultsHeaderContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.resultsTitle}>Analyzing Your Date Photos</Text>
            <View style={styles.headerSpacer} />
          </View>
        </LinearGradient>

        <View style={styles.analyzingContainer}>
          {theme && primaryColor ? (
            <AnimatedProgress
              steps={progressSteps || []}
              currentStep={currentStep || 0}
              completedSteps={completedSteps || []}
              theme={theme}
              primaryColor={primaryColor}
            />
          ) : (
            <Text style={{ color: '#fff', textAlign: 'center', marginTop: 20 }}>
              Loading progress...
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={[styles.resultsContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>
          Failed to analyze photos. Please try again.
        </Text>
      </View>
    );
  }

  // Safety check: ensure analysis has required properties
  if (!analysis.person1 || !analysis.person2 || !analysis.outfitSuggestions || !analysis.relationship) {
    return (
      <View style={[styles.resultsContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>
          Analysis data is incomplete. Please try again.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.resultsContainer, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

      <LinearGradient
        colors={[primaryColor, '#c44569'] as any}
        style={[styles.resultsHeader, { paddingTop: Math.max(insets.top, 20) }]}
      >
        <View style={styles.resultsHeaderContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.resultsTitle}>Your Perfect Date Look</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
        {/* Analysis Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>
            Date Analysis
          </Text>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
            {analysis.relationship?.dynamic || 'Perfect date coordination'}
          </Text>
        </View>

        {/* Person Analysis */}
        <View style={styles.personsContainer}>
          {[analysis.person1, analysis.person2]
            .filter(person => person && person.name)
            .map((person, index) => (
              <View key={person.name} style={[styles.personCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.personName, { color: theme.text }]}>
                  {person.name || 'Unknown'}
                </Text>
                <View style={styles.personDetails}>
                  <Text style={[styles.personDetail, { color: theme.textSecondary }]}>
                    Skin Tone: {person.skinTone || 'Not specified'}
                  </Text>
                  <Text style={[styles.personDetail, { color: theme.textSecondary }]}>
                    Body Type: {person.bodyType || 'Not specified'}
                  </Text>
                  <Text style={[styles.personDetail, { color: theme.textSecondary }]}>
                    Style: {person.style || 'Not specified'}
                  </Text>
                </View>

                {/* Outfit Suggestions */}
                <View style={styles.outfitsContainer}>
                  <Text style={[styles.outfitsTitle, { color: theme.text }]}>
                    Date Outfit Suggestions
                  </Text>
                  {(analysis.outfitSuggestions?.[index === 0 ? 'person1' : 'person2'] || [])
                    .filter(outfit => outfit && outfit.category)
                    .map((outfit, outfitIndex) => (
                      <View key={outfitIndex} style={[styles.outfitCard, { backgroundColor: theme.background }]}>
                        <Text style={[styles.outfitCategory, { color: theme.text }]}>
                          {outfit.category || 'General'}
                        </Text>
                        <Text style={[styles.outfitItems, { color: theme.textSecondary }]}>
                          {(outfit.items || []).join(' • ') || 'No items specified'}
                        </Text>
                        <Text style={[styles.outfitWhy, { color: theme.textSecondary }]}>
                          {outfit.why_this_works || 'Perfect for your date style'}
                        </Text>

                        {/* Shopping Links */}
                        <View style={styles.shoppingLinks}>
                          {(outfit.shopping_links || [])
                            .filter(link => link && link.url)
                            .map((link, linkIndex) => (
                              <TouchableOpacity
                                key={linkIndex}
                                style={[styles.shoppingLink, { borderColor: theme.borderLight }]}
                                onPress={() => openLink(link.url)}
                              >
                                <Ionicons name={link.icon as any} size={16} color={primaryColor} />
                                <Text style={[styles.shoppingText, { color: theme.text }]}>
                                  {link.platform || 'Shop'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                        </View>
                      </View>
                    ))}
                </View>
              </View>
            ))}
        </View>

        {/* Coordination Tips */}
        <View style={[styles.coordinationCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.coordinationTitle, { color: theme.text }]}>
            Date Coordination Tips
          </Text>
          <Text style={[styles.coordinationTheme, { color: theme.textSecondary }]}>
            {analysis.outfitSuggestions?.coordination?.overall_theme || 'Perfect coordination for your romantic date'}
          </Text>

          <View style={styles.tipsContainer}>
            {(analysis.outfitSuggestions?.coordination?.color_harmony || [])
              .filter(tip => tip && typeof tip === 'string')
              .map((tip, index) => (
                <View key={index} style={styles.tipRow}>
                  <Ionicons name="color-palette" size={16} color={primaryColor} />
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                    {tip}
                  </Text>
                </View>
              ))}
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}
// Styles copied from friends.tsx with date-specific color adjustments

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
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
  headerTitleSection: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerIcon: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  instructionsCard: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  instructionsGradient: {
    padding: 20,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  uploadSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  contextSection: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  contextGrid: {
    gap: 16,
  },
  contextCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,107,157,0.05)',
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  photoCard: {
    width: (screenWidth - 56) / 2,
    marginBottom: 8,
  },
  photoTouchable: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  photoContainer: {
    aspectRatio: 1,
    borderRadius: 20,
    borderStyle: 'dashed',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,107,157,0.05)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 12,
  },
  successBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#22c55e',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: -200,
    right: 0,
    bottom: 0,
    width: 200,
    zIndex: 1,
  },
  shimmerGradient: {
    flex: 1,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photoIcon: {
    fontSize: 28,
  },
  photoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  photoSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  photoPlaceholderText: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  requiredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  requiredText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  nameInputContainer: {
    marginTop: 12,
  },
  nameLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  nameInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  analyzeSection: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  analyzeButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  analyzeGradient: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  analyzeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  analyzingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  aiBrainContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinningRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderTopColor: 'rgba(255,255,255,0.8)',
  },
  ringMiddle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderTopColor: 'rgba(255,255,255,0.6)',
  },
  ringInner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.4)',
  },
  aiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  analyzingTextContainer: {
    alignItems: 'center',
    gap: 4,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  progressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  progressIndicator: {
    marginTop: 16,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,107,157,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  bottomSpacing: {
    height: 20,
  },

  // Results Overlay Styles
  resultsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
    width: '100%',
    height: '100%',
  },

  // Results Modal Styles
  resultsContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  resultsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    padding: 8,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  resultsScroll: {
    flex: 1,
    padding: 20,
  },

  // Analyzing Styles
  analyzingContainer: {
    flex: 1,
  },

  // Results Content Styles
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  personsContainer: {
    gap: 16,
    marginBottom: 20,
  },
  personCard: {
    padding: 20,
    borderRadius: 16,
  },
  personName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  personDetails: {
    marginBottom: 16,
  },
  personDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  outfitsContainer: {
    marginTop: 16,
  },
  outfitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  outfitCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  outfitCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  outfitItems: {
    fontSize: 14,
    marginBottom: 8,
  },
  outfitWhy: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  shoppingLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shoppingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  shoppingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  coordinationCard: {
    padding: 20,
    borderRadius: 16,
  },
  coordinationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  coordinationTheme: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'left',
    lineHeight: 20,
  },
  tipsContainer: {
    gap: 8,
    alignItems: 'stretch',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
});