// services/userService.ts

import { arrayRemove, arrayUnion, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// --- Types ---
export interface UserData {
  username?: string;
  gender?: string;
  [key: string]: any;
}

export interface Outfit {
  categorySlug: string;
  [key: string]: any;
}

// --- Create User Profile ---
export const createUserProfile = async (userData: UserData = {}): Promise<boolean | void> => {
  const user = auth.currentUser;
  if (!user) {
    console.log('No authenticated user found');
    return;
  }
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      username: userData.username || user.email?.split('@')[0] || 'User',
      gender: userData.gender || 'male',
      favorites: [],
      createdAt: new Date(),
      lastLogin: new Date(),
      ...userData
    });
    console.log('User profile created successfully');
    return true;
  } catch (error) {
    console.error('Error creating user profile:', error);
    return false;
  }
};

// --- Update User Profile ---
export const updateUserProfile = async (userId: string, updateData: Record<string, any>): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updateData,
      updatedAt: new Date()
    });
    console.log('User profile updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return false;
  }
};

// --- Save Favorite Outfit ---
export const saveFavoriteOutfit = async (outfit: Outfit): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) {
    console.log('No authenticated user found');
    return false;
  }
  try {
    const userRef = doc(db, 'users', user.uid);
    const favoriteOutfit = {
      ...outfit,
      savedAt: new Date(),
      // Use provided ID or generate new one
      id: outfit.id || `${outfit.categorySlug}_${Date.now()}`
    };
    await updateDoc(userRef, {
      favorites: arrayUnion(favoriteOutfit)
    });
    console.log('Outfit saved to favorites');
    return true;
  } catch (error) {
    console.error('Error saving favorite:', error);
    return false;
  }
};

// --- Get User Favorites ---
export const getUserFavorites = async (userId: string): Promise<any[]> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.favorites || [];
    }
    return [];
  } catch (error) {
    console.error('Error getting user favorites:', error);
    throw error;
  }
};

// --- Get User Profile (by UID, or current user if not provided) ---
export const getUserProfile = async (uid?: string): Promise<any | null> => {
  let userId = uid;
  if (!userId) {
    const user = auth.currentUser;
    if (!user) {
      console.log('No authenticated user found');
      return null;
    }
    userId = user.uid;
  }
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      console.log('User profile not found');
      return null;
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// --- Check if User Profile Exists ---
export const checkUserProfile = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    return userDoc.exists();
  } catch (error) {
    console.error('Error checking user profile:', error);
    return false;
  }
};

// --- Remove Favorite Outfit (by ID) ---
export const removeFavoriteOutfit = async (userId: string, outfitId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const currentFavorites = userData.favorites || [];
      const itemToRemove = currentFavorites.find((item: any) => item.id === outfitId);
      if (itemToRemove) {
        await updateDoc(userRef, {
          favorites: arrayRemove(itemToRemove)
        });
        console.log('Favorite removed successfully from Firebase');
        return true;
      } else {
        console.log('Item not found in favorites');
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error('Error removing favorite:', error);
    return false;
  }
};

// --- Remove Favorite by Index (Alternative) ---
export const removeFavoriteByIndex = async (userId: string, itemIndex: number): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const currentFavorites = userData.favorites || [];
      const updatedFavorites = currentFavorites.filter((_: any, index: number) => index !== itemIndex);
      await updateDoc(userRef, {
        favorites: updatedFavorites
      });
      console.log('Favorite removed successfully by index');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error removing favorite by index:', error);
    return false;
  }
};
