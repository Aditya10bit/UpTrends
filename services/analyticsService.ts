import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, increment, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const AI_REQUESTS_KEY = 'ai_requests_count';
const SHARED_OUTFITS_KEY = 'shared_outfits_count';

export interface UserAnalytics {
  aiRequestsCount: number;
  sharedOutfitsCount: number;
  lastUpdated: Date;
}

// Track AI request locally and in Firebase
export const trackAIRequest = async (userId?: string) => {
  try {
    // Update local count
    const currentCount = await getLocalAIRequestsCount();
    const newCount = currentCount + 1;
    await AsyncStorage.setItem(AI_REQUESTS_KEY, newCount.toString());

    // Update Firebase if user is logged in
    if (userId) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        aiRequestsCount: increment(1),
        lastAIRequest: new Date(),
        updatedAt: new Date()
      });
    }

    console.log('📊 AI request tracked:', newCount);
    return newCount;
  } catch (error) {
    console.error('Error tracking AI request:', error);
    return await getLocalAIRequestsCount();
  }
};

// Track shared outfit locally and in Firebase
export const trackSharedOutfit = async (userId?: string) => {
  try {
    // Update local count
    const currentCount = await getLocalSharedOutfitsCount();
    const newCount = currentCount + 1;
    await AsyncStorage.setItem(SHARED_OUTFITS_KEY, newCount.toString());

    // Update Firebase if user is logged in
    if (userId) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        sharedOutfitsCount: increment(1),
        lastSharedOutfit: new Date(),
        updatedAt: new Date()
      });
    }

    console.log('📊 Shared outfit tracked:', newCount);
    return newCount;
  } catch (error) {
    console.error('Error tracking shared outfit:', error);
    return await getLocalSharedOutfitsCount();
  }
};

// Get local AI requests count
export const getLocalAIRequestsCount = async (): Promise<number> => {
  try {
    const count = await AsyncStorage.getItem(AI_REQUESTS_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Error getting local AI requests count:', error);
    return 0;
  }
};

// Get local shared outfits count
export const getLocalSharedOutfitsCount = async (): Promise<number> => {
  try {
    const count = await AsyncStorage.getItem(SHARED_OUTFITS_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Error getting local shared outfits count:', error);
    return 0;
  }
};

// Get user analytics from Firebase
export const getUserAnalytics = async (userId: string): Promise<UserAnalytics> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        aiRequestsCount: data.aiRequestsCount || 0,
        sharedOutfitsCount: data.sharedOutfitsCount || 0,
        lastUpdated: data.updatedAt?.toDate() || new Date()
      };
    } else {
      // Initialize user analytics if doesn't exist
      const initialAnalytics = {
        aiRequestsCount: 0,
        sharedOutfitsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(userRef, initialAnalytics, { merge: true });
      
      return {
        aiRequestsCount: 0,
        sharedOutfitsCount: 0,
        lastUpdated: new Date()
      };
    }
  } catch (error) {
    console.error('Error getting user analytics:', error);
    // Fallback to local counts
    const localAI = await getLocalAIRequestsCount();
    const localShared = await getLocalSharedOutfitsCount();
    
    return {
      aiRequestsCount: localAI,
      sharedOutfitsCount: localShared,
      lastUpdated: new Date()
    };
  }
};

// Sync local counts with Firebase (useful when user logs in)
export const syncAnalyticsWithFirebase = async (userId: string) => {
  try {
    const localAI = await getLocalAIRequestsCount();
    const localShared = await getLocalSharedOutfitsCount();
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      const firebaseAI = data.aiRequestsCount || 0;
      const firebaseShared = data.sharedOutfitsCount || 0;
      
      // Use the higher count (local or Firebase)
      const maxAI = Math.max(localAI, firebaseAI);
      const maxShared = Math.max(localShared, firebaseShared);
      
      // Update both local and Firebase with the max values
      await AsyncStorage.setItem(AI_REQUESTS_KEY, maxAI.toString());
      await AsyncStorage.setItem(SHARED_OUTFITS_KEY, maxShared.toString());
      
      await updateDoc(userRef, {
        aiRequestsCount: maxAI,
        sharedOutfitsCount: maxShared,
        updatedAt: new Date()
      });
      
      console.log('📊 Analytics synced:', { aiRequests: maxAI, sharedOutfits: maxShared });
    } else {
      // Create new user document with local counts
      await setDoc(userRef, {
        aiRequestsCount: localAI,
        sharedOutfitsCount: localShared,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error syncing analytics:', error);
  }
};

// Clear local analytics (useful for logout)
export const clearLocalAnalytics = async () => {
  try {
    await AsyncStorage.removeItem(AI_REQUESTS_KEY);
    await AsyncStorage.removeItem(SHARED_OUTFITS_KEY);
    console.log('📊 Local analytics cleared');
  } catch (error) {
    console.error('Error clearing local analytics:', error);
  }
};