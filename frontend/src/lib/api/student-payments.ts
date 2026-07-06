import type { BaseEntity, ListParams, PaginatedResponse } from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** StudentPayment document shape as stored in Cosmos (container `operations`). */
export interface StudentPayment extends BaseEntity {
  type: 'studentPayment';
  code?: string | null;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  scheduleId: string;
  scheduleName: string;
  date: string;
  amount: number;
  installmentNumber: number;
  paymentMethod: string;
  hasReceipt: boolean;
  receiptNumber?: string | null;
  notes?: string | null;
}

/** Body for `POST /student-payments` and `PUT /student-payments/{id}`. */
export interface StudentPaymentBody {
  enrollmentId: string;
  date: string;
  amount: number;
  installmentNumber: number;
  paymentMethod: string;
  hasReceipt: boolean;
  receiptNumber?: string | null;
  notes?: string | null;
}

/** Filters for `GET /student-payments`. */
export interface StudentPaymentListParams extends ListParams {
  enrollmentId?: string;
  studentId?: string;
  from?: string;
  to?: string;
  /** Free-text search over the student's name (server-side, accent-insensitive). */
  search?: string;
}

/** A debtor row returned by the debtors operational endpoint. */
export interface Debtor {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentDoc: string;
  amount: number;
  lastPaymentDate?: string | null;
}

/** Response envelope for `GET /student-payments/debtors`. */
export interface DebtorsByScheduleResponse {
  scheduleId: string;
  scheduleName: string;
  month: string;
  debtors: Debtor[];
}

/** Required params for `GET /student-payments/debtors`. */
export interface DebtorParams {
  scheduleId: string;
  month: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List student payments with optional filters and pagination. */
export const getStudentPayments = (
  client: ApiClient,
  params?: StudentPaymentListParams,
): Promise<PaginatedResponse<StudentPayment>> =>
  client.get<PaginatedResponse<StudentPayment>>('/student-payments', {
    params: params as Record<string, string | number | boolean | undefined>,
  });

/** Get a single student payment by ID. */
export const getStudentPayment = (
  client: ApiClient,
  id: string,
): Promise<StudentPayment> =>
  client.get<StudentPayment>(`/student-payments/${encodeURIComponent(id)}`);

/** Create a student payment. Validates that `enrollmentId` exists and is active. */
export const createStudentPayment = (
  client: ApiClient,
  body: StudentPaymentBody,
): Promise<StudentPayment> =>
  client.post<StudentPayment>('/student-payments', body);

/** Full-replace update of a student payment. */
export const updateStudentPayment = (
  client: ApiClient,
  id: string,
  body: StudentPaymentBody,
  ifMatch?: string,
): Promise<StudentPayment> =>
  client.put<StudentPayment>(
    `/student-payments/${encodeURIComponent(id)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Soft-delete a student payment. */
export const deleteStudentPayment = (
  client: ApiClient,
  id: string,
): Promise<void> =>
  client.delete<void>(`/student-payments/${encodeURIComponent(id)}`);

/**
 * Get debtors for a schedule in a given month.
 * Both `scheduleId` and `month` (YYYY-MM) are required.
 */
export const getDebtors = (
  client: ApiClient,
  params: DebtorParams,
): Promise<DebtorsByScheduleResponse> =>
  client.get<DebtorsByScheduleResponse>('/student-payments/debtors', {
    params: params as unknown as Record<string, string>,
  });
