'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousWhenLoadingMore } from './query-placeholder';
import { getNextOffset, keepFirstInfinitePage } from './infinite-list';
import {
  getAllTeacherPayments,
  createTeacherPayment,
  updateTeacherPayment,
  deleteTeacherPayment,
  type ApiClient,
  type TeacherPayment,
  type TeacherPaymentBody,
  type TeacherPaymentModuleListParams,
  type PaginatedResponse,
} from '@/lib/api';

type InfiniteTeacherPaymentListParams = Omit<TeacherPaymentModuleListParams, 'offset'>;

export function useTeacherPayments(client: ApiClient, params?: TeacherPaymentModuleListParams) {
  return useQuery<PaginatedResponse<TeacherPayment>>({
    queryKey: ['teacher-payments', params],
    queryFn: () => getAllTeacherPayments(client, params),
    placeholderData: keepPreviousWhenLoadingMore<PaginatedResponse<TeacherPayment>>(params),
  });
}

export function useInfiniteTeacherPayments(client: ApiClient, params?: InfiniteTeacherPaymentListParams) {
  const limit = params?.limit ?? 25;

  return useInfiniteQuery({
    queryKey: ['teacher-payments', 'infinite', params],
    queryFn: ({ pageParam }) => getAllTeacherPayments(client, { ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
  });
}

export function useCreateTeacherPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TeacherPaymentBody) => createTeacherPayment(client, body),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['teacher-payments', 'infinite']);
      qc.invalidateQueries({ queryKey: ['teacher-payments'] });
    },
  });
}

export function useUpdateTeacherPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: TeacherPaymentBody; ifMatch?: string }) =>
      updateTeacherPayment(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['teacher-payments', 'infinite']);
      qc.invalidateQueries({ queryKey: ['teacher-payments'] });
    },
  });
}

export function useDeleteTeacherPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeacherPayment(client, id),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['teacher-payments', 'infinite']);
      qc.invalidateQueries({ queryKey: ['teacher-payments'] });
    },
  });
}
