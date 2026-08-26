import apiClient from './base.api';

export const invoiceApi = {
  // Invoice management
  getInvoices: (params) => apiClient.get('/invoices', { params }),
  createInvoice: (data) => apiClient.post('/invoices', data),

  // Payment
  startPayment: (id, idempotencyKey) => apiClient.post(`/invoices/${id}/pay`, {}, { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} }),
};