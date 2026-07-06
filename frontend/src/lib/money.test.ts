import { describe, expect, it } from 'vitest';
import { fromMoneyCents, subtractMoney, sumMoney, toMoneyCents } from './money';

describe('money helpers', () => {
  it('converts to cents with decimal rounding', () => {
    expect(toMoneyCents(10.555)).toBe(1056);
    expect(fromMoneyCents(1056)).toBe(10.56);
  });

  it('sums money values without float drift', () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney([10.25, 5.3])).toBe(15.55);
  });

  it('subtracts money using cent precision', () => {
    expect(subtractMoney(100, 33.33)).toBe(66.67);
  });
});
