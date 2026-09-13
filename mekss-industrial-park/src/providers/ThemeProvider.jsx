import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'mekss-theme';

export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
};

function readStoredTheme() {
  if (typeof window === 'undefined') return THEME.LIGHT;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === THEME.DARK || stored === THEME.LIGHT) return stored;
  } catch {
    /* ignore */
  }
  return THEME.LIGHT;
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = theme === THEME.DARK;
  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDark ? '#0b1622' : '#21aa58');
  }
}

const ThemeContext = createContext({
  theme: THEME.LIGHT,
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const initial = readStoredTheme();
    applyThemeToDocument(initial);
    return initial;
  });

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next === THEME.DARK ? THEME.DARK : THEME.LIGHT);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === THEME.DARK ? THEME.LIGHT : THEME.DARK));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === THEME.DARK,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
