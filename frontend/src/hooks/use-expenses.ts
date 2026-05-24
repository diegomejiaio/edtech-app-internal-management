'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousWhenLoadingMore } from './query-placeholder';
import { getNextOffset, keepFirstInfinitePage } from './infinite-list';
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  type ApiClient,
  type Expense,
  type ExpenseBody,
  type ExpenseListParams,
  type PaginatedResponse,
} from '@/lib/api';

type InfiniteExpenseListParams = Omit<ExpenseListParams, 'offset'>;

export function useExpenses(client: ApiClient, params?: ExpenseListParams) {
  return useQuery<PaginatedResponse<Expense>>({
    queryKey: ['expenses', params],
    queryFn: () => getExpenses(client, params),
    placeholderData: keepPreviousWhenLoadingMore<PaginatedResponse<Expense>>(params),
  });
}

export function useInfiniteExpenses(client: ApiClient, params?: InfiniteExpenseListParams) {
  const limit = params?.limit ?? 25;

  return useInfiniteQuery({
    queryKey: ['expenses', 'infinite', params],
    queryFn: ({ pageParam }) => getExpenses(client, { ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
  });
}

export function useCreateExpense(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ExpenseBody) => createExpense(client, body),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['expenses', 'infinite']);
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useUpdateExpense(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ExpenseBody; ifMatch?: string }) =>
      updateExpense(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['expenses', 'infinite']);
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useDeleteExpense(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(client, id),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['expenses', 'infinite']);
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
