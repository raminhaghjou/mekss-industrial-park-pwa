import apiClient from './base.api';
import { invoiceItemLabel, invoiceStatusLabels } from '../../constants/persianLabels';
import { escapeHtml, formatFaDate, formatFaMoney, printHtml } from '../../utils/printHtml';

export const invoiceApi = {
  getInvoices: (params) => apiClient.get('/invoices', { params }),
  getInvoicePdf: (id) => apiClient.get(`/invoices/${id}/pdf`),
  createInvoice: (data) => apiClient.post('/invoices', data),
  updateInvoice: (id, data) => apiClient.put(`/invoices/${id}`, data),
  startPayment: (id, idempotencyKey) => apiClient.post(`/invoices/${id}/pay`, {}, { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} }),
  confirmPayment: (id) => apiClient.post(`/invoices/${id}/confirm-payment`),
  getAdjustments: (id) => apiClient.get(`/invoices/${id}/adjustments`),
  discount: (id, data) => apiClient.post(`/invoices/${id}/discount`, data),
  splitInstallments: (id, data) => apiClient.post(`/invoices/${id}/installments`, data),
  settle: (id, data) => apiClient.post(`/invoices/${id}/settle`, data),
  extendDue: (id, data) => apiClient.post(`/invoices/${id}/extend-due`, data),
  downloadImportTemplate: (params) => apiClient.get('/invoices/import/template', { params, responseType: 'blob' }),
  importInvoices: (file, /** @type {{ dryRun?: boolean, target?: string }} */ { dryRun, target } = { dryRun: true }) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post('/invoices/import', form, { params: { dryRun: dryRun ? 'true' : 'false', ...(target ? { target } : {}) }, timeout: 180000 });
  },
};

/** Printable invoice (browser print dialog → "Save as PDF"), including line items. */
export const printInvoicePayload = (invoice) => {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const recipient = invoice?.factory?.name || invoice?.park?.name || '—';
  const row = (label, value) => `<div class="row"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
  const itemsHtml = items.length
    ? `<h2>ردیف‌های قبض</h2><table><thead><tr><th>#</th><th>شرح</th><th>مبلغ (ریال)</th></tr></thead><tbody>${
      items.map((item, index) => `<tr><td>${formatFaMoney(index + 1)}</td><td>${escapeHtml(invoiceItemLabel(item))}</td><td>${formatFaMoney(item.amount)}</td></tr>`).join('')
    }</tbody></table>`
    : '';
  const discount = Number(invoice?.discountAmount || 0);
  const tax = Number(invoice?.taxAmount || 0);
  const bodyHtml = `
    <div class="header">
      <div><div class="brand">MEKSS Industrial Park</div><h1>صورتحساب ${escapeHtml(invoice?.invoiceNumber || '')}</h1></div>
      <div class="muted">${escapeHtml(formatFaDate(new Date()))}</div>
    </div>
    ${row('واحد / شهرک', escapeHtml(recipient))}
    ${invoice?.factory?.nationalId ? row('شناسه ملی', `<span class="ltr">${escapeHtml(invoice.factory.nationalId)}</span>`) : ''}
    ${row('شرح', escapeHtml(invoice?.description || '—'))}
    ${invoice?.installmentNo ? row('شماره قسط', escapeHtml(formatFaMoney(invoice.installmentNo))) : ''}
    ${row('تاریخ صدور', escapeHtml(formatFaDate(invoice?.issueDate)))}
    ${row('مهلت پرداخت', escapeHtml(formatFaDate(invoice?.dueDate)))}
    ${itemsHtml}
    ${row('مبلغ پایه', `${formatFaMoney(invoice?.amount)} ریال`)}
    ${tax ? row('مالیات', `${formatFaMoney(tax)} ریال`) : ''}
    ${discount ? row('تخفیف', `${formatFaMoney(discount)}- ریال`) : ''}
    ${row('جمع خالص', `${formatFaMoney(invoice?.totalAmount)} ریال`)}
    ${row(`جریمه تأخیر${invoice?.lateDays ? ` (${formatFaMoney(invoice.lateDays)} روز)` : ''}`, `${formatFaMoney(invoice?.latePenaltyAmount)} ریال`)}
    <div class="row total"><span>قابل پرداخت</span><strong>${formatFaMoney(invoice?.payableAmount ?? invoice?.totalAmount)} ریال</strong></div>
    ${row('وضعیت', escapeHtml(invoiceStatusLabels[invoice?.status] || invoice?.status || '—'))}
    <div class="footer">سامانه مدیریت شهرک صنعتی مکس</div>`;
  return printHtml({ title: `قبض ${invoice?.invoiceNumber || ''}`.trim(), bodyHtml });
};
