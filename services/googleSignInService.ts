// services/googleSignInService.ts
// Google Sign-In for Firebase (native SDK — no web OAuth consent screen).
//
// Flow: native Google account picker → idToken → swap for a Firebase credential
// via GoogleAuthProvider.credential(idToken) → signInWithCredential. This is the
// standard React Native + Firebase pattern and works in the built APK (it needs
// Google Play services on the device).
//
// Config: the Web client ID is read from EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (see
// .env). Without it GoogleSignIn has nothing to match and fails — so we surface
// a clear error instead of a cryptic one.

import { statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, isFirebaseInitialized } from '../firebaseConfig';
import { checkUserProfile, createUserProfile } from './userService';

// Lazy-loaded native module — @react-native-google-signin/google-signin uses a
// TurboModule (RNGoogleSignin) that only exists in custom dev clients / APK
// builds. Importing it at the top level crashes Expo Go with:
//   Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found.
// By deferring the require to call-time we avoid the crash and can surface a
// friendly error instead.
let _googleSignInModule: typeof import('@react-native-google-signin/google-signin') | null = null;

const getGoogleSignInModule = () => {
  if (_googleSignInModule) return _googleSignInModule;
  try {
    _googleSignInModule = require('@react-native-google-signin/google-signin');
    return _googleSignInModule;
  } catch (e) {
    console.warn('[GoogleSignIn] Native module not available:', e);
    return null;
  }
};

const getEnvVar = (key: string): string | undefined => {
  const extraValue = Constants.expoConfig?.extra?.[key];
  if (extraValue) return extraValue as string;
  return process.env[key];
};

export type GoogleSignInResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

let configured = false;
const configureGoogleSignIn = (webClientId: string, iosClientId?: string) => {
  const mod = getGoogleSignInModule();
  if (!mod || configured) return;
  configured = true;
  mod.GoogleSignin.configure({
    webClientId,
    iosClientId,
    offlineAccess: false,
  });
};

export const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
  // Check native module availability first
  const mod = getGoogleSignInModule();
  if (!mod) {
    return {
      status: 'error',
      message:
        'Google Sign-In requires a custom dev build (not Expo Go).\n\nRun `npx expo run:android` or create an EAS development build to use this feature.',
    };
  }

  const webClientId = getEnvVar('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  if (!webClientId) {
    return {
      status: 'error',
      message:
        'Google sign-in isn\'t set up yet.\n\nAdd EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env file — get it from Firebase Console → Project Settings → Your apps → Web app → "Web client ID".',
    };
  }
  if (!isFirebaseInitialized || !auth) {
    return { status: 'error', message: 'App is not connected to Firebase. Please check your configuration.' };
  }

  configureGoogleSignIn(webClientId, getEnvVar('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'));

  try {
    await mod.GoogleSignin.hasPlayServices();
    const response = await mod.GoogleSignin.signIn();

    if (mod.isCancelledResponse(response)) {
      return { status: 'cancelled' };
    }
    if (!mod.isSuccessResponse(response)) {
      return { status: 'error', message: 'Google sign-in didn\'t return a token. Please try again.' };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return { status: 'error', message: 'Google sign-in didn\'t return a token. Please try again.' };
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);

    // Make sure the Firestore profile exists for this Google account so the rest
    // of the app (profile, closet, greeting) has something to read.
    try {
      const profileExists = await checkUserProfile();
      if (!profileExists) {
        await createUserProfile({
          username: userCredential.user.email?.split('@')[0] || 'User',
          displayName: userCredential.user.displayName || '',
          email: userCredential.user.email,
        });
      }
    } catch (e) {
      // A failed profile write shouldn't block a successful login — the app runs
      // in degraded mode and other screens create it lazily.
      console.warn('Google sign-in: profile sync failed', e);
    }

    return { status: 'success' };
  } catch (error: any) {
    // TurboModule error = native module not linked (Expo Go doesn't support it)
    if (error?.message?.includes('TurboModuleRegistry') || error?.message?.includes('RNGoogleSignin')) {
      return {
        status: 'error',
        message: 'Google Sign-In requires a custom development build.\n\nIt does NOT work in Expo Go. Build an APK with `eas build` or `cd android && ./gradlew assembleRelease` to test this feature.',
      };
    }
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      return { status: 'cancelled' };
    }
    if (error?.code === statusCodes.IN_PROGRESS) {
      return { status: 'error', message: 'A sign-in is already in progress.' };
    }
    if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { status: 'error', message: 'Google Play services is not available on this device.' };
    }
    return {
      status: 'error',
      message:
        error?.message ||
        'Google sign-in failed. Check that the Google provider is enabled and the SHA-1 fingerprint matches your APK signing key.',
    };
  }
};
