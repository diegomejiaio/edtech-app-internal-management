'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useStudentPayments(client: ApiClient, params?: StudentPaymentListParams) {
  return useQuery<PaginatedResponse<StudentPayment>>({
    queryKey: ['student-payments', params],
    queryFn: () => getStudentPayments(client, params),
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
      qc.invalidateQueries({ queryKey: ['student-payments'] });
    },
  });
}

export function useDeleteStudentPayment(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudentPayment(client, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-payments'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
