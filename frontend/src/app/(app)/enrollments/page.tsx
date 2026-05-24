'use client';

/**
 * Enrollments list page — M5.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { formatTableDate } from '@/lib/dates';
import { flattenInfiniteItems, getInfiniteTotal, useInfiniteEnrollments, useUpdateEnrollment, useDeleteEnrollment } from '@/hooks';
import { PageHeader, DataTable, RowActions, FormSheetDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { StudentPicker, SchedulePicker } from '@/components/pickers';
import { EnrollmentWizard } from '@/components/enrollments/enrollment-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { isApiError, isConflict, ENROLLMENT_STATUS_LABELS } from '@/lib/api';
import type { Enrollment, EnrollmentBody, EnrollmentStatus } from '@/lib/api';

const STATUSES: EnrollmentStatus[] = ['active', 'completed', 'cancelled', 'pending'];

const statusColors: Record<EnrollmentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  pending: 'outline',
};

const columns: Column<Enrollment>[] = [
  { key: 'student', header: 'Alumno', cell: (e) => e.studentName },
  { key: 'doc', header: 'Documento', cell: (e) => e.studentDoc },
  { key: 'schedule', header: 'Horario', cell: (e) => e.scheduleName },
  { key: 'date', header: 'Fecha inscripción', cell: (e) => formatTableDate(e.enrollmentDate) },
  { key: 'price', header: 'Precio', cell: (e) => `S/ ${e.schedulePrice.toFixed(2)}` },
  {
    key: 'status',
    header: 'Estado',
    cell: (e) => <Badge variant={statusColors[e.status]}>{ENROLLMENT_STATUS_LABELS[e.status]}</Badge>,
  },
];

export default function EnrollmentsPage() {
  const client = useApiClient();
  const limit = 25;
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'all'>('all');

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteEnrollments(client, {
    limit,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const enrollments = useMemo(() => flattenInfiniteItems(data, { sortBy: (e) => e.enrollmentDate }), [data]);
  const total = getInfiniteTotal(data);
  const updateMutation = useUpdateEnrollment(client);
  const deleteMutation = useDeleteEnrollment(client);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Enrollment | null>(null);
  const [pickedStudentId, setPickedStudentId] = useState<string | undefined>();
  const [pickedScheduleId, setPickedScheduleId] = useState<string | undefined>();

  function openCreate() { setWizardOpen(true); }
  function openEdit(e: Enrollment) { setEditing(e); setPickedStudentId(e.studentId); setPickedScheduleId(e.scheduleId); setFormOpen(true); }

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!editing) return;
    const fd = new FormData(ev.currentTarget);
    const body: EnrollmentBody = {
      studentId: pickedStudentId ?? (fd.get('studentId') as string),
      scheduleId: pickedScheduleId ?? (fd.get('scheduleId') as string),
      enrollmentDate: fd.get('enrollmentDate') as string,
      status: fd.get('status') as EnrollmentStatus,
    };

    updateMutation.mutateAsync({ id: editing.id, body, ifMatch: editing._etag })
      .then(() => { setFormOpen(false); toast.success('Inscripción actualizada'); })
      .catch((err) => {
        if (isConflict(err)) toast.error('Ya existe una inscripción activa para este alumno en este horario');
        else if (isApiError(err)) toast.error(err.problem.detail ?? err.message);
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inscripciones"
        description="Gestión de inscripciones"
        action={<Button onClick={openCreate}>Nueva inscripción</Button>}
      />

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EnrollmentStatus | 'all')}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{ENROLLMENT_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
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
      <EnrollmentWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Edit sheet (legacy single-form, only for editing) */}
      <FormSheetDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Editar inscripción"
        isLoading={updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <Label>Alumno</Label>
          <StudentPicker client={client} value={pickedStudentId} onChange={(id) => setPickedStudentId(id)} name="studentId" />
        </div>
        <div className="space-y-2">
          <Label>Horario</Label>
          <SchedulePicker client={client} value={pickedScheduleId} onChange={(id) => setPickedScheduleId(id)} name="scheduleId" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="enrollmentDate">Fecha inscripción</Label>
            <Input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={editing?.enrollmentDate} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select name="status" defaultValue={editing?.status ?? 'active'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{ENROLLMENT_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
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
