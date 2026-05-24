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
): T[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export function getInfiniteTotal<T>(
  data: InfiniteData<PaginatedResponse<T>> | undefined,
): number {
  const pages = data?.pages;
  return pages?.[pages.length - 1]?.total ?? 0;
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
