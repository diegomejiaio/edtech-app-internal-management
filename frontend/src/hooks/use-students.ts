'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousWhenLoadingMore } from './query-placeholder';
import { getNextOffset, keepFirstInfinitePage } from './infinite-list';
import {
  getStudents,
  getStudent,
  getStudentEnrollments,
  createStudent,
  updateStudent,
  deleteStudent,
  type ApiClient,
  type Student,
  type StudentDetail,
  type StudentEnrollment,
  type StudentBody,
  type StudentListParams,
  type StudentEnrollmentParams,
  type PaginatedResponse,
} from '@/lib/api';

type InfiniteStudentListParams = Omit<StudentListParams, 'offset'>;

/** Fetches a paginated list of students with optional search/filters. */
export function useStudents(client: ApiClient, params?: StudentListParams) {
  return useQuery<PaginatedResponse<Student>>({
    queryKey: ['students', params],
    queryFn: () => getStudents(client, params),
    placeholderData: keepPreviousWhenLoadingMore<PaginatedResponse<Student>>(params),
  });
}

/** Fetches students with accumulated load-more pagination. */
export function useInfiniteStudents(client: ApiClient, params?: InfiniteStudentListParams) {
  const limit = params?.limit ?? 25;

  return useInfiniteQuery({
    queryKey: ['students', 'infinite', params],
    queryFn: ({ pageParam }) => getStudents(client, { ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
  });
}

/** Fetches a single student by ID (includes derived fields). */
export function useStudent(client: ApiClient, id: string | undefined) {
  return useQuery<StudentDetail>({
    queryKey: ['students', id],
    queryFn: () => getStudent(client, id!),
    enabled: !!id,
  });
}

/** Fetches enrollments for a student. */
export function useStudentEnrollments(
  client: ApiClient,
  studentId: string | undefined,
  params?: StudentEnrollmentParams,
) {
  return useQuery<PaginatedResponse<StudentEnrollment>>({
    queryKey: ['students', studentId, 'enrollments', params],
    queryFn: () => getStudentEnrollments(client, studentId!, params),
    enabled: !!studentId,
    placeholderData: keepPreviousWhenLoadingMore<PaginatedResponse<StudentEnrollment>>(params),
  });
}

/** Create a student. Invalidates the students list on success. */
export function useCreateStudent(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StudentBody) => createStudent(client, body),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['students', 'infinite']);
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

/** Update a student. Invalidates the students list and detail on success. */
export function useUpdateStudent(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: StudentBody; ifMatch?: string }) =>
      updateStudent(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: (_data, vars) => {
      keepFirstInfinitePage(qc, ['students', 'infinite']);
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['students', vars.id] });
    },
  });
}

/** Soft-delete a student. */
export function useDeleteStudent(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudent(client, id),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['students', 'infinite']);
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
