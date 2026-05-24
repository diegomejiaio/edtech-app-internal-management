'use client';

/**
 * Course detail client view — uses useParams for runtime routing.
 *
 * Rendered by the server `page.tsx` which exports `generateStaticParams`
 * for Next.js static export (`output: 'export'`).
 */

import { BookOpen } from 'lucide-react';
import { useParams } from 'next/navigation';
import { PageBreadcrumb, PageHeader } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';

export function CourseDetailView() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: 'Cursos', href: '/courses' },
          { label: `Curso ${id}` },
        ]}
      />

      <PageHeader
        title={`Curso ${id}`}
        subtitle="Detalle del curso"
        backHref="/courses"
      />

      <EmptyState
        icon={BookOpen}
        title="Detalle del curso no disponible aún"
        description="La vista de detalle se habilitará cuando esté lista la API de cursos."
      />
    </div>
  );
}
