import type { InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { PaginatedResponse } from '@/lib/api';
import { getInfiniteTotalAmount } from './infinite-list';

interface PaymentRow {
  amount: number;
}

function buildInfiniteData(
  pages: PaginatedResponse<PaymentRow>[],
): InfiniteData<PaginatedResponse<PaymentRow>> {
  return {
    pages,
    pageParams: pages.map((_, index) => index),
  };
}

describe('getInfiniteTotalAmount', () => {
  it('uses backend totalAmount when available', () => {
    const data = buildInfiniteData([
      {
        items: [{ amount: 10 }, { amount: 20 }],
        total: 3,
        limit: 25,
        offset: 0,
        totalAmount: 180.75,
      },
      {
        items: [{ amount: 30 }],
        total: 3,
        limit: 25,
        offset: 25,
        totalAmount: 180.75,
      },
    ]);

    const totalAmount = getInfiniteTotalAmount(data, (row) => row.amount);
    expect(totalAmount).toBe(180.75);
  });

  it('falls back to summing loaded rows when totalAmount is missing', () => {
    const data = buildInfiniteData([
      {
        items: [{ amount: 10.25 }, { amount: 5.30 }],
        total: 2,
        limit: 25,
        offset: 0,
      },
    ]);

    const totalAmount = getInfiniteTotalAmount(data, (row) => row.amount);
    expect(totalAmount).toBeCloseTo(15.55, 2);
  });
});
