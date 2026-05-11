'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSchedules,
  getSchedule,
  getScheduleDashboard,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ApiClient,
  type ScheduleWithCounts,
  type ScheduleBody,
  type ScheduleListParams,
  type ScheduleDashboard,
  type PaginatedResponse,
} from '@/lib/api';

export function useSchedules(client: ApiClient, params?: ScheduleListParams) {
  return useQuery<PaginatedResponse<ScheduleWithCounts>>({
    queryKey: ['schedules', params],
    queryFn: () => getSchedules(client, params),
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

export function useCreateSchedule(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ScheduleBody) => createSchedule(client, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); },
  });
}

export function useUpdateSchedule(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ScheduleBody; ifMatch?: string }) =>
      updateSchedule(client, vars.id, vars.body, vars.ifMatch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      qc.invalidateQueries({ queryKey: ['schedules', vars.id] });
    },
  });
}

export function useDeleteSchedule(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(client, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); },
  });
}
