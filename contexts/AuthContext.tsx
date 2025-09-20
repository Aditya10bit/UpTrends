// contexts/AuthContext.tsx - SIMPLIFIED NAVIGATION
import { router, useRootNavigationState } from 'expo-router';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasNavigated, setHasNavigated] = useState(false);
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        setUser(user);
        setLoading(false);
      }, (error) => {
        console.error('Firebase auth error:', error);
        setUser(null);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      setUser(null);
      setLoading(false);
    }
  }, []);

  // Navigation effect - production-safe
  useEffect(() => {
    if (!rootNavigationState?.key || loading) return;
    
    console.log('AuthContext navigation - User:', user ? 'exists' : 'null');
    
    // Add timeout to prevent race conditions in production
    const navigationTimeout = setTimeout(() => {
      try {
        if (user && !hasNavigated) {
          console.log('AuthContext: Navigating to main dashboard');
          router.replace('/');
          setHasNavigated(true);
        } else if (!user && !hasNavigated) {
          console.log('AuthContext: Navigating to auth screen');
          router.replace('/auth');
          setHasNavigated(true);
        }
      } catch (error) {
        console.error('Navigation error:', error);
      }
    }, 100);

    return () => clearTimeout(navigationTimeout);
  }, [user, loading, rootNavigationState?.key]);

  const logout = async () => {
    try {
      await signOut(auth);
      setHasNavigated(false);
      // Let auth state change handle navigation
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    loading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
