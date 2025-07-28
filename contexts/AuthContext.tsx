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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 🔥 SINGLE NAVIGATION EFFECT - Only for initial load
  useEffect(() => {
    if (!rootNavigationState?.key || loading || hasNavigated) return;
    
    console.log('AuthContext navigation - User:', user ? 'exists' : 'null');
    
    setTimeout(() => {
      if (user) {
        console.log('AuthContext: Navigating to main dashboard');
        router.replace('/');
      } else {
        console.log('AuthContext: Navigating to auth screen');
        router.replace('/auth');
      }
      setHasNavigated(true);
    }, 200);
  }, [user, loading, rootNavigationState?.key, hasNavigated]);

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
