'use client';

/**
 * Teacher Payments list page — M7.
 */

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { useTeacherPayments, useCreateTeacherPayment, useUpdateTeacherPayment, useDeleteTeacherPayment } from '@/hooks';
import { PageHeader, DataTable, FormDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { TeacherPicker, CatalogSelect } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isApiError } from '@/lib/api';
import type { TeacherPayment, TeacherPaymentBody } from '@/lib/api';

const columns: Column<TeacherPayment>[] = [
  { key: 'teacher', header: 'Profesor', cell: (p) => p.teacherName },
  { key: 'doc', header: 'Documento', cell: (p) => p.teacherDoc },
  { key: 'date', header: 'Fecha', cell: (p) => p.date },
  { key: 'amount', header: 'Monto', cell: (p) => `S/ ${p.amount.toFixed(2)}` },
  { key: 'concept', header: 'Concepto', cell: (p) => p.concept },
  { key: 'method', header: 'Medio', cell: (p) => p.paymentMethod },
];

export default function TeacherPaymentsPage() {
  const client = useApiClient();
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const { data, isLoading } = useTeacherPayments(client, { limit, offset });
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
        if (isApiError(err)) toast.error(err.problem.detail ?? err.message);
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos de profesores"
        description="Registro de honorarios"
        action={<Button onClick={openCreate}>Nuevo pago</Button>}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        limit={limit}
        offset={offset}
        onPageChange={setOffset}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        actions={(p) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(p)}>Eliminar</Button>
          </div>
        )}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar pago' : 'Nuevo pago profesor'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div>
          <Label>Profesor</Label>
          <TeacherPicker client={client} value={pickedTeacherId} onChange={(id) => setPickedTeacherId(id)} name="teacherId" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="date">Fecha</Label><Input id="date" name="date" type="date" defaultValue={editing?.date} required /></div>
          <div><Label htmlFor="amount">Monto (S/)</Label><Input id="amount" name="amount" type="number" step="0.01" defaultValue={editing?.amount} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="concept">Concepto</Label><Input id="concept" name="concept" defaultValue={editing?.concept} required /></div>
          <div><Label>Medio de pago</Label><CatalogSelect client={client} catalogCode="paymentMethods" value={pickedPaymentMethod} onChange={setPickedPaymentMethod} placeholder="Seleccionar medio..." /></div>
        </div>
        <div><Label htmlFor="notes">Notas</Label><Input id="notes" name="notes" defaultValue={editing?.notes ?? ''} /></div>
      </FormDialog>

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
