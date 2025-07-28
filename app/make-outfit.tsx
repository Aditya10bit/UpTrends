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
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

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

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

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
    if (selectedImages.length >= 8) {
      Alert.alert('Limit Reached', 'You can upload maximum 8 images');
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
      const newImages = result.assets.slice(0, 8 - selectedImages.length).map(asset => asset.uri);
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
  };

  const generateOutfit = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Images', 'Please upload at least one image to generate an outfit');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsGenerating(true);

    // Start rotation animation for generate button
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Simulate API call
    setTimeout(() => {
      setIsGenerating(false);
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
      
      // Mock generated outfit
      setGeneratedOutfit({
        name: "Custom Trendy Outfit",
        description: "A perfectly coordinated outfit based on your uploaded clothes",
        combinations: [
          "White shirt + Dark jeans + Sneakers",
          "Blue jacket + Black pants + Boots",
          "Casual dress + Light cardigan + Flats"
        ],
        styleScore: 95,
        colorHarmony: "Excellent",
        seasonSuitability: "All seasons"
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 3000);
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
          
          {/* Upload Section */}
          <View style={styles.uploadSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Upload Your Clothes</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Add up to 8 photos of your clothes for the perfect outfit combination
            </Text>
            
            <View style={styles.imageGrid}>
              {Array.from({ length: 8 }).map((_, index) => (
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
              {selectedImages.length}/8 images uploaded
            </Text>
          </View>

          {/* Generate Button */}
          <Animated.View style={[styles.generateSection, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              style={[styles.generateButton, { opacity: selectedImages.length > 0 ? 1 : 0.5 }]}
              onPress={generateOutfit}
              disabled={isGenerating || selectedImages.length === 0}
              onPressIn={() => {
                if (selectedImages.length > 0) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  startPulseAnimation();
                }
              }}
            >
              <LinearGradient
                colors={isGenerating ? ['#6c757d', '#495057'] : ['#ff6b9d', '#c44569']}
                style={styles.generateButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isGenerating ? (
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="refresh" size={getResponsiveSize(24)} color="#fff" />
                  </Animated.View>
                ) : (
                  <Ionicons name="sparkles" size={getResponsiveSize(24)} color="#fff" />
                )}
                <Text style={styles.generateButtonText}>
                  {isGenerating ? 'Creating Magic...' : 'Generate Outfit'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
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
                
                <View style={styles.combinationsContainer}>
                  <Text style={[styles.combinationsTitle, { color: theme.text }]}>Recommended Combinations:</Text>
                  {generatedOutfit.combinations.map((combo: string, index: number) => (
                    <View key={index} style={[styles.combinationItem, { backgroundColor: theme.background }]}>
                      <Ionicons name="shirt" size={16} color={theme.primary} />
                      <Text style={[styles.combinationText, { color: theme.text }]}>{combo}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.metricsContainer}>
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: theme.primary }]}>{generatedOutfit.styleScore}%</Text>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Style Score</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: theme.primary }]}>{generatedOutfit.colorHarmony}</Text>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Color Match</Text>
                  </View>
                </View>
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
});
