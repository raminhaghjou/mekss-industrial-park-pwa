import apiClient from './base.api';

export const factoryApi = {
  getFactories: (params) => apiClient.get('/factories', { params }),
  /** The owner's full factory list for the switcher; must not be narrowed by the active-factory header. */
  getOwnedFactories: () => apiClient.get('/factories', /** @type {any} */ ({ skipActiveFactory: true })),
  getManagedFactories: (params) => apiClient.get('/factories/managed', { params }),
  getManagedFactory: (id) => apiClient.get(`/factories/managed/${id}`),
  getManagementScope: () => apiClient.get('/factories/management-scope'),
  createFactory: (data) => apiClient.post('/factories', data),
  registerFactory: (data) => apiClient.post('/factories/register', data),
  updateFactory: (id, data) => apiClient.put(`/factories/${id}`, data),
  approvePendingChanges: (id) => apiClient.post(`/factories/${id}/pending-changes/approve`),
  rejectPendingChanges: (id) => apiClient.post(`/factories/${id}/pending-changes/reject`),
  approveFactory: (id) => apiClient.post(`/factories/${id}/approve`),
  rejectFactory: (id, reason) => apiClient.post(`/factories/${id}/reject`, { reason }),
  suspendFactory: (id, reason) => apiClient.post(`/factories/${id}/suspend`, { reason }),
  unsuspendFactory: (id) => apiClient.post(`/factories/${id}/unsuspend`),
  getStaff: (id) => apiClient.get(`/factories/${id}/staff`),
  createStaff: (id, data) => apiClient.post(`/factories/${id}/staff`, data),
  updateStaff: (id, userId, data) => apiClient.patch(`/factories/${id}/staff/${userId}`, data),
  getWallet: (id) => apiClient.get(`/factories/${id}/wallet`),
  topUpWallet: (id, amount) => apiClient.post(`/factories/${id}/wallet/top-up`, { amount }),
  startWalletPayment: (id, amount) => apiClient.post(`/factories/${id}/wallet/pay`, { amount }),
};
