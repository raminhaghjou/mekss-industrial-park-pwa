import apiClient from './base.api';

export const analyticsApi = {
  // Dashboard
  getDashboardData: (params) => apiClient.get('/analytics/dashboard', { params }),
  
  // Factory analytics
  getFactoryAnalytics: (params) => apiClient.get('/analytics/factories', { params }),
  
  // Gate pass analytics
  getGatePassAnalytics: (params) => apiClient.get('/analytics/gate-passes', { params }),
  
  // Invoice analytics
  getInvoiceAnalytics: (params) => apiClient.get('/analytics/invoices', { params }),
  
  // Request analytics
  getRequestAnalytics: (params) => apiClient.get('/analytics/requests', { params }),
  
  // Emergency analytics
  getEmergencyAnalytics: (params) => apiClient.get('/analytics/emergencies', { params }),
  
  // Announcement analytics
  getAnnouncementAnalytics: (params) => apiClient.get('/analytics/announcements', { params }),
  
  // Advertisement analytics
  getAdvertisementAnalytics: (params) => apiClient.get('/analytics/advertisements', { params }),
  
  // User analytics
  getUserAnalytics: (params) => apiClient.get('/analytics/users', { params }),
  
  // Recent activity
  getRecentActivity: (params) => apiClient.get('/analytics/activity', { params }),
  
  // Reports
  generateReport: (data) => apiClient.post('/analytics/reports', data),
  getReports: (params) => apiClient.get('/analytics/reports', { params }),
  getReport: (id) => apiClient.get(`/analytics/reports/${id}`),
  downloadReport: (id) => apiClient.get(`/analytics/reports/${id}/download`, {
    responseType: 'blob',
  }),
};