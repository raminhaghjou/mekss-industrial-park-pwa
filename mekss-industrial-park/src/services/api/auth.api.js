import apiClient from './base.api';

export const authApi = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  logout: (refreshToken) => apiClient.post('/auth/logout', { refreshToken }),
  sendOtp: (data) => apiClient.post('/auth/otp/send', data),
  verifyOtp: (data) => apiClient.post('/auth/otp/verify', data),
  refreshToken: (data) => apiClient.post('/auth/refresh', data),
  getProfile: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/me', data),
  forgotPassword: (data) => apiClient.post('/auth/password/forgot', data),
  resetPassword: (data) => apiClient.post('/auth/password/reset', data),
  changePassword: (data) => apiClient.post('/auth/change-password', data),
};
