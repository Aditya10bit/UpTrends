module.exports = {
    expo: {
        name: "UpTrends",
        slug: "uptrends",
        version: "2.5.0",
        orientation: "portrait",
        icon: "./assets/images/icon.png",
        scheme: "uptrends",
        userInterfaceStyle: "automatic",
        newArchEnabled: false,
        description: "AI-powered fashion styling app that helps you create perfect outfits for any occasion",
        privacy: "public",
        platforms: ["ios", "android", "web"],
        githubUrl: "https://github.com/aditya10das/uptrends",
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.aditya10das.uptrends"
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/images/adaptive-icon.png",
                backgroundColor: "#667eea"
            },
            package: "com.aditya10das.uptrends",
            versionCode: 26,
            permissions: [
                "CAMERA",
                "READ_EXTERNAL_STORAGE",
                "WRITE_EXTERNAL_STORAGE",
                "INTERNET",
                "ACCESS_NETWORK_STATE",
                "ACCESS_FINE_LOCATION",
                "ACCESS_COARSE_LOCATION"
            ],
            allowBackup: false,
            networkSecurityConfig: {
                cleartextTrafficPermitted: false
            }
        },
        web: {
            bundler: "metro",
            output: "static",
            favicon: "./assets/images/favicon.png"
        },
        plugins: [
            "expo-router",
            [
                "expo-splash-screen",
                {
                    image: "./assets/images/splash-icon.png",
                    imageWidth: 200,
                    resizeMode: "contain",
                    backgroundColor: "#667eea"
                }
            ],
            [
                "expo-image-picker",
                {
                    photosPermission: "The app accesses your photos to let you share them with your outfits.",
                    cameraPermission: "The app accesses your camera to let you take photos for outfit analysis."
                }
            ],
            "expo-font",
            "expo-web-browser",
            "@react-native-google-signin/google-signin"
        ],
        extra: {
            router: {
                origin: false
            },
            eas: {
                projectId: "cf6d1cfe-ce05-470d-85d7-f721c607d414"
            },
        // Firebase configuration — these are public client-side keys (safe to embed).
        // Fallback values ensure EAS cloud builds work even without a .env file.
        EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCKJt0aN1utByOK_R0mv3UbBYVtdtbcQ7A',
        EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'uptrends-f893f.firebaseapp.com',
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'uptrends-f893f',
        EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'uptrends-f893f.firebasestorage.app',
        EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '734945715091',
        EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:734945715091:web:1a0157e8cf96e172fc7e66',
        // Google Sign-In — Web client ID (from Firebase Console → Your apps → Web app).
        // Required for the "Continue with Google" button; without it the screen shows a clear error.
        EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
        EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
        // Cloudflare Worker AI Proxy (multi-provider fallback for shared keys)
        EXPO_PUBLIC_AI_PROXY_URL: process.env.EXPO_PUBLIC_AI_PROXY_URL || '',
        },
        owner: "aditya10das"
    }
};
