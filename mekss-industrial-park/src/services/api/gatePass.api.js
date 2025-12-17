import apiClient from './base.api';

export const gatePassApi = {
  // Gate pass management
  getGatePasses: (params) => apiClient.get('/gate-passes', { params }),
  getGatePass: (id) => apiClient.get(`/gate-passes/${id}`),
  createGatePass: (data) => apiClient.post('/gate-passes', data),
  updateGatePass: (id, data) => apiClient.put(`/gate-passes/${id}`, data),
  deleteGatePass: (id) => apiClient.delete(`/gate-passes/${id}`),
  
  // Gate pass actions
  approveGatePass: (id, data) => apiClient.post(`/gate-passes/${id}/approve`, data),
  rejectGatePass: (id, data) => apiClient.post(`/gate-passes/${id}/reject`, data),
  verifyGatePass: (id, data) => apiClient.post(`/gate-passes/${id}/verify`, data),
  useGatePass: (id) => apiClient.post(`/gate-passes/${id}/use`),  
  
  // Gate pass statistics
  getGatePassStats: (params) => apiClient.get('/gate-passes/stats', { params }),
  getGatePassAnalytics: (params) => apiClient.get('/gate-passes/analytics', { params }),
  
  // QR Code
  generateQrCode: (id) => apiClient.get(`/gate-passes/${id}/qr`),  
};