/**
 * Smoke test for `useScheduleDashboard` (M9 BFF wiring).
 *
 * Guards against the regression discovered in the M9 wire-up: the hook must
 * call `GET /schedules/{id}/dashboard` with the `month` query, forward the
 * response shape unchanged, and only fire when a `scheduleId` is set.
 *
 * This test pairs with `src/lib/api/types.test.ts` (label/enum drift guard)
 * to lock in the camelCase wire format end to end.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { useScheduleDashboard } from './use-schedules';
import type { ApiClient, ScheduleDashboard } from '@/lib/api';

function buildDashboardFixture(): ScheduleDashboard {
  return {
    schedule: {
      id: 'sch-1',
      type: 'schedule',
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: { clerkUserId: 'u1', email: 'a@b.c', displayName: 'A' },
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: { clerkUserId: 'u1', email: 'a@b.c', displayName: 'A' },
      course: 'Inglés',
      level: 'B1',
      teacherId: 't-1',
      teacherName: 'Prof. Demo',
      weekdays: 'Lun-Mié',
      startTime: '18:00',
      endTime: '19:30',
      price: 250,
      capacity: 12,
      status: 'active', // camelCase wire format — locks in the M9 fix
      startDate: '2026-01-15',
      courseDurationHours: 16,
      projectedEndDate: '2026-02-02',
      enrolledActiveCount: 8,
      occupancyPct: 8 / 12,
      sessionCount: 8,
    },
    month: '2026-05',
    enrollments: [
      {
        enrollmentId: 'enr-1',
        studentId: 'stu-1',
        studentName: 'Juan Pérez',
        studentDoc: 'DNI 12345678',
        amount: 250,
        paidAmount: 250,
        pendingAmount: 0,
        paidThisMonth: true,
        lastPaymentDate: '2026-05-03',
      },
      {
        enrollmentId: 'enr-2',
        studentId: 'stu-2',
        studentName: 'Ana Quispe',
        studentDoc: 'DNI 87654321',
        amount: 250,
        paidAmount: 100,
        pendingAmount: 150,
        paidThisMonth: false,
        lastPaymentDate: null,
      },
    ],
    summary: {
      enrolled: 2,
      paid: 1,
      debtors: 1,
      occupancyPct: 8 / 12,
      sessions: 8,
      completedSessions: 2,
      pendingSessions: 6,
      expectedAmount: 500,
      paidAmount: 350,
      pendingAmount: 150,
    },
  };
}

function makeClient(): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useScheduleDashboard', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  it('does not fire when scheduleId is undefined', () => {
    const client = makeClient();
    renderHook(() => useScheduleDashboard(client, undefined, '2026-05'), {
      wrapper: wrapper(qc),
    });
    expect(client.get).not.toHaveBeenCalled();
  });

  it('fetches /schedules/{id}/dashboard and forwards the camelCase wire shape', async () => {
    const client = makeClient();
    const fixture = buildDashboardFixture();
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fixture);

    const { result } = renderHook(
      () => useScheduleDashboard(client, 'sch-1', '2026-05'),
      { wrapper: wrapper(qc) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith(
      '/schedules/sch-1/dashboard',
      expect.objectContaining({ params: { month: '2026-05' } }),
    );
    expect(result.current.data).toEqual(fixture);
    // Wire-format guard: status arrives as 'active', not 'Activo'.
    expect(result.current.data?.schedule.status).toBe('active');
  });

  it('omits the month param when called without one', async () => {
    const client = makeClient();
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      buildDashboardFixture(),
    );

    const { result } = renderHook(
      () => useScheduleDashboard(client, 'sch-1'),
      { wrapper: wrapper(qc) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.get).toHaveBeenCalledWith(
      '/schedules/sch-1/dashboard',
      undefined,
    );
  });
});
