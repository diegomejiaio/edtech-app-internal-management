'use client';

/**
 * Schedules list + dashboard page — M4 + M9.
 *
 * Two tabs: "Horarios" (CRUD list) and "Dashboard" (M9 BFF view).
 */

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from '@/hooks';
import { PageHeader, DataTable, FormDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { TeacherPicker, CatalogSelect } from '@/components/pickers';
import { ScheduleDashboard } from '@/components/dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { isApiError, isConflict, SCHEDULE_STATUS_LABELS } from '@/lib/api';
import type { ScheduleWithCounts, ScheduleBody, ScheduleStatus } from '@/lib/api';

const STATUSES: ScheduleStatus[] = ['active', 'inProgress', 'finished', 'cancelled'];

const statusColors: Record<ScheduleStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  inProgress: 'secondary',
  finished: 'outline',
  cancelled: 'destructive',
};

const columns: Column<ScheduleWithCounts>[] = [
  { key: 'course', header: 'Curso', cell: (s) => `${s.course} · ${s.level}` },
  { key: 'teacher', header: 'Profesor', cell: (s) => s.teacherName },
  { key: 'schedule', header: 'Horario', cell: (s) => `${s.weekdays} ${s.startTime}–${s.endTime}` },
  { key: 'capacity', header: 'Ocupación', cell: (s) => `${s.enrolledActiveCount}/${s.capacity} (${Math.round(s.occupancyPct * 100)}%)` },
  { key: 'price', header: 'Precio', cell: (s) => `S/ ${s.price.toFixed(2)}` },
  {
    key: 'status',
    header: 'Estado',
    cell: (s) => <Badge variant={statusColors[s.status]}>{SCHEDULE_STATUS_LABELS[s.status]}</Badge>,
  },
];

export default function SchedulesPage() {
  const client = useApiClient();
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const { data, isLoading } = useSchedules(client, { limit, offset });
  const createMutation = useCreateSchedule(client);
  const updateMutation = useUpdateSchedule(client);
  const deleteMutation = useDeleteSchedule(client);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleWithCounts | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleWithCounts | null>(null);

  const [pickedTeacherId, setPickedTeacherId] = useState<string | undefined>();
  const [pickedCourse, setPickedCourse] = useState<string | undefined>();
  const [pickedLevel, setPickedLevel] = useState<string | undefined>();
  const [pickedWeekdays, setPickedWeekdays] = useState<string | undefined>();
  const [pickedStatus, setPickedStatus] = useState<ScheduleStatus>('active');

  function openCreate() {
    setEditing(null);
    setPickedTeacherId(undefined);
    setPickedCourse(undefined);
    setPickedLevel(undefined);
    setPickedWeekdays(undefined);
    setPickedStatus('active');
    setFormOpen(true);
  }

  function openEdit(s: ScheduleWithCounts) {
    setEditing(s);
    setPickedTeacherId(s.teacherId);
    setPickedCourse(s.course);
    setPickedLevel(s.level);
    setPickedWeekdays(s.weekdays);
    setPickedStatus(s.status);
    setFormOpen(true);
  }

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const body: ScheduleBody = {
      course: pickedCourse ?? '',
      level: pickedLevel ?? '',
      teacherId: pickedTeacherId ?? '',
      weekdays: pickedWeekdays ?? '',
      startTime: fd.get('startTime') as string,
      endTime: fd.get('endTime') as string,
      price: Number(fd.get('price')),
      capacity: Number(fd.get('capacity')),
      status: pickedStatus,
      startDate: fd.get('startDate') as string,
    };

    const mutation = editing
      ? updateMutation.mutateAsync({ id: editing.id, body, ifMatch: editing._etag })
      : createMutation.mutateAsync(body);

    mutation
      .then(() => { setFormOpen(false); toast.success(editing ? 'Horario actualizado' : 'Horario creado'); })
      .catch((err) => {
        if (isConflict(err)) toast.error('Conflicto al guardar el horario');
        else if (isApiError(err)) toast.error(err.problem.detail ?? err.message);
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horarios"
        description="Gestión de horarios y dashboard"
        action={<Button onClick={openCreate}>Nuevo horario</Button>}
      />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Listado</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            total={data?.total ?? 0}
            limit={limit}
            offset={offset}
            onPageChange={setOffset}
            rowKey={(s) => s.id}
            isLoading={isLoading}
            actions={(s) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Editar</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(s)}>Eliminar</Button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <ScheduleDashboard client={client} />
        </TabsContent>
      </Tabs>

      {/* Create / Edit dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar horario' : 'Nuevo horario'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Curso</Label>
            <CatalogSelect client={client} catalogCode="courses" value={pickedCourse} onChange={setPickedCourse} placeholder="Seleccionar curso..." />
          </div>
          <div>
            <Label>Nivel</Label>
            <CatalogSelect client={client} catalogCode="levels" value={pickedLevel} onChange={setPickedLevel} placeholder="Seleccionar nivel..." />
          </div>
        </div>
        <div>
          <Label>Profesor</Label>
          <TeacherPicker client={client} value={pickedTeacherId} onChange={(id) => setPickedTeacherId(id)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Días</Label>
            <CatalogSelect client={client} catalogCode="weekdays" value={pickedWeekdays} onChange={setPickedWeekdays} placeholder="Seleccionar días..." />
          </div>
          <div>
            <Label htmlFor="startDate">Fecha inicio</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={editing?.startDate} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startTime">Hora inicio</Label>
            <Input id="startTime" name="startTime" type="time" defaultValue={editing?.startTime} required />
          </div>
          <div>
            <Label htmlFor="endTime">Hora fin</Label>
            <Input id="endTime" name="endTime" type="time" defaultValue={editing?.endTime} required />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="price">Precio (S/)</Label>
            <Input id="price" name="price" type="number" step="0.01" defaultValue={editing?.price} required />
          </div>
          <div>
            <Label htmlFor="capacity">Capacidad</Label>
            <Input id="capacity" name="capacity" type="number" defaultValue={editing?.capacity} required />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={pickedStatus} onValueChange={(v) => setPickedStatus(v as ScheduleStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{SCHEDULE_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutateAsync(deleteTarget.id)
          .then(() => { setDeleteTarget(null); toast.success('Horario eliminado'); })
          .catch((err) => {
            if (isConflict(err)) toast.error('No se puede eliminar: tiene inscripciones activas');
            else toast.error('Error al eliminar');
          })
        }
        entityName={deleteTarget ? `${deleteTarget.course} · ${deleteTarget.level} · ${deleteTarget.weekdays}` : undefined}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
