// app/auth.tsx
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { auth } from '../firebaseConfig';
import { checkUserProfile, createUserProfile } from '../services/userService';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
};

export default function AuthScreen() {
     const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();


  // Google Auth Setup
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: '734945715091-3lnodgg97tat9fkqs7r3kp8p78o7avbb.apps.googleusercontent.com',
      scopes: ['openid', 'profile', 'email'],
      redirectUri: makeRedirectUri({
        scheme: 'uptrends',
      }),
    },
    discovery
  );

  // Handle Google auth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleGoogleSignIn(authentication.accessToken);
      }
    }
  }, [response]);

  const handleEmailAuth = async () => {
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
    if (!email) {
      Alert.alert('Error', 'Pehle email enter kar bhai!');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Success', 'Password reset email bhej diya! Check kar inbox mein! 📧');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      await promptAsync();
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('Error', 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (accessToken: string) => {
    try {
      const userInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      const userInfo = await userInfoResponse.json();
      
      const credential = GoogleAuthProvider.credential(null, accessToken);
      
      await signInWithCredential(auth, credential);
      
      const profileExists = await checkUserProfile();
      if (!profileExists) {
        await createUserProfile({
          username: userInfo.name || userInfo.email?.split('@')[0]
        });
      }
      
      Alert.alert('Success', `Welcome ${userInfo.name}!`);
      router.replace('/');
    } catch (error: any) {
      console.error('Firebase Google sign-in error:', error);
      Alert.alert('Error', 'Failed to complete Google sign-in');
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
        <TouchableOpacity
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            paddingVertical: 16,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: loading ? 0.5 : 1,
          }}
          onPress={handleGoogleAuth}
          disabled={loading}
        >
          <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 18 }}>
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
