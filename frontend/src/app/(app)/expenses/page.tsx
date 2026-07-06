'use client';

/**
 * Expenses list page — M8.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { toIsoDate } from '@/lib/dashboard-period';
import { formatTableDate } from '@/lib/dates';
import { flattenInfiniteItems, getInfiniteTotal, useInfiniteExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useCatalog } from '@/hooks';
import { DataTable, RowActions, SearchBar, FormSheetDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { SchedulePicker, CatalogSelect } from '@/components/pickers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage, isApiError } from '@/lib/api';
import type { Expense, ExpenseBody } from '@/lib/api';

const columns: Column<Expense>[] = [
  { key: 'code', header: 'Código', cell: (e) => e.code ? <span className="font-mono text-xs font-medium">{e.code}</span> : '—' },
  { key: 'date', header: 'Fecha', cell: (e) => formatTableDate(e.date) },
  { key: 'category', header: 'Categoría', cell: (e) => e.category },
  { key: 'description', header: 'Descripción', cell: (e) => e.description },
  { key: 'amount', header: 'Monto', cell: (e) => `S/ ${e.amount.toFixed(2)}` },
  { key: 'method', header: 'Medio', cell: (e) => e.paymentMethod },
  { key: 'schedule', header: 'Horario', cell: (e) => e.scheduleName ?? '—' },
];

export default function ExpensesPage() {
  const client = useApiClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 25;

  const { data: categoriesCatalog } = useCatalog(client, 'expenseCategories');
  const categoryOptions = (categoriesCatalog?.items ?? [])
    .filter((i) => i.active)
    .slice()
    .sort((a, b) => a.order - b.order);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteExpenses(client, {
    search: search || undefined,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    limit,
  });
  const expenses = useMemo(() => flattenInfiniteItems(data, { sortBy: (e) => e.date }), [data]);
  const total = getInfiniteTotal(data);
  const createMutation = useCreateExpense(client);
  const updateMutation = useUpdateExpense(client);
  const deleteMutation = useDeleteExpense(client);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [pickedScheduleId, setPickedScheduleId] = useState<string | undefined>();
  const [pickedCategory, setPickedCategory] = useState<string | undefined>();
  const [pickedPaymentMethod, setPickedPaymentMethod] = useState<string | undefined>();

  function openCreate() { setEditing(null); setPickedScheduleId(undefined); setPickedCategory(undefined); setPickedPaymentMethod(undefined); setFormOpen(true); }
  function openEdit(e: Expense) { setEditing(e); setPickedScheduleId(e.scheduleId ?? undefined); setPickedCategory(e.category); setPickedPaymentMethod(e.paymentMethod); setFormOpen(true); }

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const body: ExpenseBody = {
      date: fd.get('date') as string,
      category: pickedCategory ?? (fd.get('category') as string),
      description: fd.get('description') as string,
      amount: Number(fd.get('amount')),
      paymentMethod: pickedPaymentMethod ?? (fd.get('paymentMethod') as string),
      scheduleId: pickedScheduleId || null,
      notes: (fd.get('notes') as string) || null,
    };

    const mutation = editing
      ? updateMutation.mutateAsync({ id: editing.id, body, ifMatch: editing._etag })
      : createMutation.mutateAsync(body);

    mutation
      .then(() => { setFormOpen(false); toast.success(editing ? 'Gasto actualizado' : 'Gasto registrado'); })
      .catch((err) => {
        if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gastos" subtitle="Registro de gastos operativos">
        <PageHeaderButton icon={Plus} onClick={openCreate} shortcutKey="n">
          Nuevo gasto
        </PageHeaderButton>
      </PageHeader>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex-1">
          <SearchBar
            placeholder="Buscar por descripción, categoría u horario..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="lg:w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categoryOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="lg:w-40"
          aria-label="Desde"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="lg:w-40"
          aria-label="Hasta"
        />
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        total={total}
        hasNextPage={hasNextPage}
        onLoadMore={() => fetchNextPage()}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        actions={(e) => (
          <RowActions
            onEdit={() => openEdit(e)}
            onDelete={() => setDeleteTarget(e)}
          />
        )}
      />

      {/* Create / Edit sheet */}
      <FormSheetDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar gasto' : 'Nuevo gasto'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="date">Fecha</Label><Input id="date" name="date" type="date" defaultValue={editing?.date ?? toIsoDate(new Date())} required /></div>
          <div className="space-y-2"><Label>Categoría</Label><CatalogSelect client={client} catalogCode="expenseCategories" value={pickedCategory} onChange={setPickedCategory} placeholder="Seleccionar categoría..." /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="description">Descripción</Label><Input id="description" name="description" defaultValue={editing?.description} required /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="amount">Monto (S/)</Label><Input id="amount" name="amount" type="number" step="0.01" defaultValue={editing?.amount} required /></div>
          <div className="space-y-2"><Label>Medio de pago</Label><CatalogSelect client={client} catalogCode="paymentMethods" value={pickedPaymentMethod} onChange={setPickedPaymentMethod} placeholder="Seleccionar medio..." /></div>
        </div>
        <div className="space-y-2">
          <Label>Horario (opcional)</Label>
          <SchedulePicker client={client} value={pickedScheduleId} onChange={(id) => setPickedScheduleId(id)} name="scheduleId" activeOnly={false} />
        </div>
        <div className="space-y-2"><Label htmlFor="notes">Notas</Label><Input id="notes" name="notes" defaultValue={editing?.notes ?? ''} /></div>
      </FormSheetDialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutateAsync(deleteTarget.id)
          .then(() => { setDeleteTarget(null); toast.success('Gasto eliminado'); })
          .catch(() => toast.error('Error al eliminar'))
        }
        entityName={deleteTarget ? `el gasto "${deleteTarget.description}"` : undefined}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
