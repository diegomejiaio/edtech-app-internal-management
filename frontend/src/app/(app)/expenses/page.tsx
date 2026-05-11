'use client';

/**
 * Expenses list page — M8.
 */

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '@/hooks';
import { PageHeader, DataTable, FormDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { SchedulePicker, CatalogSelect } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isApiError } from '@/lib/api';
import type { Expense, ExpenseBody } from '@/lib/api';

const columns: Column<Expense>[] = [
  { key: 'date', header: 'Fecha', cell: (e) => e.date },
  { key: 'category', header: 'Categoría', cell: (e) => e.category },
  { key: 'description', header: 'Descripción', cell: (e) => e.description },
  { key: 'amount', header: 'Monto', cell: (e) => `S/ ${e.amount.toFixed(2)}` },
  { key: 'method', header: 'Medio', cell: (e) => e.paymentMethod },
  { key: 'schedule', header: 'Horario', cell: (e) => e.scheduleName ?? '—' },
];

export default function ExpensesPage() {
  const client = useApiClient();
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const { data, isLoading } = useExpenses(client, { limit, offset });
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
        if (isApiError(err)) toast.error(err.problem.detail ?? err.message);
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos"
        description="Registro de gastos operativos"
        action={<Button onClick={openCreate}>Nuevo gasto</Button>}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        limit={limit}
        offset={offset}
        onPageChange={setOffset}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        actions={(e) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>Editar</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(e)}>Eliminar</Button>
          </div>
        )}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar gasto' : 'Nuevo gasto'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="date">Fecha</Label><Input id="date" name="date" type="date" defaultValue={editing?.date} required /></div>
          <div><Label>Categoría</Label><CatalogSelect client={client} catalogCode="expenseCategories" value={pickedCategory} onChange={setPickedCategory} placeholder="Seleccionar categoría..." /></div>
        </div>
        <div><Label htmlFor="description">Descripción</Label><Input id="description" name="description" defaultValue={editing?.description} required /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="amount">Monto (S/)</Label><Input id="amount" name="amount" type="number" step="0.01" defaultValue={editing?.amount} required /></div>
          <div><Label>Medio de pago</Label><CatalogSelect client={client} catalogCode="paymentMethods" value={pickedPaymentMethod} onChange={setPickedPaymentMethod} placeholder="Seleccionar medio..." /></div>
        </div>
        <div>
          <Label>Horario (opcional)</Label>
          <SchedulePicker client={client} value={pickedScheduleId} onChange={(id) => setPickedScheduleId(id)} name="scheduleId" activeOnly={false} />
        </div>
        <div><Label htmlFor="notes">Notas</Label><Input id="notes" name="notes" defaultValue={editing?.notes ?? ''} /></div>
      </FormDialog>

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
