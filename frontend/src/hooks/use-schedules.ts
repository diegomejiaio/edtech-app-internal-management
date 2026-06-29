'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousWhenLoadingMore } from './query-placeholder';
import { getNextOffset, keepFirstInfinitePage } from './infinite-list';
import {
  getSchedules,
  getSchedule,
  getScheduleDashboard,
  getScheduleEnrollments,
  getScheduleSessions,
  updateScheduleSession,
  deleteScheduleSession,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ApiClient,
  type ScheduleWithCounts,
  type ScheduleBody,
  type ScheduleListParams,
  type ScheduleDashboard,
  type ScheduleEnrollmentParams,
  type ScheduleSessionUpdateResponse,
  type ScheduleSessionParams,
  type UpdateScheduleSessionRequest,
  type PaginatedResponse,
} from '@/lib/api';

type InfiniteScheduleListParams = Omit<ScheduleListParams, 'offset'>;
type InfiniteScheduleSessionParams = Omit<ScheduleSessionParams, 'offset'>;
type InfiniteScheduleEnrollmentParams = Omit<ScheduleEnrollmentParams, 'offset'>;

export function useSchedules(client: ApiClient, params?: ScheduleListParams) {
  return useQuery<PaginatedResponse<ScheduleWithCounts>>({
    queryKey: ['schedules', params],
    queryFn: () => getSchedules(client, params),
    placeholderData: keepPreviousWhenLoadingMore<PaginatedResponse<ScheduleWithCounts>>(params),
  });
}

export function useInfiniteSchedules(client: ApiClient, params?: InfiniteScheduleListParams) {
  const limit = params?.limit ?? 25;

  return useInfiniteQuery({
    queryKey: ['schedules', 'infinite', params],
    queryFn: ({ pageParam }) => getSchedules(client, { ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
  });
}

export function useSchedule(client: ApiClient, id: string | undefined) {
  return useQuery<ScheduleWithCounts>({
    queryKey: ['schedules', id],
    queryFn: () => getSchedule(client, id!),
    enabled: !!id,
  });
}

export function useScheduleDashboard(
  client: ApiClient,
  scheduleId: string | undefined,
  month?: string,
) {
  return useQuery<ScheduleDashboard>({
    queryKey: ['schedules', scheduleId, 'dashboard', month],
    queryFn: () => getScheduleDashboard(client, scheduleId!, month),
    enabled: !!scheduleId,
  });
}

export function useInfiniteScheduleSessions(
  client: ApiClient,
  scheduleId: string | undefined,
  params?: InfiniteScheduleSessionParams,
) {
  const limit = params?.limit ?? 20;

  return useInfiniteQuery({
    queryKey: ['schedules', scheduleId, 'sessions', 'infinite', params],
    queryFn: ({ pageParam }) =>
      getScheduleSessions(client, scheduleId!, { ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: !!scheduleId,
  });
}

export function useInfiniteScheduleEnrollments(
  client: ApiClient,
  scheduleId: string | undefined,
  params?: InfiniteScheduleEnrollmentParams,
) {
  const limit = params?.limit ?? 20;

  return useInfiniteQuery({
    queryKey: ['schedules', scheduleId, 'enrollments', 'infinite', params],
    queryFn: ({ pageParam }) =>
      getScheduleEnrollments(client, scheduleId!, { ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: !!scheduleId,
  });
}

export function useUpdateScheduleSession(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation<
    ScheduleSessionUpdateResponse,
    Error,
    { scheduleId: string; sessionId: string; body: UpdateScheduleSessionRequest; ifMatch?: string }
  >({
    mutationFn: (vars) =>
      updateScheduleSession(client, vars.scheduleId, vars.sessionId, vars.body, vars.ifMatch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['schedules', vars.scheduleId] });
      qc.invalidateQueries({ queryKey: ['schedules', vars.scheduleId, 'sessions'] });
      qc.invalidateQueries({ queryKey: ['schedules', vars.scheduleId, 'dashboard'] });
    },
  });
}

export function useDeleteScheduleSession(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { scheduleId: string; sessionId: string; ifMatch?: string }
  >({
    mutationFn: (vars) => deleteScheduleSession(client, vars.scheduleId, vars.sessionId, vars.ifMatch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['schedules', vars.scheduleId] });
      qc.invalidateQueries({ queryKey: ['schedules', vars.scheduleId, 'sessions'] });
      qc.invalidateQueries({ queryKey: ['schedules', vars.scheduleId, 'dashboard'] });
    },
  });
}

export function useCreateSchedule(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ScheduleBody) => createSchedule(client, body),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['schedules', 'infinite']);
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useUpdateSchedule(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ScheduleBody; ifMatch?: string }) =>
      updateSchedule(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: (_data, vars) => {
      keepFirstInfinitePage(qc, ['schedules', 'infinite']);
      qc.invalidateQueries({ queryKey: ['schedules'] });
      qc.invalidateQueries({ queryKey: ['schedules', vars.id] });
    },
  });
}

export function useDeleteSchedule(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(client, id),
    onSuccess: () => {
      keepFirstInfinitePage(qc, ['schedules', 'infinite']);
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
