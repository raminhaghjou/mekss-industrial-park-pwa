import apiClient from './base.api';

export const invoiceApi = {
  getInvoices: (params) => apiClient.get('/invoices', { params }),
  createInvoice: (data) => apiClient.post('/invoices', data),
  updateInvoice: (id, data) => apiClient.put(`/invoices/${id}`, data),
  startPayment: (id, idempotencyKey) => apiClient.post(`/invoices/${id}/pay`, {}, { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} }),
};
