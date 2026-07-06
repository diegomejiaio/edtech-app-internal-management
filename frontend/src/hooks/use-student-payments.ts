'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousWhenLoadingMore } from './query-placeholder';
import { getNextOffset, keepFirstInfinitePage } from './infinite-list';
import {
  getStudentPayments,
  getDebtors,
  createStudentPayment,
  updateStudentPayment,
  deleteStudentPayment,
  type ApiClient,
  type StudentPayment,
  type StudentPaymentBody,
  type StudentPaymentListParams,
  type Debtor,
  type DebtorParams,
  type PaginatedResponse,
} from '@/lib/api';

type InfiniteStudentPaymentListParams = Omit<StudentPaymentListParams, 'offset'>;

export function useStudentPayments(
  client: ApiClient,
  params?: StudentPaymentListParams,
  options?: { enabled?: boolean },
) {
  return useQuery<PaginatedResponse<StudentPayment>>({
    queryKey: ['student-payments', params],
    queryFn: () => getStudentPayments(client, params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousWhenLoadingMore<PaginatedResponse<StudentPayment>>(params),
  });
}

export function useInfiniteStudentPayments(
  client: ApiClient,
  params?: InfiniteStudentPaymentListParams,
  options?: { enabled?: boolean },
) {
  const limit = params?.limit ?? 25;

  return useInfiniteQuery({
    queryKey: ['student-payments', 'infinite', params],
    queryFn: ({ pageParam }) => getStudentPayments(client, { ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: options?.enabled ?? true,
  });
}

export function useDebtors(client: ApiClient, params: DebtorParams | undefined) {
  return useQuery<Debtor[]>({
    queryKey: ['student-payments', 'debtors', params],
    queryFn: () => getDebtors(client, params!),
    enabled: !!params?.scheduleId && !!params?.month,
  });
}

export function useCreateStudentPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StudentPaymentBody) => createStudentPayment(client, body),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['student-payments', 'infinite']);
      keepFirstInfinitePage(qc, ['schedules', 'infinite']);
      qc.invalidateQueries({ queryKey: ['student-payments'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useUpdateStudentPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: StudentPaymentBody; ifMatch?: string }) =>
      updateStudentPayment(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['student-payments', 'infinite']);
      qc.invalidateQueries({ queryKey: ['student-payments'] });
    },
  });
}

export function useDeleteStudentPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudentPayment(client, id),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['student-payments', 'infinite']);
      keepFirstInfinitePage(qc, ['schedules', 'infinite']);
      qc.invalidateQueries({ queryKey: ['student-payments'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
