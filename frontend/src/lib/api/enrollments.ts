import type { BaseEntity, EnrollmentStatus, ListParams, PaginatedResponse } from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Enrollment document shape as stored in Cosmos (container `operations`). */
export interface Enrollment extends BaseEntity {
  type: 'enrollment';
  code?: string | null;
  studentId: string;
  studentName: string;
  studentDoc: string;
  scheduleId: string;
  scheduleName: string;
  schedulePrice: number;
  enrollmentDate: string;
  status: EnrollmentStatus;
}

/** Body for `POST /enrollments` and `PUT /enrollments/{id}`. */
export interface EnrollmentBody {
  studentId: string;
  scheduleId: string;
  enrollmentDate: string;
  status: EnrollmentStatus;
}

/** Filters for `GET /enrollments`. */
export interface EnrollmentListParams extends ListParams {
  studentId?: string;
  scheduleId?: string;
  status?: EnrollmentStatus;
}

/** Filters for `GET /enrollments/{id}/payments`. */
export interface EnrollmentPaymentParams extends ListParams {
  from?: string;
  to?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List enrollments with optional filters and pagination. */
export const getEnrollments = (
  client: ApiClient,
  params?: EnrollmentListParams,
): Promise<PaginatedResponse<Enrollment>> =>
  client.get<PaginatedResponse<Enrollment>>('/enrollments', {
    params: params as Record<string, string | number | boolean | undefined>,
  });

/** Get a single enrollment by ID (includes student + schedule snapshots). */
export const getEnrollment = (
  client: ApiClient,
  id: string,
): Promise<Enrollment> =>
  client.get<Enrollment>(`/enrollments/${encodeURIComponent(id)}`);

/**
 * Create an enrollment.
 * Returns 409 if an active enrollment already exists for the same
 * `studentId + scheduleId` combination.
 */
export const createEnrollment = (
  client: ApiClient,
  body: EnrollmentBody,
): Promise<Enrollment> =>
  client.post<Enrollment>('/enrollments', body);

/** Full-replace update of an enrollment (status transitions are free). */
export const updateEnrollment = (
  client: ApiClient,
  id: string,
  body: EnrollmentBody,
  ifMatch?: string,
): Promise<Enrollment> =>
  client.put<Enrollment>(
    `/enrollments/${encodeURIComponent(id)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Soft-delete an enrollment (payments are preserved). */
export const deleteEnrollment = (
  client: ApiClient,
  id: string,
): Promise<void> =>
  client.delete<void>(`/enrollments/${encodeURIComponent(id)}`);

/** List payments for an enrollment. */
export const getEnrollmentPayments = (
  client: ApiClient,
  enrollmentId: string,
  params?: EnrollmentPaymentParams,
): Promise<PaginatedResponse<unknown>> =>
  client.get<PaginatedResponse<unknown>>(
    `/enrollments/${encodeURIComponent(enrollmentId)}/payments`,
    { params: params as Record<string, string | number | boolean | undefined> },
  );
