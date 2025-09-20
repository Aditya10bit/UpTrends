import { Stack } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';

// Import polyfills safely for both dev and production
try {
  require("../polyfills");
} catch (error) {
  if (__DEV__) {
    console.warn('Polyfills not loaded:', error);
  }
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
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

            </Stack>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}