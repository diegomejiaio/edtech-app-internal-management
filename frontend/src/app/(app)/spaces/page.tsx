'use client';

/**
 * Spaces list page — scaffold.
 *
 * Placeholder until the `useSpaces` domain hook and CRUD UI are implemented.
 */

import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';

export default function SpacesPage() {
  function handleCreate() {
    // TODO: open create-space dialog when the domain hook is available.
    toast.info('Creación de espacios próximamente');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Espacios" subtitle="Aulas y locaciones disponibles" backHref="/catalogs">
        <PageHeaderButton icon={MapPin} onClick={handleCreate} shortcutKey="n">
          Nuevo espacio
        </PageHeaderButton>
      </PageHeader>

      <EmptyState
        icon={MapPin}
        title="No hay espacios registrados aún"
        description="Cuando registres tu primer aula o locación aparecerá aquí."
      />
    </div>
  );
}
