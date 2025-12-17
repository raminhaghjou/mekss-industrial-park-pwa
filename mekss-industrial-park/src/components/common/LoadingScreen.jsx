import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
}));

export const LoadingScreen = ({ message = 'در حال بارگذاری...' }) => {
  return (
    <LoadingContainer>
      <CircularProgress size={60} thickness={4} />
      <Typography variant="h6" sx={{ mt: 3, color: 'text.primary' }}>
        {message}
      </Typography>
    </LoadingContainer>
  );
};