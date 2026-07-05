import type {
  AttendanceStatus,
  AuditUser,
  BaseEntity,
  EnrollmentStatus,
  ListParams,
  PaginatedResponse,
  ScheduleSessionStatus,
  ScheduleStatus,
} from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Schedule document shape as stored in Cosmos (container `master`). */
export interface Schedule extends BaseEntity {
  type: 'schedule';
  code?: string | null;
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
  courseDurationHours?: number | null;
  projectedEndDate?: string | null;
  sessionCount: number;
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
  search?: string;
  /** One or more statuses; serialized to a comma-separated `status` query param. */
  status?: ScheduleStatus[];
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
  amount: number;
  paidAmount: number;
  pendingAmount: number;
  paidThisMonth: boolean;
  lastPaymentDate?: string | null;
}

/** Summary totals in the dashboard response. */
export interface DashboardSummary {
  enrolled: number;
  paid: number;
  debtors: number;
  occupancyPct: number;
  sessions: number;
  completedSessions: number;
  pendingSessions: number;
  expectedAmount: number;
  paidAmount: number;
  pendingAmount: number;
}

export interface ScheduleAttendance {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  notes?: string | null;
  updatedAt: string;
  updatedBy: AuditUser;
}

export interface ScheduleSession {
  id: string;
  sequenceNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleSessionStatus;
  attendance: ScheduleAttendance[];
  active: boolean;
  createdAt: string;
  createdBy: AuditUser;
  updatedAt: string;
  updatedBy: AuditUser;
  deletedAt?: string | null;
  deletedBy?: AuditUser | null;
}

export interface ScheduleEnrollment {
  id: string;
  studentId: string;
  studentName: string;
  status: EnrollmentStatus;
  amount: number;
  paidAmount: number;
  pendingAmount: number;
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
): Promise<PaginatedResponse<ScheduleWithCounts>> => {
  const { status, ...rest } = params ?? {};
  return client.get<PaginatedResponse<ScheduleWithCounts>>('/schedules', {
    params: {
      ...(rest as Record<string, string | number | boolean | undefined>),
      status: status?.length ? status.join(',') : undefined,
    },
  });
};

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
): Promise<PaginatedResponse<ScheduleEnrollment>> =>
  client.get<PaginatedResponse<ScheduleEnrollment>>(
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

/** Filters for `GET /schedules/{id}/sessions`. */
export type ScheduleSessionParams = ListParams;

export interface UpdateScheduleAttendanceRequest {
  studentId: string;
  status: AttendanceStatus;
  notes?: string | null;
}

export interface UpdateScheduleSessionRequest {
  status?: ScheduleSessionStatus;
  date?: string;
  startTime?: string;
  endTime?: string;
  attendance?: UpdateScheduleAttendanceRequest[];
}

export interface ScheduleSessionUpdateResponse {
  session: ScheduleSession;
  scheduleEtag?: string | null;
}

/** List generated sessions for a schedule. */
export const getScheduleSessions = (
  client: ApiClient,
  scheduleId: string,
  params?: ScheduleSessionParams,
): Promise<PaginatedResponse<ScheduleSession>> =>
  client.get<PaginatedResponse<ScheduleSession>>(
    `/schedules/${encodeURIComponent(scheduleId)}/sessions`,
    { params: params as Record<string, string | number | boolean | undefined> },
  );

/** Get one generated schedule session. */
export const getScheduleSession = (
  client: ApiClient,
  scheduleId: string,
  sessionId: string,
): Promise<ScheduleSession> =>
  client.get<ScheduleSession>(
    `/schedules/${encodeURIComponent(scheduleId)}/sessions/${encodeURIComponent(sessionId)}`,
  );

/** Update a generated session status and attendance with schedule ETag concurrency. */
export const updateScheduleSession = (
  client: ApiClient,
  scheduleId: string,
  sessionId: string,
  body: UpdateScheduleSessionRequest,
  ifMatch?: string,
): Promise<ScheduleSessionUpdateResponse> =>
  client.put<ScheduleSessionUpdateResponse>(
    `/schedules/${encodeURIComponent(scheduleId)}/sessions/${encodeURIComponent(sessionId)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Soft-delete a generated session with schedule ETag concurrency. */
export const deleteScheduleSession = (
  client: ApiClient,
  scheduleId: string,
  sessionId: string,
  ifMatch?: string,
): Promise<void> =>
  client.delete<void>(
    `/schedules/${encodeURIComponent(scheduleId)}/sessions/${encodeURIComponent(sessionId)}`,
    ifMatch ? { ifMatch } : undefined,
  );
