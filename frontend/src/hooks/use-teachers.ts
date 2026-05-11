'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  type ApiClient,
  type Teacher,
  type TeacherBody,
  type TeacherListParams,
  type PaginatedResponse,
} from '@/lib/api';

/** Fetches a paginated list of teachers with optional search/filters. */
export function useTeachers(client: ApiClient, params?: TeacherListParams) {
  return useQuery<PaginatedResponse<Teacher>>({
    queryKey: ['teachers', params],
    queryFn: () => getTeachers(client, params),
  });
}

/** Fetches a single teacher by ID. */
export function useTeacher(client: ApiClient, id: string | undefined) {
  return useQuery<Teacher>({
    queryKey: ['teachers', id],
    queryFn: () => getTeacher(client, id!),
    enabled: !!id,
  });
}

export function useCreateTeacher(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TeacherBody) => createTeacher(client, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teachers'] }); },
  });
}

export function useUpdateTeacher(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: TeacherBody; ifMatch?: string }) =>
      updateTeacher(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      qc.invalidateQueries({ queryKey: ['teachers', vars.id] });
    },
  });
}

export function useDeleteTeacher(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeacher(client, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teachers'] }); },
  });
}
