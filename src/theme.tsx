import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Colors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  /** Text/icon color drawn on top of `accent`. */
  onAccent: string;
  star: string;
  danger: string;
  ok: string;
};

export type Theme = { id: string; name: string; colors: Colors };

const shared = { text: '#F4F5F7', star: '#FFC24B', ok: '#3DDC97' };

export const THEMES: Theme[] = [
  {
    id: 'lumen-red',
    name: 'Lumen Red',
    colors: {
      ...shared,
      bg: '#0A0A0A',
      surface: '#161616',
      surfaceAlt: '#222222',
      border: '#2E2E2E',
      muted: '#9A9A9A',
      accent: '#E63946',
      accentSoft: 'rgba(230,57,70,0.18)',
      onAccent: '#FFFFFF',
      danger: '#FF9F43',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      ...shared,
      bg: '#0B0F17',
      surface: '#151B26',
      surfaceAlt: '#1E2633',
      border: '#263042',
      muted: '#8A94A6',
      accent: '#4F8CFF',
      accentSoft: 'rgba(79,140,255,0.16)',
      onAccent: '#FFFFFF',
      danger: '#FF6B6B',
    },
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    colors: {
      ...shared,
      bg: '#0E0B16',
      surface: '#1A1526',
      surfaceAlt: '#251E35',
      border: '#322943',
      muted: '#9A90AE',
      accent: '#8B5CF6',
      accentSoft: 'rgba(139,92,246,0.18)',
      onAccent: '#FFFFFF',
      danger: '#FF6B6B',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    colors: {
      ...shared,
      bg: '#08110E',
      surface: '#121D19',
      surfaceAlt: '#1B2823',
      border: '#25352E',
      muted: '#8BA39A',
      accent: '#10B981',
      accentSoft: 'rgba(16,185,129,0.18)',
      onAccent: '#04130D',
      danger: '#FF6B6B',
      ok: '#6EE7B7',
    },
  },
  {
    id: 'gold',
    name: 'Black Gold',
    colors: {
      ...shared,
      bg: '#0B0A08',
      surface: '#181612',
      surfaceAlt: '#24211A',
      border: '#332E24',
      muted: '#A39C8C',
      accent: '#D4A73A',
      accentSoft: 'rgba(212,167,58,0.18)',
      onAccent: '#1A1405',
      danger: '#FF6B6B',
      star: '#F5D27A',
    },
  },
];

const THEME_KEY = 'lumen.theme';

type ThemeState = { theme: Theme; colors: Colors; setTheme: (id: string) => void };

const ThemeContext = createContext<ThemeState>({ theme: THEMES[0], colors: THEMES[0].colors, setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(THEMES[0].id);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => saved && THEMES.some((t) => t.id === saved) && setId(saved))
      .catch(() => {});
  }, []);

  const setTheme = useCallback((next: string) => {
    setId(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => {
    const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
    return { theme, colors: theme.colors, setTheme };
  }, [id, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Builds a styles hook whose StyleSheet is created once per theme. */
export function themed<T>(factory: (colors: Colors) => T): () => T {
  const cache = new Map<string, T>();
  return function useStyles() {
    const { theme } = useTheme();
    let styles = cache.get(theme.id);
    if (!styles) {
      styles = factory(theme.colors);
      cache.set(theme.id, styles);
    }
    return styles;
  };
}
