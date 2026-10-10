import * as XLSX from 'xlsx';
import { saveBlob } from '../services/api/files.api';
import { escapeHtml, printHtml } from './printHtml';
import {
  cargoTypeLabels,
  labelFor,
  requestPriorityLabels,
  requestTypeLabels,
  vehicleTypeLabels,
} from '../constants/persianLabels';

const STATUS_FA = {
  PENDING: 'در انتظار',
  PAID: 'پرداخت شده',
  OVERDUE: 'سررسید گذشته',
  INSTALLMENTS: 'تقسیط‌شده',
  AWAITING_CONFIRMATION: 'در انتظار تأیید پرداخت',
  CANCELLED: 'لغو شده',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
  COMPLETED: 'تکمیل شده',
  EXPIRED: 'منقضی شده',
  VERIFIED: 'تایید نهایی',
  DENIED: 'رد خروج',
};

const TYPE_FA = {
  financial: 'مالی',
  gatepass: 'تردد / برگ خروج',
  requests: 'درخواست‌ها',
};

const formatFaDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('fa-IR-u-ca-persian');
  } catch {
    return String(value);
  }
};

const formatFaMoney = (value) =>
  Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: 0 });

function stamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${h}${min}`;
}

function reportTitle(data) {
  return `گزارش ${TYPE_FA[data.type] || data.type}`;
}

function summaryRows(data) {
  const rows = [
    ['نوع گزارش', TYPE_FA[data.type] || data.type],
    ['از تاریخ', data.from ? formatFaDate(data.from) : 'بدون محدودیت'],
    ['تا تاریخ', data.to ? formatFaDate(data.to) : 'بدون محدودیت'],
    ['زمان تولید', formatFaDate(data.generatedAt)],
    ['تعداد رکورد', String(data.count ?? 0)],
  ];
  if (data.type === 'financial') {
    rows.push(
      ['جمع کل مبلغ (ریال)', formatFaMoney(data.totalAmount)],
      ['مبلغ پرداخت‌شده (ریال)', formatFaMoney(data.paidAmount)],
      ['مبلغ پرداخت‌نشده (ریال)', formatFaMoney(data.unpaidAmount)],
    );
  }
  return rows;
}

function detailHeaders(type) {
  if (type === 'financial') {
    return ['شماره قبض', 'واحد صنعتی', 'توضیح', 'مبلغ', 'مالیات', 'جمع', 'وضعیت', 'تاریخ صدور', 'سررسید'];
  }
  if (type === 'gatepass') {
    return ['واحد صنعتی', 'راننده', 'پلاک', 'بار', 'وسیله', 'وضعیت', 'کد QR', 'تاریخ ایجاد', 'تایید خروج'];
  }
  return ['عنوان', 'نوع', 'واحد صنعتی', 'ایجادکننده', 'اولویت', 'وضعیت', 'تاریخ ایجاد'];
}

function detailRows(data) {
  const items = data.items || [];
  if (data.type === 'financial') {
    return items.map((item) => [
      item.invoiceNumber || item.id,
      item.factoryName || '—',
      item.description || '—',
      formatFaMoney(item.amount),
      formatFaMoney(item.taxAmount),
      formatFaMoney(item.totalAmount),
      STATUS_FA[item.status] || item.status,
      formatFaDate(item.issueDate),
      formatFaDate(item.dueDate),
    ]);
  }
  if (data.type === 'gatepass') {
    return items.map((item) => [
      item.factoryName || '—',
      item.driverName || '—',
      item.licensePlate || '—',
      labelFor(cargoTypeLabels, item.cargoType) || '—',
      labelFor(vehicleTypeLabels, item.vehicleType) || '—',
      STATUS_FA[item.status] || item.status,
      item.qrCode || '—',
      formatFaDate(item.createdAt),
      formatFaDate(item.verifiedAt),
    ]);
  }
  return items.map((item) => [
    item.title || '—',
    labelFor(requestTypeLabels, item.type) || '—',
    item.factoryName || '—',
    item.creatorName || '—',
    labelFor(requestPriorityLabels, item.priority) || '—',
    STATUS_FA[item.status] || item.status,
    formatFaDate(item.createdAt),
  ]);
}

function statusSheetRows(data) {
  return (data.byStatus || []).map((row) => [
    STATUS_FA[row.status] || row.status,
    String(row.count),
  ]);
}

/** Persian RTL report → print dialog (Save as PDF). */
export function exportReportPdf(data) {
  const title = reportTitle(data);
  const headers = detailHeaders(data.type);
  const rows = detailRows(data);
  const summary = summaryRows(data);
  const statusRows = statusSheetRows(data);

  const summaryHtml = summary
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  const statusHtml = statusRows.length
    ? `<h2>خلاصه وضعیت</h2><table><thead><tr><th>وضعیت</th><th>تعداد</th></tr></thead><tbody>${
      statusRows.map(([s, c]) => `<tr><td>${escapeHtml(s)}</td><td>${escapeHtml(c)}</td></tr>`).join('')
    }</tbody></table>`
    : '';
  const detailHtml = rows.length
    ? `<h2>جزئیات رکوردها</h2><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${
      rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    }</tbody></table>`
    : '<p class="empty">رکوردی برای بازه انتخاب‌شده یافت نشد.</p>';

  const css = `
    .hero {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 16px; padding-bottom: 18px; border-bottom: 3px solid var(--brand); margin-bottom: 22px;
    }
    .brand { font-size: 13px; font-weight: 700; color: var(--brand); }
    h1 { margin: 4px 0 0; font-size: 22px; }
    .meta { text-align: left; font-size: 12px; color: var(--muted); direction: ltr; }
    h2 { margin: 24px 0 10px; font-size: 15px; color: var(--brand); }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
    th, td { border: 1px solid var(--line); padding: 7px 8px; text-align: right; vertical-align: top; }
    th { background: #f0fdf4; color: #166534; font-weight: 700; }
    tr:nth-child(even) td { background: #f8fafc; }
    .empty { color: var(--muted); }
    .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }
    @page { size: A4 landscape; margin: 10mm; }
    @media print { body { padding: 0; } }
  `;

  const bodyHtml = `
  <div class="hero">
    <div>
      <div class="brand">MEKSS Industrial Park</div>
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="meta">${stamp()}</div>
  </div>
  <h2>خلاصه گزارش</h2>
  <table><tbody>${summaryHtml}</tbody></table>
  ${statusHtml}
  ${detailHtml}
  <div class="footer">تولیدشده توسط سامانه مدیریت شهرک صنعتی مکس · گزارش جامع</div>`;

  return printHtml({ title: `${title} ${stamp()}`, bodyHtml, css });
}

export function exportReportExcel(data) {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ['گزارش MEKSS', reportTitle(data)],
    ...summaryRows(data),
  ]);
  XLSX.utils.book_append_sheet(wb, summary, 'خلاصه');

  if ((data.byStatus || []).length) {
    const statusSheet = XLSX.utils.aoa_to_sheet([
      ['وضعیت', 'تعداد'],
      ...statusSheetRows(data),
    ]);
    XLSX.utils.book_append_sheet(wb, statusSheet, 'وضعیت‌ها');
  }

  const details = XLSX.utils.aoa_to_sheet([
    detailHeaders(data.type),
    ...detailRows(data),
  ]);
  XLSX.utils.book_append_sheet(wb, details, 'جزئیات');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `mekss-report-${data.type}-${stamp()}.xlsx`,
  );
}

export { TYPE_FA as reportTypeLabels, STATUS_FA as reportStatusLabels };
