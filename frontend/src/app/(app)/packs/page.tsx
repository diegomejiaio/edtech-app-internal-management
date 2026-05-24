'use client';

/**
 * Packs list page — scaffold.
 *
 * Placeholder until the `usePacks` domain hook and CRUD UI are implemented.
 */

import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';

export default function PacksPage() {
  function handleCreate() {
    // TODO: open create-pack dialog when the domain hook is available.
    toast.info('Creación de packs próximamente');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Packs" subtitle="Catálogo de paquetes de cursos">
        <PageHeaderButton icon={Package} onClick={handleCreate} shortcutKey="n">
          Nuevo pack
        </PageHeaderButton>
      </PageHeader>

      <EmptyState
        icon={Package}
        title="No hay packs creados aún"
        description="Cuando crees tu primer paquete de cursos aparecerá aquí."
      />
    </div>
  );
}
