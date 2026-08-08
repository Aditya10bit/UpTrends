import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  checkShoppingItemMatch,
  getWardrobe,
  addWardrobeItem,
  WardrobeItem,
  ShoppingMatchResult,
  ClothingType,
} from '../services/digitalWardrobeService';
import { getUserProfile } from '../services/userService';
import { getColorCode } from '../utils/colorResolver';

const { width: screenWidth } = Dimensions.get('window');

export default function ShoppingScannerScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [result, setResult] = useState<ShoppingMatchResult | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [addingToCloset, setAddingToCloset] = useState(false);

  // Animation values
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const resultFadeAnim = useRef(new Animated.Value(0)).current;
  const scoreScaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadWardrobeAndProfile();
  }, []);

  const loadWardrobeAndProfile = async () => {
    try {
      const [items, profile] = await Promise.all([
        getWardrobe(),
        getUserProfile(),
      ]);
      setWardrobeItems(items);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to load assets for scanner:', error);
    }
  };

  // Scanner animation sweep
  useEffect(() => {
    if (matching) {
      scanLineAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [matching]);

  const handleSelectImage = async (useCamera: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      let pickerResult;
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Denied', 'Please allow camera access to scan items.');
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.7,
        });
      } else {
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.7,
        });
      }

      if (pickerResult.canceled || !pickerResult.assets?.length) return;

      const selectedUri = pickerResult.assets[0].uri;
      setImageUri(selectedUri);
      setResult(null);
      runScanner(selectedUri);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to select image');
    }
  };

  const runScanner = async (uri: string) => {
    try {
      setMatching(true);
      const matchResult = await checkShoppingItemMatch(uri, wardrobeItems, userProfile);
      setResult(matchResult);
      
      // Trigger animations on result load
      Animated.parallel([
        Animated.timing(resultFadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scoreScaleAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
      ]).start();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Analysis Failed', e.message || 'AI could not evaluate this item. Make sure the clothing is clearly visible.');
      setImageUri(null);
    } finally {
      setMatching(false);
    }
  };

  // Add the purchase item straight to closet
  const handleAddToCloset = async () => {
    if (!imageUri || !result) return;
    try {
      setAddingToCloset(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const gender = userProfile?.gender || 'male';

      // Add using the metadata the scanner ALREADY detected — no second AI call.
      // (Previously this re-ran full AI analysis, doubling cost and failing when
      // quota was low after the first call.)
      await addWardrobeItem(imageUri, gender, {
        name: result.detectedItem.name,
        type: result.detectedItem.type as ClothingType,
        subType: result.detectedItem.subType,
        primaryColor: result.detectedItem.primaryColor,
        colors: [result.detectedItem.primaryColor],
        stylePersonality: result.detectedItem.stylePersonality,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '🎉 Added!',
        `"${result.detectedItem.name}" is now in your digital wardrobe.`,
        [{ text: 'Nice!', onPress: () => router.replace('/wardrobe') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add item to wardrobe.');
    } finally {
      setAddingToCloset(false);
    }
  };

  const getVerdictTheme = (verdict: string) => {
    switch (verdict) {
      case 'BUY':
        return { color: '#10B981', bg: '#10B98115', icon: 'checkmark-circle' };
      case 'SKIP':
        return { color: '#EF4444', bg: '#EF444415', icon: 'close-circle' };
      default:
        return { color: '#F59E0B', bg: '#F59E0B15', icon: 'alert-circle' };
    }
  };

  const resolveImageSource = (item: WardrobeItem) => {
    if (item.imageUri && (item.imageUri.startsWith('http') || item.imageUri.startsWith('file:') || item.imageUri.startsWith('content:'))) {
      return { uri: item.imageUri };
    }
    if (item.imageBase64) {
      return { uri: `data:image/jpeg;base64,${item.imageBase64}` };
    }
    return { uri: item.imageUri };
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[theme.primary, theme.secondary]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Shopping Scanner</Text>
            <Text style={styles.headerSubtitle}>Will it match your closet?</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Scanner Workspace */}
      {!imageUri && !matching && (
        <View style={styles.selectWorkspace}>
          <Ionicons name="scan-circle" size={100} color={theme.primary + '50'} />
          <Text style={[styles.selectTitle, { color: theme.text }]}>Scan Potential Purchase</Text>
          <Text style={[styles.selectSubtitle, { color: theme.textSecondary }]}>
            Take a photo of any item in a store or upload a screenshot to see if it coordinates with your current closet.
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.actionSelectBtn} onPress={() => handleSelectImage(true)}>
              <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.btnGradient}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.btnText}>Take Photo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionSelectBtn, { borderColor: theme.borderLight, borderWidth: 1.5 }]} onPress={() => handleSelectImage(false)}>
              <View style={[styles.btnGradient, { backgroundColor: 'transparent' }]}>
                <Ionicons name="image" size={20} color={theme.primary} />
                <Text style={[styles.btnText, { color: theme.primary }]}>Upload Photo</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Scanner Animation View */}
      {imageUri && matching && (
        <View style={styles.scannerWorkspace}>
          <View style={styles.imageWrapper}>
            <Image source={{ uri: imageUri }} style={styles.scannedPreview as any} />
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 296], // Height of scanned preview
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
          <Text style={[styles.scanStatusText, { color: theme.text }]}>Stylist AI is scanning wardrobe compatibility...</Text>
          <Text style={[styles.scanStatusSubtext, { color: theme.textTertiary }]}>Checking styles, color theory, and coordination</Text>
        </View>
      )}

      {/* Results View */}
      {imageUri && result && !matching && (
        <Animated.ScrollView
          style={[styles.resultsContainer, { opacity: resultFadeAnim }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* Main Scanned Item Details */}
          <View style={[styles.resultCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Image source={{ uri: imageUri }} style={styles.smallScannedImage as any} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.scannedName, { color: theme.text }]}>{result.detectedItem.name}</Text>
                <Text style={[styles.scannedCategory, { color: theme.textSecondary }]}>
                  {result.detectedItem.primaryColor} • {result.detectedItem.subType}
                </Text>
                <View style={[styles.vibeBadge, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={[styles.vibeText, { color: theme.primary }]}>✨ {result.detectedItem.stylePersonality}</Text>
                </View>
              </View>
            </View>

            {/* Verdict Section */}
            <View style={styles.verdictRow}>
              {/* Score Circular Badge */}
              <Animated.View style={[styles.scoreCircle, { borderColor: getVerdictTheme(result.recommendation).color, transform: [{ scale: scoreScaleAnim }] }]}>
                <Text style={[styles.scoreValue, { color: theme.text }]}>{result.compatibilityScore}%</Text>
                <Text style={[styles.scoreLabel, { color: theme.textTertiary }]}>Match</Text>
              </Animated.View>

              {/* Verdict Text */}
              <View style={{ flex: 1, marginLeft: 16 }}>
                <View style={[styles.verdictBadge, { backgroundColor: getVerdictTheme(result.recommendation).bg }]}>
                  <Ionicons name={getVerdictTheme(result.recommendation).icon as any} size={16} color={getVerdictTheme(result.recommendation).color} />
                  <Text style={[styles.verdictBadgeText, { color: getVerdictTheme(result.recommendation).color }]}>
                    RECOMMENDED: {result.recommendation}
                  </Text>
                </View>
                <Text style={[styles.verdictReason, { color: theme.textSecondary }]}>{result.verdictReason}</Text>
              </View>
            </View>
          </View>

          {/* Matches List / Outfit combos */}
          {result.matchingOutfits.length > 0 && (
            <View style={styles.outfitsSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>✨ Recommended Coordinate Combos</Text>
              {result.matchingOutfits.map((outfit, index) => (
                <View key={index} style={[styles.outfitCard, { backgroundColor: theme.card }]}>
                  <Text style={[styles.outfitTitle, { color: theme.text }]}>{outfit.outfitName}</Text>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchesScroll}>
                    {/* The Scanned Item representation */}
                    <View style={styles.matchItemThumb}>
                      <Image source={{ uri: imageUri }} style={styles.matchImage as any} />
                      <Text style={[styles.matchLabel, { color: theme.primary, fontWeight: '700' }]} numberOfLines={1}>
                        New Scanned
                      </Text>
                    </View>

                    {/* Closet Matches */}
                    {outfit.closetItems.map((closetItem, idx) => (
                      <View key={idx} style={styles.matchItemThumb}>
                        <Image source={resolveImageSource(closetItem)} style={styles.matchImage as any} />
                        <Text style={[styles.matchLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                          {closetItem.name}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>

                  <Text style={[styles.outfitReasoning, { color: theme.textSecondary }]}>{outfit.reasoning}</Text>
                  
                  {outfit.stylingTips.map((tip, idx) => (
                    <View key={idx} style={[styles.tipChip, { backgroundColor: theme.primary + '10' }]}>
                      <Text style={[styles.tipText, { color: theme.primary }]}>💡 {tip}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.actionBtnContainer}>
            <TouchableOpacity style={styles.actionSelectBtn} onPress={handleAddToCloset} disabled={addingToCloset}>
              <LinearGradient colors={[theme.primary, theme.accent]} style={styles.btnGradient}>
                {addingToCloset ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.btnText}>Add Scanned Item to Closet</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSelectBtn, { borderColor: theme.borderLight, borderWidth: 1.5 }]}
              onPress={() => {
                setImageUri(null);
                setResult(null);
              }}
            >
              <View style={[styles.btnGradient, { backgroundColor: 'transparent' }]}>
                <Ionicons name="refresh" size={20} color={theme.textSecondary} />
                <Text style={[styles.btnText, { color: theme.textSecondary }]}>Scan New Item</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginTop: 2 },

  // Select workspace
  selectWorkspace: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  selectTitle: { fontSize: 20, fontWeight: '800', marginTop: 24, marginBottom: 8 },
  selectSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32, paddingHorizontal: 16 },
  btnRow: { gap: 12, width: '100%' },
  actionSelectBtn: { borderRadius: 14, overflow: 'hidden', width: '100%' },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, height: 48 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Scanner Workspace
  scannerWorkspace: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  imageWrapper: { width: 222, height: 296, borderRadius: 20, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, position: 'relative' },
  scannedPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  scanStatusText: { fontSize: 16, fontWeight: '700', marginTop: 24, textAlign: 'center' },
  scanStatusSubtext: { fontSize: 13, marginTop: 6, textAlign: 'center' },

  // Results View
  resultsContainer: { flex: 1, padding: 16 },
  resultCard: { borderRadius: 20, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.1)', paddingBottom: 16 },
  smallScannedImage: { width: 64, height: 80, borderRadius: 12, resizeMode: 'cover' },
  scannedName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  scannedCategory: { fontSize: 13, marginTop: 2 },
  vibeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8 },
  vibeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  verdictRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  scoreCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  scoreValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  scoreLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  verdictBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 6 },
  verdictBadgeText: { fontSize: 11, fontWeight: '800' },
  verdictReason: { fontSize: 13, lineHeight: 18 },

  // Matches/outfit list
  outfitsSection: { marginVertical: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12, letterSpacing: -0.3 },
  outfitCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  outfitTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  matchesScroll: { marginBottom: 12 },
  matchItemThumb: { alignItems: 'center', marginRight: 12, width: 72 },
  matchImage: { width: 68, height: 85, borderRadius: 10, resizeMode: 'cover', marginBottom: 4 },
  matchLabel: { fontSize: 10, textAlign: 'center', fontWeight: '500' },
  outfitReasoning: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  tipChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginBottom: 6, alignSelf: 'flex-start' },
  tipText: { fontSize: 12, fontWeight: '500' },

  actionBtnContainer: { gap: 12, marginTop: 16 },
});
