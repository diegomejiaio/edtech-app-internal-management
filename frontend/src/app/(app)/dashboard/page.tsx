'use client';

/**
 * Dashboard page — hybrid layout.
 *
 * 1. Page header with quick-action "Nueva matrícula" (⌘N) opens an inline sheet.
 * 2. Global KPIs for the whole academy (students, schedules, income, balance).
 * 3. Active schedules summary card (top 8 with occupancy badges).
 * 4. Schedule drill-down (existing ScheduleDashboard with selector + month).
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import {
  GlobalKpis,
  QuickEnrollmentSheet,
  ScheduleDashboard,
  WeeklySchedulesCalendar,
} from '@/components/dashboard';

export default function DashboardPage() {
  const client = useApiClient();
  const [enrollOpen, setEnrollOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen de la actividad de la academia"
      >
        <PageHeaderButton
          icon={Plus}
          onClick={() => setEnrollOpen(true)}
          shortcutKey="n"
        >
          Nueva matrícula
        </PageHeaderButton>
      </PageHeader>

      <GlobalKpis client={client} />

      <WeeklySchedulesCalendar client={client} />

      <ScheduleDashboard client={client} />

      <QuickEnrollmentSheet
        client={client}
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
      />
    </div>
  );
}
