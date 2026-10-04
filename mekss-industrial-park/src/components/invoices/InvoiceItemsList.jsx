import { invoiceItemLabel } from '../../constants/persianLabels';

const money = (value) => Number(value || 0).toLocaleString('fa-IR');

/**
 * Line items of an invoice. Legacy invoices have no items and render nothing,
 * so callers keep showing their description/amount as before.
 * @param {{ items?: Array<{ id?: string, type: string, title?: string | null, amount: number | string }>, compact?: boolean }} props
 */
export const InvoiceItemsList = ({ items, compact = false }) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (compact) {
    return (
      <p className="mt-1 text-[11px] leading-5 text-foreground-500" data-testid="invoice-items-compact">
        {items.map((item) => `${invoiceItemLabel(item)}: ${money(item.amount)}`).join(' · ')}
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-default-100 rounded-2xl border border-default-200 text-sm dark:divide-white/5 dark:border-white/10" data-testid="invoice-items">
      {items.map((item, index) => (
        <li key={item.id || `${item.type}-${index}`} className={`flex items-center justify-between gap-3 px-3 py-2 ${item.type === 'CARRIED_PENALTY' ? 'text-danger' : ''}`}>
          <span>{invoiceItemLabel(item)}</span>
          <span dir="ltr" className="font-medium">{money(item.amount)} ریال</span>
        </li>
      ))}
    </ul>
  );
};

export default InvoiceItemsList;
