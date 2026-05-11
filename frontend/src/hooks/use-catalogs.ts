'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCatalogs,
  getCatalog,
  replaceCatalogItems,
  addCatalogItem,
  disableCatalogItem,
  type ApiClient,
  type Catalog,
  type ReplaceCatalogItemsBody,
  type CreateCatalogItemBody,
} from '@/lib/api';

/** Fetches all catalogs. Cached for 5 minutes — catalogs rarely change. */
export function useCatalogs(client: ApiClient) {
  return useQuery<Catalog[]>({
    queryKey: ['catalogs'],
    queryFn: () => getCatalogs(client),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Fetches a single catalog by code. */
export function useCatalog(client: ApiClient, code: string) {
  return useQuery<Catalog>({
    queryKey: ['catalogs', code],
    queryFn: () => getCatalog(client, code),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: !!code,
  });
}

/** Bulk-replace a catalog's items array. */
export function useReplaceCatalogItems(client: ApiClient, code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReplaceCatalogItemsBody & { ifMatch?: string }) =>
      replaceCatalogItems(client, code, { items: body.items }, body.ifMatch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs'] });
    },
  });
}

/** Append a new item to a catalog. */
export function useAddCatalogItem(client: ApiClient, code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCatalogItemBody) => addCatalogItem(client, code, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs'] });
    },
  });
}

/** Soft-disable a catalog item. */
export function useDisableCatalogItem(client: ApiClient, code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: string) => disableCatalogItem(client, code, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs'] });
    },
  });
}
