import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api/auth.api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const response = await authApi.getProfile();
        setUser(response.data);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await authApi.login(credentials);
      const { accessToken, refreshToken, user: userData } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      setUser(userData);
      navigate('/dashboard');
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authApi.register(userData);
      const { accessToken, refreshToken, user: newUser } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      setUser(newUser);
      navigate('/dashboard');
      
      return { success: true };
    } catch (error) {
      console.error('Registration failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Registration failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    navigate('/login');
  };

  const refreshAccessToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authApi.refreshToken({ refreshToken });
      const { accessToken } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      return accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      throw error;
    }
  };

  const sendOtp = async (phoneNumber) => {
    try {
      await authApi.sendOtp({ phoneNumber });
      return { success: true };
    } catch (error) {
      console.error('OTP send failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to send OTP' 
      };
    }
  };

  const verifyOtp = async (phoneNumber, code) => {
    try {
      const response = await authApi.verifyOtp({ phoneNumber, code });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('OTP verification failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'OTP verification failed' 
      };
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    return user.permissions?.includes(permission) || user.role === 'ADMIN';
  };

  const hasRole = (role) => {
    if (!user) return false;
    return user.role === role;
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshAccessToken,
    sendOtp,
    verifyOtp,
    hasPermission,
    hasRole,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};