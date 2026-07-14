import { Stack } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';

// Minimal error boundary for startup crashes
import React from 'react';
import { Text, View } from 'react-native';

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

export default function RootLayout() {
  return (
    <StartupErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <StatusBar style="auto" />
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
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </StartupErrorBoundary>
  );
}