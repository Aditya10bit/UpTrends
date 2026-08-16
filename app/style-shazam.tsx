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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getWardrobe, WardrobeItem } from '../services/digitalWardrobeService';
import { getUserProfile } from '../services/userService';
import { analyzeStyleInspiration, StyleComponent } from '../services/geminiService';

const { width: screenWidth } = Dimensions.get('window');

export default function StyleShazamScreen() {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<StyleComponent[] | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Animation values
  const scanLineAnim = useRef(new Animated.Value(0)).current;

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
      console.error('Failed to load assets for style shazam:', error);
    }
  };

  useEffect(() => {
    if (analyzing) {
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
  }, [analyzing]);

  const handleSelectImage = async (useCamera: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      let pickerResult;
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission Required", "Please allow camera access to use this feature.");
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
          Alert.alert("Permission Required", "Please allow gallery access to upload an inspiration photo.");
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
        analyzeOutfit(pickerResult.assets[0].uri);
      }
    } catch (error) {
      console.error('Image selection error:', error);
      Alert.alert('Error', 'Failed to load image');
    }
  };

  const analyzeOutfit = async (uri: string) => {
    try {
      setAnalyzing(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const components = await analyzeStyleInspiration(uri, wardrobeItems, userProfile);
      setResults(components);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Style Shazam Error:', error);
      Alert.alert('Analysis Failed', 'Could not analyze this outfit. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getWardrobeItemById = (id: string) => {
    return wardrobeItems.find(item => item.id === id);
  };

  const openShoppingLink = (platform: 'google' | 'amazon' | 'pinterest', query: string) => {
    Haptics.selectionAsync();
    const encodedQuery = encodeURIComponent(query);
    let url = '';
    
    switch (platform) {
      case 'google':
        url = `https://www.google.com/search?tbm=shop&q=${encodedQuery}`;
        break;
      case 'amazon':
        url = `https://www.amazon.com/s?k=${encodedQuery}`;
        break;
      case 'pinterest':
        url = `https://www.pinterest.com/search/pins/?q=${encodedQuery}`;
        break;
    }
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      }
    });
  };

  const renderComponentCard = (comp: StyleComponent, index: number) => {
    const isMissing = comp.matchStatus === 'missing';
    const isExact = comp.matchStatus === 'exact';
    const matchedItem = comp.matchedItemId ? getWardrobeItemById(comp.matchedItemId) : null;
    
    return (
      <View key={index} style={[styles.componentCard, { backgroundColor: theme.surface }]}>
        <View style={styles.componentHeader}>
          <Text style={[styles.componentCategory, { color: theme.text }]}>
            {comp.category.toUpperCase()}
          </Text>
          <View style={[
            styles.badge, 
            { backgroundColor: isMissing ? '#FF5252' : isExact ? '#4CAF50' : '#FF9800' }
          ]}>
            <Text style={styles.badgeText}>
              {isMissing ? 'MISSING' : isExact ? 'EXACT MATCH' : 'SIMILAR MATCH'}
            </Text>
          </View>
        </View>

        <Text style={[styles.componentDesc, { color: theme.textSecondary }]}>
          {comp.description}
        </Text>

        {!isMissing && matchedItem && (
          <View style={styles.matchContainer}>
            <Image source={{ uri: matchedItem.imageUri }} style={styles.matchImage} />
            <View style={styles.matchInfo}>
              <Text style={[styles.matchTitle, { color: theme.text }]} numberOfLines={2}>
                {matchedItem.name}
              </Text>
              <Text style={[styles.matchSubtitle, { color: theme.textSecondary }]}>
                In your {matchedItem.type || 'closet'}
              </Text>
            </View>
          </View>
        )}

        {isMissing && comp.searchQuery && (
          <View style={styles.shopContainer}>
            <Text style={[styles.shopTitle, { color: theme.text }]}>Shop this look:</Text>
            <View style={styles.shopButtonsRow}>
              <TouchableOpacity 
                style={[styles.shopButton, { backgroundColor: '#DB4437' }]}
                onPress={() => openShoppingLink('google', comp.searchQuery!)}
              >
                <Ionicons name="logo-google" size={16} color="#FFF" />
                <Text style={styles.shopButtonText}>Shop</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.shopButton, { backgroundColor: '#FF9900' }]}
                onPress={() => openShoppingLink('amazon', comp.searchQuery!)}
              >
                <Ionicons name="logo-amazon" size={16} color="#FFF" />
                <Text style={styles.shopButtonText}>Amazon</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.shopButton, { backgroundColor: '#E60023' }]}
                onPress={() => openShoppingLink('pinterest', comp.searchQuery!)}
              >
                <Ionicons name="logo-pinterest" size={16} color="#FFF" />
                <Text style={styles.shopButtonText}>Ideas</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Style Shazam',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
        
        {/* Image Preview Area */}
        <View style={styles.imageContainer}>
          {imageUri ? (
            <View style={styles.previewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              
              {analyzing && (
                <View style={styles.analyzingOverlay}>
                  <Animated.View 
                    style={[
                      styles.scanLine,
                      {
                        transform: [{
                          translateY: scanLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 300]
                          })
                        }]
                      }
                    ]} 
                  />
                  <View style={styles.analyzingGlass}>
                    <ActivityIndicator size="large" color="#FFF" />
                    <Text style={styles.analyzingText}>Aria is stealing this look...</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <LinearGradient
              colors={isDark ? ['#2D2D3A', '#1E1E28'] : ['#F0F0F5', '#E5E5EA']}
              style={styles.placeholderContainer}
            >
              <Ionicons name="sparkles" size={48} color={theme.primary} />
              <Text style={[styles.placeholderTitle, { color: theme.text }]}>
                Steal the Look
              </Text>
              <Text style={[styles.placeholderSub, { color: theme.textSecondary }]}>
                Upload an outfit from Instagram, Pinterest, or snap a pic on the street. 
                We'll recreate it using your closet!
              </Text>
            </LinearGradient>
          )}
        </View>

        {/* Upload Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.surface }]}
            onPress={() => handleSelectImage(true)}
            disabled={analyzing}
          >
            <Ionicons name="camera" size={24} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleSelectImage(false)}
            disabled={analyzing}
          >
            <Ionicons name="images" size={24} color="#FFF" />
            <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Upload Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Results Area */}
        {results && (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsTitle, { color: theme.text }]}>Outfit Breakdown</Text>
              <Text style={[styles.resultsSub, { color: theme.textSecondary }]}>
                We found {results.filter(r => r.matchStatus !== 'missing').length} matches in your closet!
              </Text>
            </View>

            {results.map((comp, index) => renderComponentCard(comp, index))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  previewWrapper: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  analyzingGlass: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  analyzingText: {
    color: '#FFF',
    marginTop: 12,
    fontWeight: '600',
    fontSize: 15,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    width: '100%',
  },
  resultsHeader: {
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultsSub: {
    fontSize: 15,
  },
  componentCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  componentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  componentCategory: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  componentDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  matchContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  matchImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  matchSubtitle: {
    fontSize: 13,
  },
  shopContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  shopTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  shopButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  shopButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
