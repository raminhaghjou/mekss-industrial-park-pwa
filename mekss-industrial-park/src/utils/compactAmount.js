const COMPACT_UNITS = [
  [1e12, 'هزار میلیارد'],
  [1e9, 'میلیارد'],
  [1e6, 'میلیون'],
];

/** `12_500_000_000` → `۱۲٫۵ میلیارد`; returns null below one million. */
export const compactFaAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const unit = COMPACT_UNITS.find(([size]) => Math.abs(value) >= size);
  if (!unit) return null;
  const scaled = value / unit[0];
  return `${scaled.toLocaleString('fa-IR', { maximumFractionDigits: Math.abs(scaled) >= 100 ? 0 : 1 })} ${unit[1]}`;
};
