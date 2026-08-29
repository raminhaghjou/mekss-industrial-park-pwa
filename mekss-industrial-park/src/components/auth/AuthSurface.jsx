import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';

const SurfaceRoot = styled(Box)(({ theme }) => ({
  position: 'relative',
  isolation: 'isolate',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.12fr) minmax(390px, 0.88fr)',
  direction: 'ltr',
  width: '100%',
  minHeight: '100vh',
  overflowX: 'hidden',
  backgroundColor: '#07131f',
  backgroundImage: 'url("/auth-industrial-park.svg")',
  backgroundPosition: 'center bottom',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
  '&::before': {
    position: 'absolute',
    zIndex: -1,
    inset: 0,
    background: 'linear-gradient(90deg, rgba(4, 12, 22, 0.18) 0%, rgba(4, 12, 22, 0.32) 42%, rgba(4, 12, 22, 0.72) 100%)',
    content: '""',
    pointerEvents: 'none',
  },
  [theme.breakpoints.down('md')]: {
    display: 'flex',
    flexDirection: 'column',
    backgroundPosition: '58% center',
    '&::before': {
      background: 'linear-gradient(180deg, rgba(4, 12, 22, 0.24) 0%, rgba(4, 12, 22, 0.48) 34%, rgba(4, 12, 22, 0.78) 100%)',
    },
  },
}));

const LandscapeStory = styled(Box)(({ theme }) => ({
  direction: 'rtl',
  alignSelf: 'end',
  maxWidth: 680,
  padding: theme.spacing(7),
  paddingBottom: `max(${theme.spacing(7)}, env(safe-area-inset-bottom))`,
  color: '#FFFFFF',
  textShadow: '0 2px 18px rgba(0, 0, 0, 0.42)',
  [theme.breakpoints.down('md')]: {
    alignSelf: 'stretch',
    maxWidth: 'none',
    padding: `max(${theme.spacing(3)}, env(safe-area-inset-top)) ${theme.spacing(2.5)} ${theme.spacing(2)}`,
  },
}));

const AuthPane = styled(Box)(({ theme }) => ({
  direction: 'rtl',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  paddingTop: `max(${theme.spacing(3)}, env(safe-area-inset-top))`,
  paddingRight: `max(${theme.spacing(3)}, env(safe-area-inset-right))`,
  paddingBottom: `max(${theme.spacing(3)}, env(safe-area-inset-bottom))`,
  paddingLeft: `max(${theme.spacing(3)}, env(safe-area-inset-left))`,
  [theme.breakpoints.down('md')]: {
    alignItems: 'flex-start',
    flexGrow: 1,
    paddingTop: theme.spacing(1),
  },
  [theme.breakpoints.down('sm')]: {
    paddingRight: `max(${theme.spacing(1.5)}, env(safe-area-inset-right))`,
    paddingBottom: `max(${theme.spacing(2)}, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${theme.spacing(1.5)}, env(safe-area-inset-left))`,
  },
}));

export const AuthSurface = ({ children, ...props }) => (
  <SurfaceRoot component="main" data-auth-surface="true" {...props}>
    <LandscapeStory aria-label="سامانه مدیریت شهرک صنعتی مکث">
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: { xs: 1.5, md: 3 } }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.16)',
            border: '1px solid rgba(255,255,255,0.28)',
            backdropFilter: 'blur(12px)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
          }}
        >
          M
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={850}>MEKSS</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.78)' }}>سامانه یکپارچه شهرک صنعتی</Typography>
        </Box>
      </Stack>
      <Typography
        component="p"
        sx={{
          maxWidth: 580,
          fontSize: { xs: '1.45rem', sm: '1.8rem', lg: 'clamp(2.15rem, 3.4vw, 3.6rem)' },
          lineHeight: { xs: 1.45, lg: 1.25 },
          fontWeight: 850,
          letterSpacing: '-0.025em',
          textWrap: 'balance',
          opacity: 0,
          animation: 'mekssFadeInUp 620ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both',
          '@media (prefers-reduced-motion: reduce)': { opacity: 1, animation: 'none' },
        }}
      >
        مدیریت یکپارچه، برای شهری که همیشه در حرکت است.
      </Typography>
      <Typography
        variant="body1"
        sx={{
          mt: 2,
          maxWidth: 540,
          color: 'rgba(255,255,255,0.80)',
          display: { xs: 'none', sm: 'block' },
          opacity: 0,
          animation: 'mekssFadeInUp 620ms cubic-bezier(0.16, 1, 0.3, 1) 220ms both',
          '@media (prefers-reduced-motion: reduce)': { opacity: 1, animation: 'none' },
        }}
      >
        خدمات واحدهای صنعتی، حراست، پیام‌ها و فرایندهای مدیریتی در یک تجربهٔ امن و سریع.
      </Typography>
    </LandscapeStory>
    <AuthPane>{children}</AuthPane>
  </SurfaceRoot>
);

export const AuthCard = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: 480,
  padding: theme.spacing(4),
  border: `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.62 : 0.14)}`,
  backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.94 : 0.92),
  WebkitBackdropFilter: 'saturate(145%) blur(22px)',
  backdropFilter: 'saturate(145%) blur(22px)',
  boxShadow: theme.palette.mode === 'light'
    ? '0 22px 58px rgba(3, 18, 34, 0.25)'
    : '0 24px 64px rgba(0, 0, 0, 0.46)',
  color: theme.palette.text.primary,
  textAlign: 'center',
  borderRadius: 24,
  opacity: 0,
  animation: 'mekssCardIn 560ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both',
  '@media (prefers-reduced-motion: reduce)': {
    opacity: 1,
    animation: 'none',
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3, 2),
    borderRadius: 20,
  },
}));
