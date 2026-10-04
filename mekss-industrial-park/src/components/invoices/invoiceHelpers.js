/** Splits an Excel import preview into valid and invalid rows. */
export const summarizeImportPreview = (preview) => {
  const rows = Array.isArray(preview?.rows) ? preview.rows : [];
  const invalid = rows.filter((row) => Array.isArray(row.errors) && row.errors.length > 0);
  return {
    rows,
    invalid,
    validCount: rows.length - invalid.length,
    canCommit: rows.length > 0 && invalid.length === 0 && !preview?.alreadyImported,
  };
};

export const INVOICE_OPERATION_TITLES = {
  edit: 'ویرایش قبض',
  discount: 'تخفیف روی مبلغ پایه',
  installments: 'تقسیط قبض',
  settle: 'تسویه دستی',
  extend: 'تمدید مهلت پرداخت',
  history: 'تاریخچهٔ تغییرات قبض',
};

/** Equal split preview in whole Rials (remainder on the last one), mirroring the server. */
export const previewEvenSplit = (total, count) => {
  const n = Math.floor(Number(count));
  const sum = Math.round(Number(total || 0) * 100) / 100;
  if (!Number.isFinite(n) || n < 2 || !(sum > 0)) return [];
  const base = Math.floor(sum / n);
  const amounts = Array.from({ length: n }, () => base);
  amounts[n - 1] = Math.round((sum - base * (n - 1)) * 100) / 100;
  return amounts;
};
