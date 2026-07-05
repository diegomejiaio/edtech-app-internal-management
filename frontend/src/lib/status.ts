import {
  ENROLLMENT_STATUS_LABELS,
  SCHEDULE_SESSION_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
} from '@/lib/api';
import type { EnrollmentStatus, ScheduleSessionStatus, ScheduleStatus } from '@/lib/api';

export type StatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info';

export const STATUS_LABELS = {
  enrollment: ENROLLMENT_STATUS_LABELS,
  schedule: SCHEDULE_STATUS_LABELS,
  scheduleSession: SCHEDULE_SESSION_STATUS_LABELS,
} as const;

export const STATUS_VARIANTS = {
  enrollment: {
    active: 'success',
    completed: 'secondary',
    cancelled: 'destructive',
    pending: 'warning',
  },
  schedule: {
    active: 'success',
    inProgress: 'info',
    finished: 'secondary',
    cancelled: 'destructive',
  },
  scheduleSession: {
    scheduled: 'warning',
    completed: 'success',
    cancelled: 'destructive',
  },
} as const satisfies {
  enrollment: Record<EnrollmentStatus, StatusBadgeVariant>;
  schedule: Record<ScheduleStatus, StatusBadgeVariant>;
  scheduleSession: Record<ScheduleSessionStatus, StatusBadgeVariant>;
};

export const TERMINAL_STATUSES = {
  enrollment: ['completed', 'cancelled'],
  schedule: ['finished', 'cancelled'],
  scheduleSession: ['cancelled'],
} as const satisfies {
  enrollment: readonly EnrollmentStatus[];
  schedule: readonly ScheduleStatus[];
  scheduleSession: readonly ScheduleSessionStatus[];
};
