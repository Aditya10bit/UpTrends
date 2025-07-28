import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { dark, light } from '../themes';

const ThemeContext = createContext({
  theme: light,
  mode: 'light',
  toggle: () => {},
});

export const ThemeProvider = ({ children }: PropsWithChildren<{}>) => {
  const [mode, setMode] = useState(Appearance.getColorScheme() || 'light');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setMode(colorScheme || 'light'));
    return () => sub.remove();
  }, []);

  const toggle = () => setMode(m => (m === 'light' ? 'dark' : 'light'));
  const theme = mode === 'dark' ? dark : light;

  return (
    <ThemeContext.Provider value={{ theme, mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};
export const useTheme = () => useContext(ThemeContext);
