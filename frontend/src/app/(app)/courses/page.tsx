'use client';

/**
 * Courses page — backed by the `courses` catalog (master/catalogs).
 *
 * Courses are catalog items (strings like "Melamina", "Drywall") rather
 * than standalone entities. This page exposes the same add/disable flow
 * as the global Catalogs page but scoped to a single catalog code.
 */

import { useState, type FormEvent } from 'react';
import { BookOpen, Plus } from 'lucide-react';
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

const CATALOG_CODE = 'courses';

export default function CoursesPage() {
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
        if (isApiError(err)) toast.error(getApiErrorMessage(err));
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
      <PageHeader title="Cursos" subtitle="Catálogo de cursos disponibles">
        <PageHeaderButton icon={Plus} onClick={() => setOpen(true)} shortcutKey="n">
          Nuevo curso
        </PageHeaderButton>
      </PageHeader>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No hay cursos creados aún"
          description="Cuando crees tu primer curso aparecerá aquí."
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
        title="Nuevo curso"
        isLoading={addMutation.isPending}
        onSubmit={handleAddSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="value">Nombre del curso</Label>
          <Input id="value" name="value" required placeholder="Ej. Melamina" />
        </div>
      </FormSheetDialog>
    </div>
  );
}
