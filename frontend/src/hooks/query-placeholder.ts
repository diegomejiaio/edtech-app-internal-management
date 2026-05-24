'use client';

type ListQueryParams = object | undefined;
type PreviousQuery = { queryKey: readonly unknown[] } | undefined;

function stripPagination(params: ListQueryParams): Record<string, unknown> {
  const comparable: Record<string, unknown> = {};

  for (const [key, value] of Object.entries((params ?? {}) as Record<string, unknown>)) {
    if (key !== 'limit' && key !== 'offset') {
      comparable[key] = value;
    }
  }

  return comparable;
}

function stableStringify(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {}),
  );
}

function numberParam(params: ListQueryParams, key: 'limit' | 'offset'): number {
  const value = (params as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'number' ? value : 0;
}

function sameNonPaginationParams(previousParams: ListQueryParams, nextParams: ListQueryParams): boolean {
  return stableStringify(stripPagination(previousParams)) === stableStringify(stripPagination(nextParams));
}

export function keepPreviousWhenLoadingMore<T>(nextParams: ListQueryParams) {
  return (previousData: T | undefined, previousQuery: PreviousQuery): T | undefined => {
    const previousParams = previousQuery?.queryKey[1] as ListQueryParams;

    if (!sameNonPaginationParams(previousParams, nextParams)) {
      return undefined;
    }

    const previousLimit = numberParam(previousParams, 'limit');
    const nextLimit = numberParam(nextParams, 'limit');
    const previousOffset = numberParam(previousParams, 'offset');
    const nextOffset = numberParam(nextParams, 'offset');

    return nextOffset === previousOffset && nextLimit >= previousLimit ? previousData : undefined;
  };
}
