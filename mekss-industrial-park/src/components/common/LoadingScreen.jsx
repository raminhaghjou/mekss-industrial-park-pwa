import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2.5),
  minHeight: '100vh',
  '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
  backgroundColor: theme.palette.background.default,
}));

const Mark = styled(Box)(({ theme }) => ({
  width: 64,
  height: 64,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 18,
  fontWeight: 900,
  fontSize: '1.6rem',
  letterSpacing: '-0.04em',
  color: theme.palette.primary.contrastText,
  background: `linear-gradient(155deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  boxShadow: theme.palette.mode === 'light'
    ? '0 14px 32px rgba(0, 110, 220, 0.28)'
    : '0 16px 36px rgba(0, 0, 0, 0.4)',
  animation: 'mekssPulse 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  '@keyframes mekssPulse': {
    '0%, 100%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.06)' },
  },
}));

export const LoadingScreen = ({ message = 'در حال بارگذاری...' }) => (
  <LoadingContainer role="status" aria-live="polite">
    <Mark aria-hidden="true">M</Mark>
    <Typography variant="body1" color="text.secondary" fontWeight={600}>
      {message}
    </Typography>
  </LoadingContainer>
);

export default LoadingScreen;
