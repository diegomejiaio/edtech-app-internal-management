import type { BaseEntity, ListParams, PaginatedResponse } from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** TeacherPayment document shape as stored in Cosmos (container `operations`). */
export interface TeacherPayment extends BaseEntity {
  type: 'teacherPayment';
  teacherId: string;
  teacherName: string;
  teacherDoc: string;
  date: string;
  amount: number;
  concept: string;
  paymentMethod: string;
  notes?: string | null;
}

/** Body for `POST /teacher-payments` and `PUT /teacher-payments/{id}`. */
export interface TeacherPaymentBody {
  teacherId: string;
  date: string;
  amount: number;
  concept: string;
  paymentMethod: string;
  notes?: string | null;
}

/** Filters for `GET /teacher-payments`. */
export interface TeacherPaymentListParams extends ListParams {
  teacherId?: string;
  from?: string;
  to?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List teacher payments with optional filters and pagination. */
export const getTeacherPayments = (
  client: ApiClient,
  params?: TeacherPaymentListParams,
): Promise<PaginatedResponse<TeacherPayment>> =>
  client.get<PaginatedResponse<TeacherPayment>>('/teacher-payments', {
    params: params as Record<string, string | number | boolean | undefined>,
  });

/** Get a single teacher payment by ID. */
export const getTeacherPayment = (
  client: ApiClient,
  id: string,
): Promise<TeacherPayment> =>
  client.get<TeacherPayment>(`/teacher-payments/${encodeURIComponent(id)}`);

/** Create a teacher payment. */
export const createTeacherPayment = (
  client: ApiClient,
  body: TeacherPaymentBody,
): Promise<TeacherPayment> =>
  client.post<TeacherPayment>('/teacher-payments', body);

/** Full-replace update of a teacher payment. */
export const updateTeacherPayment = (
  client: ApiClient,
  id: string,
  body: TeacherPaymentBody,
  ifMatch?: string,
): Promise<TeacherPayment> =>
  client.put<TeacherPayment>(
    `/teacher-payments/${encodeURIComponent(id)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Soft-delete a teacher payment. */
export const deleteTeacherPayment = (
  client: ApiClient,
  id: string,
): Promise<void> =>
  client.delete<void>(`/teacher-payments/${encodeURIComponent(id)}`);
