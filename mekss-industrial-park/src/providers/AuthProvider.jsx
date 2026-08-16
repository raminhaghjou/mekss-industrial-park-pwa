import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api/auth.api';

const AuthContext = createContext(null);
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearSession = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };
  const setSession = ({ accessToken, refreshToken, user: nextUser }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(nextUser);
  };
  const checkAuth = async () => {
    try {
      if (!localStorage.getItem('accessToken')) return;
      const response = await authApi.getProfile();
      setUser(response.data);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { checkAuth(); }, []);

  const login = async (credentials) => {
    try {
      const { data } = await authApi.login(credentials);
      setSession(data);
      navigate('/dashboard');
      return { success: true, mustChangePassword: data.mustChangePassword };
    } catch (error) { return { success: false, error: error.response?.data?.message || 'ورود ناموفق بود.' }; }
  };
  const register = async (userData) => {
    try {
      const { data } = await authApi.register(userData);
      navigate('/login');
      return { success: true, message: data.message || 'ثبت‌نام انجام شد؛ حساب شما پس از تأیید فعال می‌شود.' };
    } catch (error) { return { success: false, error: error.response?.data?.message || 'ثبت‌نام ناموفق بود.' }; }
  };
  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* local logout remains valid when offline */ }
    clearSession();
    navigate('/login');
  };
  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');
    try {
      const { data } = await authApi.refreshToken({ refreshToken });
      setSession(data);
      return data.accessToken;
    } catch (error) { clearSession(); navigate('/login'); throw error; }
  };
  const sendOtp = async (phoneNumber) => {
    try { await authApi.sendOtp({ phoneNumber }); return { success: true }; }
    catch (error) { return { success: false, error: error.response?.data?.message || 'ارسال رمز یک‌بار مصرف ناموفق بود.' }; }
  };
  const verifyOtp = async (phoneNumber, otp) => {
    try { const { data } = await authApi.verifyOtp({ phoneNumber, otp }); setSession(data); return { success: true, data }; }
    catch (error) { return { success: false, error: error.response?.data?.message || 'رمز یک‌بار مصرف نامعتبر است.' }; }
  };
  return <AuthContext.Provider value={{ user, loading, login, register, logout, refreshAccessToken, sendOtp, verifyOtp, hasRole: (role) => user?.role === role, checkAuth }}>{children}</AuthContext.Provider>;
};
