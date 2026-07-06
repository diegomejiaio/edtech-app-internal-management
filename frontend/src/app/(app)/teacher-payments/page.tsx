'use client';

/**
 * Teacher Payments list page — M7.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { toIsoDate } from '@/lib/dashboard-period';
import { formatTableDate } from '@/lib/dates';
import { flattenInfiniteItems, getInfiniteTotal, useInfiniteTeacherPayments, useCreateTeacherPayment, useUpdateTeacherPayment, useDeleteTeacherPayment } from '@/hooks';
import { DataTable, RowActions, FormSheetDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { TeacherPicker, CatalogSelect } from '@/components/pickers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage, isApiError } from '@/lib/api';
import type { TeacherPayment, TeacherPaymentBody } from '@/lib/api';

const columns: Column<TeacherPayment>[] = [
  { key: 'code', header: 'Código', cell: (p) => p.code ? <span className="font-mono text-xs font-medium">{p.code}</span> : '—' },
  { key: 'teacher', header: 'Profesor', cell: (p) => p.teacherName },
  { key: 'doc', header: 'Documento', cell: (p) => p.teacherDoc },
  { key: 'date', header: 'Fecha', cell: (p) => formatTableDate(p.date) },
  { key: 'amount', header: 'Monto', cell: (p) => `S/ ${p.amount.toFixed(2)}` },
  { key: 'concept', header: 'Concepto', cell: (p) => p.concept },
  { key: 'method', header: 'Medio', cell: (p) => p.paymentMethod },
];

export default function TeacherPaymentsPage() {
  const client = useApiClient();
  const limit = 25;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteTeacherPayments(client, {
    limit,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });
  const teacherPayments = useMemo(() => flattenInfiniteItems(data, { sortBy: (p) => p.date }), [data]);
  const total = getInfiniteTotal(data);
  const createMutation = useCreateTeacherPayment(client);
  const updateMutation = useUpdateTeacherPayment(client);
  const deleteMutation = useDeleteTeacherPayment(client);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherPayment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeacherPayment | null>(null);
  const [pickedTeacherId, setPickedTeacherId] = useState<string | undefined>();
  const [pickedPaymentMethod, setPickedPaymentMethod] = useState<string | undefined>();

  function openCreate() { setEditing(null); setPickedTeacherId(undefined); setPickedPaymentMethod(undefined); setFormOpen(true); }
  function openEdit(p: TeacherPayment) { setEditing(p); setPickedTeacherId(p.teacherId); setPickedPaymentMethod(p.paymentMethod); setFormOpen(true); }

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const body: TeacherPaymentBody = {
      teacherId: pickedTeacherId ?? (fd.get('teacherId') as string),
      date: fd.get('date') as string,
      amount: Number(fd.get('amount')),
      concept: fd.get('concept') as string,
      paymentMethod: pickedPaymentMethod ?? (fd.get('paymentMethod') as string),
      notes: (fd.get('notes') as string) || null,
    };

    const mutation = editing
      ? updateMutation.mutateAsync({ id: editing.id, body, ifMatch: editing._etag })
      : createMutation.mutateAsync(body);

    mutation
      .then(() => { setFormOpen(false); toast.success(editing ? 'Pago actualizado' : 'Pago registrado'); })
      .catch((err) => {
        if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pagos de profesores" subtitle="Registro de honorarios">
        <PageHeaderButton icon={Plus} onClick={openCreate} shortcutKey="n">
          Nuevo pago
        </PageHeaderButton>
      </PageHeader>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="sm:w-40" aria-label="Desde" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="sm:w-40" aria-label="Hasta" />
      </div>

      <DataTable
        columns={columns}
        data={teacherPayments}
        total={total}
        hasNextPage={hasNextPage}
        onLoadMore={() => fetchNextPage()}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        actions={(p) => (
          <RowActions
            onEdit={() => openEdit(p)}
            onDelete={() => setDeleteTarget(p)}
          />
        )}
      />

      {/* Create / Edit sheet */}
      <FormSheetDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar pago' : 'Nuevo pago profesor'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <Label>Profesor</Label>
          <TeacherPicker client={client} value={pickedTeacherId} onChange={(id) => setPickedTeacherId(id)} name="teacherId" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="date">Fecha</Label><Input id="date" name="date" type="date" defaultValue={editing?.date ?? toIsoDate(new Date())} required /></div>
          <div className="space-y-2"><Label htmlFor="amount">Monto (S/)</Label><Input id="amount" name="amount" type="number" step="0.01" defaultValue={editing?.amount} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="concept">Concepto</Label><Input id="concept" name="concept" defaultValue={editing?.concept} required /></div>
          <div className="space-y-2"><Label>Medio de pago</Label><CatalogSelect client={client} catalogCode="paymentMethods" value={pickedPaymentMethod} onChange={setPickedPaymentMethod} placeholder="Seleccionar medio..." /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="notes">Notas</Label><Input id="notes" name="notes" defaultValue={editing?.notes ?? ''} /></div>
      </FormSheetDialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutateAsync(deleteTarget.id)
          .then(() => { setDeleteTarget(null); toast.success('Pago eliminado'); })
          .catch(() => toast.error('Error al eliminar'))
        }
        entityName={deleteTarget ? `el pago a ${deleteTarget.teacherName}` : undefined}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
