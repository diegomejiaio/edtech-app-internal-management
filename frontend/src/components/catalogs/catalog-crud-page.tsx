'use client';

import { useState, type FormEvent } from 'react';
import { Ban, Pencil, Plus, RotateCcw, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { useCatalog, useAddCatalogItem, useReplaceCatalogItems } from '@/hooks';
import { DataTable, FormSheetDialog, type Column } from '@/components/data';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage, isApiError, type CatalogCode, type CatalogItem } from '@/lib/api';

interface CatalogCrudPageProps {
  catalogCode: CatalogCode;
  title: string;
  subtitle: string;
  createButtonLabel: string;
  columnLabel: string;
  fieldLabel: string;
  fieldPlaceholder: string;
  fieldRequiredMessage: string;
  createSheetTitle: string;
  editSheetTitle: string;
  createSuccessMessage: (value: string) => string;
  editSuccessMessage: string;
  toggleSuccessMessage: (value: string, wasActive: boolean) => string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}

export function CatalogCrudPage({
  catalogCode,
  title,
  subtitle,
  createButtonLabel,
  columnLabel,
  fieldLabel,
  fieldPlaceholder,
  fieldRequiredMessage,
  createSheetTitle,
  editSheetTitle,
  createSuccessMessage,
  editSuccessMessage,
  toggleSuccessMessage,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: CatalogCrudPageProps) {
  const client = useApiClient();
  const { data: catalog, isLoading } = useCatalog(client, catalogCode);
  const addMutation = useAddCatalogItem(client, catalogCode);
  const replaceMutation = useReplaceCatalogItems(client, catalogCode);

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
    return catalog?.items.find(
      (item) => item.value.toLowerCase() === value.toLowerCase() && item.value !== editing?.value,
    );
  }

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const value = (fd.get('value') as string)?.trim();
    if (!value) {
      toast.error(fieldRequiredMessage);
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
        toast.success(editing ? editSuccessMessage : createSuccessMessage(value));
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
      .then(() => toast.success(toggleSuccessMessage(item.value, item.active)))
      .catch(() => toast.error(item.active ? 'Error al desactivar' : 'Error al reactivar'));
  }

  const items = (catalog?.items ?? []).slice().sort((a, b) => a.order - b.order);
  const columns: Column<CatalogItem>[] = [
    {
      key: 'value',
      header: columnLabel,
      cell: (item) => <span className="font-medium">{item.value}</span>,
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
      <PageHeader title={title} subtitle={subtitle} backHref="/catalogs">
        <PageHeaderButton icon={Plus} onClick={openCreate} shortcutKey="n">
          {createButtonLabel}
        </PageHeaderButton>
      </PageHeader>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
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
        title={editing ? editSheetTitle : createSheetTitle}
        isLoading={addMutation.isPending || replaceMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="value">{fieldLabel}</Label>
          <Input
            key={editing?.value ?? `new-${catalogCode}`}
            id="value"
            name="value"
            required
            defaultValue={editing?.value ?? ''}
            placeholder={fieldPlaceholder}
          />
        </div>
      </FormSheetDialog>
    </div>
  );
}
