// Client
export { useApiClient } from './use-api-client';

// Health
export { useApiHealth } from './use-api-health';

// Domain hooks (queries + mutations)
export { useCatalogs, useCatalog, useReplaceCatalogItems, useAddCatalogItem, useDisableCatalogItem } from './use-catalogs';
export { useStudents, useStudent, useStudentEnrollments, useCreateStudent, useUpdateStudent, useDeleteStudent } from './use-students';
export { useTeachers, useTeacher, useCreateTeacher, useUpdateTeacher, useDeleteTeacher } from './use-teachers';
export { useSchedules, useSchedule, useScheduleDashboard, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from './use-schedules';
export { useEnrollments, useEnrollment, useCreateEnrollment, useUpdateEnrollment, useDeleteEnrollment } from './use-enrollments';
export { useStudentPayments, useDebtors, useCreateStudentPayment, useUpdateStudentPayment, useDeleteStudentPayment } from './use-student-payments';
export { useTeacherPayments, useCreateTeacherPayment, useUpdateTeacherPayment, useDeleteTeacherPayment } from './use-teacher-payments';
export { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from './use-expenses';

// Utilities
export { useIsMobile } from './use-mobile';
