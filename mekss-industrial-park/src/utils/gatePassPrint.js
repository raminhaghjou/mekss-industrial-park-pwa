import QRCode from 'qrcode';
import {
  cargoTypeLabels,
  gatePassStatusLabels,
  labelFor,
  vehicleTypeLabels,
} from '../constants/persianLabels';
import { displayIranLicensePlate } from './iranLicensePlate';
import { escapeHtml, formatFaDateTime, printHtml } from './printHtml';

export const GATE_PASS_PRINT_FORMATS = {
  a5: { label: 'پرینت A5' },
  thermal: { label: 'پرینت حرارتی ۸۰ میلی‌متری' },
};

/** Short, human-readable reference shown next to the QR (the QR itself carries the full token). */
export const gatePassNumber = (pass) => String(pass?.id || '').slice(-8).toUpperCase() || '—';

/** The QR encodes the raw `qrCode` token, which the guard scanner resolves via `gate-passes/lookup`. */
export const gatePassQrDataUrl = async (qrCode, width = 360) => {
  if (!qrCode) return '';
  return QRCode.toDataURL(String(qrCode), { errorCorrectionLevel: 'M', margin: 1, width });
};

export const gatePassPrintRows = (pass) => [
  ['شماره برگ', gatePassNumber(pass)],
  ['واحد صنعتی', pass?.factory?.name || '—'],
  ['نام راننده', pass?.driverName || '—'],
  ['کد ملی راننده', pass?.driverNationalId || '—'],
  ['تلفن راننده', pass?.driverPhone || '—'],
  ['پلاک', displayIranLicensePlate(pass?.licensePlate) || '—'],
  ['نوع خودرو', labelFor(vehicleTypeLabels, pass?.vehicleType) || '—'],
  ['نوع بار', labelFor(cargoTypeLabels, pass?.cargoType) || '—'],
  ['شرح بار', pass?.cargoDescription || '—'],
  ['تاریخ و ساعت خروج', formatFaDateTime(pass?.exitDate)],
  ['تاریخ صدور', formatFaDateTime(pass?.createdAt)],
  ['وضعیت', labelFor(gatePassStatusLabels, pass?.status) || '—'],
];

const PRINT_CSS = {
  a5: `
    @page { size: A5 portrait; margin: 8mm; }
    body { padding: 0; font-size: 12px; }
    .pass { max-width: 132mm; margin: 0 auto; }
    .qr { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 10px 0; }
    .qr img { width: 46mm; height: 46mm; }
  `,
  thermal: `
    /* No @page size: "80mm auto" is invalid CSS and a fixed height feeds blank paper on roll printers;
       the 80mm printer's own paper size defines the page and the content is 72mm wide. */
    @page { margin: 3mm; }
    body { padding: 0; font-size: 11px; line-height: 1.6; }
    .pass { width: 72mm; margin: 0 auto; }
    .header { flex-direction: column; align-items: center; text-align: center; border-bottom-width: 2px; }
    .qr { display: flex; flex-direction: column; align-items: center; gap: 2px; margin: 6px 0; }
    .qr img { width: 52mm; height: 52mm; }
    table { font-size: 10.5px; }
    th, td { padding: 3px 4px; }
    th { width: 26mm; }
  `,
};

export const buildGatePassPrintBody = (pass, qrDataUrl) => {
  const rows = gatePassPrintRows(pass)
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');
  const qr = qrDataUrl
    ? `<div class="qr"><img src="${escapeHtml(qrDataUrl)}" alt="QR" /><span class="muted ltr">${escapeHtml(gatePassNumber(pass))}</span></div>`
    : '<p class="muted">کد QR برای این برگ ثبت نشده است؛ نگهبان می‌تواند با پلاک یا شماره برگ جستجو کند.</p>';
  return `<div class="pass">
    <div class="header"><div><h1>برگ خروج کالا</h1><div class="muted">${escapeHtml(pass?.factory?.name || '')}</div></div><div class="brand">MEKSS</div></div>
    ${qr}
    <table>${rows}</table>
    <div class="footer">این برگ را هنگام خروج به نگهبان ارائه دهید تا کد QR آن اسکن شود.</div>
  </div>`;
};

/** Resolves true when the print dialog opened, false when it fell back to downloading the HTML. */
export const printGatePass = async (pass, format = 'a5') => {
  const qrDataUrl = await gatePassQrDataUrl(pass?.qrCode);
  return printHtml({
    title: `برگ خروج ${gatePassNumber(pass)}`,
    css: PRINT_CSS[format] || PRINT_CSS.a5,
    bodyHtml: buildGatePassPrintBody(pass, qrDataUrl),
  });
};
