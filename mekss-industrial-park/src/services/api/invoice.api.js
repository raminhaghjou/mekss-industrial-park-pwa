import apiClient from './base.api';

export const invoiceApi = {
  getInvoices: (params) => apiClient.get('/invoices', { params }),
  getInvoicePdf: (id) => apiClient.get(`/invoices/${id}/pdf`),
  createInvoice: (data) => apiClient.post('/invoices', data),
  updateInvoice: (id, data) => apiClient.put(`/invoices/${id}`, data),
  startPayment: (id, idempotencyKey) => apiClient.post(`/invoices/${id}/pay`, {}, { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} }),
  confirmPayment: (id) => apiClient.post(`/invoices/${id}/confirm-payment`),
};

export const printInvoicePayload = (invoice) => {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!win) return;
  const amount = Number(invoice.payableAmount ?? invoice.totalAmount).toLocaleString('fa-IR');
  win.document.write(`<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"/><title>قبض ${invoice.invoiceNumber}</title>
    <style>body{font-family:Tahoma,sans-serif;padding:24px;line-height:1.8}h1{font-size:18px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:6px 0}@media print{button{display:none}}</style>
    </head><body>
    <h1>قبض شارژ مکص — ${invoice.invoiceNumber || ''}</h1>
    <div class="row"><span>واحد / شهرک</span><strong>${invoice.factory?.name || invoice.park?.name || '—'}</strong></div>
    <div class="row"><span>شرح</span><strong>${invoice.description || '—'}</strong></div>
    <div class="row"><span>تاریخ صدور</span><strong>${invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('fa-IR') : '—'}</strong></div>
    <div class="row"><span>سررسید</span><strong>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fa-IR') : '—'}</strong></div>
    <div class="row"><span>مبلغ پایه</span><strong>${Number(invoice.totalAmount).toLocaleString('fa-IR')} ریال</strong></div>
    <div class="row"><span>جریمه تأخیر</span><strong>${Number(invoice.latePenaltyAmount || 0).toLocaleString('fa-IR')} ریال</strong></div>
    <div class="row"><span>قابل پرداخت</span><strong>${amount} ریال</strong></div>
    <div class="row"><span>وضعیت</span><strong>${invoice.status || ''}</strong></div>
    <p style="margin-top:24px"><button onclick="window.print()">پرینت / ذخیره PDF</button></p>
    </body></html>`);
  win.document.close();
};
