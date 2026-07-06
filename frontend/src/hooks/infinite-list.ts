'use client';

import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/lib/api';

export function getNextOffset<T>(
  lastPage: PaginatedResponse<T>,
  pages: PaginatedResponse<T>[],
): number | undefined {
  const loadedCount = pages.reduce((count, page) => count + page.items.length, 0);

  if (
    loadedCount >= lastPage.total ||
    lastPage.items.length === 0 ||
    lastPage.items.length < lastPage.limit
  ) {
    return undefined;
  }

  return loadedCount;
}

export function flattenInfiniteItems<T>(
  data: InfiniteData<PaginatedResponse<T>> | undefined,
  options?: {
    /** Extract the value to sort by (e.g., `(s) => s.startDate`). */
    sortBy?: (item: T) => string | number | null | undefined;
    /** Sort direction. Defaults to `'desc'`. */
    sortDir?: 'asc' | 'desc';
  },
): T[] {
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const sortBy = options?.sortBy;
  if (!sortBy) return items;

  const dir = options?.sortDir ?? 'desc';
  const factor = dir === 'desc' ? -1 : 1;

  return items.slice().sort((a, b) => {
    const av = sortBy(a);
    const bv = sortBy(b);
    // Null/undefined sort to the end regardless of direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}

export function getInfiniteTotal<T>(
  data: InfiniteData<PaginatedResponse<T>> | undefined,
): number {
  const pages = data?.pages;
  return pages?.[pages.length - 1]?.total ?? 0;
}

export function getInfiniteTotalAmount<T>(
  data: InfiniteData<PaginatedResponse<T>> | undefined,
  amountSelector: (item: T) => number,
): number {
  const pages = data?.pages;
  if (!pages || pages.length === 0) return 0;

  const backendTotalAmount = pages[pages.length - 1]?.totalAmount;
  if (typeof backendTotalAmount === 'number') {
    return backendTotalAmount;
  }

  return pages
    .flatMap((page) => page.items)
    .reduce((sum, item) => sum + amountSelector(item), 0);
}

export function keepFirstInfinitePage(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
): void {
  queryClient.setQueriesData<InfiniteData<PaginatedResponse<unknown>>>({ queryKey }, (data) => {
    if (!data || data.pages.length <= 1) {
      return data;
    }

    return {
      pages: data.pages.slice(0, 1),
      pageParams: data.pageParams.slice(0, 1),
    };
  });
}
