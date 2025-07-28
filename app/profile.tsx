import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
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
import { storage } from '../firebaseConfig';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { getUserFavorites, getUserProfile, removeFavoriteOutfit, updateUserProfile } from '../services/userService';

const { width } = Dimensions.get('window');

interface FavoriteItem {
  name: string;
  category: string;
  categorySlug: string;
  items: string;
  price: string;
  gender: string;
  savedAt: any;
  id?: string;
}

interface UserProfile {
  displayName?: string;
  photoURL?: string;
  email?: string;
  totalOutfits?: number;
  sharedCount?: number;
  uid?: string;
  username?: string;
  gender?: string;
  favorites?: any[];
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
  preferredStyle?: string;
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
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [uploading, setUploading] = useState(false);
  const { user, logout } = useAuth();

  // Animation values
  const scale = useSharedValue(1);
  const profileCardOpacity = useSharedValue(0);
  const profileCardTranslateY = useSharedValue(50);
  const tabsOpacity = useSharedValue(0);
  const tabsTranslateY = useSharedValue(30);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(40);
  const backButtonOpacity = useSharedValue(0);
  const settingsButtonOpacity = useSharedValue(0);

  useEffect(() => {
    loadUserData();
    // Start entrance animations
    startEntranceAnimations();
  }, []);

  const startEntranceAnimations = () => {
    // Animate back button first
    backButtonOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    
    // Animate settings button
    settingsButtonOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    
    // Animate profile card
    profileCardOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    profileCardTranslateY.value = withDelay(300, withSpring(0, { damping: 20, stiffness: 200 }));
    
    // Animate tabs
    tabsOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    tabsTranslateY.value = withDelay(600, withSpring(0, { damping: 15, stiffness: 180 }));
    
    // Animate content
    contentOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    contentTranslateY.value = withDelay(800, withSpring(0, { damping: 15, stiffness: 180 }));
  };

  const loadUserData = async () => {
    try {
      if (user?.uid) {
        const userFavorites = await getUserFavorites(user.uid);
        setFavorites(userFavorites || []);

        const profile = await getUserProfile();
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
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setFavorites([]);
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

  const tabsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: tabsOpacity.value,
      transform: [{ translateY: tabsTranslateY.value }],
    };
  });

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
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const imageRef = ref(storage, `profile-images/${user?.uid}`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);
      await updateUserProfile(user?.uid!, { photoURL: downloadURL });
      await loadUserData();
      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Info', 'Photo upload will work in APK build');
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

