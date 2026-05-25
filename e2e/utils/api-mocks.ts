import type { Page, Route } from '@playwright/test';

const auditUser = {
  clerkUserId: 'e2e-user',
  email: 'e2e@example.com',
  displayName: 'E2E User',
};

const baseEntity = {
  active: true,
  createdAt: '2026-05-01T00:00:00.000Z',
  createdBy: auditUser,
  updatedAt: '2026-05-01T00:00:00.000Z',
  updatedBy: auditUser,
  deletedAt: null,
  deletedBy: null,
};

export const mockEnrollment = {
  ...baseEntity,
  id: 'enrollment-e2e-1',
  type: 'enrollment',
  studentId: 'student-e2e-1',
  studentName: 'Ana Pago',
  studentDoc: 'DNI 70000001',
  scheduleId: 'schedule-e2e-1',
  scheduleName: 'Melamina Básico - Mayo',
  schedulePrice: 400,
  enrollmentDate: '2026-05-01',
  status: 'active',
  _etag: 'enrollment-etag',
};

export const mockStudentPayments = [
  {
    ...baseEntity,
    id: 'student-payment-e2e-1',
    type: 'studentPayment',
    enrollmentId: mockEnrollment.id,
    studentId: mockEnrollment.studentId,
    studentName: mockEnrollment.studentName,
    scheduleId: mockEnrollment.scheduleId,
    scheduleName: mockEnrollment.scheduleName,
    date: '2026-05-10',
    amount: 100,
    installmentNumber: 1,
    paymentMethod: 'Yape',
    hasReceipt: true,
    receiptNumber: 'B001-0001',
    notes: null,
    _etag: 'payment-etag-1',
  },
  {
    ...baseEntity,
    id: 'student-payment-e2e-2',
    type: 'studentPayment',
    enrollmentId: mockEnrollment.id,
    studentId: mockEnrollment.studentId,
    studentName: mockEnrollment.studentName,
    scheduleId: mockEnrollment.scheduleId,
    scheduleName: mockEnrollment.scheduleName,
    date: '2026-05-20',
    amount: 50,
    installmentNumber: 2,
    paymentMethod: 'Transferencia',
    hasReceipt: false,
    receiptNumber: null,
    notes: null,
    _etag: 'payment-etag-2',
  },
];

export const mockSchedule = {
  ...baseEntity,
  id: mockEnrollment.scheduleId,
  type: 'schedule',
  course: 'Melamina',
  level: 'Básico',
  teacherId: 'teacher-e2e-1',
  teacherName: 'Rosa Maestra',
  weekdays: 'Lunes y Miércoles',
  startTime: '18:00',
  endTime: '20:00',
  price: 400,
  capacity: 12,
  status: 'active',
  startDate: '2026-05-01',
  sessionCount: 8,
  enrolledActiveCount: 1,
  occupancyPct: 8,
  _etag: 'schedule-etag',
};

const emptyPage = { items: [], total: 0, limit: 25, offset: 0 };

function paginated<T>(items: T[], limit = 25, offset = 0) {
  return { items, total: items.length, limit, offset };
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function mockEspacioProApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');

    if (path === '/catalogs') {
      await fulfillJson(route, [
        {
          ...baseEntity,
          id: 'catalog-payment-methods',
          type: 'catalog',
          code: 'paymentMethods',
          items: [
            { value: 'Yape', order: 1, active: true },
            { value: 'Transferencia', order: 2, active: true },
            { value: 'Efectivo', order: 3, active: true },
          ],
        },
        {
          ...baseEntity,
          id: 'catalog-student-sources',
          type: 'catalog',
          code: 'studentSources',
          items: [{ value: 'Referido', order: 1, active: true }],
        },
      ]);
      return;
    }

    if (path === '/students') {
      await fulfillJson(route, paginated([
        {
          ...baseEntity,
          id: mockEnrollment.studentId,
          type: 'student',
          firstName: 'Ana',
          lastName: 'Pago',
          docType: 'dni',
          docNumber: '70000001',
          phone: '999111222',
          email: 'ana@example.com',
          source: 'Referido',
          notes: null,
        },
      ]));
      return;
    }

    if (path === '/teachers') {
      await fulfillJson(route, paginated([
        {
          ...baseEntity,
          id: 'teacher-e2e-1',
          type: 'teacher',
          firstName: 'Rosa',
          lastName: 'Maestra',
          docType: 'dni',
          docNumber: '70000002',
          phone: '999333444',
          email: 'rosa@example.com',
          specialty: 'Melamina',
          clerkUserId: null,
        },
      ]));
      return;
    }

    if (path === '/schedules') {
      await fulfillJson(route, paginated([mockSchedule]));
      return;
    }

    if (path === `/schedules/${mockSchedule.id}/dashboard`) {
      await fulfillJson(route, {
        schedule: mockSchedule,
        month: '2026-05',
        enrollments: [
          {
            enrollmentId: mockEnrollment.id,
            studentId: mockEnrollment.studentId,
            studentName: mockEnrollment.studentName,
            studentDoc: mockEnrollment.studentDoc,
            amount: 400,
            paidAmount: 150,
            pendingAmount: 250,
            paidThisMonth: true,
            lastPaymentDate: '2026-05-20',
          },
        ],
        summary: {
          enrolled: 1,
          paid: 1,
          debtors: 0,
          occupancyPct: 8,
          sessions: 8,
          completedSessions: 0,
          pendingSessions: 8,
          expectedAmount: 400,
          paidAmount: 150,
          pendingAmount: 250,
        },
      });
      return;
    }

    if (path === `/schedules/${mockSchedule.id}/sessions`) {
      await fulfillJson(route, paginated([]));
      return;
    }

    if (path === '/enrollments') {
      await fulfillJson(route, paginated([mockEnrollment], Number(url.searchParams.get('limit') ?? 25)));
      return;
    }

    if (path === `/enrollments/${mockEnrollment.id}`) {
      await fulfillJson(route, mockEnrollment);
      return;
    }

    if (path === '/student-payments') {
      const items = url.searchParams.get('enrollmentId')
        ? mockStudentPayments
        : [];
      await fulfillJson(route, paginated(items, Number(url.searchParams.get('limit') ?? 25)));
      return;
    }

    if (path === '/student-payments/debtors') {
      await fulfillJson(route, []);
      return;
    }

    if (path === '/teacher-payments' || path === '/expenses') {
      await fulfillJson(route, emptyPage);
      return;
    }

    await fulfillJson(route, emptyPage);
  });
}
