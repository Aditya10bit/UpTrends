// services/userService.ts

import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
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



// --- Get User Profile (by UID, or current user if not provided) ---
export const getUserProfile = async (uid?: string): Promise<any | null> => {
  let userId: string = uid || '';
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

// --- NSFW Violation Handling ---
export const handleNsfwViolation = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      const currentWarnings = data.nsfwWarnings || 0;
      const newWarnings = currentWarnings + 1;
      
      const updateData: any = {
        nsfwWarnings: newWarnings,
      };

      // Ban after 2 warnings (meaning the 3rd strike)
      if (newWarnings >= 3) {
        updateData.isBanned = true;
        updateData.bannedAt = new Date();
      }

      await updateDoc(userRef, updateData);
    }
  } catch (error) {
    console.error('Error handling NSFW violation:', error);
  }
};

// --- Check Ban Status ---
export const checkBanStatus = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return !!userDoc.data().isBanned;
    }
    return false;
  } catch (error) {
    console.error('Error checking ban status:', error);
    return false;
  }
};

// --- Delete User Account ---
export const deleteUserAccount = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    // Delete profile doc (and any other root-level user docs if known)
    const userRef = doc(db, 'users', user.uid);
    await deleteDoc(userRef);
    
    // Delete Auth User
    await deleteUser(user);
    console.log('User account and profile deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting user account:', error);
    return false;
  }
};
