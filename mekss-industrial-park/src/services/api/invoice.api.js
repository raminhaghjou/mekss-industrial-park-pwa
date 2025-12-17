import apiClient from './base.api';

export const invoiceApi = {
  // Invoice management
  getInvoices: (params) => apiClient.get('/invoices', { params }),
  getInvoice: (id) => apiClient.get(`/invoices/${id}`),
  createInvoice: (data) => apiClient.post('/invoices', data),
  updateInvoice: (id, data) => apiClient.put(`/invoices/${id}`, data),
  deleteInvoice: (id) => apiClient.delete(`/invoices/${id}`),
  
  // Invoice actions
  payInvoice: (id, data) => apiClient.post(`/invoices/${id}/pay`, data),
  cancelInvoice: (id, data) => apiClient.post(`/invoices/${id}/cancel`, data),
  
  // Invoice items
  getInvoiceItems: (invoiceId) => apiClient.get(`/invoices/${invoiceId}/items`),
  addInvoiceItem: (invoiceId, data) => apiClient.post(`/invoices/${invoiceId}/items`, data),
  updateInvoiceItem: (invoiceId, itemId, data) => 
    apiClient.put(`/invoices/${invoiceId}/items/${itemId}`, data),
  deleteInvoiceItem: (invoiceId, itemId) => 
    apiClient.delete(`/invoices/${invoiceId}/items/${itemId}`),
  
  // Invoice statistics
  getInvoiceStats: (params) => apiClient.get('/invoices/stats', { params }),
  getInvoiceAnalytics: (params) => apiClient.get('/invoices/analytics', { params }),
};