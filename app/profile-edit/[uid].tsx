import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { getUserProfile, updateUserProfile } from '../../services/userService';

const skinTones = [
  { label: 'Fair 🏻', value: 'Fair' },
  { label: 'Wheatish 🏽', value: 'Wheatish' },
  { label: 'Dusky 🏾', value: 'Dusky' },
  { label: 'Dark 🏿', value: 'Dark' },
];

const bodyTypes = [
  { label: 'Slim 🪶', value: 'Slim' },
  { label: 'Average 👤', value: 'Average' },
  { label: 'Athletic 💪', value: 'Athletic' },
  { label: 'Heavy 🐻', value: 'Heavy' },
];

const stylesList = [
  { label: 'Casual 👕', value: 'Casual' },
  { label: 'Formal 👔', value: 'Formal' },
  { label: 'Street 🧢', value: 'Street' },
  { label: 'Ethnic 🥻', value: 'Ethnic' },
  { label: 'Trendy 😎', value: 'Trendy' },
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
  const [preferredStyle, setPreferredStyle] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (uid) {
      getUserProfile(uid).then(profile => {
        setUserProfile(profile);
        setHeight(profile?.height ? String(profile.height) : '');
        setWeight(profile?.weight ? String(profile.weight) : '');
        setSkinTone(profile?.skinTone || '');
        setBodyType(profile?.bodyType || '');
        setCity(profile?.city || '');
        setPreferredStyle(profile?.preferredStyle || '');
        setLoading(false);
        
        // Trigger entrance animations
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [uid]);

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
    if (!height || !weight || !skinTone || !bodyType || !city || !preferredStyle) {
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
        preferredStyle,
      };
      if (!uid) throw new Error('User ID not found!');
      const success = await updateUserProfile(uid, updateData);
      setSaving(false);
      if (success) {
        Alert.alert('Profile updated!', 'Your details have been saved.', [
          { text: 'OK', onPress: () => router.back() },
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: 40,
          backgroundColor: theme.background,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
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

        {/* Height */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>Height (cm) 📏</Text>
          <TextInput
            value={height}
            onChangeText={setHeight}
            keyboardType="numeric"
            placeholder="e.g. 170"
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

        {/* Skin Tone */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>Skin Tone 🧑🏻‍🦱</Text>
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
        </View>

        {/* Body Type */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>Body Type 🏋️‍♂️</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {bodyTypes.map((item) => (
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
        </View>

        {/* City Dropdown + Location */}
        <View style={{ marginBottom: 18 }}>
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
        </View>

        {/* Preferred Style */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>Preferred Style 👗</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {stylesList.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={{
                  backgroundColor: preferredStyle === item.value ? theme.primary : theme.card,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  marginRight: 10,
                  marginBottom: 10,
                  borderWidth: preferredStyle === item.value ? 2 : 1,
                  borderColor: preferredStyle === item.value ? theme.primary : theme.borderLight,
                }}
                onPress={() => setPreferredStyle(item.value)}
              >
                <Text style={{
                  color: preferredStyle === item.value ? '#fff' : theme.text,
                  fontWeight: 'bold',
                  fontSize: 15,
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Save Button - Fixed at bottom */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + 16,
          paddingHorizontal: 24,
          backgroundColor: 'transparent',
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
      </View>
    </KeyboardAvoidingView>
  );
}
