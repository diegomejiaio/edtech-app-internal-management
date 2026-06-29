// Client
export { useApiClient } from './use-api-client';

// Health
export { useApiHealth } from './use-api-health';

// Domain hooks (queries + mutations)
export { useCatalogs, useCatalog, useReplaceCatalogItems, useAddCatalogItem, useDisableCatalogItem } from './use-catalogs';
export { useStudents, useInfiniteStudents, useStudent, useStudentEnrollments, useCreateStudent, useUpdateStudent, useDeleteStudent } from './use-students';
export { useTeachers, useInfiniteTeachers, useTeacher, useCreateTeacher, useUpdateTeacher, useDeleteTeacher } from './use-teachers';
export { useSchedules, useInfiniteSchedules, useSchedule, useScheduleDashboard, useInfiniteScheduleSessions, useInfiniteScheduleEnrollments, useUpdateScheduleSession, useDeleteScheduleSession, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from './use-schedules';
export { useEnrollments, useInfiniteEnrollments, useEnrollment, useCreateEnrollment, useUpdateEnrollment, useDeleteEnrollment } from './use-enrollments';
export { useStudentPayments, useInfiniteStudentPayments, useDebtors, useCreateStudentPayment, useUpdateStudentPayment, useDeleteStudentPayment } from './use-student-payments';
export { useTeacherPayments, useInfiniteTeacherPayments, useCreateTeacherPayment, useUpdateTeacherPayment, useDeleteTeacherPayment } from './use-teacher-payments';
export { useExpenses, useInfiniteExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from './use-expenses';
export { flattenInfiniteItems, getInfiniteTotal } from './infinite-list';

// Utilities
export { useIsMobile } from './use-mobile';
export { useModKey } from './use-mod-key';
export { useKeyboardShortcut } from './use-keyboard-shortcut';
