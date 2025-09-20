import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { analyzeImageAndGenerateOutfits, generateOutfitLinks, generateOutfitsFromPrompt, OutfitSuggestion, StyleAnalysisResult } from '../services/geminiService';
import { getUserProfile } from '../services/userService';
import { checkUserGender, promptForGender } from '../utils/genderUtils';

const { width: screenWidth } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / 375;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

export default function UploadAesthetic() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<StyleAnalysisResult | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startEntranceAnimations();
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const selectImage = async () => {
    if (selectedImages.length >= 2) {
      Alert.alert('Limit Reached', 'You can upload maximum 2 images');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImages(prev => [...prev, result.assets[0].uri]);

      // Animate image addition
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 1,
          tension: 100,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const removeImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
  };

  const generateSuggestions = async () => {
    if (isGenerating || isNavigating) return;

    if (selectedImages.length === 0 && !prompt.trim()) {
      Alert.alert('Missing Input', 'Please upload at least one image or add a description');
      return;
    }

    const genderCheck = await checkUserGender(user?.uid);
    if (!genderCheck.hasGender) {
      promptForGender(() => {
        loadUserProfile();
      });
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsGenerating(true);

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    try {
      let result: StyleAnalysisResult;
      
      const userContext = buildUserContext();
      const enhancedPrompt = `${prompt}\n\nUser Profile: ${userContext}`;

      if (selectedImages.length > 0) {
        result = await analyzeImageAndGenerateOutfits(selectedImages[0], enhancedPrompt, userProfile);
      } else {
        result = await generateOutfitsFromPrompt(enhancedPrompt, userProfile);
      }

      setSuggestions(result);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      Alert.alert(
        'Generation Failed',
        'Unable to generate outfit suggestions. Please try again.',
        [{ text: 'OK' }]
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
    }
  };

  const buildUserContext = () => {
    if (!userProfile) return 'No profile information available';
    
    const context = [];
    if (userProfile.gender) context.push(`Gender: ${userProfile.gender}`);
    if (userProfile.bodyType) context.push(`Body Type: ${userProfile.bodyType}`);
    if (userProfile.height) context.push(`Height: ${userProfile.height}cm`);
    if (userProfile.weight) context.push(`Weight: ${userProfile.weight}kg`);
    if (userProfile.skinTone) context.push(`Skin Tone: ${userProfile.skinTone}`);
    
    return context.join(', ');
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleSeeLinks = async (outfit: OutfitSuggestion) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      Alert.alert(
        'Generating Links',
        'Finding shopping links for this outfit...',
        [{ text: 'OK' }]
      );

      const links = await generateOutfitLinks(outfit.outfit, prompt);

      if (links.length > 0) {
        router.push({
          pathname: '/outfit-links',
          params: {
            links: JSON.stringify(links),
            outfitName: outfit.style,
            url: links[0].url
          }
        });
      } else {
        const fallbackLinks = outfit.shoppingLinks || [];
        if (fallbackLinks.length > 0) {
          router.push({
            pathname: '/outfit-links',
            params: {
              links: JSON.stringify(fallbackLinks),
              outfitName: outfit.style,
              url: fallbackLinks[0].url
            }
          });
        } else {
          Alert.alert(
            'No Links Found',
            'Unable to generate shopping links for this outfit. Please try searching manually.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error generating outfit links:', error);
      Alert.alert(
        'Error',
        'Unable to generate shopping links. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['#667eea', '#764ba2', '#a8edea']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isNavigating) return;
              setIsNavigating(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
              setTimeout(() => setIsNavigating(false), 1000);
            }}
          >
            <Ionicons name="arrow-back" size={getResponsiveSize(24)} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerEmoji}>🌟</Text>
            <Text style={styles.headerTitle}>Upload Aesthetic</Text>
            <Text style={styles.headerSubtitle}>Get styled for any occasion</Text>
          </View>

          <View style={styles.headerSpacer} />
        </LinearGradient>
      </Animated.View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
            }
          ]}
        >

          {/* User Profile Section */}
          <View style={styles.profileSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Style Preferences</Text>
            <View style={[styles.profileCard, { backgroundColor: 'rgba(102, 126, 234, 0.1)' }]}>
              <View style={styles.profileRow}>
                <Ionicons name="person" size={getResponsiveSize(24)} color={theme.primary} />
                <Text style={[styles.profileText, { color: theme.text }]}>Gender: {userProfile?.gender || 'Not Set'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Ionicons name="fitness" size={getResponsiveSize(24)} color={theme.primary} />
                <Text style={[styles.profileText, { color: theme.text }]}>Body Type: {userProfile?.bodyType || 'Not Set'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Ionicons name="resize" size={getResponsiveSize(24)} color={theme.primary} />
                <Text style={[styles.profileText, { color: theme.text }]}>Height: {userProfile?.height || 'Not Set'}cm</Text>
              </View>
              <View style={styles.profileRow}>
                <Ionicons name="scale" size={getResponsiveSize(24)} color={theme.primary} />
                <Text style={[styles.profileText, { color: theme.text }]}>Weight: {userProfile?.weight || 'Not Set'}kg</Text>
              </View>
              <View style={styles.profileRow}>
                <Ionicons name="partly-sunny" size={getResponsiveSize(24)} color={theme.primary} />
                <Text style={[styles.profileText, { color: theme.text }]}>Skin Tone: {userProfile?.skinTone || 'Not Set'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/profile');
              }}
            >
              <Ionicons name="pencil" size={getResponsiveSize(24)} color={theme.primary} />
              <Text style={[styles.editProfileText, { color: theme.primary }]}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Upload Section */}
          <View style={styles.uploadSection}>
            <Text style={[styles.uploadTitle, { color: theme.text }]}>Upload Place Images</Text>
            <Text style={[styles.uploadDescription, { color: theme.textSecondary }]}>
              Share up to 2 photos of where you're going (restaurant, event, trip location, etc.)
            </Text>

            <Animated.View style={[styles.imageContainer, { transform: [{ scale: bounceAnim }] }]}>
              <View style={styles.imageRow}>
                {Array.from({ length: 2 }).map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.imageUpload,
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
                        <Image
                          source={{ uri: selectedImages[index] }}
                          style={styles.uploadedImage}
                        />
                        <View style={styles.removeButton}>
                          <Ionicons name="close" size={16} color="#fff" />
                        </View>
                      </>
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="camera" size={getResponsiveSize(32)} color={theme.textTertiary} />
                        <Text style={[styles.imagePlaceholderText, { color: theme.textTertiary }]}>
                          {index === 0 ? "Add Location" : "Optional"}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            <Text style={[styles.imageCounter, { color: theme.textSecondary }]}>
              {selectedImages.length}/2 images uploaded
            </Text>
          </View>

          {/* Prompt Section */}
          <View style={styles.promptSection}>
            <Text style={[styles.promptTitle, { color: theme.text }]}>Describe the Occasion</Text>
            <Text style={[styles.promptDescription, { color: theme.textSecondary }]}>
              Tell us more about the event, vibe, or style you're aiming for
            </Text>

            <View style={[styles.tipsCard, { backgroundColor: 'rgba(102, 126, 234, 0.1)' }]}>
              <Text style={[styles.tipsTitle, { color: theme.text }]}>💡 Tips for better suggestions:</Text>
              <Text style={[styles.tipsText, { color: theme.textSecondary }]}>
                • Mention the occasion (dinner, wedding, business meeting)
              </Text>
              <Text style={[styles.tipsText, { color: theme.textSecondary }]}>
                • Describe the venue atmosphere (casual, formal, trendy)
              </Text>
              <Text style={[styles.tipsText, { color: theme.textSecondary }]}>
                • Include time of day and weather if relevant
              </Text>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[styles.textInputContainer, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                  <TextInput
                    style={[styles.textInput, { color: theme.text }]}
                    placeholder="E.g., Dinner at an upscale restaurant, casual beach trip, business meeting, wedding party..."
                    placeholderTextColor={theme.textTertiary}
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    numberOfLines={4}
                    maxLength={300}
                    scrollEnabled={true}
                    textAlignVertical="top"
                    returnKeyType="done"
                    onFocus={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  />
                  <View style={styles.characterCounter}>
                    <Text style={[styles.characterCounterText, { color: theme.textTertiary }]}>
                      {prompt.length}/300
                    </Text>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>

          {/* Generate Button */}
          <View style={styles.generateSection}>
            <TouchableOpacity
              style={[
                styles.generateButton,
                { opacity: (selectedImages.length > 0 || prompt.trim().length > 0) ? 1 : 0.5 }
              ]}
              onPress={generateSuggestions}
              disabled={isGenerating || (selectedImages.length === 0 && !prompt.trim())}
              onPressIn={() => {
                if (selectedImages.length > 0 || prompt.trim().length > 0) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                }
              }}
            >
              <LinearGradient
                colors={isGenerating ? ['#6c757d', '#495057'] : ['#667eea', '#764ba2']}
                style={styles.generateButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isGenerating ? (
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="sparkles" size={getResponsiveSize(24)} color="#fff" />
                  </Animated.View>
                ) : (
                  <Ionicons name="color-wand" size={getResponsiveSize(24)} color="#fff" />
                )}
                <Text style={styles.generateButtonText}>
                  {isGenerating ? 'Analyzing with AI...' : 'Get AI Style Suggestions'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {isGenerating && (
              <Text style={[styles.generatingText, { color: theme.textSecondary }]}>
                🤖 AI is analyzing your style preferences...
              </Text>
            )}
          </View>

          {/* Results Section */}
          {suggestions && (
            <Animated.View
              style={[
                styles.resultsContainer,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.borderLight,
                  opacity: fadeAnim
                }
              ]}
            >
              <View style={styles.resultsHeader}>
                <Ionicons name="star" size={getResponsiveSize(24)} color="#f39c12" />
                <Text style={[styles.resultsTitle, { color: theme.text }]}>Style Suggestions</Text>
              </View>

              <View style={styles.venueInfo}>
                <Text style={[styles.venueTitle, { color: theme.text }]}>{suggestions.venue}</Text>
                <Text style={[styles.venueAmbiance, { color: theme.textSecondary }]}>{suggestions.ambiance}</Text>
              </View>

              {/* Dominant Colors Section */}
              {suggestions.dominantColors && suggestions.dominantColors.length > 0 && (
                <View style={styles.colorsSection}>
                  <Text style={[styles.colorsTitle, { color: theme.text }]}>Venue Colors:</Text>
                  <View style={styles.colorsContainer}>
                    {suggestions.dominantColors.map((color: string, index: number) => (
                      <View
                        key={index}
                        style={[styles.colorTag, { backgroundColor: theme.background }]}
                      >
                        <Text style={[styles.colorText, { color: theme.text }]}>{color}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.recommendationsSection}>
                <Text style={[styles.recommendationsTitle, { color: theme.text }]}>Outfit Recommendations:</Text>
                {suggestions.recommendations.map((rec, index: number) => (
                  <View
                    key={index}
                    style={[styles.recommendationCard, { backgroundColor: theme.background }]}
                  >
                    <View style={styles.recommendationHeader}>
                      <Text style={[styles.recommendationStyle, { color: theme.primary }]}>{rec.style}</Text>
                      <Text style={[styles.recommendationMood, { color: theme.textSecondary }]}>{rec.mood}</Text>
                    </View>

                    <Text style={[styles.recommendationOutfit, { color: theme.text }]}>{rec.outfit}</Text>

                    <View style={styles.recommendationColors}>
                      <Text style={[styles.recommendationColorsLabel, { color: theme.textSecondary }]}>Colors:</Text>
                      <View style={styles.recommendationColorsContainer}>
                        {rec.colors.map((color: string, colorIndex: number) => (
                          <View key={colorIndex} style={styles.recommendationColorTag}>
                            <Text style={[styles.recommendationColorText, { color: theme.text }]}>{color}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <Text style={[styles.recommendationAccessories, { color: theme.textSecondary }]}>
                      Accessories: {rec.accessories}
                    </Text>

                    {rec.reasoning && (
                      <Text style={[styles.recommendationReasoning, { color: theme.textTertiary }]}>
                        💡 {rec.reasoning}
                      </Text>
                    )}

                    {/* See Links Button */}
                    <TouchableOpacity
                      style={[styles.linksButton, { backgroundColor: theme.primary }]}
                      onPress={() => handleSeeLinks(rec)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="link" size={16} color="#fff" style={styles.linksButtonIcon} />
                      <Text style={styles.linksButtonText}>
                        See Shopping Links
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.tipsSection}>
                <Text style={[styles.tipsSectionTitle, { color: theme.text }]}>Pro Tips:</Text>
                {suggestions.tips.map((tip: string, index: number) => (
                  <View key={index} style={styles.tipRow}>
                    <Ionicons name="bulb" size={14} color={theme.accent} />
                    <Text style={[styles.tipText, { color: theme.textSecondary }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Bottom spacing */}
          <View style={styles.bottomSpacing} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: getResponsiveSize(20),
    paddingVertical: getResponsiveSize(16),
    borderBottomLeftRadius: getResponsiveSize(24),
    borderBottomRightRadius: getResponsiveSize(24),
  },
  backButton: {
    padding: getResponsiveSize(8),
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerEmoji: {
    fontSize: getResponsiveFontSize(30),
    marginBottom: getResponsiveSize(4),
  },
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
  headerSpacer: {
    width: getResponsiveSize(40),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  contentContainer: {
    padding: getResponsiveSize(20),
  },
  profileSection: {
    marginBottom: getResponsiveSize(24),
  },
  sectionTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(8),
  },
  profileCard: {
    borderRadius: getResponsiveSize(24),
    padding: getResponsiveSize(16),
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: getResponsiveSize(12),
  },
  profileText: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginLeft: getResponsiveSize(12),
  },
  editProfileButton: {
    marginTop: getResponsiveSize(16),
    borderRadius: getResponsiveSize(16),
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(102, 126, 234, 0.5)',
    padding: getResponsiveSize(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileText: {
    fontSize: getResponsiveFontSize(16),
    marginTop: getResponsiveSize(8),
    fontWeight: '500',
  },
  uploadSection: {
    marginBottom: getResponsiveSize(30),
  },
  uploadTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(8),
  },
  uploadDescription: {
    fontSize: getResponsiveFontSize(14),
    marginBottom: getResponsiveSize(20),
    lineHeight: 20,
  },
  imageContainer: {
    marginBottom: getResponsiveSize(16),
  },
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: getResponsiveSize(16),
  },
  imageUpload: {
    flex: 1,
    height: getResponsiveSize(144),
    borderRadius: getResponsiveSize(16),
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: getResponsiveSize(12),
  },
  removeButton: {
    position: 'absolute',
    top: getResponsiveSize(-8),
    right: getResponsiveSize(-8),
    backgroundColor: '#ef4444',
    borderRadius: getResponsiveSize(12),
    width: getResponsiveSize(24),
    height: getResponsiveSize(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: getResponsiveFontSize(12),
    marginTop: getResponsiveSize(8),
    fontWeight: '500',
  },
  imageCounter: {
    textAlign: 'center',
    fontSize: getResponsiveFontSize(12),
    marginTop: getResponsiveSize(8),
  },
  promptSection: {
    marginBottom: getResponsiveSize(32),
  },
  promptTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(8),
  },
  promptDescription: {
    fontSize: getResponsiveFontSize(14),
    marginBottom: getResponsiveSize(20),
    lineHeight: 20,
  },
  tipsCard: {
    borderRadius: getResponsiveSize(24),
    padding: getResponsiveSize(12),
    marginBottom: getResponsiveSize(16),
  },
  tipsTitle: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
    marginBottom: getResponsiveSize(8),
  },
  tipsText: {
    fontSize: getResponsiveFontSize(12),
    lineHeight: 16,
    marginBottom: getResponsiveSize(4),
  },
  textInputContainer: {
    borderRadius: getResponsiveSize(16),
    borderWidth: 1,
    padding: getResponsiveSize(16),
    position: 'relative',
  },
  textInput: {
    fontSize: getResponsiveFontSize(16),
    minHeight: getResponsiveSize(100),
    maxHeight: getResponsiveSize(150),
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  characterCounter: {
    position: 'absolute',
    bottom: getResponsiveSize(8),
    right: getResponsiveSize(12),
  },
  characterCounterText: {
    fontSize: getResponsiveFontSize(12),
  },
  generateSection: {
    marginBottom: getResponsiveSize(32),
  },
  generateButton: {
    borderRadius: getResponsiveSize(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getResponsiveSize(20),
    paddingHorizontal: getResponsiveSize(32),
    gap: getResponsiveSize(12),
  },
  generateButtonText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
  },
  generatingText: {
    textAlign: 'center',
    fontSize: getResponsiveFontSize(14),
    marginTop: getResponsiveSize(12),
    fontStyle: 'italic',
  },
  resultsContainer: {
    borderRadius: getResponsiveSize(16),
    padding: getResponsiveSize(20),
    marginBottom: getResponsiveSize(20),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: getResponsiveSize(16),
    gap: getResponsiveSize(12),
  },
  resultsTitle: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: 'bold',
  },
  venueInfo: {
    marginBottom: getResponsiveSize(20),
  },
  venueTitle: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(4),
  },
  venueAmbiance: {
    fontSize: getResponsiveFontSize(14),
    fontStyle: 'italic',
  },
  colorsSection: {
    marginBottom: getResponsiveSize(20),
  },
  colorsTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(12),
  },
  colorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getResponsiveSize(8),
  },
  colorTag: {
    paddingHorizontal: getResponsiveSize(12),
    paddingVertical: getResponsiveSize(8),
    borderRadius: getResponsiveSize(16),
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    marginBottom: getResponsiveSize(8),
  },
  colorText: {
    fontSize: getResponsiveFontSize(12),
    fontWeight: '500',
  },
  recommendationsSection: {
    marginBottom: getResponsiveSize(20),
  },
  recommendationsTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(16),
  },
  recommendationCard: {
    padding: getResponsiveSize(16),
    borderRadius: getResponsiveSize(12),
    marginBottom: getResponsiveSize(12),
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getResponsiveSize(8),
  },
  recommendationStyle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: 'bold',
  },
  recommendationMood: {
    fontSize: getResponsiveFontSize(12),
    fontStyle: 'italic',
  },
  recommendationOutfit: {
    fontSize: getResponsiveFontSize(14),
    marginBottom: getResponsiveSize(8),
    fontWeight: '500',
  },
  recommendationColors: {
    marginBottom: getResponsiveSize(8),
  },
  recommendationColorsLabel: {
    fontSize: getResponsiveFontSize(12),
    marginBottom: getResponsiveSize(4),
  },
  recommendationColorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getResponsiveSize(4),
  },
  recommendationColorTag: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    borderRadius: getResponsiveSize(8),
    paddingHorizontal: getResponsiveSize(8),
    paddingVertical: getResponsiveSize(4),
    marginBottom: getResponsiveSize(4),
  },
  recommendationColorText: {
    fontSize: getResponsiveFontSize(12),
    fontWeight: '500',
  },
  recommendationAccessories: {
    fontSize: getResponsiveFontSize(12),
  },
  recommendationReasoning: {
    fontSize: getResponsiveFontSize(12),
    marginTop: getResponsiveSize(8),
    fontStyle: 'italic',
    lineHeight: 16,
  },
  linksButton: {
    marginTop: getResponsiveSize(12),
    paddingHorizontal: getResponsiveSize(16),
    paddingVertical: getResponsiveSize(8),
    borderRadius: getResponsiveSize(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  linksButtonIcon: {
    marginRight: getResponsiveSize(6),
  },
  linksButtonText: {
    color: '#fff',
    fontSize: getResponsiveFontSize(12),
    fontWeight: '600',
  },
  tipsSection: {
    marginTop: getResponsiveSize(16),
  },
  tipsSectionTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(12),
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: getResponsiveSize(8),
    gap: getResponsiveSize(8),
  },
  tipText: {
    fontSize: getResponsiveFontSize(12),
    flex: 1,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: getResponsiveSize(100),
  },
});