  const removeFavorite = async (index: number) => {
    const item = favorites[index];
    Alert.alert(
      'Remove Favorite',
      'Are you sure you want to remove this outfit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.id && user?.uid) {
                const success = await removeFavoriteOutfit(user.uid, item.id);
                if (success) {
                  const newFavorites = favorites.filter((_, i) => i !== index);
                  setFavorites(newFavorites);
                } else {
                  Alert.alert('Error', 'Failed to remove from database');
                }
              } else {
                const newFavorites = favorites.filter((_, i) => i !== index);
                setFavorites(newFavorites);
              }
            } catch (error) {
              console.error('Error removing favorite:', error);
              Alert.alert('Error', 'Failed to remove favorite');
            }
          }
        },
      ]
    );
  };

  const displayName = userProfile?.displayName || user?.displayName || 'Fashion Enthusiast';
  const profileImageUrl = userProfile?.photoURL || user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=120`;

  const savedCount = favorites.length;
  const totalOutfits = userProfile?.viewHistory?.length || savedCount;
  const sharedCount = userProfile?.sharedOutfits?.length || 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
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
        <TouchableOpacity onPress={() => router.back()} style={{
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
                       if (!userProfile || !userProfile.uid) return;
                      router.push(`/profile-edit/${userProfile.uid}`);
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
              {/* City & Preferred Style */}
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
                    Style:
                  </Text>
                  <Text style={{ marginLeft: 4, color: theme.textSecondary }}>
                    {userProfile?.preferredStyle || '—'}
                  </Text>
                </View>
              </View>
            </View>
            {/* Stats */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.primary }}>{savedCount}</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>Saved</Text>
              </View>
              <View style={{ width: 1, height: 30, backgroundColor: theme.borderLight, opacity: 0.3 }} />
              <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.primary }}>{totalOutfits}</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>Viewed</Text>
              </View>
              <View style={{ width: 1, height: 30, backgroundColor: theme.borderLight, opacity: 0.3 }} />
              <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.primary }}>{sharedCount}</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>Shared</Text>
              </View>
            </View>
          </View>
        </Animated.View>
        {/* Tabs */}
        <Animated.View style={[
          {
            flexDirection: 'row',
            backgroundColor: theme.card,
            marginHorizontal: 20,
            marginTop: 24,
            borderRadius: 12,
            padding: 4,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          },
          tabsAnimatedStyle
        ]}>
          <TouchableOpacity
            style={[
              { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
              activeTab === 'favorites' && { backgroundColor: theme.background }
            ]}
            onPress={() => setActiveTab('favorites')}
          >
            <Ionicons
              name="heart"
              size={20}
              color={activeTab === 'favorites' ? theme.primary : theme.textTertiary}
            />
            <Text style={[
              { marginLeft: 8, fontSize: 16, fontWeight: '500' },
              activeTab === 'favorites' && { color: theme.primary }
            ]}>
              Favorites
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
              activeTab === 'history' && { backgroundColor: theme.background }
            ]}
            onPress={() => setActiveTab('history')}
          >
            <Ionicons
              name="time"
              size={20}
              color={activeTab === 'history' ? theme.primary : theme.textTertiary}
            />
            <Text style={[
              { marginLeft: 8, fontSize: 16, fontWeight: '500' },
              activeTab === 'history' && { color: theme.primary }
            ]}>
              History
            </Text>
          </TouchableOpacity>
        </Animated.View>
        {/* Content */}
        {activeTab === 'favorites' && (
          <Animated.View style={[
            { paddingHorizontal: 20, marginTop: 20 },
            contentAnimatedStyle
          ]}>
            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Text style={{ fontSize: 16, color: theme.textSecondary }}>Loading your style...</Text>
              </View>
            ) : favorites.length > 0 ? (
              favorites.map((item: any, index: number) => (
                <View
                  key={`${item.categorySlug}-${index}`}
                  style={{
                    marginBottom: 16,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: theme.card,
                    borderColor: theme.borderLight,
                    borderWidth: 1,
                    shadowColor: theme.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <LinearGradient
                    colors={[theme.card, theme.background]}
                    style={{ padding: 16 }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                          {item.category || 'Fashion'}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFavorite(index)}>
                        <Ionicons name="heart" size={20} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 4 }}>
                      {item.name || 'Stylish Outfit'}
                    </Text>
                    <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 16 }}>
                      {item.items || 'Fashion Items'}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.success }}>
                        {item.price || '₹500-1000'}
                      </Text>
                      <TouchableOpacity style={{ backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Try Again</Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              ))
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 }}>
                <Ionicons name="heart-outline" size={64} color={theme.textTertiary} />
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text, marginTop: 16, marginBottom: 8 }}>No Saved Outfits</Text>
                <Text style={{ fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 24 }}>
                  Start exploring and save your favorite looks!
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                  onPress={() => router.push('/fashion')}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Explore Fashion</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}
        {activeTab === 'history' && (
          <Animated.View style={[
            { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, marginTop: 20 },
            contentAnimatedStyle
          ]}>
            <Ionicons name="time-outline" size={64} color={theme.textTertiary} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text, marginTop: 16, marginBottom: 8 }}>Coming Soon</Text>
            <Text style={{ fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 24 }}>
              Your fashion history will appear here
            </Text>
          </Animated.View>
        )}
      </ScrollView>
      {/* Settings Icon */}
      <Animated.View style={[
        {
          position: 'absolute',
          top: insets.top + 16,
          right: 16,
          zIndex: 100,
        },
        settingsButtonAnimatedStyle
      ]}>
        <TouchableOpacity
          style={{
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 8,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
          onPress={handleLogout}
        >
          <Ionicons name="settings-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
