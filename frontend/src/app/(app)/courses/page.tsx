'use client';

/**
 * Courses list page — scaffold.
 *
 * Placeholder until the `useCourses` domain hook and CRUD UI are implemented.
 */

import { BookOpen, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';

export default function CoursesPage() {
  function handleCreate() {
    // TODO: open create-course dialog when the domain hook is available.
    toast.info('Creación de cursos aún no disponible');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Cursos" subtitle="Catálogo de cursos disponibles">
        <PageHeaderButton icon={Plus} onClick={handleCreate} shortcutKey="n">
          Nuevo curso
        </PageHeaderButton>
      </PageHeader>

      <EmptyState
        icon={BookOpen}
        title="No hay cursos creados aún"
        description="Cuando crees tu primer curso aparecerá aquí."
      />
    </div>
  );
}
