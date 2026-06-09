import type { BaseEntity, DocType, EnrollmentStatus, ListParams, PaginatedResponse } from './types';
import type { ApiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Student document shape as stored in Cosmos (container `master`). */
export interface Student extends BaseEntity {
  type: 'student';
  code?: string | null;
  firstName: string;
  lastName: string;
  docType: DocType;
  docNumber: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
}

/** Extended student returned by `GET /students/{id}` with derived fields. */
export interface StudentDetail extends Student {
  enrollmentCount: number;
  lastPaymentDate?: string | null;
}

/** Body for `POST /students` and `PUT /students/{id}`. */
export interface StudentBody {
  firstName: string;
  lastName: string;
  docType: DocType;
  docNumber: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
}

/** Enrollment snapshot returned by `GET /students/{id}/enrollments`. */
export interface StudentEnrollment extends BaseEntity {
  type: 'enrollment';
  studentId: string;
  studentName: string;
  studentDoc: string;
  scheduleId: string;
  scheduleName: string;
  schedulePrice: number;
  enrollmentDate: string;
  status: EnrollmentStatus;
}

/** Filters for `GET /students`. */
export interface StudentListParams extends ListParams {
  search?: string;
  docType?: DocType;
}

/** Filters for `GET /students/{id}/enrollments`. */
export interface StudentEnrollmentParams extends ListParams {
  status?: EnrollmentStatus;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List students with optional search and pagination. */
export const getStudents = (
  client: ApiClient,
  params?: StudentListParams,
): Promise<PaginatedResponse<Student>> =>
  client.get<PaginatedResponse<Student>>('/students', {
    params: params as Record<string, string | number | boolean | undefined>,
  });

/** Get a single student by ID (includes derived `enrollmentCount`, `lastPaymentDate`). */
export const getStudent = (
  client: ApiClient,
  id: string,
): Promise<StudentDetail> =>
  client.get<StudentDetail>(`/students/${encodeURIComponent(id)}`);

/** Create a student. Returns 409 if `docType + docNumber` already active. */
export const createStudent = (
  client: ApiClient,
  body: StudentBody,
): Promise<Student> =>
  client.post<Student>('/students', body);

/** Full-replace update of a student. */
export const updateStudent = (
  client: ApiClient,
  id: string,
  body: StudentBody,
  ifMatch?: string,
): Promise<Student> =>
  client.put<Student>(
    `/students/${encodeURIComponent(id)}`,
    body,
    ifMatch ? { ifMatch } : undefined,
  );

/** Soft-delete a student. Returns 409 if the student has active enrollments. */
export const deleteStudent = (
  client: ApiClient,
  id: string,
): Promise<void> =>
  client.delete<void>(`/students/${encodeURIComponent(id)}`);

/** List enrollments for a student. */
export const getStudentEnrollments = (
  client: ApiClient,
  studentId: string,
  params?: StudentEnrollmentParams,
): Promise<PaginatedResponse<StudentEnrollment>> =>
  client.get<PaginatedResponse<StudentEnrollment>>(
    `/students/${encodeURIComponent(studentId)}/enrollments`,
    { params: params as Record<string, string | number | boolean | undefined> },
  );
