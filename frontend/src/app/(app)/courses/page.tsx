'use client';

/**
 * Courses page — backed by the `courses` catalog (master/catalogs).
 *
 * Courses are catalog items (strings like "Melamina", "Drywall") rather
 * than standalone entities. This page provides a scoped CRUD surface over
 * the `courses` catalog while keeping soft-delete semantics via active=false.
 */

import { useState, type FormEvent } from 'react';
import { Ban, BookOpen, Pencil, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { useCatalog, useAddCatalogItem, useReplaceCatalogItems } from '@/hooks';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { DataTable, FormSheetDialog, type Column } from '@/components/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { getApiErrorMessage, isApiError, type CatalogItem } from '@/lib/api';

const CATALOG_CODE = 'courses';

export default function CoursesPage() {
  const client = useApiClient();
  const { data: catalog, isLoading } = useCatalog(client, CATALOG_CODE);
  const addMutation = useAddCatalogItem(client, CATALOG_CODE);
  const replaceMutation = useReplaceCatalogItems(client, CATALOG_CODE);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setEditing(item);
    setOpen(true);
  }

  function getDuplicateItem(value: string) {
    return catalog?.items.find((item) =>
      item.value.toLowerCase() === value.toLowerCase() && item.value !== editing?.value
    );
  }

  function handleAddSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const value = (fd.get('value') as string)?.trim();
    if (!value) {
      toast.error('Ingresa el nombre del curso');
      return;
    }
    if (getDuplicateItem(value)) {
      toast.error(`"${value}" ya existe`);
      return;
    }

    const mutation = editing
      ? replaceMutation.mutateAsync({
          items: (catalog?.items ?? []).map((item) =>
            item.value === editing.value ? { ...item, value } : item,
          ),
          ifMatch: catalog?._etag,
        })
      : addMutation.mutateAsync({ value });

    mutation
      .then(() => {
        setOpen(false);
        setEditing(null);
        toast.success(editing ? 'Curso actualizado' : `"${value}" agregado`);
      })
      .catch((err) => {
        if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  function handleToggleActive(item: CatalogItem) {
    replaceMutation
      .mutateAsync({
        items: (catalog?.items ?? []).map((current) =>
          current.value === item.value ? { ...current, active: !item.active } : current,
        ),
        ifMatch: catalog?._etag,
      })
      .then(() => toast.success(`"${item.value}" ${item.active ? 'desactivado' : 'reactivado'}`))
      .catch((err) => {
        if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error(item.active ? 'Error al desactivar' : 'Error al reactivar');
      });
  }

  const items = (catalog?.items ?? []).slice().sort((a, b) => a.order - b.order);
  const columns: Column<CatalogItem>[] = [
    {
      key: 'value',
      header: 'Curso',
      cell: (item) => <span className="font-medium">{item.value}</span>,
    },
    {
      key: 'duration',
      header: 'Duración',
      cell: (item) => formatDurationMetadata(item.metadata),
    },
    {
      key: 'order',
      header: 'Orden',
      cell: (item) => item.order,
    },
    {
      key: 'active',
      header: 'Estado',
      cell: (item) => (
        <Badge variant={item.active ? 'default' : 'secondary'}>
          {item.active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Cursos" subtitle="Catálogo de cursos disponibles" backHref="/catalogs">
        <PageHeaderButton icon={Plus} onClick={openCreate} shortcutKey="n">
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
        <DataTable
          columns={columns}
          data={items}
          total={items.length}
          rowKey={(item) => item.value}
          animated={false}
          actions={(item) => (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${item.value}`}
                title="Editar"
                onClick={() => openEdit(item)}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={item.active ? 'text-destructive hover:text-destructive' : 'text-primary hover:text-primary'}
                aria-label={item.active ? `Desactivar ${item.value}` : `Reactivar ${item.value}`}
                title={item.active ? 'Desactivar' : 'Reactivar'}
                disabled={replaceMutation.isPending}
                onClick={() => handleToggleActive(item)}
              >
                {item.active ? <Ban /> : <RotateCcw />}
              </Button>
            </div>
          )}
        />
      )}

      <FormSheetDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
        title={editing ? 'Editar curso' : 'Nuevo curso'}
        description={editing ? 'Actualiza el nombre del curso. Los horarios existentes conservan su información histórica.' : undefined}
        isLoading={addMutation.isPending || replaceMutation.isPending}
        onSubmit={handleAddSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="value">Nombre del curso</Label>
          <Input
            key={editing?.value ?? 'new-course'}
            id="value"
            name="value"
            required
            defaultValue={editing?.value ?? ''}
            placeholder="Ej. Melamina"
          />
        </div>
      </FormSheetDialog>
    </div>
  );
}

function formatDurationMetadata(metadata: CatalogItem['metadata']) {
  const byLevel = metadata?.durationHoursByLevel;
  if (!byLevel || typeof byLevel !== 'object' || Array.isArray(byLevel)) return '—';

  return Object.entries(byLevel)
    .map(([level, hours]) => `${level}: ${String(hours)} h`)
    .join(' · ');
}
