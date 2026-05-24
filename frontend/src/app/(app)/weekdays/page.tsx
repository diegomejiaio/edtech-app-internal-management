'use client';

/**
 * Weekdays page — backed by the `weekdays` catalog (master/catalogs).
 */

import { useState, type FormEvent } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { useCatalog, useAddCatalogItem, useDisableCatalogItem } from '@/hooks';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { FormSheetDialog } from '@/components/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { isApiError } from '@/lib/api';

const CATALOG_CODE = 'weekdays';

export default function WeekdaysPage() {
  const client = useApiClient();
  const { data: catalog, isLoading } = useCatalog(client, CATALOG_CODE);
  const addMutation = useAddCatalogItem(client, CATALOG_CODE);
  const disableMutation = useDisableCatalogItem(client, CATALOG_CODE);

  const [open, setOpen] = useState(false);

  function handleAddSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const value = (fd.get('value') as string)?.trim();
    if (!value) return;

    addMutation
      .mutateAsync({ value })
      .then(() => {
        setOpen(false);
        toast.success(`"${value}" agregado`);
      })
      .catch((err) => {
        if (isApiError(err)) toast.error(err.problem.detail ?? err.message);
        else toast.error('Error inesperado');
      });
  }

  function handleDisable(value: string) {
    disableMutation
      .mutateAsync(value)
      .then(() => toast.success(`"${value}" desactivado`))
      .catch(() => toast.error('Error al desactivar'));
  }

  const items = (catalog?.items ?? []).slice().sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <PageHeader title="Días" subtitle="Catálogo de días para horarios">
        <PageHeaderButton icon={Plus} onClick={() => setOpen(true)} shortcutKey="n">
          Nuevo día
        </PageHeaderButton>
      </PageHeader>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No hay días creados aún"
          description="Cuando crees tu primer día aparecerá aquí."
        />
      )}

      {!isLoading && items.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
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
            </div>
          </CardContent>
        </Card>
      )}

      <FormSheetDialog
        open={open}
        onOpenChange={setOpen}
        title="Nuevo día"
        isLoading={addMutation.isPending}
        onSubmit={handleAddSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="value">Nombre del día</Label>
          <Input id="value" name="value" required placeholder="Ej. Lunes" />
        </div>
      </FormSheetDialog>
    </div>
  );
}
