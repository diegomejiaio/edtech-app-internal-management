import type { BaseEntity, DocType, ListParams, PaginatedResponse, ScheduleStatus } from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Teacher document shape as stored in Cosmos (container `master`). */
export interface Teacher extends BaseEntity {
  type: 'teacher';
  firstName: string;
  lastName: string;
  docType: DocType;
  docNumber: string;
  phone?: string | null;
  email?: string | null;
  specialty?: string | null;
  clerkUserId?: string | null;
}

/** Body for `POST /teachers` and `PUT /teachers/{id}`. */
export interface TeacherBody {
  firstName: string;
  lastName: string;
  docType: DocType;
  docNumber: string;
  phone?: string | null;
  email?: string | null;
  specialty?: string | null;
}

/** Filters for `GET /teachers`. */
export interface TeacherListParams extends ListParams {
  search?: string;
  specialty?: string;
}

/** Filters for `GET /teachers/{id}/payments`. */
export interface TeacherPaymentListParams extends ListParams {
  from?: string;
  to?: string;
}

/** Filters for `GET /teachers/{id}/schedules`. */
export interface TeacherScheduleListParams extends ListParams {
  status?: ScheduleStatus;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List teachers with optional search and pagination. */
export const getTeachers = (
  client: ApiClient,
  params?: TeacherListParams,
): Promise<PaginatedResponse<Teacher>> =>
  client.get<PaginatedResponse<Teacher>>('/teachers', {
    params: params as Record<string, string | number | boolean | undefined>,
  });

/** Get a single teacher by ID. */
export const getTeacher = (
  client: ApiClient,
  id: string,
): Promise<Teacher> =>
  client.get<Teacher>(`/teachers/${encodeURIComponent(id)}`);

/** Create a teacher. Returns 409 if `docType + docNumber` already active. */
export const createTeacher = (
  client: ApiClient,
  body: TeacherBody,
): Promise<Teacher> =>
  client.post<Teacher>('/teachers', body);

/** Full-replace update of a teacher. */
export const updateTeacher = (
  client: ApiClient,
  id: string,
  body: TeacherBody,
  ifMatch?: string,
): Promise<Teacher> =>
  client.put<Teacher>(
    `/teachers/${encodeURIComponent(id)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Soft-delete a teacher. Returns 409 if assigned to an active schedule. */
export const deleteTeacher = (
  client: ApiClient,
  id: string,
): Promise<void> =>
  client.delete<void>(`/teachers/${encodeURIComponent(id)}`);

/**
 * List payments for a teacher.
 * Note: returns TeacherPayment from the teacher-payments module;
 * import that type separately if needed.
 */
export const getTeacherPayments = (
  client: ApiClient,
  teacherId: string,
  params?: TeacherPaymentListParams,
): Promise<PaginatedResponse<unknown>> =>
  client.get<PaginatedResponse<unknown>>(
    `/teachers/${encodeURIComponent(teacherId)}/payments`,
    { params: params as Record<string, string | number | boolean | undefined> },
  );

/**
 * List schedules assigned to a teacher.
 * Note: returns Schedule from the schedules module;
 * import that type separately if needed.
 */
export const getTeacherSchedules = (
  client: ApiClient,
  teacherId: string,
  params?: TeacherScheduleListParams,
): Promise<PaginatedResponse<unknown>> =>
  client.get<PaginatedResponse<unknown>>(
    `/teachers/${encodeURIComponent(teacherId)}/schedules`,
    { params: params as Record<string, string | number | boolean | undefined> },
  );
