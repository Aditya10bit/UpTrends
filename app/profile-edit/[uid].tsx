import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { analyzePersonComprehensively } from '../../services/geminiService';
import { getUserProfile, updateUserProfile } from '../../services/userService';

const skinTones = [
  { label: 'Fair 🏻', value: 'Fair' },
  { label: 'Wheatish 🏽', value: 'Wheatish' },
  { label: 'Dusky 🏾', value: 'Dusky' },
  { label: 'Dark 🏿', value: 'Dark' },
];

// Comprehensive body types that match AI analysis results
const maleBodyTypes = [
  { label: 'Slim 🪶', value: 'Slim' },
  { label: 'Average 👤', value: 'Average' },
  { label: 'Athletic 💪', value: 'Athletic' },
  { label: 'Heavy 🐻', value: 'Heavy' },
  { label: 'Rectangle 📐', value: 'Rectangle' },
  { label: 'Triangle 🔺', value: 'Triangle' },
  { label: 'Inverted Triangle 🔻', value: 'Inverted Triangle' },
  { label: 'Oval 🥚', value: 'Oval' },
];

const femaleBodyTypes = [
  { label: 'Slim 🪶', value: 'Slim' },
  { label: 'Average 👤', value: 'Average' },
  { label: 'Athletic 💪', value: 'Athletic' },
  { label: 'Heavy 🐻', value: 'Heavy' },
  { label: 'Hourglass ⏳', value: 'Hourglass' },
  { label: 'Pear 🍐', value: 'Pear' },
  { label: 'Apple 🍎', value: 'Apple' },
  { label: 'Rectangle 📐', value: 'Rectangle' },
  { label: 'Inverted Triangle 🔻', value: 'Inverted Triangle' },
];

const otherBodyTypes = [
  { label: 'Slim 🪶', value: 'Slim' },
  { label: 'Average 👤', value: 'Average' },
  { label: 'Athletic 💪', value: 'Athletic' },
  { label: 'Heavy 🐻', value: 'Heavy' },
  { label: 'Rectangle 📐', value: 'Rectangle' },
  { label: 'Pear 🍐', value: 'Pear' },
  { label: 'Apple 🍎', value: 'Apple' },
  { label: 'Hourglass ⏳', value: 'Hourglass' },
  { label: 'Triangle 🔺', value: 'Triangle' },
  { label: 'Inverted Triangle 🔻', value: 'Inverted Triangle' },
];

const genderList = [
  { label: 'Male 👨', value: 'Male' },
  { label: 'Female 👩', value: 'Female' },
  { label: 'Other 🏳️‍⚧️', value: 'Other' },
];
const cityList = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Pune", "Jaipur", "Lucknow",
  "Kanpur", "Nagpur", "Indore", "Bhopal", "Patna", "Ludhiana", "Agra", "Nashik", "Vadodara", "Other"
];

