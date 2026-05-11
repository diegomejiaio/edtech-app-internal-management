'use client';

/**
 * Dashboard page — M9.
 * Schedule dashboard with enrolled students and paid/debtor flags.
 */

import { useApiClient } from '@/hooks/use-api-client';
import { ScheduleDashboard } from '@/components/dashboard';
import { PageHeader } from '@/components/data';

export default function DashboardPage() {
  const client = useApiClient();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Vista por horario — inscritos y estado de pagos"
      />
      <ScheduleDashboard client={client} />
    </div>
  );
}
