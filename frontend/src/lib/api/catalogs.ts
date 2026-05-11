import type { BaseEntity } from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Known catalog codes seeded at install (see docs/01-domain-model.md §3.1). */
export type CatalogCode =
  | 'courses'
  | 'levels'
  | 'paymentMethods'
  | 'expenseCategories'
  | 'enrollmentStatuses'
  | 'scheduleStatuses'
  | 'weekdays'
  | 'studentSources';

/** A single item inside a catalog document. */
export interface CatalogItem {
  value: string;
  order: number;
  active: boolean;
}

/** Catalog document shape as stored in Cosmos (container `master`). */
export interface Catalog extends BaseEntity {
  type: 'catalog';
  code: string;
  items: CatalogItem[];
}

/** Body for `POST /catalogs/{code}/items`. */
export interface CreateCatalogItemBody {
  value: string;
  order?: number;
}

/** Body for `PUT /catalogs/{code}` (bulk replace items array). */
export interface ReplaceCatalogItemsBody {
  items: CatalogItem[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List all catalog documents (no pagination — ≤10 docs). */
export const getCatalogs = (client: ApiClient): Promise<Catalog[]> =>
  client.get<Catalog[]>('/catalogs');

/** Get a single catalog by its code. */
export const getCatalog = (client: ApiClient, code: string): Promise<Catalog> =>
  client.get<Catalog>(`/catalogs/${encodeURIComponent(code)}`);

/** Replace the entire items array of a catalog (bulk edit). */
export const replaceCatalogItems = (
  client: ApiClient,
  code: string,
  body: ReplaceCatalogItemsBody,
  ifMatch?: string,
): Promise<Catalog> =>
  client.put<Catalog>(
    `/catalogs/${encodeURIComponent(code)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Append a new item to a catalog. Returns the updated catalog (201). */
export const addCatalogItem = (
  client: ApiClient,
  code: string,
  body: CreateCatalogItemBody,
): Promise<Catalog> =>
  client.post<Catalog>(
    `/catalogs/${encodeURIComponent(code)}/items`,
    body,
  );

/** Soft-disable a catalog item (sets `active=false` inside the array). */
export const disableCatalogItem = (
  client: ApiClient,
  code: string,
  value: string,
): Promise<void> =>
  client.delete<void>(
    `/catalogs/${encodeURIComponent(code)}/items/${encodeURIComponent(value)}`,
  );