export default function ProfileEditScreen() {
  const params = useLocalSearchParams();
  let uid = params.uid;
  if (Array.isArray(uid)) uid = uid[0];
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [skinTone, setSkinTone] = useState<string>('');
  const [bodyType, setBodyType] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [customCity, setCustomCity] = useState<string>('');
  const [detecting, setDetecting] = useState(false);
  const [gender, setGender] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState<boolean>(false);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);

  // Function to get appropriate body types based on gender
  const getBodyTypesForGender = (selectedGender: string) => {
    switch (selectedGender.toLowerCase()) {
      case 'male':
        return maleBodyTypes;
      case 'female':
        return femaleBodyTypes;
      default:
        return otherBodyTypes;
    }
  };

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const titleSlideAnim = useRef(new Animated.Value(-30)).current;
  const sectionsSlideAnim = useRef(new Animated.Value(40)).current;
  const buttonSlideAnim = useRef(new Animated.Value(60)).current;
  const aiSectionScaleAnim = useRef(new Animated.Value(0.9)).current;
  const aiSectionRotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (uid) {
      getUserProfile(uid).then(profile => {
        setUserProfile(profile);
        setHeight(profile?.height ? String(profile.height) : '');
        setWeight(profile?.weight ? String(profile.weight) : '');
        setSkinTone(profile?.skinTone || '');
        setBodyType(profile?.bodyType || '');
        setCity(profile?.city || '');
        setGender(profile?.gender || '');
        setLoading(false);
      });
    }
  }, [uid]);

  // Handle gender change - reset body type if it's not valid for the new gender
  useEffect(() => {
    if (gender && bodyType) {
      const validBodyTypes = getBodyTypesForGender(gender);
      const isValidBodyType = validBodyTypes.some(bt => bt.value === bodyType);
      
      if (!isValidBodyType) {
        // Reset body type if current selection is not valid for the new gender
        setBodyType('');
      }
    }
  }, [gender, bodyType]);

  // Use useFocusEffect to handle screen focus properly
  useFocusEffect(
    useCallback(() => {
      // Reset animation values when screen comes into focus
      resetAnimationValues();
      startEntranceAnimations();

      return () => {
        // Cleanup when screen loses focus
        setIsNavigating(false);
        setAnalyzingPhoto(false);
      };
    }, [])
  );

  const resetAnimationValues = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    scaleAnim.setValue(0.8);
    titleSlideAnim.setValue(-30);
    sectionsSlideAnim.setValue(40);
    buttonSlideAnim.setValue(60);
    aiSectionScaleAnim.setValue(0.9);
    aiSectionRotateAnim.setValue(0);
  };

  const startEntranceAnimations = () => {
    // Staggered entrance animations for smooth visual flow
    Animated.sequence([
      // First: Fade in the main container
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Then: Animate title and sections in sequence
      Animated.parallel([
        // Title slides down
        Animated.spring(titleSlideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        // Main content slides up
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        // Scale animation for overall content
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // After main animations, animate sections with delay
      Animated.stagger(100, [
        Animated.spring(sectionsSlideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(aiSectionScaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(buttonSlideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const animateAISection = () => {
    // Special animation for AI section when photo is uploaded
    Animated.parallel([
      Animated.spring(aiSectionScaleAnim, {
        toValue: 1.05,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(aiSectionRotateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.spring(aiSectionScaleAnim, {
          toValue: 1,
          tension: 150,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(aiSectionRotateAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const analyzeBodyType = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photos to analyze your body type. Please grant permission in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [3, 4], // Portrait aspect ratio for body photos
        quality: 0.8,
      });

      if (!result.canceled) {
        setUploadedPhoto(result.assets[0].uri);
        setAnalyzingPhoto(true);

        // Animate AI section when photo is uploaded
        animateAISection();

        try {
          const analysisText = await analyzePersonComprehensively(result.assets[0].uri, 'User');

          // Parse the analysis response
          const bodyTypeMatch = analysisText.match(/Body Type:\s*([^\n]+)/i);
          const skinToneMatch = analysisText.match(/Skin Tone:\s*([^\n]+)/i);
          const confidenceMatch = analysisText.match(/Confidence:\s*(\d+)/i);

          const detectedBodyType = bodyTypeMatch ? bodyTypeMatch[1].trim() : '';
          const detectedSkinTone = skinToneMatch ? skinToneMatch[1].trim() : '';
          const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 85;

          // Auto-fill the detected values (excluding gender)
          if (detectedSkinTone) setSkinTone(detectedSkinTone);
          
          // Validate and set body type based on current gender selection
          if (detectedBodyType && gender) {
            const validBodyTypes = getBodyTypesForGender(gender);
            const isValidBodyType = validBodyTypes.some(bt => bt.value === detectedBodyType);
            
            if (isValidBodyType) {
              setBodyType(detectedBodyType);
            } else {
              // If detected body type is not valid for current gender, suggest it but don't auto-set
              console.log(`Detected body type "${detectedBodyType}" is not valid for gender "${gender}"`);
            }
          } else if (detectedBodyType && !gender) {
            // If no gender is selected, set the body type anyway
            setBodyType(detectedBodyType);
          }

          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Animate success
          Animated.sequence([
            Animated.spring(aiSectionScaleAnim, {
              toValue: 1.1,
              tension: 150,
              friction: 6,
              useNativeDriver: true,
            }),
            Animated.spring(aiSectionScaleAnim, {
              toValue: 1,
              tension: 150,
              friction: 8,
              useNativeDriver: true,
            }),
          ]).start();

          const bodyTypeMessage = gender ? 
            (getBodyTypesForGender(gender).some(bt => bt.value === detectedBodyType) ? 
              `• Body Type: ${detectedBodyType} ✓` : 
              `• Body Type: ${detectedBodyType} (not applied - please select manually for ${gender})`) :
            `• Body Type: ${detectedBodyType} (please select gender first)`;

          Alert.alert(
            '🎉 Analysis Complete!',
            `Detected:\n${bodyTypeMessage}\n• Skin Tone: ${detectedSkinTone} ✓\n• Confidence: ${confidence}%\n\n${!gender ? 'Please select your gender first, then ' : ''}You can adjust any detected values if needed.`,
            [{ text: 'Got it!' }]
          );
        } catch (error) {
          console.error('Body analysis error:', error);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Analysis Failed',
            'Unable to analyze the photo. Please select your body type and skin tone manually, or try with a clearer full-body photo.',
            [{ text: 'OK' }]
          );
        } finally {
          setAnalyzingPhoto(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Unable to access photos. Please check permissions.');
      setAnalyzingPhoto(false);
    }
  };

  const detectCity = async () => {
    try {
      setDetecting(true);

      // First check if location services are available
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        Alert.alert('Location Services Disabled', 'Please enable location services in your device settings.');
        setDetecting(false);
        return;
      }

      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to detect your city. You can still select your city manually.');
        setDetecting(false);
        return;
      }

      // Get current location with improved accuracy
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      // Reverse geocode to get city name
      let geocode = await Location.reverseGeocodeAsync(location.coords);
      if (geocode && geocode.length > 0) {
        const address = geocode[0];
        // Try multiple fields to find the city
        const detectedCity = address.city || address.district || address.region || '';

        if (detectedCity) {
          // Check if detected city is in our predefined list
          const cityExists = cityList.some(c => c.toLowerCase() === detectedCity.toLowerCase());
          if (cityExists) {
            setCity(detectedCity);
            Alert.alert('City Detected!', `Your city is ${detectedCity}`);
          } else {
            // If not in list, set to 'Other' and let user input manually
            setCity('Other');
            setCustomCity(detectedCity);
            Alert.alert('Location Detected', `We detected ${detectedCity}, but it's not in our list. Please enter your city manually.`);
          }
        } else {
          Alert.alert('Location Found', 'We found your location but couldn\'t determine the city. Please select your city manually.');
        }
      } else {
        Alert.alert('Location Error', 'Could not determine your city from your location. Please select manually.');
      }
    } catch (error: any) {
      console.error('Location detection error:', error);
      let errorMessage = 'Could not detect your city.';

      if (error.code === 'E_LOCATION_TIMEOUT') {
        errorMessage = 'Location request timed out. Please try again or select your city manually.';
      } else if (error.code === 'E_LOCATION_UNAVAILABLE') {
        errorMessage = 'Location services are not available. Please select your city manually.';
      } else if (error.code === 'E_LOCATION_SETTINGS_UNSATISFIED') {
        errorMessage = 'Location settings need to be adjusted. Please enable high accuracy mode.';
      }

      Alert.alert('Location Detection Failed', errorMessage);
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    if (saving || isNavigating) return; // Prevent double-tap

    if (!height || !weight || !skinTone || !bodyType || !city || !gender) {
      Alert.alert('Please fill all details!');
      return;
    }
    setSaving(true);
    try {
      // Use customCity if city is "Other"
      const finalCity = city === 'Other' ? customCity : city;

      if (city === 'Other' && !customCity.trim()) {
        Alert.alert('Please enter your city name');
        setSaving(false);
        return;
      }

      const updateData = {
        height: Number(height),
        weight: Number(weight),
        skinTone,
        bodyType,
        city: finalCity,
        gender,
      };
      if (!uid) throw new Error('User ID not found!');
      const success = await updateUserProfile(uid, updateData);
      setSaving(false);
      if (success) {
        Alert.alert('Profile updated!', 'Your details have been saved.', [
          {
            text: 'OK', onPress: () => {
              if (!isNavigating) {
                setIsNavigating(true);
                router.back();
              }
            }
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to update profile.');
      }
    } catch (error: any) {
      setSaving(false);
      Alert.alert('Error', error.message || 'Failed to update profile.');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingTop: insets.top + 20,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: titleSlideAnim }, { scale: scaleAnim }]
          }}
        >
          <Text style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: theme.primary,
            marginBottom: 16,
            textAlign: 'center',
          }}>
            ✨ Edit Your Style Profile ✨
          </Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: sectionsSlideAnim }, { scale: scaleAnim }]
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                {/* Height */}
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>Height (cm) 📏</Text>
                  <TextInput
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numeric"
                    placeholder="e.g. 170"
                    placeholderTextColor={theme.textTertiary}
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 16,
                      color: theme.text,
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                    }}
                  />
                </View>

                {/* Weight */}
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>Weight (kg) ⚖️</Text>
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="e.g. 65"
                    placeholderTextColor={theme.textTertiary}
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 16,
                      color: theme.text,
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                    }}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Animated.View>

        {/* AI Body Analysis */}
        <Animated.View
          style={{
            marginBottom: 24,
            opacity: fadeAnim,
            transform: [
              { translateY: sectionsSlideAnim },
              { scale: aiSectionScaleAnim },
              {
                rotate: aiSectionRotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '2deg']
                })
              }
            ]
          }}
        >
          <View style={{
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderRadius: 15,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(102, 126, 234, 0.2)',
            shadowColor: '#667eea',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 6,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>🤖</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text, flex: 1 }}>
                AI Profile Analysis
              </Text>
            </View>

            <Text style={{
              fontSize: 14,
              color: theme.textSecondary,
              marginBottom: 16,
              lineHeight: 20
            }}>
              Upload a clear full-body photo and let AI detect your body type and skin tone automatically!
              {!gender && (
                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>
                  {'\n\n💡 Tip: Select your gender first for more accurate body type detection!'}
                </Text>
              )}
            </Text>

            {uploadedPhoto && (
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Image
                  source={{ uri: uploadedPhoto }}
                  style={{
                    width: 120,
                    height: 160,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: theme.borderLight
                  }}
                />
                <Text style={{
                  fontSize: 12,
                  color: theme.textTertiary,
                  marginTop: 8,
                  textAlign: 'center'
                }}>
                  Photo uploaded ✓
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={analyzeBodyType}
              disabled={analyzingPhoto}
              style={{
                backgroundColor: analyzingPhoto ? theme.textTertiary : theme.primary,
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Ionicons
                name={analyzingPhoto ? "hourglass" : "camera"}
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 'bold'
              }}>
                {analyzingPhoto ? 'Analyzing Photo...' : 'Upload & Analyze Photo'}
              </Text>
            </TouchableOpacity>

            <Text style={{
              fontSize: 12,
              color: theme.textTertiary,
              textAlign: 'center',
              marginTop: 12,
              fontStyle: 'italic'
            }}>
              💡 For best results, use a clear full-body photo with good lighting
            </Text>
          </View>
        </Animated.View>

        {/* Skin Tone */}
        <Animated.View
          style={{
            marginBottom: 18,
            opacity: fadeAnim,
            transform: [{ translateY: sectionsSlideAnim }]
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 16, color: theme.text }}>Skin Tone 🧑🏻‍🦱</Text>
            {uploadedPhoto && skinTone && (
              <View style={{
                marginLeft: 8,
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8
              }}>
                <Text style={{ fontSize: 10, color: '#2ecc71', fontWeight: 'bold' }}>
                  🤖 AI Detected
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {skinTones.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={{
                  backgroundColor: skinTone === item.value ? theme.primary : theme.card,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  marginRight: 10,
                  marginBottom: 10,
                  borderWidth: skinTone === item.value ? 2 : 1,
                  borderColor: skinTone === item.value ? theme.primary : theme.borderLight,
                }}
                onPress={() => setSkinTone(item.value)}
              >
                <Text style={{
                  color: skinTone === item.value ? '#fff' : theme.text,
                  fontWeight: 'bold',
                  fontSize: 15,
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Body Type */}
        <Animated.View
          style={{
            marginBottom: 18,
            opacity: fadeAnim,
            transform: [{ translateY: sectionsSlideAnim }]
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 16, color: theme.text }}>Body Type 🏋️‍♂️</Text>
            {uploadedPhoto && bodyType && (
              <View style={{
                marginLeft: 8,
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8
              }}>
                <Text style={{ fontSize: 10, color: '#2ecc71', fontWeight: 'bold' }}>
                  🤖 AI Detected
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {getBodyTypesForGender(gender).map((item) => (
              <TouchableOpacity
                key={item.value}
                style={{
                  backgroundColor: bodyType === item.value ? theme.primary : theme.card,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  marginRight: 10,
                  marginBottom: 10,
                  borderWidth: bodyType === item.value ? 2 : 1,
                  borderColor: bodyType === item.value ? theme.primary : theme.borderLight,
                }}
                onPress={() => setBodyType(item.value)}
              >
                <Text style={{
                  color: bodyType === item.value ? '#fff' : theme.text,
                  fontWeight: 'bold',
                  fontSize: 15,
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* City Dropdown + Location */}
        <Animated.View
          style={{
            marginBottom: 18,
            opacity: fadeAnim,
            transform: [{ translateY: sectionsSlideAnim }]
          }}
        >
          <Text style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>City 🏙️</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <RNPickerSelect
                onValueChange={value => setCity(value)}
                value={city}
                items={cityList.map(c => ({ label: c, value: c }))}
                placeholder={{ label: "Select your city", value: "" }}
                style={{
                  inputIOS: {
                    backgroundColor: theme.card,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 16,
                    color: theme.text,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                  },
                  inputAndroid: {
                    backgroundColor: theme.card,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 16,
                    color: theme.text,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                  },
                  placeholder: {
                    color: theme.textTertiary,
                  }
                }}
                useNativeAndroidPickerStyle={false}
                Icon={() => <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />}
              />
            </View>
            <TouchableOpacity
              onPress={detectCity}
              style={{
                marginLeft: 10,
                backgroundColor: theme.primary,
                borderRadius: 10,
                padding: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 4,
              }}
              disabled={detecting}
            >
              <Ionicons name="locate" size={18} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 6, fontWeight: 'bold' }}>
                {detecting ? 'Detecting...' : 'Detect'}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Manual input if city is not in list */}
          {city === 'Other' && (
            <TextInput
              value={customCity}
              onChangeText={setCustomCity}
              placeholder="Enter your city"
              placeholderTextColor={theme.textTertiary}
              style={{
                backgroundColor: theme.card,
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
                color: theme.text,
                borderWidth: 1,
                borderColor: theme.borderLight,
                marginTop: 8,
              }}
            />
          )}
        </Animated.View>

        {/* Gender */}
        <Animated.View
          style={{
            marginBottom: 30,
            opacity: fadeAnim,
            transform: [{ translateY: sectionsSlideAnim }]
          }}
        >
          <Text style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>Gender 👤</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {genderList.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={{
                  backgroundColor: gender === item.value ? theme.primary : theme.card,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  marginRight: 10,
                  marginBottom: 10,
                  borderWidth: gender === item.value ? 2 : 1,
                  borderColor: gender === item.value ? theme.primary : theme.borderLight,
                }}
                onPress={() => setGender(item.value)}
              >
                <Text style={{
                  color: gender === item.value ? '#fff' : theme.text,
                  fontWeight: 'bold',
                  fontSize: 15,
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Save Button - Fixed at bottom */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + 16,
          paddingHorizontal: 24,
          backgroundColor: 'transparent',
          opacity: fadeAnim,
          transform: [{ translateY: buttonSlideAnim }]
        }}
      >
        <TouchableOpacity
          style={{
            backgroundColor: theme.primary,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="#fff" style={{ marginRight: 8 }} />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
