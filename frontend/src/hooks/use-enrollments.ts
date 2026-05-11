'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useEnrollments(client: ApiClient, params?: EnrollmentListParams) {
  return useQuery<PaginatedResponse<Enrollment>>({
    queryKey: ['enrollments', params],
    queryFn: () => getEnrollments(client, params),
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
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
