'use client';

/**
 * GlobalKpis — aggregated metrics for the whole academy.
 *
 * Renders 4 stat cards using existing list endpoints. The income/balance
 * KPIs respect the period selected via {@link PeriodFilter}; the alumnos
 * and horarios KPIs are point-in-time and do not depend on the period.
 */

import { useState } from 'react';
import { Users, CalendarRange, TrendingUp, Wallet } from 'lucide-react';
import { StatCard, StatCardSkeleton } from '@/components/ui/stat-card';
import {
  useEnrollments,
  useSchedules,
  useStudentPayments,
  useExpenses,
} from '@/hooks';
import type { ApiClient } from '@/lib/api';
import {
  formatCurrency,
  presetRange,
  rangeToIso,
  type DateRange,
} from '@/lib/dashboard-period';
import { PeriodFilter } from './period-filter';

interface GlobalKpisProps {
  client: ApiClient;
}

export function GlobalKpis({ client }: GlobalKpisProps) {
  const [period, setPeriod] = useState<DateRange>(
    () => presetRange('thisMonth')!,
  );
  const { from, to } = rangeToIso(period);

  // Active students = distinct studentIds across active enrollments.
  // Capped at 500 — sufficient for the MVP-scale academy; the day the
  // page hits the limit a dedicated `/dashboard/stats` endpoint should
  // take over (see docs/04-api-design.md).
  const enrollmentsQuery = useEnrollments(client, {
    status: 'active',
    limit: 500,
  });
  const schedulesQuery = useSchedules(client, { status: 'active', limit: 1 });
  const paymentsQuery = useStudentPayments(client, { from, to, limit: 500 });
  const expensesQuery = useExpenses(client, { from, to, limit: 500 });

  const isLoading =
    enrollmentsQuery.isLoading ||
    schedulesQuery.isLoading ||
    paymentsQuery.isLoading ||
    expensesQuery.isLoading;

  const activeEnrollments = enrollmentsQuery.data?.items ?? [];
  const activeStudents = new Set(activeEnrollments.map((e) => e.studentId)).size;
  const activeSchedules = schedulesQuery.data?.total ?? 0;
  const income = (paymentsQuery.data?.items ?? []).reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0,
  );
  const expenses = (expensesQuery.data?.items ?? []).reduce(
    (sum, e) => sum + (e.amount ?? 0),
    0,
  );
  const balance = income - expenses;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Resumen del periodo
        </h2>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} variant="badge" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            variant="badge"
            label="Alumnos activos"
            value={activeStudents}
            icon={Users}
            iconClassName="text-sky-500"
            description="Con matrícula vigente"
          />
          <StatCard
            variant="badge"
            label="Horarios activos"
            value={activeSchedules}
            icon={CalendarRange}
            iconClassName="text-violet-500"
            description="Clases en curso"
          />
          <StatCard
            variant="badge"
            label="Ingresos"
            value={formatCurrency(income)}
            icon={TrendingUp}
            iconClassName="text-emerald-500"
            valueClassName="text-success"
            description="Pagos de alumnos"
          />
          <StatCard
            variant="badge"
            label="Balance"
            value={formatCurrency(balance)}
            icon={Wallet}
            iconClassName="text-amber-500"
            valueClassName={balance >= 0 ? 'text-success' : 'text-destructive'}
            description={`Ingresos − gastos (${formatCurrency(expenses)})`}
          />
        </div>
      )}
    </div>
  );
}
