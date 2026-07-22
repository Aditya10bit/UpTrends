import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { isFirebaseInitialized, storage } from '../firebaseConfig';
import { testApiKey, invalidateApiKeyCache, getActiveKeySource } from '../services/geminiService';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { getUserAnalytics, syncAnalyticsWithFirebase, UserAnalytics } from '../services/analyticsService';
import { getUserProfile, updateUserProfile } from '../services/userService';

const { width } = Dimensions.get('window');

// FavoriteItem interface removed - no longer using saved outfits

interface UserProfile {
  displayName?: string;
  photoURL?: string;
  email?: string;
  totalOutfits?: number;
  sharedCount?: number;
  uid?: string;
  username?: string;
  gender?: string;

  // favorites removed - no longer using saved outfits
  sharedOutfits?: any[];
  viewHistory?: any[];
  createdAt?: any;
  lastLogin?: any;
  updatedAt?: any;
  height?: number;
  weight?: number;
  skinTone?: string;
  bodyType?: string;
  city?: string;
}

const getStatusBarHeight = () => {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight || 0;
  }
  return 44;
};

export default function ProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Removed favorites and tabs - focusing on profile info only
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { user, logout } = useAuth();

  // --- API Key Settings State ---
  const [apiKeyExpanded, setApiKeyExpanded] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiKeyError, setApiKeyError] = useState('');
  const [activeKeySource, setActiveKeySource] = useState<'custom' | 'default'>('default');
  const [showApiKey, setShowApiKey] = useState(false);

  // Animation values
  const scale = useSharedValue(1);
  const profileCardOpacity = useSharedValue(0);
  const profileCardTranslateY = useSharedValue(50);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(40);
  const backButtonOpacity = useSharedValue(0);
  const settingsButtonOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);
  const screenTranslateY = useSharedValue(0);

  useEffect(() => {
    loadUserData();
    loadApiKeyStatus();
  }, []);

  // Load the current API key source status
  const loadApiKeyStatus = async () => {
    try {
      const source = await getActiveKeySource();
      setActiveKeySource(source);
      if (source === 'custom') {
        const savedKey = await AsyncStorage.getItem('user_gemini_api_key');
        if (savedKey) setCustomApiKey(savedKey);
      }
    } catch {}
  };

  // Handle verifying and saving a custom API key
  const handleVerifyAndSaveKey = async () => {
    if (!customApiKey.trim()) {
      setApiKeyError('Please enter an API key.');
      setApiKeyStatus('error');
      return;
    }
    setApiKeyStatus('testing');
    setApiKeyError('');
    const result = await testApiKey(customApiKey.trim());
    if (result.success) {
      await AsyncStorage.setItem('user_gemini_api_key', customApiKey.trim());
      invalidateApiKeyCache();
      setApiKeyStatus('success');
      setActiveKeySource('custom');
    } else {
      setApiKeyStatus('error');
      setApiKeyError(result.error || 'Verification failed.');
    }
  };

  // Handle resetting to the default developer key
  const handleResetApiKey = async () => {
    Alert.alert(
      'Reset to Default Key',
      'This will remove your custom API key and use the default. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('user_gemini_api_key');
            invalidateApiKeyCache();
            setCustomApiKey('');
            setApiKeyStatus('idle');
            setApiKeyError('');
            setActiveKeySource('default');
            setShowApiKey(false);
          }
        }
      ]
    );
  };

  // Use useFocusEffect to handle screen focus properly
  useFocusEffect(
    useCallback(() => {
      // Reset animation values when screen comes into focus
      resetAnimationValues();
      startEntranceAnimations();

      return () => {
        // Cleanup when screen loses focus
        setIsExiting(false);
        setIsNavigating(false);
      };
    }, [])
  );

  const resetAnimationValues = () => {
    screenOpacity.value = 1;
    screenTranslateY.value = 0;
    profileCardOpacity.value = 0;
    profileCardTranslateY.value = 50;
    contentOpacity.value = 0;
    contentTranslateY.value = 40;
    backButtonOpacity.value = 0;
    settingsButtonOpacity.value = 0;
  };

  const startExitAnimation = (callback: () => void) => {
    if (isExiting) return;
    setIsExiting(true);

    // Animate screen exit
    screenOpacity.value = withTiming(0, { duration: 250 });
    screenTranslateY.value = withTiming(-30, { duration: 250 });

    setTimeout(() => {
      callback();
    }, 250);
  };

  const startEntranceAnimations = () => {
    // Animate back button first
    backButtonOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));

    // Animate settings button
    settingsButtonOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));

    // Animate profile card
    profileCardOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    profileCardTranslateY.value = withDelay(300, withSpring(0, { damping: 20, stiffness: 200 }));

    // Animate content
    contentOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    contentTranslateY.value = withDelay(800, withSpring(0, { damping: 15, stiffness: 180 }));
  };

  const loadUserData = async () => {
    try {
      if (user?.uid) {
        // Load profile and analytics in parallel
        const [profile, analytics] = await Promise.all([
          getUserProfile(),
          getUserAnalytics(user.uid)
        ]);

        if (profile) {
          const profileWithEmail: UserProfile = {
            ...profile,
            email: profile.email || user.email || '',
            uid: profile.uid || user.uid || '',
          };
          setUserProfile(profileWithEmail);
        } else {
          const basicProfile: UserProfile = {
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            uid: user.uid || '',
          };
          setUserProfile(basicProfile);
        }

        setUserAnalytics(analytics);

        // Sync analytics in the background
        syncAnalyticsWithFirebase(user.uid);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const profileCardAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: profileCardOpacity.value,
      transform: [{ translateY: profileCardTranslateY.value }],
    };
  });

  // tabsAnimatedStyle removed - no longer using tabs

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ translateY: contentTranslateY.value }],
    };
  });

  const backButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: backButtonOpacity.value,
    };
  });

  const settingsButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: settingsButtonOpacity.value,
    };
  });

  const handleProfileImagePress = () => {
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    Alert.alert(
      'Profile Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => pickImage('camera') },
        { text: 'Gallery', onPress: () => pickImage('gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        })
        : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Info', 'Photo upload will work in APK build, not in Expo Go');
    }
  };

  const uploadProfileImage = async (imageUri: string) => {
    try {
      setUploading(true);

      if (!isFirebaseInitialized || !storage) {
        throw new Error('Firebase Storage not initialized');
      }

      // Check if user is authenticated
      if (!user?.uid) {
        Alert.alert('Error', 'Please log in to upload profile photo');
        return;
      }

      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Create a unique filename to avoid conflicts
      const timestamp = Date.now();
      const imageRef = ref(storage, `profile-images/${user.uid}_${timestamp}`);

      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);
      await updateUserProfile(user.uid, { photoURL: downloadURL });
      await loadUserData();
      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);

      if (error.code === 'storage/unauthorized') {
        Alert.alert(
          'Upload Permission Error',
          'Please update Firebase Storage rules to allow profile image uploads. This is a configuration issue, not an Expo vs APK issue.'
        );
      } else {
        Alert.alert('Upload Error', `Failed to upload image: ${error.message}`);
      }
    } finally {
      setUploading(false);
    }
  };

  // --- Name Edit Logic ---
  const handleNameEdit = () => {
    const currentName = userProfile?.displayName || user?.displayName || 'Fashion Enthusiast';
    setTempDisplayName(currentName);
    setIsEditingName(true);
  };

  const handleNameSave = async () => {
    try {
      if (!tempDisplayName.trim()) {
        Alert.alert('Error', 'Please enter a valid name');
        return;
      }
      await updateUserProfile(user?.uid!, { displayName: tempDisplayName.trim() });
      await loadUserData();
      setIsEditingName(false);
      Alert.alert('Success', 'Name updated successfully!');
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert('Error', 'Failed to update name');
    }
  };

  const handleNameCancel = () => {
    setIsEditingName(false);
    setTempDisplayName('');
  };

  // removeFavorite function removed - no longer using saved outfits

  const displayName = userProfile?.displayName || user?.displayName || 'Fashion Enthusiast';
  const profileImageUrl = userProfile?.photoURL || user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=120`;

  // Dynamic stats from analytics service
  const totalOutfits = userAnalytics?.aiRequestsCount || 0;
  const sharedCount = userAnalytics?.sharedOutfitsCount || 0;

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));

  // Don't render anything until data is loaded to prevent lag
  if (loading) {
    return (
      <PremiumBackground variant="profile">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} backgroundColor={theme.primary} />
          <Ionicons name="sparkles" size={48} color={theme.primary} />
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 16 }}>
            Loading your profile...
          </Text>
        </View>
      </PremiumBackground>
    );
  }

  return (
    <PremiumBackground variant="profile">
    <Animated.View style={[{ flex: 1 }, screenAnimatedStyle]}>
      <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} backgroundColor={theme.primary} />
      {/* Back Button */}
      <Animated.View style={[
        {
          position: 'absolute',
          top: insets.top + 16,
          left: 16,
          zIndex: 100,
        },
        backButtonAnimatedStyle
      ]}>
        <TouchableOpacity onPress={() => {
          if (isNavigating || isExiting) return;
          setIsNavigating(true);
          startExitAnimation(() => {
            router.back();
            setTimeout(() => setIsNavigating(false), 500);
          });
        }} style={{
          backgroundColor: theme.card,
          borderRadius: 20,
          padding: 8,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
      </Animated.View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Modern Profile Card */}
        <Animated.View style={[
          {
            backgroundColor: theme.card,
            borderRadius: 24,
            marginHorizontal: 20,
            marginTop: insets.top + 60,
            paddingTop: 56,
            paddingBottom: 32,
            paddingHorizontal: 24,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 10,
            alignItems: 'center',
          },
          profileCardAnimatedStyle
        ]}>
          {/* Profile Image */}
          <View style={{
            position: 'absolute',
            top: -50,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 2,
          }}>
            <TouchableOpacity onPress={handleProfileImagePress} disabled={uploading}>
              <Image
                source={{ uri: profileImageUrl }}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 4,
                  borderColor: theme.background,
                  backgroundColor: theme.card,
                }}
              />
              <View style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: theme.primary,
                width: 32,
                height: 32,
                borderRadius: 16,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: theme.background,
              }}>
                {uploading
                  ? <Ionicons name="hourglass" size={16} color="#fff" />
                  : <Ionicons name="camera" size={16} color="#fff" />
                }
              </View>
            </TouchableOpacity>
          </View>
          {/* User Info */}
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            {/* Editable Name + Edit Profile Button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              {isEditingName ? (
                <>
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: 20,
                      fontWeight: 'bold',
                      color: theme.text,
                      textAlign: 'center',
                      paddingVertical: 4,
                      backgroundColor: theme.background,
                      borderRadius: 8,
                    }}
                    value={tempDisplayName}
                    onChangeText={setTempDisplayName}
                    placeholder="Enter your name"
                    placeholderTextColor={theme.textTertiary}
                    autoFocus={true}
                    selectTextOnFocus={true}
                    onSubmitEditing={handleNameSave}
                  />
                  <TouchableOpacity onPress={handleNameSave} style={{ marginLeft: 8 }}>
                    <Ionicons name="checkmark" size={20} color={theme.success} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleNameCancel} style={{ marginLeft: 8 }}>
                    <Ionicons name="close" size={20} color={theme.error} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{displayName}</Text>
                  <TouchableOpacity onPress={handleNameEdit} style={{ marginLeft: 8 }}>
                    <Ionicons name="pencil" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {/* --- EDIT PROFILE BUTTON --- */}
                  <TouchableOpacity
                    onPress={() => {
                      if (isNavigating || isExiting || !userProfile || !userProfile.uid) return;
                      setIsNavigating(true);
                      startExitAnimation(() => {
                        router.push(`/profile-edit/${userProfile.uid}`);
                        setTimeout(() => setIsNavigating(false), 500);
                      });
                    }}
                    style={{
                      marginLeft: 12,
                      backgroundColor: theme.primary,
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      shadowColor: theme.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 15 }}>
                      Edit Profile
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 20 }}>
              {userProfile?.email || user?.email}
            </Text>
            {/* User Details Card */}
            <View
              style={{
                backgroundColor: theme.background,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                width: '100%',
                shadowColor: theme.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              {/* Height & Weight */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="resize-outline" size={18} color={theme.primary} />
                  <Text style={{ marginLeft: 6, color: theme.text, fontWeight: 'bold' }}>
                    Height:
                  </Text>
                  <Text style={{ marginLeft: 4, color: theme.textSecondary }}>
                    {userProfile?.height ? `${userProfile.height} cm` : '—'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="barbell-outline" size={18} color={theme.primary} />
                  <Text style={{ marginLeft: 6, color: theme.text, fontWeight: 'bold' }}>
                    Weight:
                  </Text>
                  <Text style={{ marginLeft: 4, color: theme.textSecondary }}>
                    {userProfile?.weight ? `${userProfile.weight} kg` : '—'}
                  </Text>
                </View>
              </View>
              {/* Skin Tone & Body Type */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="color-palette-outline" size={18} color={theme.primary} />
                  <Text style={{ marginLeft: 6, color: theme.text, fontWeight: 'bold' }}>
                    Skin Tone:
                  </Text>
                  <Text style={{ marginLeft: 4, color: theme.textSecondary }}>
                    {userProfile?.skinTone || '—'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="body-outline" size={18} color={theme.primary} />
                  <Text style={{ marginLeft: 6, color: theme.text, fontWeight: 'bold' }}>
                    Body Type:
                  </Text>
                  <Text style={{ marginLeft: 4, color: theme.textSecondary }}>
                    {userProfile?.bodyType || '—'}
                  </Text>
                </View>
              </View>
              {/* City & Gender */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location-outline" size={18} color={theme.primary} />
                  <Text style={{ marginLeft: 6, color: theme.text, fontWeight: 'bold' }}>
                    City:
                  </Text>
                  <Text style={{ marginLeft: 4, color: theme.textSecondary }}>
                    {userProfile?.city || '—'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="shirt-outline" size={18} color={theme.primary} />
                  <Text style={{ marginLeft: 6, color: theme.text, fontWeight: 'bold' }}>
                    Gender:
                  </Text>
                  <Text style={{ marginLeft: 4, color: theme.textSecondary }}>
                    {userProfile?.gender || '—'}
                  </Text>
                </View>
              </View>
            </View>
            {/* Stats */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, justifyContent: 'center' }}>
              <View style={{ alignItems: 'center', paddingHorizontal: 30 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.primary }}>{totalOutfits}</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>AI Requests</Text>
              </View>
              <View style={{ width: 1, height: 30, backgroundColor: theme.borderLight, opacity: 0.3 }} />
              <View style={{ alignItems: 'center', paddingHorizontal: 30 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.primary }}>{sharedCount}</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>Shared</Text>
              </View>
            </View>
          </View>
        </Animated.View>
        {/* AI Fashion Section */}
        <Animated.View style={[
          {
            backgroundColor: theme.card,
            marginHorizontal: 20,
            marginTop: 24,
            borderRadius: 16,
            padding: 20,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          },
          contentAnimatedStyle
        ]}>
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Ionicons name="sparkles" size={64} color={theme.primary} />
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text, marginTop: 16, marginBottom: 8 }}>
              AI Fashion Assistant
            </Text>
            <Text style={{ fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 24 }}>
              Get personalized outfit recommendations powered by AI. Upload venue photos or describe your occasion to receive tailored style advice.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: theme.primary,
                paddingHorizontal: 32,
                paddingVertical: 16,
                borderRadius: 25,
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              onPress={() => {
                if (isNavigating || isExiting) return;
                setIsNavigating(true);
                startExitAnimation(() => {
                  router.push('/fashion');
                  setTimeout(() => setIsNavigating(false), 500);
                });
              }}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Explore AI Fashion</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* AI Developer Settings Card */}
        <Animated.View style={[
          {
            backgroundColor: theme.card,
            marginHorizontal: 20,
            marginTop: 20,
            borderRadius: 16,
            padding: 20,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          },
          contentAnimatedStyle
        ]}>
          {/* Header Row */}
          <TouchableOpacity
            onPress={() => setApiKeyExpanded(!apiKeyExpanded)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: activeKeySource === 'custom' ? '#10b981' + '20' : theme.primary + '20',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons
                  name={activeKeySource === 'custom' ? 'key' : 'key-outline'}
                  size={22}
                  color={activeKeySource === 'custom' ? '#10b981' : theme.primary}
                />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>AI Developer Settings</Text>
                <Text style={{ fontSize: 12, color: activeKeySource === 'custom' ? '#10b981' : theme.textTertiary, marginTop: 2 }}>
                  {activeKeySource === 'custom' ? '✓ Using your custom key' : 'Using default key (shared limits)'}
                </Text>
              </View>
            </View>
            <Ionicons
              name={apiKeyExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textTertiary}
            />
          </TouchableOpacity>

          {/* Expandable Content */}
          {apiKeyExpanded && (
            <View style={{ marginTop: 16 }}>
              {/* Step-by-step Guide */}
              <View style={{
                backgroundColor: theme.background,
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
              }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 10 }}>
                  🔑 Get Your Free API Key (1 min)
                </Text>
                <View style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20 }}>
                    <Text style={{ fontWeight: '700', color: theme.primary }}>Step 1:</Text> Tap the button below to open Google AI Studio
                  </Text>
                </View>
                <View style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20 }}>
                    <Text style={{ fontWeight: '700', color: theme.primary }}>Step 2:</Text> Sign in with your Google account
                  </Text>
                </View>
                <View style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20 }}>
                    <Text style={{ fontWeight: '700', color: theme.primary }}>Step 3:</Text> Tap "Create API Key" and copy it
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20 }}>
                    <Text style={{ fontWeight: '700', color: theme.primary }}>Step 4:</Text> Paste it below and tap "Verify & Save"
                  </Text>
                </View>
              </View>

              {/* Open AI Studio Button */}
              <TouchableOpacity
                onPress={() => WebBrowser.openBrowserAsync('https://aistudio.google.com/apikey')}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                  Get Free Key from Google AI Studio
                </Text>
              </TouchableOpacity>

              {/* API Key Input */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.background,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: apiKeyStatus === 'success' ? '#10b981' : apiKeyStatus === 'error' ? '#ef4444' : theme.borderLight,
                paddingHorizontal: 12,
                marginBottom: 8,
              }}>
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: theme.text,
                    paddingVertical: 14,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  }}
                  placeholder="Paste your API key here (AIza...)"
                  placeholderTextColor={theme.textTertiary}
                  value={customApiKey}
                  onChangeText={(text) => {
                    setCustomApiKey(text);
                    setApiKeyStatus('idle');
                    setApiKeyError('');
                  }}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} style={{ padding: 8 }}>
                  <Ionicons name={showApiKey ? 'eye-off' : 'eye'} size={20} color={theme.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* Status Messages */}
              {apiKeyStatus === 'success' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                    Key verified and activated!
                  </Text>
                </View>
              )}
              {apiKeyStatus === 'error' && apiKeyError ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginTop: 1 }} />
                  <Text style={{ color: '#ef4444', fontSize: 13, marginLeft: 6, flex: 1 }}>
                    {apiKeyError}
                  </Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={handleVerifyAndSaveKey}
                  disabled={apiKeyStatus === 'testing' || !customApiKey.trim()}
                  style={{
                    flex: 1,
                    backgroundColor: apiKeyStatus === 'testing' ? theme.textTertiary : '#10b981',
                    borderRadius: 12,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: !customApiKey.trim() ? 0.5 : 1,
                  }}
                >
                  {apiKeyStatus === 'testing' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                  )}
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 8 }}>
                    {apiKeyStatus === 'testing' ? 'Verifying...' : 'Verify & Save'}
                  </Text>
                </TouchableOpacity>

                {activeKeySource === 'custom' && (
                  <TouchableOpacity
                    onPress={handleResetApiKey}
                    style={{
                      backgroundColor: theme.background,
                      borderRadius: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#ef4444' + '40',
                    }}
                  >
                    <Ionicons name="refresh" size={16} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13, marginLeft: 6 }}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Info Note */}
              <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 12, lineHeight: 16, textAlign: 'center' }}>
                Your key stays on this device only. It is never uploaded to any server.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Settings Section */}
        <Animated.View style={[
          {
            backgroundColor: theme.card,
            marginHorizontal: 20,
            marginTop: 20,
            borderRadius: 16,
            padding: 20,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          },
          contentAnimatedStyle
        ]}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.borderLight,
            }}
            onPress={handleLogout}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="log-out-outline" size={24} color={theme.error} />
              <Text style={{ marginLeft: 12, fontSize: 16, fontWeight: '500', color: theme.text }}>
                Logout
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

    </Animated.View>
    </PremiumBackground>
  );
}
