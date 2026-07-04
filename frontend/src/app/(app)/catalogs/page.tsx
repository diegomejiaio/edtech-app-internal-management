'use client';

/**
 * Catalogs management page — M1.
 *
 * Lists all catalogs with quick view of items.
 * Edit button navigates to the individual catalog CRUD page.
 */

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import { useCatalogs, useAddCatalogItem, useDisableCatalogItem } from '@/hooks';
import { PageHeader, FormSheetDialog } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage, isApiError } from '@/lib/api';
import type { Catalog } from '@/lib/api';

/** Maps catalog code → individual CRUD route */
const CATALOG_ROUTES: Record<string, string> = {
  courses: '/courses',
  levels: '/levels',
  weekdays: '/weekdays',
  studentSources: '/student-sources',
  spaces: '/spaces',
  paymentMethods: '/payment-methods',
  expenseCategories: '/expense-categories',
};

/** Maps catalog code → user-friendly Spanish label */
const CATALOG_LABELS: Record<string, string> = {
  courses: 'Cursos',
  levels: 'Niveles',
  weekdays: 'Días',
  studentSources: 'Fuentes de alumnos',
  spaces: 'Espacios',
  paymentMethods: 'Medios de pago',
  expenseCategories: 'Categorías de gastos',
};

export default function CatalogsPage() {
  const client = useApiClient();
  const { data: catalogs, isLoading } = useCatalogs(client);

  const [addingTo, setAddingTo] = useState<string | null>(null);
  const addMutation = useAddCatalogItem(client, addingTo ?? '');

  function handleAddSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!addingTo) return;
    const fd = new FormData(ev.currentTarget);
    const value = fd.get('value') as string;

    addMutation.mutateAsync({ value })
      .then(() => { setAddingTo(null); toast.success(`"${value}" agregado`); })
      .catch((err) => {
        if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogos"
        description="Datos maestros del sistema (cursos, niveles, medios de pago, etc.)"
        action={(
          <Button asChild>
            <Link href="/teachers">Gestionar profesores</Link>
          </Button>
        )}
      />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {catalogs?.map((catalog) => (
          <CatalogCard
            key={catalog.id}
            catalog={catalog}
            client={client}
            onAddItem={() => setAddingTo(catalog.code)}
          />
        ))}
      </div>

      {/* Add item sheet */}
      <FormSheetDialog
        open={!!addingTo}
        onOpenChange={(open) => !open && setAddingTo(null)}
        title={`Agregar item — ${CATALOG_LABELS[addingTo ?? ''] ?? addingTo}`}
        isLoading={addMutation.isPending}
        onSubmit={handleAddSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="value">Valor</Label>
          <Input id="value" name="value" required placeholder="Nombre del item" />
        </div>
      </FormSheetDialog>
    </div>
  );
}

function CatalogCard({
  catalog,
  client,
  onAddItem,
}: {
  catalog: Catalog;
  client: ReturnType<typeof useApiClient>;
  onAddItem: () => void;
}) {
  const disableMutation = useDisableCatalogItem(client, catalog.code);
  const editRoute = CATALOG_ROUTES[catalog.code];

  function handleDisable(value: string) {
    disableMutation.mutateAsync(value)
      .then(() => toast.success(`"${value}" desactivado`))
      .catch(() => toast.error('Error al desactivar'));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{CATALOG_LABELS[catalog.code] ?? catalog.code}</CardTitle>
        <div className="flex items-center gap-2">
          {editRoute && (
            <Button variant="outline" size="sm" asChild>
              <Link href={editRoute}>
                <Pencil className="mr-1 size-3.5" />
                Editar
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAddItem}>Agregar</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {catalog.items
            .sort((a, b) => a.order - b.order)
            .map((item) => (
              <Badge
                key={item.value}
                variant={item.active ? 'default' : 'secondary'}
                className="cursor-pointer"
                onClick={() => item.active && handleDisable(item.value)}
                title={item.active ? 'Clic para desactivar' : 'Desactivado'}
              >
                {item.value}
                {!item.active && ' ✕'}
              </Badge>
            ))}
          {catalog.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin items</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
