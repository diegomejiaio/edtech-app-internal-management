'use client';

/**
 * Enrollments list page — M5.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { formatTableDate } from '@/lib/dates';
import { flattenInfiniteItems, getInfiniteTotal, useInfiniteEnrollments, useUpdateEnrollment, useDeleteEnrollment } from '@/hooks';
import { DataTable, RowActions, FormSheetDialog, ConfirmDeleteDialog, ReadOnlyField, StatusMultiSelect, StatusBadgeMenu, type Column, type StatusOption } from '@/components/data';
import { PageHeader, PageHeaderButton } from '@/components/layout';
import { EnrollmentWizard } from '@/components/enrollments/enrollment-wizard';
import { EnrollmentPaymentsBlock } from '@/components/enrollments/enrollment-payments-block';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage, isApiError, isConflict } from '@/lib/api';
import { STATUS_LABELS, STATUS_VARIANTS, TERMINAL_STATUSES } from '@/lib/status';
import type { Enrollment, EnrollmentBody, EnrollmentStatus } from '@/lib/api';

const STATUSES: EnrollmentStatus[] = ['active', 'completed', 'cancelled', 'pending'];
const STATUS_OPTIONS: StatusOption<EnrollmentStatus>[] = STATUSES.map((s) => ({ value: s, label: STATUS_LABELS.enrollment[s] }));
const DEFAULT_STATUS_FILTER: EnrollmentStatus[] = ['active', 'pending'];

const baseColumns: Column<Enrollment>[] = [
  { key: 'code', header: 'Código', cell: (e) => e.code ? <span className="font-mono text-xs font-medium">{e.code}</span> : '—' },
  { key: 'student', header: 'Alumno', cell: (e) => e.studentName },
  { key: 'doc', header: 'Documento', cell: (e) => e.studentDoc },
  { key: 'schedule', header: 'Horario', cell: (e) => e.scheduleName },
  { key: 'date', header: 'Fecha inscripción', cell: (e) => formatTableDate(e.enrollmentDate) },
  { key: 'price', header: 'Precio', cell: (e) => `S/ ${e.schedulePrice.toFixed(2)}` },
];

export default function EnrollmentsPage() {
  const client = useApiClient();
  const limit = 25;
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus[]>(DEFAULT_STATUS_FILTER);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteEnrollments(client, {
    limit,
    status: statusFilter,
  });
  const enrollments = useMemo(() => flattenInfiniteItems(data, { sortBy: (e) => e.enrollmentDate }), [data]);
  const total = getInfiniteTotal(data);
  const updateMutation = useUpdateEnrollment(client);
  const deleteMutation = useDeleteEnrollment(client);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Enrollment | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');

  function openCreate() { setWizardOpen(true); }
  function openEdit(e: Enrollment) { setEditing(e); setEditPrice(e.schedulePrice.toString()); setFormOpen(true); }

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!editing) return;
    const fd = new FormData(ev.currentTarget);
    // Student and schedule are frozen on edit; reuse the existing snapshots' ids.
    const body: EnrollmentBody = {
      studentId: editing.studentId,
      scheduleId: editing.scheduleId,
      enrollmentDate: fd.get('enrollmentDate') as string,
      status: fd.get('status') as EnrollmentStatus,
      schedulePrice: editPrice.trim() ? Number.parseFloat(editPrice) : undefined,
    };

    updateMutation.mutateAsync({ id: editing.id, body, ifMatch: editing._etag })
      .then(() => { setFormOpen(false); toast.success('Inscripción actualizada'); })
      .catch((err) => {
        if (isConflict(err)) toast.error('Ya existe una inscripción activa para este alumno en este horario');
        else if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  function handleStatusChange(e: Enrollment, next: EnrollmentStatus) {
    if (next === e.status) return;
    const body: EnrollmentBody = {
      studentId: e.studentId,
      scheduleId: e.scheduleId,
      enrollmentDate: e.enrollmentDate,
      status: next,
      schedulePrice: e.schedulePrice,
    };

    updateMutation.mutateAsync({ id: e.id, body, ifMatch: e._etag })
      .then(() => toast.success('Estado actualizado'))
      .catch((err) => {
        if (isConflict(err)) toast.error('Ya existe una inscripción activa para este alumno en este horario');
        else if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  const columns: Column<Enrollment>[] = [
    ...baseColumns,
    {
      key: 'status',
      header: 'Estado',
      cell: (e) => (
        <StatusBadgeMenu
          value={e.status}
          options={STATUS_OPTIONS}
          variants={STATUS_VARIANTS.enrollment}
          terminalStatuses={TERMINAL_STATUSES.enrollment}
          onChange={(next) => handleStatusChange(e, next)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Inscripciones" subtitle="Gestión de inscripciones">
        <PageHeaderButton icon={Plus} onClick={openCreate} shortcutKey="n">
          Nueva inscripción
        </PageHeaderButton>
      </PageHeader>

      <div className="flex justify-end">
        <StatusMultiSelect
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <DataTable
        columns={columns}
        data={enrollments}
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

      {/* Wizard for new enrollment (mirrors legacy GAS 2-step flow) */}
      {wizardOpen && (
        <EnrollmentWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      )}

      {/* Edit sheet (legacy single-form, only for editing) */}
      <FormSheetDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Editar inscripción"
        isLoading={updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <ReadOnlyField label="Alumno" value={editing?.studentName} hint={editing?.studentDoc} />
        <ReadOnlyField label="Horario" value={editing?.scheduleName} />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="enrollmentDate">Fecha inscripción</Label>
            <Input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={editing?.enrollmentDate} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editPrice">Precio (S/)</Label>
            <Input
              id="editPrice"
              name="schedulePrice"
              type="number"
              min="0"
              step="0.01"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select name="status" defaultValue={editing?.status ?? 'active'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS.enrollment[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {editing && <EnrollmentPaymentsBlock enrollmentId={editing.id} />}
      </FormSheetDialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutateAsync(deleteTarget.id)
          .then(() => { setDeleteTarget(null); toast.success('Inscripción eliminada'); })
          .catch(() => toast.error('Error al eliminar'))
        }
        entityName={deleteTarget ? `la inscripción de ${deleteTarget.studentName}` : undefined}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
