import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

/**
 * Wraps route content with a single authored entrance (fade + gentle rise)
 * that replays on every route change, giving navigation between admin pages
 * the same settled, native-app feel as the rest of the shell. Respects
 * `prefers-reduced-motion` by rendering content immediately with no motion.
 */
export const PageTransition = ({ children }) => {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    setKey(location.pathname);
  }, [location.pathname]);

  if (prefersReducedMotion.current) {
    return <>{children}</>;
  }

  return (
    <Box
      key={key}
      sx={{
        animation: 'mekssFadeInUp 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      {children}
    </Box>
  );
};

export default PageTransition;
