import { useEffect } from 'react';
import { useTheme } from '@mui/material/styles';

export const RTL = ({ children }) => {
  const theme = useTheme();

  useEffect(() => {
    document.body.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'fa');
    
    return () => {
      document.body.removeAttribute('dir');
      document.documentElement.removeAttribute('lang');
    };
  }, []);

  return <>{children}</>;
};