'use client';

/**
 * Teacher detail client view — uses useParams for runtime routing.
 *
 * Rendered by the server `page.tsx` which exports `generateStaticParams`
 * for Next.js static export (`output: 'export'`).
 */

import { GraduationCap } from 'lucide-react';
import { useParams } from 'next/navigation';
import { PageBreadcrumb, PageHeader } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';

export function TeacherDetailView() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: 'Profesores', href: '/teachers' },
          { label: `Profesor ${id}` },
        ]}
      />

      <PageHeader
        title={`Profesor ${id}`}
        subtitle="Detalle del profesor"
        backHref="/teachers"
      />

      <EmptyState
        icon={GraduationCap}
        title="Detalle del profesor no disponible aún"
        description="La vista de detalle se habilitará cuando esté lista la API de profesores."
      />
    </div>
  );
}
