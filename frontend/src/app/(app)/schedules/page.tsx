'use client';

/**
 * Schedules list + dashboard page — M4 + M9.
 *
 * Two tabs: "Horarios" (CRUD list) and "Dashboard" (M9 BFF view).
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { formatTableDate } from '@/lib/dates';
import { flattenInfiniteItems, getInfiniteTotal, useInfiniteSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from '@/hooks';
import { PageHeader, DataTable, RowActions, SearchBar, FormSheetDialog, ConfirmDeleteDialog, StatusMultiSelect, StatusBadgeMenu, type Column, type StatusOption } from '@/components/data';
import { TeacherPicker, CatalogSelect } from '@/components/pickers';
import { ScheduleDashboard } from '@/components/dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage, isApiError, isConflict, SCHEDULE_STATUS_LABELS } from '@/lib/api';
import type { ScheduleWithCounts, ScheduleBody, ScheduleStatus } from '@/lib/api';

const STATUSES: ScheduleStatus[] = ['active', 'inProgress', 'finished', 'cancelled'];
const STATUS_OPTIONS: StatusOption<ScheduleStatus>[] = STATUSES.map((s) => ({ value: s, label: SCHEDULE_STATUS_LABELS[s] }));
const DEFAULT_STATUS_FILTER: ScheduleStatus[] = ['active', 'inProgress'];
const TERMINAL_STATUSES: ScheduleStatus[] = ['finished', 'cancelled'];

const statusColors: Record<ScheduleStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  inProgress: 'secondary',
  finished: 'outline',
  cancelled: 'destructive',
};

const baseColumns: Column<ScheduleWithCounts>[] = [
  { key: 'code', header: 'Código', cell: (s) => s.code ? <span className="font-mono text-xs font-medium">{s.code}</span> : '—' },
  { key: 'course', header: 'Curso', cell: (s) => `${s.course} · ${s.level}` },
  { key: 'startDate', header: 'Fecha Inicio', cell: (s) => formatTableDate(s.startDate) },
  { key: 'teacher', header: 'Profesor', cell: (s) => s.teacherName || '—' },
  { key: 'schedule', header: 'Horario', cell: (s) => `${s.weekdays} ${s.startTime}–${s.endTime}` },
  { key: 'capacity', header: 'Ocupación', cell: (s) => `${s.enrolledActiveCount}/${s.capacity} (${Math.round(s.occupancyPct * 100)}%)` },
  { key: 'price', header: 'Precio', cell: (s) => `S/ ${s.price.toFixed(2)}` },
];

export default function SchedulesPage() {
  const client = useApiClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus[]>(DEFAULT_STATUS_FILTER);
  const limit = 25;

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteSchedules(client, {
    search: search || undefined,
    status: statusFilter,
    limit,
  });
  const schedules = useMemo(() => flattenInfiniteItems(data, { sortBy: (s) => s.startDate }), [data]);
  const total = getInfiniteTotal(data);
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
        else if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  function handleStatusChange(s: ScheduleWithCounts, next: ScheduleStatus) {
    if (next === s.status) return;
    const body: ScheduleBody = {
      course: s.course,
      level: s.level,
      teacherId: s.teacherId,
      weekdays: s.weekdays,
      startTime: s.startTime,
      endTime: s.endTime,
      price: s.price,
      capacity: s.capacity,
      status: next,
      startDate: s.startDate,
    };

    updateMutation.mutateAsync({ id: s.id, body, ifMatch: s._etag })
      .then(() => toast.success('Estado actualizado'))
      .catch((err) => {
        if (isConflict(err)) toast.error('Conflicto al actualizar el estado');
        else if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  const columns: Column<ScheduleWithCounts>[] = [
    ...baseColumns,
    {
      key: 'status',
      header: 'Estado',
      cell: (s) => (
        <StatusBadgeMenu
          value={s.status}
          options={STATUS_OPTIONS}
          variants={statusColors}
          terminalStatuses={TERMINAL_STATUSES}
          onChange={(next) => handleStatusChange(s, next)}
        />
      ),
    },
  ];

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

        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchBar
                placeholder="Buscar por curso, nivel, profesor o días..."
                value={search}
                onChange={setSearch}
              />
            </div>
            <StatusMultiSelect
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          <DataTable
            columns={columns}
            data={schedules}
            total={total}
            hasNextPage={hasNextPage}
            onLoadMore={() => fetchNextPage()}
            rowKey={(s) => s.id}
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            actions={(s) => (
              <RowActions
                onView={() => router.push(`/schedules/detail?id=${s.id}`)}
                onEdit={() => openEdit(s)}
                onDelete={() => setDeleteTarget(s)}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <ScheduleDashboard client={client} />
        </TabsContent>
      </Tabs>

      {/* Create / Edit sheet */}
      <FormSheetDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar horario' : 'Nuevo horario'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Curso</Label>
            <CatalogSelect client={client} catalogCode="courses" value={pickedCourse} onChange={setPickedCourse} placeholder="Seleccionar curso..." />
          </div>
          <div className="space-y-2">
            <Label>Nivel</Label>
            <CatalogSelect client={client} catalogCode="levels" value={pickedLevel} onChange={setPickedLevel} placeholder="Seleccionar nivel..." />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Profesor</Label>
          <TeacherPicker client={client} value={pickedTeacherId} onChange={(id) => setPickedTeacherId(id)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Días</Label>
            <CatalogSelect client={client} catalogCode="weekdays" value={pickedWeekdays} onChange={setPickedWeekdays} placeholder="Seleccionar días..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha inicio</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={editing?.startDate} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Hora inicio</Label>
            <Input id="startTime" name="startTime" type="time" defaultValue={editing?.startTime} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">Hora fin</Label>
            <Input id="endTime" name="endTime" type="time" defaultValue={editing?.endTime} required />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Precio (S/)</Label>
            <Input id="price" name="price" type="number" step="0.01" defaultValue={editing?.price} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacidad</Label>
            <Input id="capacity" name="capacity" type="number" defaultValue={editing?.capacity} required />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={pickedStatus} onValueChange={(v) => setPickedStatus(v as ScheduleStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{SCHEDULE_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </FormSheetDialog>

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
