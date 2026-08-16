import { Stack } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import AnimatedSplash from '../components/AnimatedSplash';
import DefaultKeyPrompt from '../components/DefaultKeyPrompt';

// Minimal error boundary for startup crashes
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

// Keep the native splash visible until our custom splash is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

interface ErrorBoundaryState {
  hasError: boolean;
}

class StartupErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Startup Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#667eea' }}>
          <Text style={{ color: 'white', fontSize: 18, textAlign: 'center', padding: 20 }}>
            UpTrends is starting up...{'\n'}Please restart the app if this persists.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Import polyfills safely for both dev and production
try {
  require("../polyfills");
} catch (error) {
  console.warn('Polyfills not loaded:', error);
}

// Inner layout that has access to useTheme (must be inside ThemeProvider).
function RootLayoutContent() {
  const { theme } = useTheme();
  const isDark = theme.background === '#0e0e0e';
  const [showSplash, setShowSplash] = useState(true);

  // Load Playfair Display (display) + Inter (body) before showing the app.
  // Keep the native splash up until the fonts are ready so text doesn't flash
  // in with the wrong typeface.
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Hide the native splash as soon as fonts are loaded AND the custom splash
  // has mounted. If hideAsync() is deferred until the animation ends, the
  // native splash (plain logo) stays on top and covers the custom animation.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Keep the native splash up until the fonts are ready. Placed AFTER every
  // hook so the rules-of-hooks stay satisfied while fonts load.
  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Animated splash overlay — renders on top of everything until animation completes */}
      {showSplash && (
        <AnimatedSplash isDark={isDark} onFinish={handleSplashFinish} />
      )}

      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'UpTrends',
          }}
        />
        <Stack.Screen
          name="auth"
          options={{
            title: 'Authentication',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="fashion"
          options={{
            title: 'Fashion Categories',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            title: 'Profile',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="category/[slug]"
          options={{
            title: 'Category',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="profile-edit/[uid]"
          options={{
            title: 'Edit Profile',
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="upload-aesthetic"
          options={{
            title: 'Upload Aesthetic',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="make-outfit"
          options={{
            title: 'Make Outfit',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="twinning/friends"
          options={{
            title: 'Twin with Friends',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="twinning/date"
          options={{
            title: 'Twin for Date',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="style-check"
          options={{
            title: 'Style Check',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="body-analysis"
          options={{
            title: 'Body Analysis',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="todays-outfit"
          options={{
            title: 'Today\'s Outfit',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="outfit-detail"
          options={{
            title: 'Outfit Details',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="outfit-links"
          options={{
            title: 'Outfit Links',
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="wardrobe"
          options={{
            title: 'My Closet',
            presentation: 'card'
          }}
        />

      </Stack>

      {/* Auto-dismissing "add your own AI key" nudge — only when on the default key */}
      {!showSplash && <DefaultKeyPrompt />}
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <StartupErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootLayoutContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </StartupErrorBoundary>
  );
}