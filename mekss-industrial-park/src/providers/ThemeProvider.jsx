import { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { faIR } from '@mui/material/locale';
import { faIR as faIRDate } from '@mui/x-date-pickers/locales';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState('light'); // 'light' or 'dark'

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => {
    const baseTheme = createTheme(
      {
        direction: 'rtl',
        palette: {
          mode,
          primary: {
            main: mode === 'light' ? '#1976d2' : '#90caf9',
            light: mode === 'light' ? '#42a5f5' : '#bbdefb',
            dark: mode === 'light' ? '#1565c0' : '#64b5f6',
          },
          secondary: {
            main: mode === 'light' ? '#dc004e' : '#f48fb1',
            light: mode === 'light' ? '#e33371' : '#f8bbd0',
            dark: mode === 'light' ? '#9a0036' : '#f06292',
          },
          background: {
            default: mode === 'light' ? '#fafafa' : '#121212',
            paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
          },
          text: {
            primary: mode === 'light' ? '#000000' : '#ffffff',
            secondary: mode === 'light' ? '#666666' : '#b0b0b0',
          },
          success: {
            main: '#4caf50',
            light: '#81c784',
            dark: '#388e3c',
          },
          warning: {
            main: '#ff9800',
            light: '#ffb74d',
            dark: '#f57c00',
          },
          error: {
            main: '#f44336',
            light: '#e57373',
            dark: '#d32f2f',
          },
          info: {
            main: '#2196f3',
            light: '#64b5f6',
            dark: '#1976d2',
          },
        },
        typography: {
          fontFamily: '"Vazirmatn", "Roboto", "Helvetica", "Arial", sans-serif',
          fontSize: 14,
          h1: {
            fontSize: '2.5rem',
            fontWeight: 500,
          },
          h2: {
            fontSize: '2rem',
            fontWeight: 500,
          },
          h3: {
            fontSize: '1.75rem',
            fontWeight: 500,
          },
          h4: {
            fontSize: '1.5rem',
            fontWeight: 500,
          },
          h5: {
            fontSize: '1.25rem',
            fontWeight: 500,
          },
          h6: {
            fontSize: '1rem',
            fontWeight: 500,
          },
          body1: {
            fontSize: '1rem',
            lineHeight: 1.5,
          },
          body2: {
            fontSize: '0.875rem',
            lineHeight: 1.43,
          },
          button: {
            textTransform: 'none',
            fontWeight: 500,
          },
        },
        shape: {
          borderRadius: 8,
        },
        spacing: 8,
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                textTransform: 'none',
                fontWeight: 500,
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: mode === 'light' 
                  ? '0 2px 8px rgba(0,0,0,0.1)' 
                  : '0 2px 8px rgba(0,0,0,0.3)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                borderRadius: 0,
              },
            },
          },
        },
      },
      faIR, // Persian locale for Material-UI
      faIRDate // Persian locale for Date pickers
    );

    return baseTheme;
  }, [mode]);

  const value = {
    theme,
    mode,
    toggleMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme
export const useCustomTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useCustomTheme must be used within a ThemeProvider');
  }
  return context;
};