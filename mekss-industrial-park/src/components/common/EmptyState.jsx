import { Box, Typography } from '@mui/material';
import { InboxOutlined as InboxIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

/**
 * Shared empty-state treatment: an icon mark, a short title, and optional
 * supporting text. Replaces plain "nothing here" table/list rows with a
 * state that teaches rather than merely reports absence, per the Operate
 * mode's empty-state guidance.
 */
export const EmptyState = ({ icon, title, description, sx = {} }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 1,
      py: 6,
      px: 2,
      opacity: 0,
      animation: 'mekssFadeInUp 380ms cubic-bezier(0.16, 1, 0.3, 1) both',
      ...sx,
    }}
  >
    <Box
      aria-hidden="true"
      sx={{
        width: 56,
        height: 56,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        color: 'text.secondary',
        bgcolor: (theme) => alpha(theme.palette.text.secondary, theme.palette.mode === 'light' ? 0.08 : 0.14),
        mb: 0.5,
      }}
    >
      {icon || <InboxIcon fontSize="medium" />}
    </Box>
    <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
    {description && (
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        {description}
      </Typography>
    )}
  </Box>
);

export default EmptyState;
