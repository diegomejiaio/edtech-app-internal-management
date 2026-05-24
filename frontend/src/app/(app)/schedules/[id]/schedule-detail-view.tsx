'use client';

/**
 * Schedule detail client view — uses useParams for runtime routing.
 *
 * Rendered by the server `page.tsx` which exports `generateStaticParams`
 * for Next.js static export (`output: 'export'`).
 */

import { Calendar } from 'lucide-react';
import { useParams } from 'next/navigation';
import { PageBreadcrumb, PageHeader } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';

export function ScheduleDetailView() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: 'Horarios', href: '/schedules' },
          { label: `Horario ${id}` },
        ]}
      />

      <PageHeader
        title={`Horario ${id}`}
        subtitle="Detalle del horario"
        backHref="/schedules"
      />

      <EmptyState
        icon={Calendar}
        title="Detalle del horario no disponible aún"
        description="La vista de detalle se habilitará cuando esté lista la API de horarios."
      />
    </div>
  );
}
