'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousWhenLoadingMore } from './query-placeholder';
import { getNextOffset, keepFirstInfinitePage } from './infinite-list';
import {
  getEnrollments,
  getEnrollment,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
  type ApiClient,
  type Enrollment,
  type EnrollmentBody,
  type EnrollmentListParams,
  type PaginatedResponse,
} from '@/lib/api';

type InfiniteEnrollmentListParams = Omit<EnrollmentListParams, 'offset'>;

export function useEnrollments(client: ApiClient, params?: EnrollmentListParams) {
  return useQuery<PaginatedResponse<Enrollment>>({
    queryKey: ['enrollments', params],
    queryFn: () => getEnrollments(client, params),
    placeholderData: keepPreviousWhenLoadingMore<PaginatedResponse<Enrollment>>(params),
  });
}

export function useInfiniteEnrollments(client: ApiClient, params?: InfiniteEnrollmentListParams) {
  const limit = params?.limit ?? 25;

  return useInfiniteQuery({
    queryKey: ['enrollments', 'infinite', params],
    queryFn: ({ pageParam }) => getEnrollments(client, { ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
  });
}

export function useEnrollment(client: ApiClient, id: string | undefined) {
  return useQuery<Enrollment>({
    queryKey: ['enrollments', id],
    queryFn: () => getEnrollment(client, id!),
    enabled: !!id,
  });
}

export function useCreateEnrollment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EnrollmentBody) => createEnrollment(client, body),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['enrollments', 'infinite']);
      keepFirstInfinitePage(qc, ['schedules', 'infinite']);
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useUpdateEnrollment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: EnrollmentBody; ifMatch?: string }) =>
      updateEnrollment(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: (_data, vars) => {
      keepFirstInfinitePage(qc, ['enrollments', 'infinite']);
      keepFirstInfinitePage(qc, ['schedules', 'infinite']);
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['enrollments', vars.id] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useDeleteEnrollment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEnrollment(client, id),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['enrollments', 'infinite']);
      keepFirstInfinitePage(qc, ['schedules', 'infinite']);
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
