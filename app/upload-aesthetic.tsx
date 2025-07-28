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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;
const getResponsiveFontSize = (size: number) => {
  const scale = screenWidth / 375;
  const newSize = size * scale;
  return Math.max(12, Math.min(newSize, size * 1.3));
};

export default function UploadAesthetic() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startEntranceAnimations();
  }, []);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (selectedImages.length === 0 && !prompt.trim()) {
      Alert.alert('Missing Input', 'Please upload at least one image or add a description');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsGenerating(true);

    // Start rotation animation for generate button
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Simulate API call
    setTimeout(() => {
      setIsGenerating(false);
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
      
      // Mock generated suggestions
      setSuggestions({
        venue: "Elegant Restaurant",
        ambiance: "Sophisticated & Cozy",
        recommendations: [
          {
            style: "Smart Casual",
            colors: ["Navy Blue", "Cream", "Gold"],
            outfit: "Tailored blazer + Chinos + Leather loafers",
            accessories: "Watch, leather belt, minimal jewelry",
            mood: "Professional yet relaxed"
          },
          {
            style: "Business Casual",
            colors: ["Charcoal", "White", "Silver"],
            outfit: "Dress shirt + Dark trousers + Oxford shoes",
            accessories: "Tie optional, cufflinks, briefcase",
            mood: "Polished and confident"
          },
          {
            style: "Cocktail Chic",
            colors: ["Black", "Deep Purple", "Rose Gold"],
            outfit: "Cocktail dress + Heels + Statement jacket",
            accessories: "Clutch, bold earrings, cocktail ring",
            mood: "Elegant and striking"
          }
        ],
        tips: [
          "Consider the lighting - warm tones work well in cozy settings",
          "Layer pieces for versatility throughout the evening",
          "Choose comfortable shoes if you'll be standing",
          "Match your style to the venue's dress code"
        ]
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 3500);
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
          colors={['#667eea', '#764ba2', '#a8edea']}
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
            <Text style={styles.headerIcon}>🌟</Text>
            <Text style={styles.headerTitle}>Upload Aesthetic</Text>
            <Text style={styles.headerSubtitle}>Get styled for any occasion</Text>
          </View>
          
          <View style={styles.placeholder} />
        </LinearGradient>
      </Animated.View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
          
          {/* Upload Section */}
          <View style={styles.uploadSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Upload Place Images</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Share up to 2 photos of where you're going (restaurant, event, trip location, etc.)
            </Text>
            
            <Animated.View style={[styles.imageContainer, { transform: [{ scale: bounceAnim }] }]}>
              <View style={styles.imageRow}>
                {Array.from({ length: 2 }).map((_, index) => (
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
                        <Ionicons name="camera" size={getResponsiveSize(32)} color={theme.textTertiary} />
                        <Text style={[styles.emptySlotText, { color: theme.textTertiary }]}>
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
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Describe the Occasion</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Tell us more about the event, vibe, or style you're aiming for
            </Text>
            
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
                onFocus={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              />
              <View style={styles.charCounter}>
                <Text style={[styles.charCountText, { color: theme.textTertiary }]}>
                  {prompt.length}/300
                </Text>
              </View>
            </View>
          </View>

          {/* Generate Button */}
          <View style={styles.generateSection}>
            <TouchableOpacity
              style={[styles.generateButton, { opacity: (selectedImages.length > 0 || prompt.trim().length > 0) ? 1 : 0.5 }]}
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
                  {isGenerating ? 'Analyzing Style...' : 'Get Style Suggestions'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Results Section */}
          {suggestions && (
            <Animated.View 
              style={[styles.resultsSection, { backgroundColor: theme.card, borderColor: theme.borderLight }]}
            >
              <View style={styles.resultHeader}>
                <Ionicons name="star" size={getResponsiveSize(24)} color="#f39c12" />
                <Text style={[styles.resultTitle, { color: theme.text }]}>Style Suggestions</Text>
              </View>
              
              <View style={styles.venueInfo}>
                <Text style={[styles.venueTitle, { color: theme.text }]}>{suggestions.venue}</Text>
                <Text style={[styles.venueAmbiance, { color: theme.textSecondary }]}>{suggestions.ambiance}</Text>
              </View>

              <View style={styles.recommendationsContainer}>
                <Text style={[styles.recommendationsTitle, { color: theme.text }]}>Outfit Recommendations:</Text>
                {suggestions.recommendations.map((rec: any, index: number) => (
                  <View key={index} style={[styles.recommendationCard, { backgroundColor: theme.background }]}>
                    <View style={styles.recHeader}>
                      <Text style={[styles.recStyle, { color: theme.primary }]}>{rec.style}</Text>
                      <Text style={[styles.recMood, { color: theme.textSecondary }]}>{rec.mood}</Text>
                    </View>
                    
                    <Text style={[styles.recOutfit, { color: theme.text }]}>{rec.outfit}</Text>
                    
                    <View style={styles.colorsContainer}>
                      <Text style={[styles.colorsLabel, { color: theme.textSecondary }]}>Colors: </Text>
                      {rec.colors.map((color: string, colorIndex: number) => (
                        <View key={colorIndex} style={styles.colorTag}>
                          <Text style={[styles.colorText, { color: theme.text }]}>{color}</Text>
                        </View>
                      ))}
                    </View>
                    
                    <Text style={[styles.recAccessories, { color: theme.textSecondary }]}>
                      Accessories: {rec.accessories}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.tipsContainer}>
                <Text style={[styles.tipsTitle, { color: theme.text }]}>Pro Tips:</Text>
                {suggestions.tips.map((tip: string, index: number) => (
                  <View key={index} style={styles.tipItem}>
                    <Ionicons name="bulb" size={14} color={theme.accent} />
                    <Text style={[styles.tipText, { color: theme.textSecondary }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          <View style={styles.bottomSpacing} />
        </Animated.View>
      </ScrollView>
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
  imageContainer: { marginBottom: getResponsiveSize(15) },
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: getResponsiveSize(15),
  },
  imageSlot: {
    flex: 1,
    height: getResponsiveSize(150),
    borderRadius: getResponsiveSize(15),
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: getResponsiveSize(13),
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
    fontSize: getResponsiveFontSize(12),
    marginTop: 8,
    fontWeight: '500',
  },
  imageCounter: {
    textAlign: 'center',
    fontSize: getResponsiveFontSize(12),
  },
  promptSection: { marginBottom: getResponsiveSize(30) },
  textInputContainer: {
    borderRadius: getResponsiveSize(15),
    borderWidth: 1,
    padding: getResponsiveSize(15),
    position: 'relative',
  },
  textInput: {
    fontSize: getResponsiveFontSize(16),
    minHeight: getResponsiveSize(100),
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  charCounter: {
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  charCountText: {
    fontSize: getResponsiveFontSize(10),
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
  venueInfo: { marginBottom: getResponsiveSize(20) },
  venueTitle: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: 'bold',
    marginBottom: getResponsiveSize(4),
  },
  venueAmbiance: {
    fontSize: getResponsiveFontSize(14),
    fontStyle: 'italic',
  },
  recommendationsContainer: { marginBottom: getResponsiveSize(20) },
  recommendationsTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(15),
  },
  recommendationCard: {
    padding: getResponsiveSize(15),
    borderRadius: getResponsiveSize(12),
    marginBottom: getResponsiveSize(12),
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getResponsiveSize(8),
  },
  recStyle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: 'bold',
  },
  recMood: {
    fontSize: getResponsiveFontSize(12),
    fontStyle: 'italic',
  },
  recOutfit: {
    fontSize: getResponsiveFontSize(14),
    marginBottom: getResponsiveSize(8),
    fontWeight: '500',
  },
  colorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: getResponsiveSize(8),
  },
  colorsLabel: {
    fontSize: getResponsiveFontSize(12),
    marginRight: getResponsiveSize(5),
  },
  colorTag: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    borderRadius: getResponsiveSize(8),
    paddingHorizontal: getResponsiveSize(8),
    paddingVertical: getResponsiveSize(2),
    marginRight: getResponsiveSize(5),
    marginBottom: getResponsiveSize(2),
  },
  colorText: {
    fontSize: getResponsiveFontSize(10),
    fontWeight: '500',
  },
  recAccessories: {
    fontSize: getResponsiveFontSize(12),
  },
  tipsContainer: {},
  tipsTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    marginBottom: getResponsiveSize(10),
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: getResponsiveSize(8),
    gap: getResponsiveSize(8),
  },
  tipText: {
    fontSize: getResponsiveFontSize(12),
    flex: 1,
    lineHeight: 18,
  },
  bottomSpacing: { height: getResponsiveSize(50) },
});
