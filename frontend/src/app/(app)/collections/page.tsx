'use client';

/**
 * Collections list page — scaffold.
 *
 * Placeholder until the `useDebtors` hook wiring and collections UI are implemented.
 * Collections are derived from payments, so there is no "create" action.
 */

import { HandCoins } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';

export default function CollectionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Cobranzas" subtitle="Gestión de cuentas por cobrar" />

      <EmptyState
        icon={HandCoins}
        title="No hay cobranzas pendientes"
        description="Cuando existan pagos pendientes por cobrar aparecerán aquí."
      />
    </div>
  );
}
