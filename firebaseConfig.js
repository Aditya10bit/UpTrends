// firebaseConfig.js - Fixed with AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCKJt0aN1utByOK_R0mv3UbBYVtdtbcQ7A",
  authDomain: "uptrends-f893f.firebaseapp.com",
  projectId: "uptrends-f893f",
  storageBucket: "uptrends-f893f.firebasestorage.app",
  messagingSenderId: "734945715091",
  appId: "1:734945715091:web:1a0157e8cf96e172fc7e66"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
