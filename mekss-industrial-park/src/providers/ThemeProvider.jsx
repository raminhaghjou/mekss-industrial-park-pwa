import { createContext, useContext, useMemo, useState } from 'react';
import { alpha, createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { faIR } from '@mui/material/locale';
import { faIR as faIRDate } from '@mui/x-date-pickers/locales';

const ThemeContext = createContext(
  /** @type {{ theme: import('@mui/material/styles').Theme, mode: 'light' | 'dark', toggleMode: () => void } | null} */ (null),
);

const STORAGE_KEY = 'mekss-theme-mode';
const FONT_STACK = '"Vazirmatn", "SF Pro Text", "Segoe UI", Tahoma, Arial, sans-serif';

/** @returns {'light' | 'dark'} */
const readStoredMode = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' ? stored : 'light';
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(readStoredMode);

  const toggleMode = () => {
    setMode((currentMode) => {
      const nextMode = currentMode === 'light' ? 'dark' : 'light';
      window.localStorage.setItem(STORAGE_KEY, nextMode);
      return nextMode;
    });
  };

  const theme = useMemo(() => {
    const isLight = mode === 'light';
    const paper = isLight ? '#FFFFFF' : '#181A1E';
    const border = isLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.12)';
    const softShadow = isLight
      ? '0 10px 32px rgba(15, 23, 42, 0.07)'
      : '0 12px 36px rgba(0, 0, 0, 0.28)';

    return createTheme(
      {
        direction: 'rtl',
        palette: {
          mode,
          primary: {
            main: isLight ? '#006EDC' : '#5AA9FF',
            light: isLight ? '#4EA3FF' : '#8EC5FF',
            dark: isLight ? '#004F9F' : '#2B84DE',
            contrastText: '#FFFFFF',
          },
          secondary: {
            main: isLight ? '#5856D6' : '#7D7AFF',
            light: isLight ? '#8180E5' : '#A5A3FF',
            dark: isLight ? '#3D3BA8' : '#5D5BE0',
            contrastText: '#FFFFFF',
          },
          background: {
            default: isLight ? '#F4F6F8' : '#0D0F12',
            paper,
          },
          text: {
            primary: isLight ? '#101828' : '#F5F7FA',
            secondary: isLight ? '#526071' : '#AAB4C0',
          },
          divider: border,
          success: { main: isLight ? '#168A53' : '#42C986' },
          warning: { main: isLight ? '#B86400' : '#FFB24C' },
          error: { main: isLight ? '#C8323C' : '#FF6B74' },
          info: { main: isLight ? '#087DA4' : '#50C7E8' },
        },
        typography: {
          fontFamily: FONT_STACK,
          fontSize: 16,
          h1: { fontSize: 'clamp(1.8rem, 4vw, 2.65rem)', lineHeight: 1.25, fontWeight: 800, letterSpacing: '-0.025em' },
          h2: { fontSize: 'clamp(1.55rem, 3vw, 2.15rem)', lineHeight: 1.3, fontWeight: 800, letterSpacing: '-0.02em' },
          h3: { fontSize: 'clamp(1.35rem, 2.4vw, 1.75rem)', lineHeight: 1.35, fontWeight: 750 },
          h4: { fontSize: '1.4rem', lineHeight: 1.4, fontWeight: 750 },
          h5: { fontSize: '1.2rem', lineHeight: 1.45, fontWeight: 700 },
          h6: { fontSize: '1.05rem', lineHeight: 1.5, fontWeight: 700 },
          subtitle1: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 650 },
          body1: { fontSize: '1rem', lineHeight: 1.75 },
          body2: { fontSize: '0.875rem', lineHeight: 1.7 },
          button: { fontSize: '0.925rem', fontWeight: 700, textTransform: 'none' },
          caption: { fontSize: '0.78rem', lineHeight: 1.6 },
        },
        shape: { borderRadius: 14 },
        spacing: 8,
        transitions: {
          duration: { shortest: 120, shorter: 160, short: 200, standard: 260, complex: 320, enteringScreen: 240, leavingScreen: 180 },
          easing: { easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)', easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)', easeIn: 'cubic-bezier(0.7, 0, 0.84, 0)', sharp: 'cubic-bezier(0.4, 0, 0.6, 1)' },
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              html: { colorScheme: mode, WebkitTextSizeAdjust: '100%' },
              body: { minWidth: 320, backgroundImage: 'none', fontFeatureSettings: '"ss01" 1, "tnum" 1' },
              '::selection': { backgroundColor: alpha(isLight ? '#006EDC' : '#5AA9FF', 0.24) },
              ':focus-visible': { outline: `3px solid ${alpha(isLight ? '#006EDC' : '#5AA9FF', 0.42)}`, outlineOffset: 2 },
              '*': { scrollbarWidth: 'thin', scrollbarColor: `${alpha(isLight ? '#344054' : '#E4E7EC', 0.34)} transparent` },
              '*::-webkit-scrollbar': { width: 8, height: 8 },
              '*::-webkit-scrollbar-thumb': { backgroundColor: alpha(isLight ? '#344054' : '#E4E7EC', 0.3), borderRadius: 8 },
              '@media (prefers-reduced-motion: reduce)': {
                '*, *::before, *::after': { animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important', scrollBehavior: 'auto !important' },
              },
            },
          },
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
              root: { minHeight: 44, borderRadius: 12, paddingInline: 18, textTransform: 'none' },
              contained: { boxShadow: isLight ? '0 5px 14px rgba(0, 110, 220, 0.18)' : '0 5px 16px rgba(0, 0, 0, 0.24)' },
            },
          },
          MuiIconButton: {
            styleOverrides: { root: { width: 44, height: 44, borderRadius: 12 } },
          },
          MuiCard: {
            styleOverrides: {
              root: { borderRadius: 18, border: `1px solid ${border}`, boxShadow: softShadow, backgroundImage: 'none' },
            },
          },
          MuiPaper: {
            styleOverrides: { root: { backgroundImage: 'none' }, rounded: { borderRadius: 16 } },
          },
          MuiAppBar: {
            defaultProps: { elevation: 0 },
            styleOverrides: { root: { borderRadius: 0, color: isLight ? '#101828' : '#F5F7FA' } },
          },
          MuiDrawer: {
            styleOverrides: { paper: { backgroundColor: paper, backgroundImage: 'none' } },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                minHeight: 44,
                borderRadius: 12,
                transition: 'background-color 160ms ease, color 160ms ease',
                '&.Mui-selected': { backgroundColor: alpha(isLight ? '#006EDC' : '#5AA9FF', 0.12), color: isLight ? '#005CB9' : '#8EC5FF' },
                '&.Mui-selected:hover': { backgroundColor: alpha(isLight ? '#006EDC' : '#5AA9FF', 0.17) },
              },
            },
          },
          MuiListItemIcon: { styleOverrides: { root: { color: 'inherit' } } },
          MuiTextField: { defaultProps: { size: 'medium' } },
          MuiOutlinedInput: {
            styleOverrides: {
              root: { minHeight: 48, borderRadius: 12, backgroundColor: alpha(paper, isLight ? 0.74 : 0.88) },
              input: { fontSize: '1rem' },
            },
          },
          MuiDialog: {
            styleOverrides: { paper: { width: 'calc(100% - 32px)', margin: 16, borderRadius: 20, border: `1px solid ${border}` } },
          },
          MuiMenu: { styleOverrides: { paper: { border: `1px solid ${border}`, boxShadow: softShadow } } },
          MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 14, fontSize: '0.9rem' } } },
          MuiBottomNavigation: { styleOverrides: { root: { backgroundImage: 'none' } } },
          MuiBottomNavigationAction: {
            styleOverrides: {
              root: { minWidth: 54, minHeight: 58, padding: '8px 4px 6px' },
              label: { fontFamily: FONT_STACK, fontSize: '0.68rem', '&.Mui-selected': { fontSize: '0.7rem', fontWeight: 700 } },
            },
          },
          MuiTableCell: { styleOverrides: { root: { borderColor: border }, head: { fontWeight: 750 } } },
          MuiTooltip: { styleOverrides: { tooltip: { fontFamily: FONT_STACK, fontSize: '0.78rem', borderRadius: 8 } } },
        },
      },
      faIR,
      faIRDate,
    );
  }, [mode]);

  const value = useMemo(() => ({ theme, mode, toggleMode }), [theme, mode]);

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

export const useCustomTheme = useTheme;
