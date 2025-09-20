// utils/genderUtils.ts

import { router } from 'expo-router';
import { Alert } from 'react-native';
import { getUserProfile } from '../services/userService';

export interface GenderCheckResult {
  hasGender: boolean;
  gender?: 'Male' | 'Female' | 'Other';
  needsSelection: boolean;
}

/**
 * Check if user has gender set in their profile
 */
export const checkUserGender = async (userId?: string): Promise<GenderCheckResult> => {
  try {
    const profile = await getUserProfile(userId);
    
    if (!profile || !profile.gender) {
      return {
        hasGender: false,
        needsSelection: true
      };
    }

    return {
      hasGender: true,
      gender: profile.gender,
      needsSelection: profile.gender === 'Other'
    };
  } catch (error) {
    console.error('Error checking user gender:', error);
    return {
      hasGender: false,
      needsSelection: true
    };
  }
};

/**
 * Prompt user to set gender if not set
 */
export const promptForGender = (onComplete?: () => void) => {
  Alert.alert(
    'Complete Your Profile',
    'Please set your gender preference to get personalized fashion recommendations.',
    [
      {
        text: 'Set Gender',
        onPress: () => {
          router.push('/profile-edit');
          if (onComplete) onComplete();
        }
      },
      {
        text: 'Skip',
        style: 'cancel',
        onPress: onComplete
      }
    ]
  );
};

/**
 * Get gender-specific category slug
 */
export const getGenderSpecificSlug = (categoryName: string, gender: string): string => {
  const genderPrefix = gender.toLowerCase() === 'female' ? 'female' : 'male';
  return `${genderPrefix}-${categoryName.toLowerCase().replace(/\s+/g, '-')}`;
};

/**
 * Filter content based on gender
 */
export const filterByGender = <T extends { gender?: string | string[] }>(
  items: T[],
  userGender: string
): T[] => {
  return items.filter(item => {
    if (!item.gender) return true; // No gender restriction
    
    if (Array.isArray(item.gender)) {
      return item.gender.includes(userGender.toLowerCase()) || 
             item.gender.includes('unisex') || 
             item.gender.includes('all');
    }
    
    return item.gender.toLowerCase() === userGender.toLowerCase() || 
           item.gender.toLowerCase() === 'unisex' || 
           item.gender.toLowerCase() === 'all';
  });
};