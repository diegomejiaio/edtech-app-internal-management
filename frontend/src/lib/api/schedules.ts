import type { BaseEntity, EnrollmentStatus, ListParams, PaginatedResponse, ScheduleStatus } from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Schedule document shape as stored in Cosmos (container `master`). */
export interface Schedule extends BaseEntity {
  type: 'schedule';
  course: string;
  level: string;
  teacherId: string;
  teacherName: string;
  weekdays: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  status: ScheduleStatus;
  startDate: string;
}

/** Extended schedule returned by list/get with server-computed fields. */
export interface ScheduleWithCounts extends Schedule {
  enrolledActiveCount: number;
  occupancyPct: number;
}

/** Body for `POST /schedules` and `PUT /schedules/{id}`. */
export interface ScheduleBody {
  course: string;
  level: string;
  teacherId: string;
  weekdays: string;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  status: ScheduleStatus;
  startDate: string;
}

/** Filters for `GET /schedules`. */
export interface ScheduleListParams extends ListParams {
  status?: ScheduleStatus;
  teacherId?: string;
  course?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

/** Filters for `GET /schedules/{id}/enrollments`. */
export interface ScheduleEnrollmentParams extends ListParams {
  status?: EnrollmentStatus;
}

// ---------------------------------------------------------------------------
// Dashboard BFF types (see docs/04-api-design.md §6.1)
// ---------------------------------------------------------------------------

/** Single enrollment row in the dashboard response. */
export interface DashboardEnrollment {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentDoc: string;
  paidThisMonth: boolean;
  lastPaymentDate?: string | null;
}

/** Summary totals in the dashboard response. */
export interface DashboardSummary {
  enrolled: number;
  paid: number;
  debtors: number;
  occupancyPct: number;
}

/** Composite response from `GET /schedules/{id}/dashboard`. */
export interface ScheduleDashboard {
  schedule: ScheduleWithCounts;
  month: string;
  enrollments: DashboardEnrollment[];
  summary: DashboardSummary;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List schedules with optional filters and pagination. */
export const getSchedules = (
  client: ApiClient,
  params?: ScheduleListParams,
): Promise<PaginatedResponse<ScheduleWithCounts>> =>
  client.get<PaginatedResponse<ScheduleWithCounts>>('/schedules', {
    params: params as Record<string, string | number | boolean | undefined>,
  });

/** Get a single schedule by ID (includes computed counts). */
export const getSchedule = (
  client: ApiClient,
  id: string,
): Promise<ScheduleWithCounts> =>
  client.get<ScheduleWithCounts>(`/schedules/${encodeURIComponent(id)}`);

/** Create a schedule. Validates that `teacherId` exists and is active. */
export const createSchedule = (
  client: ApiClient,
  body: ScheduleBody,
): Promise<Schedule> =>
  client.post<Schedule>('/schedules', body);

/** Full-replace update of a schedule. */
export const updateSchedule = (
  client: ApiClient,
  id: string,
  body: ScheduleBody,
  ifMatch?: string,
): Promise<Schedule> =>
  client.put<Schedule>(
    `/schedules/${encodeURIComponent(id)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Soft-delete a schedule. Returns 409 if it has active enrollments. */
export const deleteSchedule = (
  client: ApiClient,
  id: string,
): Promise<void> =>
  client.delete<void>(`/schedules/${encodeURIComponent(id)}`);

/** List enrollments for a schedule. */
export const getScheduleEnrollments = (
  client: ApiClient,
  scheduleId: string,
  params?: ScheduleEnrollmentParams,
): Promise<PaginatedResponse<unknown>> =>
  client.get<PaginatedResponse<unknown>>(
    `/schedules/${encodeURIComponent(scheduleId)}/enrollments`,
    { params: params as Record<string, string | number | boolean | undefined> },
  );

/** Get the schedule dashboard (BFF composite endpoint). */
export const getScheduleDashboard = (
  client: ApiClient,
  scheduleId: string,
  month?: string,
): Promise<ScheduleDashboard> =>
  client.get<ScheduleDashboard>(
    `/schedules/${encodeURIComponent(scheduleId)}/dashboard`,
    month ? { params: { month } } : undefined,
  );
