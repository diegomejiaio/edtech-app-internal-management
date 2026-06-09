import type { BaseEntity, ListParams, PaginatedResponse } from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Expense document shape as stored in Cosmos (container `operations`). */
export interface Expense extends BaseEntity {
  type: 'expense';
  code?: string | null;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  scheduleId?: string | null;
  scheduleName?: string | null;
  notes?: string | null;
}

/** Body for `POST /expenses` and `PUT /expenses/{id}`. */
export interface ExpenseBody {
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  scheduleId?: string | null;
  notes?: string | null;
}

/** Filters for `GET /expenses`. */
export interface ExpenseListParams extends ListParams {
  search?: string;
  from?: string;
  to?: string;
  category?: string;
  scheduleId?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List expenses with optional filters and pagination. */
export const getExpenses = (
  client: ApiClient,
  params?: ExpenseListParams,
): Promise<PaginatedResponse<Expense>> =>
  client.get<PaginatedResponse<Expense>>('/expenses', {
    params: params as Record<string, string | number | boolean | undefined>,
  });

/** Get a single expense by ID. */
export const getExpense = (
  client: ApiClient,
  id: string,
): Promise<Expense> =>
  client.get<Expense>(`/expenses/${encodeURIComponent(id)}`);

/** Create an expense. */
export const createExpense = (
  client: ApiClient,
  body: ExpenseBody,
): Promise<Expense> =>
  client.post<Expense>('/expenses', body);

/** Full-replace update of an expense. */
export const updateExpense = (
  client: ApiClient,
  id: string,
  body: ExpenseBody,
  ifMatch?: string,
): Promise<Expense> =>
  client.put<Expense>(
    `/expenses/${encodeURIComponent(id)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Soft-delete an expense. */
export const deleteExpense = (
  client: ApiClient,
  id: string,
): Promise<void> =>
  client.delete<void>(`/expenses/${encodeURIComponent(id)}`);
