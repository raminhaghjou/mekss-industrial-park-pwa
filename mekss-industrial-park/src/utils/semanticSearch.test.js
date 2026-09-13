import { describe, expect, it } from 'vitest';
import {
  expandSearchQuery,
  matchesSemantic,
  normalizeText,
  semanticFilter,
  scoreSemanticMatch,
} from './semanticSearch';

describe('semanticSearch', () => {
  it('normalizes Persian yeh/keh and digits', () => {
    expect(normalizeText('كارخانه ۱۲')).toBe('کارخانه 12');
    expect(normalizeText('يک')).toBe('یک');
  });

  it('matches synonyms conceptually', () => {
    expect(matchesSemantic('فروشگاه', 'شاپ آنلاین فولاد')).toBe(true);
    expect(matchesSemantic('کارخانه', 'واحد صنعتی آذر')).toBe(true);
    expect(matchesSemantic('شهرک', 'پارک فناوری پردیس')).toBe(true);
  });

  it('requires every query token to match', () => {
    expect(scoreSemanticMatch('فولاد تهران', 'فولاد مبارکه اصفهان')).toBe(0);
    expect(scoreSemanticMatch('فولاد اصفهان', 'فولاد مبارکه اصفهان')).toBeGreaterThan(0);
  });

  it('filters and ranks list items', () => {
    const items = [
      { name: 'شاپ آنلاین آذر', city: 'تبریز' },
      { name: 'کارگاه چوب شمال', city: 'رشت' },
      { name: 'فروشگاه قطعات ماشین', city: 'کرج' },
    ];
    const result = semanticFilter(items, 'فروشگاه', (item) => [item.name, item.city]);
    expect(result.map((i) => i.name)).toEqual([
      'فروشگاه قطعات ماشین',
      'شاپ آنلاین آذر',
    ]);
  });

  it('expands query for API search params', () => {
    const expanded = expandSearchQuery('فروشگاه');
    expect(expanded.includes('فروشگاه')).toBe(true);
    expect(expanded.includes('شاپ') || expanded.includes('shop')).toBe(true);
  });
});
