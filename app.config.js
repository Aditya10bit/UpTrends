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
                "ACCESS_NETWORK_STATE"
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
            "expo-web-browser"
        ],
        extra: {
            router: {
                origin: false
            },
            eas: {
                projectId: "cf6d1cfe-ce05-470d-85d7-f721c607d414"
            },
            // Firebase configuration from environment variables
            EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
            EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
            EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
            EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
        },
        owner: "aditya10das"
    }
};
