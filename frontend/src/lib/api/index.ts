// Domain types
export type { AuditUser, BaseEntity, ProblemDetails, ListParams, PaginatedResponse, DocType, EnrollmentStatus, ScheduleStatus } from './types';
export { DOC_TYPE_LABELS, ENROLLMENT_STATUS_LABELS, SCHEDULE_STATUS_LABELS } from './types';

// Error handling
export { ApiError, isApiError, isNotFound, isConflict, isValidation, isUnauthorized, isForbidden } from './errors';

// HTTP client
export { createApiClient } from './client';
export type { ApiClient, RequestOptions, CreateApiClientOptions } from './client';

// Health check
export { getHealth } from './health';
export type { HealthResponse } from './health';

// Catalogs
export { getCatalogs, getCatalog, replaceCatalogItems, addCatalogItem, disableCatalogItem } from './catalogs';
export type { CatalogCode, CatalogItem, Catalog, CreateCatalogItemBody, ReplaceCatalogItemsBody } from './catalogs';

// Students
export { getStudents, getStudent, createStudent, updateStudent, deleteStudent, getStudentEnrollments } from './students';
export type { Student, StudentDetail, StudentBody, StudentEnrollment, StudentListParams, StudentEnrollmentParams } from './students';

// Teachers
export { getTeachers, getTeacher, createTeacher, updateTeacher, deleteTeacher, getTeacherPayments, getTeacherSchedules } from './teachers';
export type { Teacher, TeacherBody, TeacherListParams, TeacherPaymentListParams, TeacherScheduleListParams } from './teachers';

// Schedules
export { getSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, getScheduleEnrollments, getScheduleDashboard } from './schedules';
export type { Schedule, ScheduleWithCounts, ScheduleBody, ScheduleListParams, ScheduleEnrollmentParams, DashboardEnrollment, DashboardSummary, ScheduleDashboard } from './schedules';

// Enrollments
export { getEnrollments, getEnrollment, createEnrollment, updateEnrollment, deleteEnrollment, getEnrollmentPayments } from './enrollments';
export type { Enrollment, EnrollmentBody, EnrollmentListParams, EnrollmentPaymentParams } from './enrollments';

// Student Payments
export { getStudentPayments, getStudentPayment, createStudentPayment, updateStudentPayment, deleteStudentPayment, getDebtors } from './student-payments';
export type { StudentPayment, StudentPaymentBody, StudentPaymentListParams, Debtor, DebtorParams } from './student-payments';

// Teacher Payments
export { getTeacherPayments as getAllTeacherPayments, getTeacherPayment, createTeacherPayment, updateTeacherPayment, deleteTeacherPayment } from './teacher-payments';
export type { TeacherPayment, TeacherPaymentBody, TeacherPaymentListParams as TeacherPaymentModuleListParams } from './teacher-payments';

// Expenses
export { getExpenses, getExpense, createExpense, updateExpense, deleteExpense } from './expenses';
export type { Expense, ExpenseBody, ExpenseListParams } from './expenses';
