import apiClient from './base.api';

export const factoryApi = {
  // Factory management
  getFactories: (params) => apiClient.get('/factories', { params }),
  getFactory: (id) => apiClient.get(`/factories/${id}`),
  createFactory: (data) => apiClient.post('/factories', data),
  updateFactory: (id, data) => apiClient.put(`/factories/${id}`, data),
  deleteFactory: (id) => apiClient.delete(`/factories/${id}`),
  
  // Factory employees
  getFactoryEmployees: (factoryId, params) => 
    apiClient.get(`/factories/${factoryId}/employees`, { params }),
  createFactoryEmployee: (factoryId, data) => 
    apiClient.post(`/factories/${factoryId}/employees`, data),
  updateFactoryEmployee: (factoryId, employeeId, data) => 
    apiClient.put(`/factories/${factoryId}/employees/${employeeId}`, data),
  deleteFactoryEmployee: (factoryId, employeeId) => 
    apiClient.delete(`/factories/${factoryId}/employees/${employeeId}`),
  
  // Factory statistics
  getFactoryStats: (factoryId) => apiClient.get(`/factories/${factoryId}/stats`),  
  getFactoryAnalytics: (factoryId, params) => 
    apiClient.get(`/factories/${factoryId}/analytics`, { params }),
};