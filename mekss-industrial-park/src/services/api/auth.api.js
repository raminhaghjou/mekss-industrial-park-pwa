import apiClient from './base.api';

export const authApi = {
  // Authentication
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  logout: () => apiClient.post('/auth/logout'),
  
  // OTP
  sendOtp: (data) => apiClient.post('/auth/send-otp', data),
  verifyOtp: (data) => apiClient.post('/auth/verify-otp', data),
  
  // Token management
  refreshToken: (data) => apiClient.post('/auth/refresh', data),
  
  // User profile
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  
  // Password management
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (data) => apiClient.post('/auth/reset-password', data),
  changePassword: (data) => apiClient.put('/auth/change-password', data),
};