
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

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

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

// Validated config or null
const getFirebaseConfig = () => {
  if (!validateEnvironment()) return null;

  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!
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

    // Initialize Firebase Auth - Firebase v11 handles persistence automatically
    auth = getAuth(app);
    console.log('Firebase Auth initialized successfully');

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
