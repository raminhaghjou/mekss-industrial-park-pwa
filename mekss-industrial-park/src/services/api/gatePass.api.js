import apiClient from './base.api';

export const gatePassApi = {
  // Gate pass management
  getGatePasses: (params) => apiClient.get('/gate-passes', { params }),
  getGatePass: (id) => apiClient.get(`/gate-passes/${id}`),
  createGatePass: (data) => apiClient.post('/gate-passes', data),

  // Gate pass actions
  approveGatePass: (id) => apiClient.post(`/gate-passes/${id}/approve`),
  rejectGatePass: (id, data) => apiClient.post(`/gate-passes/${id}/reject`, data),
  verifyGatePass: (id) => apiClient.post(`/gate-passes/${id}/verify`),
  denyGatePassExit: (id, data) => apiClient.post(`/gate-passes/${id}/deny`, data),
};