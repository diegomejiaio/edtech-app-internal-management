'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useExpenses(client: ApiClient, params?: ExpenseListParams) {
  return useQuery<PaginatedResponse<Expense>>({
    queryKey: ['expenses', params],
    queryFn: () => getExpenses(client, params),
  });
}

export function useCreateExpense(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ExpenseBody) => createExpense(client, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); },
  });
}

export function useUpdateExpense(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ExpenseBody; ifMatch?: string }) =>
      updateExpense(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); },
  });
}

export function useDeleteExpense(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(client, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); },
  });
}
