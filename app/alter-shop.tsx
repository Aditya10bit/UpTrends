import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { analyzeCurrentFit, getQuotaStatus } from '../services/alterShopService';
import { getUserProfile } from '../services/userService';
import { openExternalUrl } from '../utils/openExternalUrl';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AIPrivacyConsentModal, { HAS_SEEN_AI_PRIVACY_KEY } from '../components/AIPrivacyConsentModal';

const { width: screenWidth } = Dimensions.get('window');

interface AlteredResult {
  analysis: any;
  imageUri: string | null;
}

export default function AlterShopScreen() {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1

  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [perfectFitMsg, setPerfectFitMsg] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ count: number, limit: number, source: string } | null>(null);

  // Privacy Modal State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<boolean | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfileAndQuota();
  }, []);

  const loadProfileAndQuota = async () => {
    try {
      const profile = await getUserProfile();
      setUserProfile(profile);
      const quota = await getQuotaStatus();
      setQuotaInfo(quota);
    } catch (error) {
      console.error('Failed to load profile/quota:', error);
    }
  };

  const refreshQuota = async () => {
    const quota = await getQuotaStatus();
    setQuotaInfo(quota);
  };

  const handleSelectImage = async (useCamera: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const hasSeenPrivacy = await AsyncStorage.getItem(HAS_SEEN_AI_PRIVACY_KEY);
      if (hasSeenPrivacy !== 'accepted') {
        setPendingAction(useCamera);
        setShowPrivacyModal(true);
        return;
      }
      
      await proceedWithImageSelection(useCamera);
    } catch (error) {
      console.error('Privacy check error:', error);
    }
  };

  const proceedWithImageSelection = async (useCamera: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let pickerResult;
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission Required", "Please allow camera access.");
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission Required", "Please allow gallery access.");
          return;
        }
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.8,
        });
      }

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        setImageUri(pickerResult.assets[0].uri);
        setResults(null);
        setIsQuotaExhausted(false);
        setPerfectFitMsg(null);
        processAlteration(pickerResult.assets[0].uri);
      }
    } catch (error) {
      console.error('Image selection error:', error);
      Alert.alert('Error', 'Failed to load image');
    }
  };

  const processAlteration = async (uri: string) => {
    try {
      setAnalyzing(true);
      setGenerating(false);
      setProgress(0.1);

      // Step 1: Text Analysis (the only AI step needed)
      const analysisResponse = await analyzeCurrentFit(uri, userProfile);

      if (analysisResponse.isPerfectFit) {
        setAnalyzing(false);
        setPerfectFitMsg(analysisResponse.message || "Perfect Fit!");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      setAnalyzing(false);
      setResults(analysisResponse.analyses);
      await refreshQuota();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error: any) {
      console.error('Alter Shop Error:', error);
      if (error?.message === 'NSFW_VIOLATION') {
        Alert.alert('Warning', 'Explicit content detected. Repeated violations will result in an account ban.');
      } else {
        Alert.alert('Analysis Failed', error?.message || 'Could not analyze this outfit.');
      }
    } finally {
      setAnalyzing(false);
      setGenerating(false);
      progressAnim.setValue(0);
    }
  };



  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={['#6366f1', '#a855f7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alter Shop</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSubtitle}>Your AI Tailor Adjustments</Text>
      </LinearGradient>


      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!imageUri && (
          <View style={styles.uploadSection}>
            <TouchableOpacity style={[styles.uploadButton, { borderColor: theme.border }]} onPress={() => handleSelectImage(true)}>
              <Ionicons name="camera" size={32} color={theme.text} />
              <Text style={[styles.uploadText, { color: theme.text }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton, { borderColor: theme.border }]} onPress={() => handleSelectImage(false)}>
              <Ionicons name="image" size={32} color={theme.text} />
              <Text style={[styles.uploadText, { color: theme.text }]}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />

            {analyzing && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>The Tailor is analyzing...</Text>
              </View>
            )}

            {generating && (
              <View style={styles.loadingOverlay}>
                <Text style={styles.loadingText}>Generating alterations...</Text>
                <View style={styles.progressBarContainer}>
                  <Animated.View style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      })
                    }
                  ]} />
                </View>
              </View>
            )}
          </View>
        )}

        {perfectFitMsg && (
          <View style={[styles.perfectFitCard, { backgroundColor: isDark ? '#1a1a1a' : '#f0fdf4', borderColor: '#10b981' }]}>
            <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            <Text style={[styles.perfectFitTitle, { color: theme.text }]}>Perfect Fit!</Text>
            <Text style={[styles.perfectFitText, { color: theme.textSecondary }]}>{perfectFitMsg}</Text>
          </View>
        )}

        {results && !perfectFitMsg && (
          <View style={styles.resultsContainer}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Tailor Suggestions</Text>

            {/* IG-story style collage: photo on top, alteration panels below */}
            <View style={[styles.collageWrapper, { borderColor: theme.border }]}>
              {/* Full photo header */}
              <Image source={{ uri: imageUri! }} style={styles.collagePhoto} resizeMode="cover" />
              
              {/* Gradient overlay at bottom of photo */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.collagePhotoOverlay}
              >
                <Text style={styles.collagePhotoTitle}>Your Outfit</Text>
                <Text style={styles.collagePhotoSubtitle}>{results.length} alteration{results.length > 1 ? 's' : ''} suggested</Text>
              </LinearGradient>
            </View>

            {/* Grid of alteration panels */}
            <View style={styles.alterationGrid}>
              {results.map((res, idx) => {
                const colors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b'];
                const accentColor = colors[idx % colors.length];
                return (
                  <View
                    key={idx}
                    style={[styles.alterationPanel, {
                      backgroundColor: isDark ? '#1a1a2e' : '#fff',
                      borderColor: accentColor,
                    }]}
                  >
                    {/* Panel number badge */}
                    <View style={[styles.panelBadge, { backgroundColor: accentColor }]}>
                      <Text style={styles.panelBadgeNum}>{idx + 1}</Text>
                    </View>

                    <View style={styles.panelContent}>
                      <Text style={[styles.panelZone, { color: accentColor }]}>{res.zone}</Text>
                      <Text style={[styles.panelLabel, { color: theme.text }]}>{res.label}</Text>
                      <Text style={[styles.panelIssue, { color: theme.textSecondary }]}>Issue: {res.currentFit}</Text>

                      <View style={[styles.panelDivider, { backgroundColor: isDark ? '#333' : '#eee' }]} />

                      <Text style={[styles.panelTailorTitle, { color: theme.text }]}>✂️ Tailor Instructions</Text>
                      <Text style={[styles.panelTailorDesc, { color: theme.textSecondary }]}>{res.tailorInstructions}</Text>

                      <TouchableOpacity
                        style={[styles.shopBtn, { backgroundColor: accentColor }]}
                        onPress={() => openExternalUrl(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(res.searchQuery)}`)}
                      >
                        <Ionicons name="bag-handle-outline" size={14} color="#fff" />
                        <Text style={styles.shopBtnText}>Shop Similar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <AIPrivacyConsentModal
        visible={showPrivacyModal}
        onAccept={() => {
          setShowPrivacyModal(false);
          if (pendingAction !== null) {
            proceedWithImageSelection(pendingAction);
            setPendingAction(null);
          }
        }}
        onDecline={() => {
          setShowPrivacyModal(false);
          setPendingAction(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  quotaBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quotaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 24,
  },
  uploadSection: {
    gap: 16,
    marginTop: 20,
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  uploadText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 10,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  progressBarContainer: {
    width: '70%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  perfectFitCard: {
    marginTop: 24,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  perfectFitTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  perfectFitText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  resultsContainer: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  // --- Collage Styles ---
  collageWrapper: {
    width: '100%',
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 20,
    position: 'relative',
  },
  collagePhoto: {
    width: '100%',
    height: '100%',
  },
  collagePhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  collagePhotoTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  collagePhotoSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  // --- Alteration Grid ---
  alterationGrid: {
    gap: 16,
  },
  alterationPanel: {
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  panelBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  panelBadgeNum: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  panelContent: {
    padding: 18,
    paddingRight: 54, // avoid overlap with number badge
  },
  panelZone: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  panelLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  panelIssue: {
    fontSize: 13,
    marginBottom: 12,
  },
  panelDivider: {
    height: 1,
    marginVertical: 12,
    borderRadius: 1,
  },
  panelTailorTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  panelTailorDesc: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shopBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

