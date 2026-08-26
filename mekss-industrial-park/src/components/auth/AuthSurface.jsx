import { Box, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';

const SurfaceRoot = styled(Box)(({ theme }) => ({
  position: 'relative',
  isolation: 'isolate',
  display: 'flex',
  width: '100%',
  minHeight: '100vh',
  alignItems: 'center',
  justifyContent: 'center',
  overflowX: 'hidden',
  padding: theme.spacing(4, 2),
  '@supports (min-height: 100dvh)': {
    minHeight: '100dvh',
  },
  '&::before': {
    position: 'absolute',
    zIndex: -2,
    inset: 0,
    backgroundColor: '#07131f',
    backgroundImage: 'url("/auth-industrial-park.svg")',
    backgroundPosition: 'center bottom',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    content: '""',
  },
  '&::after': {
    position: 'absolute',
    zIndex: -1,
    inset: 0,
    backgroundColor: 'rgba(3, 10, 17, 0.22)',
    content: '""',
    pointerEvents: 'none',
  },
  [theme.breakpoints.up('lg')]: {
    justifyContent: 'flex-start',
    paddingRight: `clamp(${theme.spacing(5)}, 7vw, ${theme.spacing(14)})`,
    paddingLeft: theme.spacing(5),
  },
  [theme.breakpoints.down('sm')]: {
    alignItems: 'flex-start',
    paddingTop: `max(${theme.spacing(2)}, env(safe-area-inset-top))`,
    paddingRight: `max(${theme.spacing(1.5)}, env(safe-area-inset-right))`,
    paddingBottom: `max(${theme.spacing(2)}, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${theme.spacing(1.5)}, env(safe-area-inset-left))`,
  },
}));

export const AuthSurface = ({ maxWidth, ...props }) => (
  <SurfaceRoot
    component="main"
    data-auth-surface="true"
    data-legacy-container-width={maxWidth}
    {...props}
  />
);

export const AuthCard = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: 450,
  padding: theme.spacing(4),
  border: '1px solid rgba(255, 255, 255, 0.78)',
  backgroundColor: 'rgba(255, 255, 255, 0.96)',
  boxShadow: '0 20px 52px rgba(4, 35, 52, 0.28)',
  color: theme.palette.text.primary,
  textAlign: 'center',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3, 2.25),
  },
}));
