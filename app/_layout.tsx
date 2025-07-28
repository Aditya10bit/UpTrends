import { Stack } from "expo-router";
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import "../global.css";
import "../polyfills"; // Import polyfill to fix BackHandler compatibility

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
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
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
