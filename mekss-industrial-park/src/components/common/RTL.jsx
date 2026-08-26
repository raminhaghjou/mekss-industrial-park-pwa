import { useEffect } from 'react';

export const RTL = ({ children }) => {
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