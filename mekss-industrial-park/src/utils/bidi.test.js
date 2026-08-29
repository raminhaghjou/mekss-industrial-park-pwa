import { describe, expect, it } from 'vitest';
import { isolateLtr } from './bidi';

describe('isolateLtr', () => {
  it('wraps a value with Unicode LTR isolate marks and sets dir=ltr', () => {
    const result = isolateLtr('09120000000');
    expect(result.dir).toBe('ltr');
    expect(result.children).toBe('\u206609120000000\u2069');
  });

  it('renders an em dash placeholder for an empty value without isolate marks', () => {
    expect(isolateLtr(null)).toEqual({ dir: 'ltr', children: '—' });
    expect(isolateLtr('')).toEqual({ dir: 'ltr', children: '—' });
  });
});
