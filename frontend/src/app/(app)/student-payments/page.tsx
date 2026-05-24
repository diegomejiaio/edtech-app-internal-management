'use client';

/**
 * Student Payments list page — M6.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { formatTableDate } from '@/lib/dates';
import { flattenInfiniteItems, getInfiniteTotal, useInfiniteStudentPayments, useCreateStudentPayment, useUpdateStudentPayment, useDeleteStudentPayment } from '@/hooks';
import { PageHeader, DataTable, RowActions, FormSheetDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { EnrollmentPicker, CatalogSelect } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { isApiError } from '@/lib/api';
import type { StudentPayment, StudentPaymentBody } from '@/lib/api';

const columns: Column<StudentPayment>[] = [
  { key: 'student', header: 'Alumno', cell: (p) => p.studentName },
  { key: 'schedule', header: 'Horario', cell: (p) => p.scheduleName },
  { key: 'date', header: 'Fecha', cell: (p) => formatTableDate(p.date) },
  { key: 'amount', header: 'Monto', cell: (p) => `S/ ${p.amount.toFixed(2)}` },
  { key: 'installment', header: 'Cuota', cell: (p) => `#${p.installmentNumber}` },
  { key: 'method', header: 'Medio', cell: (p) => p.paymentMethod },
  {
    key: 'receipt',
    header: 'Boleta',
    cell: (p) => p.hasReceipt
      ? <Badge variant="default">{p.receiptNumber ?? 'Sí'}</Badge>
      : <Badge variant="secondary">No</Badge>,
  },
];

export default function StudentPaymentsPage() {
  const client = useApiClient();
  const limit = 25;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteStudentPayments(client, {
    limit,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });
  const studentPayments = useMemo(() => flattenInfiniteItems(data, { sortBy: (p) => p.date }), [data]);
  const total = getInfiniteTotal(data);
  const createMutation = useCreateStudentPayment(client);
  const updateMutation = useUpdateStudentPayment(client);
  const deleteMutation = useDeleteStudentPayment(client);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentPayment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentPayment | null>(null);
  const [pickedEnrollmentId, setPickedEnrollmentId] = useState<string | undefined>();
  const [pickedPaymentMethod, setPickedPaymentMethod] = useState<string | undefined>();

  function openCreate() { setEditing(null); setPickedEnrollmentId(undefined); setPickedPaymentMethod(undefined); setFormOpen(true); }
  function openEdit(p: StudentPayment) { setEditing(p); setPickedEnrollmentId(p.enrollmentId); setPickedPaymentMethod(p.paymentMethod); setFormOpen(true); }

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const body: StudentPaymentBody = {
      enrollmentId: pickedEnrollmentId ?? (fd.get('enrollmentId') as string),
      date: fd.get('date') as string,
      amount: Number(fd.get('amount')),
      installmentNumber: Number(fd.get('installmentNumber')),
      paymentMethod: pickedPaymentMethod ?? (fd.get('paymentMethod') as string),
      hasReceipt: fd.get('hasReceipt') === 'on',
      receiptNumber: (fd.get('receiptNumber') as string) || null,
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
        title="Pagos de alumnos"
        description="Registro de pagos por inscripción"
        action={<Button onClick={openCreate}>Nuevo pago</Button>}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="sm:w-40" aria-label="Desde" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="sm:w-40" aria-label="Hasta" />
      </div>

      <DataTable
        columns={columns}
        data={studentPayments}
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
        title={editing ? 'Editar pago' : 'Nuevo pago'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <Label>Inscripción</Label>
          <EnrollmentPicker client={client} value={pickedEnrollmentId} onChange={(id) => setPickedEnrollmentId(id)} name="enrollmentId" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="date">Fecha</Label><Input id="date" name="date" type="date" defaultValue={editing?.date} required /></div>
          <div className="space-y-2"><Label htmlFor="amount">Monto (S/)</Label><Input id="amount" name="amount" type="number" step="0.01" defaultValue={editing?.amount} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="installmentNumber">N° Cuota</Label><Input id="installmentNumber" name="installmentNumber" type="number" defaultValue={editing?.installmentNumber} required /></div>
          <div className="space-y-2"><Label>Medio de pago</Label><CatalogSelect client={client} catalogCode="paymentMethods" value={pickedPaymentMethod} onChange={setPickedPaymentMethod} placeholder="Seleccionar medio..." /></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="hasReceipt" name="hasReceipt" defaultChecked={editing?.hasReceipt} />
            <Label htmlFor="hasReceipt">¿Tiene boleta?</Label>
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="receiptNumber">N° Boleta</Label>
            <Input id="receiptNumber" name="receiptNumber" defaultValue={editing?.receiptNumber ?? ''} />
          </div>
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
        entityName={deleteTarget ? `el pago de ${deleteTarget.studentName}` : undefined}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
