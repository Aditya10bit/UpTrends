
import Constants from 'expo-constants';
import { FirebaseApp, initializeApp } from 'firebase/app';
// @ts-ignore — getReactNativePersistence types are missing in firebase v11 but the export exists at runtime
import { Auth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get environment variables from expo-constants (works in production builds)
const getEnvVar = (key: string): string | undefined => {
  // Try expo-constants first (for EAS builds)
  const extraValue = Constants.expoConfig?.extra?.[key];
  if (extraValue) return extraValue;

  // Fallback to process.env (for development)
  return process.env[key];
};

// Validate environment variables - Safe version
const validateEnvironment = () => {
  const requiredVars = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID'
  ];

  const missing = requiredVars.filter(varName => !getEnvVar(varName));

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.log('Available extra keys:', Object.keys(Constants.expoConfig?.extra || {}));
    return false;
  }
  return true;
};

// Validated config or null
const getFirebaseConfig = () => {
  if (!validateEnvironment()) return null;

  return {
    apiKey: getEnvVar('EXPO_PUBLIC_FIREBASE_API_KEY')!,
    authDomain: getEnvVar('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN')!,
    projectId: getEnvVar('EXPO_PUBLIC_FIREBASE_PROJECT_ID')!,
    storageBucket: getEnvVar('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET')!,
    messagingSenderId: getEnvVar('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')!,
    appId: getEnvVar('EXPO_PUBLIC_FIREBASE_APP_ID')!
  };
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let isFirebaseInitialized = false;
let initializationError: Error | null = null;

try {
  const config = getFirebaseConfig();
  if (config) {
    app = initializeApp(config);

    // Initialize Firebase Auth with AsyncStorage persistence for React Native
    // Without this, auth state is memory-only and lost on every app reload
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    console.log('Firebase Auth initialized with AsyncStorage persistence');

    db = getFirestore(app);
    storage = getStorage(app);
    isFirebaseInitialized = true;
    console.log('Firebase initialized successfully with secure configuration');
  } else {
    initializationError = new Error("Missing environment variables");
    console.warn("Firebase skipped due to missing config");
  }
} catch (error) {
  console.error('Firebase initialization failed:', error);
  // Do NOT throw here, just log it.
  initializationError = error as Error;
}

// We export these. They might be undefined if init failed.
// Consumers should check `isFirebaseInitialized` or check for undefined.
export { app, auth, db, initializationError, isFirebaseInitialized, storage };
export default app;
