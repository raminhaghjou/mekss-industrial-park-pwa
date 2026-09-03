import apiClient from './base.api';

export const gatePassApi = {
  getGatePasses: (params) => apiClient.get('/gate-passes', { params }),
  getGatePass: (id) => apiClient.get(`/gate-passes/${id}`),
  getByQr: (code) => apiClient.get(`/gate-passes/by-qr/${encodeURIComponent(code)}`),
  createGatePass: (data) => apiClient.post('/gate-passes', data),
  approveGatePass: (id) => apiClient.post(`/gate-passes/${id}/approve`),
  rejectGatePass: (id, data) => apiClient.post(`/gate-passes/${id}/reject`, data),
  verifyGatePass: (id) => apiClient.post(`/gate-passes/${id}/verify`),
  denyGatePassExit: (id, data) => apiClient.post(`/gate-passes/${id}/deny`, data),
};
