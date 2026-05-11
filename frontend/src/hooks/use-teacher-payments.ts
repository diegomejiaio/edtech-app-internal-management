'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useTeacherPayments(client: ApiClient, params?: TeacherPaymentModuleListParams) {
  return useQuery<PaginatedResponse<TeacherPayment>>({
    queryKey: ['teacher-payments', params],
    queryFn: () => getAllTeacherPayments(client, params),
  });
}

export function useCreateTeacherPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TeacherPaymentBody) => createTeacherPayment(client, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teacher-payments'] }); },
  });
}

export function useUpdateTeacherPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: TeacherPaymentBody; ifMatch?: string }) =>
      updateTeacherPayment(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teacher-payments'] }); },
  });
}

export function useDeleteTeacherPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeacherPayment(client, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teacher-payments'] }); },
  });
}
