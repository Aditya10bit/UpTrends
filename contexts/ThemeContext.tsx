import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Appearance, StatusBar } from 'react-native';
import { dark, light } from '../themes';

interface ThemeContextType {
  theme: typeof light;
  mode: 'light' | 'dark';
  toggle: () => void;
  setStatusBarColor: (screen: keyof typeof light.statusBar) => void;
  currentStatusBarColor: string;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: light,
  mode: 'light',
  toggle: () => {},
  setStatusBarColor: () => {},
  currentStatusBarColor: light.statusBar.default,
});

export const ThemeProvider = ({ children }: PropsWithChildren<{}>) => {
  const [mode, setMode] = useState<'light' | 'dark'>(Appearance.getColorScheme() as 'light' | 'dark' || 'light');
  const [currentScreen, setCurrentScreen] = useState<keyof typeof light.statusBar>('default');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => 
      setMode(colorScheme as 'light' | 'dark' || 'light')
    );
    return () => sub.remove();
  }, []);

  const toggle = () => setMode(m => (m === 'light' ? 'dark' : 'light'));
  const theme = mode === 'dark' ? dark : light;

  const setStatusBarColor = (screen: keyof typeof light.statusBar) => {
    setCurrentScreen(screen);
    const color = theme.statusBar[screen];
    StatusBar.setBackgroundColor(color, true);
  };

  const currentStatusBarColor = theme.statusBar[currentScreen];

  // Set initial status bar color
  useEffect(() => {
    StatusBar.setBackgroundColor(currentStatusBarColor, false);
  }, [currentStatusBarColor]);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      mode, 
      toggle, 
      setStatusBarColor, 
      currentStatusBarColor 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
