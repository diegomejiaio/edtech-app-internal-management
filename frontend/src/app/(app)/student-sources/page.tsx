'use client';

/**
 * Student sources page — backed by the `studentSources` catalog (master/catalogs).
 */

import { useState, type FormEvent } from 'react';
import { Megaphone, Plus } from 'lucide-react';
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
import { getApiErrorMessage, isApiError } from '@/lib/api';

const CATALOG_CODE = 'studentSources';

export default function StudentSourcesPage() {
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
        toast.success(`"${value}" agregada`);
      })
      .catch((err) => {
        if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  function handleDisable(value: string) {
    disableMutation
      .mutateAsync(value)
      .then(() => toast.success(`"${value}" desactivada`))
      .catch(() => toast.error('Error al desactivar'));
  }

  const items = (catalog?.items ?? []).slice().sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <PageHeader title="Fuentes de alumnos" subtitle="Cómo nos conocieron los alumnos">
        <PageHeaderButton icon={Plus} onClick={() => setOpen(true)} shortcutKey="n">
          Nueva fuente
        </PageHeaderButton>
      </PageHeader>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={Megaphone}
          title="No hay fuentes creadas aún"
          description="Cuando crees tu primera fuente aparecerá aquí."
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
        title="Nueva fuente"
        isLoading={addMutation.isPending}
        onSubmit={handleAddSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="value">Nombre de la fuente</Label>
          <Input id="value" name="value" required placeholder="Ej. Instagram" />
        </div>
      </FormSheetDialog>
    </div>
  );
}
