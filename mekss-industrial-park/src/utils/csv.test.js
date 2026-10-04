import { describe, expect, it } from 'vitest';
import { csvCell, csvLine } from './csv';

describe('csv', () => {
  it('quotes cells and escapes embedded quotes', () => {
    expect(csvCell('علی "رضا"')).toBe('"علی ""رضا"""');
    expect(csvCell(null)).toBe('""');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+98912')).toBe('"\'+98912"');
    expect(csvCell('-1')).toBe('"\'-1"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvLine(['a', '=b'])).toBe('"a","\'=b"');
  });
});
