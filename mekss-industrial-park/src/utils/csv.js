/**
 * One quoted CSV cell. Text starting with = + - @ (or a tab/CR) is prefixed with `'` so
 * spreadsheet apps show it as text instead of running it as a formula (CSV injection).
 */
export const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const csvLine = (cells) => cells.map(csvCell).join(',');
