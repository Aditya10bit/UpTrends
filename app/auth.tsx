// app/auth.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { auth, isFirebaseInitialized } from '../firebaseConfig';
import { signInWithGoogle } from '../services/googleSignInService';
import { checkUserProfile, createUserProfile } from '../services/userService';

export default function AuthScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleEmailAuth = async () => {
    if (!isFirebaseInitialized || !auth) {
      Alert.alert('Configuration Error', 'App is not connected to Firebase. Please check your configuration.');
      return;
    }

    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);

        const profileExists = await checkUserProfile();
        if (!profileExists) {
          await createUserProfile();
        }
      } else {
        await createUserWithEmailAndPassword(auth, email, password);

        await createUserProfile({
          username: email.split('@')[0]
        });
      }

      router.replace('/');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isFirebaseInitialized || !auth) {
      Alert.alert('Configuration Error', 'App is not connected to Firebase.');
      return;
    }

    if (!email) {
      Alert.alert('Error', 'Please enter your email first!');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Success', 'Password reset email sent! Check your inbox! 📧');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.status === 'success') {
        router.replace('/');
      } else if (result.status === 'cancelled') {
        // User backed out of the Google account picker — do nothing.
      } else {
        Alert.alert('Google Sign-In Failed', result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 24, justifyContent: 'center' }}>
      <View style={{ marginBottom: 32 }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: theme.text, marginBottom: 8 }}>
          Welcome to UpTrends
        </Text>
        <Text style={{ textAlign: 'center', color: theme.textSecondary }}>
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </Text>
      </View>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ color: theme.textSecondary, marginBottom: 8, fontWeight: '500' }}>Email</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: theme.text,
              backgroundColor: theme.card,
            }}
            placeholder="Enter your email"
            placeholderTextColor={theme.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View>
          <Text style={{ color: theme.textSecondary, marginBottom: 8, fontWeight: '500' }}>Password</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: theme.text,
              backgroundColor: theme.card,
            }}
            placeholder="Enter your password"
            placeholderTextColor={theme.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {isLogin && (
            <TouchableOpacity style={{ paddingVertical: 8 }} onPress={handleForgotPassword}>
              <Text style={{ color: theme.primary, textAlign: 'right', fontWeight: '500' }}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: theme.primary,
            borderRadius: 8,
            paddingVertical: 16,
            opacity: loading ? 0.5 : 1,
            marginTop: 8,
          }}
          onPress={handleEmailAuth}
          disabled={loading}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        {/* OR divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          <Text style={{ color: theme.textTertiary, fontSize: 13, letterSpacing: 1 }}>OR</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
        </View>

        {/* Google sign-in (native SDK → Firebase credential swap) */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.borderLight,
            borderRadius: 8,
            paddingVertical: 14,
            opacity: loading ? 0.5 : 1,
          }}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Ionicons name="logo-google" size={20} color={theme.text} />
          <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ paddingVertical: 16 }} onPress={() => setIsLogin(!isLogin)}>
          <Text style={{ textAlign: 'center', color: theme.primary, fontWeight: '500' }}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
