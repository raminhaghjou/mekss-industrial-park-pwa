import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, post: mocks.post },
}));

const { invoiceApi } = await import('./invoice.api');

describe('invoice API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists and creates invoices against the real management routes', () => {
    const params = { factoryId: 'factory-1' };
    const createPayload = { factoryId: 'factory-1', description: 'شرح', amount: 1000, dueDate: '2027-01-01' };

    invoiceApi.getInvoices(params);
    invoiceApi.createInvoice(createPayload);

    expect(mocks.get).toHaveBeenCalledWith('/invoices', { params });
    expect(mocks.post).toHaveBeenCalledWith('/invoices', createPayload);
  });

  it('starts payment with an idempotency-key header only when a key is provided', () => {
    invoiceApi.startPayment('invoice-1', 'retry-key-1');
    invoiceApi.startPayment('invoice-2');

    expect(mocks.post).toHaveBeenNthCalledWith(1, '/invoices/invoice-1/pay', {}, { headers: { 'Idempotency-Key': 'retry-key-1' } });
    expect(mocks.post).toHaveBeenNthCalledWith(2, '/invoices/invoice-2/pay', {}, { headers: {} });
  });
});
