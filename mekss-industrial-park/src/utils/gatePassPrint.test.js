import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toDataURL: vi.fn(),
  printHtml: vi.fn(),
}));

vi.mock('qrcode', () => ({ default: { toDataURL: mocks.toDataURL } }));
vi.mock('./printHtml', async (importOriginal) => ({
  ...(await importOriginal()),
  printHtml: mocks.printHtml,
}));

const {
  buildGatePassPrintBody,
  gatePassNumber,
  gatePassPrintRows,
  gatePassQrDataUrl,
  printGatePass,
} = await import('./gatePassPrint');

const pass = {
  id: 'cmabcdef1234wxyz9876',
  qrCode: 'MEKSS-0123456789abcdef',
  factory: { name: 'فولاد <ایران>' },
  driverName: 'علی رضایی',
  driverNationalId: '0012345678',
  driverPhone: '09120000000',
  licensePlate: '12ب34567',
  vehicleType: 'KHAVAR',
  cargoType: 'FINISHED_GOODS',
  cargoDescription: 'ورق',
  exitDate: '2026-10-04T08:30:00.000Z',
  createdAt: '2026-10-04T07:00:00.000Z',
  status: 'PENDING',
};

describe('gate pass printing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toDataURL.mockResolvedValue('data:image/png;base64,QR');
    mocks.printHtml.mockResolvedValue(true);
  });

  it('uses the last 8 id characters as the human-readable number', () => {
    expect(gatePassNumber(pass)).toBe('WXYZ9876');
    expect(gatePassNumber({})).toBe('—');
  });

  it('lists Persian labels for vehicle, cargo and status', () => {
    const rows = Object.fromEntries(gatePassPrintRows(pass));
    expect(rows['نوع خودرو']).toBe('خاور');
    expect(rows['نوع بار']).toBe('محصول نهایی');
    expect(rows['وضعیت']).toBe('در انتظار');
    expect(rows['واحد صنعتی']).toBe('فولاد <ایران>');
  });

  it('encodes the raw qrCode token that the guard scanner looks up', async () => {
    await expect(gatePassQrDataUrl(pass.qrCode)).resolves.toBe('data:image/png;base64,QR');
    expect(mocks.toDataURL).toHaveBeenCalledWith('MEKSS-0123456789abcdef', expect.objectContaining({ errorCorrectionLevel: 'M' }));
    await expect(gatePassQrDataUrl(null)).resolves.toBe('');
  });

  it('escapes user data in the printable body and embeds the QR image', () => {
    const body = buildGatePassPrintBody(pass, 'data:image/png;base64,QR');
    expect(body).toContain('فولاد &lt;ایران&gt;');
    expect(body).not.toContain('<ایران>');
    expect(body).toContain('<img src="data:image/png;base64,QR"');
    expect(body).toContain('WXYZ9876');
  });

  it('explains how to find legacy passes without a QR code', () => {
    const body = buildGatePassPrintBody({ ...pass, qrCode: null }, '');
    expect(body).not.toContain('<img');
    expect(body).toContain('کد QR برای این برگ ثبت نشده است');
  });

  it('prints with the page size of the chosen format', async () => {
    await expect(printGatePass(pass, 'thermal')).resolves.toBe(true);
    expect(mocks.printHtml).toHaveBeenCalledWith(expect.objectContaining({
      title: 'برگ خروج WXYZ9876',
      css: expect.stringContaining('width: 72mm'),
    }));
    expect(mocks.printHtml.mock.calls[0][0].css).not.toMatch(/size:\s*80mm\s+auto/);

    await printGatePass(pass, 'a5');
    expect(mocks.printHtml).toHaveBeenLastCalledWith(expect.objectContaining({
      css: expect.stringContaining('size: A5 portrait'),
    }));
  });
});
