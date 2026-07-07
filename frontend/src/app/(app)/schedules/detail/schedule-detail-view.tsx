'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, CircleDollarSign, ClipboardList, Trash2, Users } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import {
  flattenInfiniteItems,
  getInfiniteTotal,
  useDeleteScheduleSession,
  useInfiniteScheduleEnrollments,
  useInfiniteScheduleSessions,
  useSchedule,
  useScheduleDashboard,
  useUpdateScheduleSession,
} from '@/hooks';
import { ConfirmDeleteDialog, DataTable, StatusBadge, type Column } from '@/components/data';
import { PageBreadcrumb, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ATTENDANCE_STATUS_LABELS, getApiErrorMessage, isApiError } from '@/lib/api';
import { formatAuditMetadata } from '@/lib/audit';
import { currentMonthInPeru, formatTableDate } from '@/lib/dates';
import { formatCurrency, subtractMoney } from '@/lib/money';
import { STATUS_LABELS, STATUS_VARIANTS, TERMINAL_STATUSES } from '@/lib/status';
import type { AttendanceStatus, ScheduleEnrollment, ScheduleSession, ScheduleSessionStatus } from '@/lib/api';

const attendanceStatuses: AttendanceStatus[] = ['present', 'absent', 'late', 'pending'];

type ScheduleEnrollmentRow = ScheduleEnrollment & {
  amount: number;
  paidAmount: number;
  pendingAmount: number;
};

export function ScheduleDetailView() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const client = useApiClient();
  const [month, setMonth] = useState(currentMonthInPeru);
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);
  const [scheduleEtag, setScheduleEtag] = useState<string | undefined>();
  const [dateDraft, setDateDraft] = useState('');
  const [startDraft, setStartDraft] = useState('');
  const [endDraft, setEndDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ScheduleSession | null>(null);
  const [pendingSessionStatus, setPendingSessionStatus] = useState<ScheduleSessionStatus | null>(null);

  const scheduleQuery = useSchedule(client, id);
  const dashboardQuery = useScheduleDashboard(client, id, month);
  const sessionQuery = useInfiniteScheduleSessions(client, id, { limit: 20 });
  const enrollmentQuery = useInfiniteScheduleEnrollments(client, id, { limit: 20 });
  const updateSession = useUpdateScheduleSession(client);
  const deleteSession = useDeleteScheduleSession(client);

  function selectSession(session: ScheduleSession | null) {
    setSelectedSession(session);
    if (!session) return;
    setDateDraft(session.date);
    setStartDraft(session.startTime.slice(0, 5));
    setEndDraft(session.endTime.slice(0, 5));
  }

  const sessions = useMemo(() => flattenInfiniteItems(sessionQuery.data, { sortBy: (s) => s.date }), [sessionQuery.data]);
  const schedule = scheduleQuery.data;
  const dashboard = dashboardQuery.data;
  const dashboardEnrollmentsById = useMemo(
    () => new Map(dashboard?.enrollments.map((row) => [row.enrollmentId, row]) ?? []),
    [dashboard?.enrollments],
  );
  const enrollments = useMemo(
    () => flattenInfiniteItems(enrollmentQuery.data).map((enrollment) => {
      const dashboardEnrollment = dashboardEnrollmentsById.get(enrollment.id);
      const amount = [enrollment.amount, dashboardEnrollment?.amount, schedule?.price]
        .find((value) => value !== undefined && value > 0) ?? 0;
      const paidAmount = [enrollment.paidAmount, dashboardEnrollment?.paidAmount]
        .find((value) => value !== undefined && value > 0) ?? 0;

      return {
        ...enrollment,
        amount,
        paidAmount,
        pendingAmount: Math.max(subtractMoney(amount, paidAmount), 0),
      };
    }),
    [dashboardEnrollmentsById, enrollmentQuery.data, schedule?.price],
  );
  const attendanceRate = useMemo(() => {
    const entries = sessions.flatMap((session) => session.attendance);
    if (entries.length === 0) return 0;
    return entries.filter((entry) => entry.status === 'present' || entry.status === 'late').length / entries.length;
  }, [sessions]);

  const sessionColumns: Column<ScheduleSession>[] = [
    { key: 'number', header: '#', cell: (s) => s.sequenceNumber },
    { key: 'date', header: 'Fecha', cell: (s) => formatTableDate(s.date) },
    { key: 'time', header: 'Hora', cell: (s) => `${s.startTime}–${s.endTime}` },
    {
      key: 'status',
      header: 'Estado',
      cell: (s) => (
        <StatusBadge
          value={s.status}
          labels={STATUS_LABELS.scheduleSession}
          variants={STATUS_VARIANTS.scheduleSession}
        />
      ),
    },
    { key: 'attendance', header: 'Asistencia', cell: (s) => `${s.attendance.filter((a) => a.status === 'present').length}/${s.attendance.length}` },
  ];

  const enrollmentColumns: Column<ScheduleEnrollmentRow>[] = [
    { key: 'student', header: 'Alumno', cell: (e) => e.studentName },
    {
      key: 'status',
      header: 'Estado',
      cell: (e) => (
        <StatusBadge
          value={e.status}
          labels={STATUS_LABELS.enrollment}
          variants={STATUS_VARIANTS.enrollment}
        />
      ),
    },
    { key: 'amount', header: 'Monto', cell: (e) => formatCurrency(e.amount), className: 'text-right tabular-nums' },
    { key: 'paid', header: 'Pagado', cell: (e) => formatCurrency(e.paidAmount), className: 'text-right tabular-nums' },
    { key: 'pending', header: 'Pendiente', cell: (e) => formatCurrency(e.pendingAmount), className: 'text-right tabular-nums' },
  ];

  function applySessionStatus(status: ScheduleSessionStatus) {
    if (!selectedSession) return;
    updateSession.mutate(
      {
        scheduleId: id,
        sessionId: selectedSession.id,
        body: { status },
        ifMatch: scheduleEtag ?? schedule?._etag,
      },
      {
        onSuccess: (updated) => {
          selectSession(updated.session);
          setScheduleEtag(updated.scheduleEtag ?? undefined);
          toast.success('Sesión actualizada');
        },
        onError: (err) => toast.error(isApiError(err) ? getApiErrorMessage(err) : 'No se pudo actualizar la sesión'),
      },
    );
  }

  function handleSessionStatus(status: ScheduleSessionStatus) {
    if (!selectedSession || status === selectedSession.status) return;
    if ((TERMINAL_STATUSES.scheduleSession as readonly ScheduleSessionStatus[]).includes(status)) {
      setPendingSessionStatus(status);
      return;
    }
    applySessionStatus(status);
  }

  function confirmSessionStatusChange() {
    if (!pendingSessionStatus) return;
    applySessionStatus(pendingSessionStatus);
    setPendingSessionStatus(null);
  }

  function handleAttendance(studentId: string, status: AttendanceStatus) {
    if (!selectedSession) return;
    const attendance = selectedSession.attendance.map((entry) => ({
      studentId: entry.studentId,
      status: entry.studentId === studentId ? status : entry.status,
      notes: entry.notes ?? null,
    }));

    updateSession.mutate(
      {
        scheduleId: id,
        sessionId: selectedSession.id,
        body: { attendance },
        ifMatch: scheduleEtag ?? schedule?._etag,
      },
      {
        onSuccess: (updated) => {
          selectSession(updated.session);
          setScheduleEtag(updated.scheduleEtag ?? undefined);
          toast.success('Asistencia actualizada');
        },
        onError: (err) => toast.error(isApiError(err) ? getApiErrorMessage(err) : 'No se pudo actualizar la asistencia'),
      },
    );
  }

  function handleReschedule() {
    if (!selectedSession) return;
    if (!dateDraft || !startDraft || !endDraft) {
      toast.error('Completa fecha, hora inicio y hora fin');
      return;
    }
    if (endDraft <= startDraft) {
      toast.error('La hora fin debe ser mayor que la hora inicio');
      return;
    }
    updateSession.mutate(
      {
        scheduleId: id,
        sessionId: selectedSession.id,
        body: { date: dateDraft, startTime: startDraft, endTime: endDraft },
        ifMatch: scheduleEtag ?? schedule?._etag,
      },
      {
        onSuccess: (updated) => {
          selectSession(updated.session);
          setScheduleEtag(updated.scheduleEtag ?? undefined);
          toast.success('Sesión reprogramada');
        },
        onError: (err) => toast.error(isApiError(err) ? getApiErrorMessage(err) : 'No se pudo reprogramar la sesión'),
      },
    );
  }

  function requestDeleteSession(session: ScheduleSession) {
    setSessionToDelete(session);
    setConfirmDelete(true);
  }

  function handleDeleteSession() {
    const target = sessionToDelete ?? selectedSession;
    if (!target) return;
    deleteSession.mutate(
      {
        scheduleId: id,
        sessionId: target.id,
        ifMatch: scheduleEtag ?? schedule?._etag,
      },
      {
        onSuccess: () => {
          setConfirmDelete(false);
          setSessionToDelete(null);
          if (selectedSession?.id === target.id) selectSession(null);
          setScheduleEtag(undefined);
          toast.success('Sesión eliminada');
        },
        onError: (err) => toast.error(isApiError(err) ? getApiErrorMessage(err) : 'No se pudo eliminar la sesión'),
      },
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: 'Horarios', href: '/schedules' },
          { label: schedule ? `${schedule.course} · ${schedule.level}` : 'Detalle' },
        ]}
      />

      <PageHeader
        title={schedule ? `${schedule.course} · ${schedule.level}` : 'Detalle del horario'}
        subtitle={schedule ? `${schedule.teacherName} · ${schedule.weekdays} ${schedule.startTime}–${schedule.endTime}` : 'Cargando horario...'}
        backHref="/schedules"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Sesiones"
          value={schedule?.sessionCount ?? 0}
          icon={Calendar}
          isLoading={scheduleQuery.isLoading}
          description="Generadas por duración"
        />
        <StatCard
          label="Matriculados"
          value={dashboard?.summary.enrolled ?? 0}
          icon={Users}
          isLoading={dashboardQuery.isLoading}
        />
        <StatCard
          label="Saldo pendiente"
          value={formatCurrency(dashboard?.summary.pendingAmount)}
          icon={CircleDollarSign}
          isLoading={dashboardQuery.isLoading}
          valueClassName={(dashboard?.summary.pendingAmount ?? 0) > 0 ? 'text-destructive' : undefined}
        />
        <StatCard
          label="Asistencia"
          value={`${Math.round(attendanceRate * 100)}%`}
          icon={CheckCircle2}
          isLoading={dashboardQuery.isLoading || sessionQuery.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del horario</CardTitle>
              <CardDescription>Fechas, cupos y estado operativo</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Info label="Código" value={schedule?.code ?? '—'} />
              <Info label="Fecha inicio" value={schedule ? formatTableDate(schedule.startDate) : '—'} />
              <Info label="Fecha fin proyectada" value={schedule?.projectedEndDate ? formatTableDate(schedule.projectedEndDate) : '—'} />
              <Info label="Duración total" value={schedule?.courseDurationHours ? `${schedule.courseDurationHours} h` : '—'} />
              <Info label="Capacidad" value={schedule ? `${schedule.enrolledActiveCount}/${schedule.capacity}` : '—'} />
              <Info label="Precio" value={schedule ? formatCurrency(schedule.price) : '—'} />
              <Info label="Estado" value={schedule ? STATUS_LABELS.schedule[schedule.status] : '—'} />
              <Info label="Creado por" value={formatAuditMetadata(schedule?.createdBy, schedule?.createdAt)} />
              <Info label="Última edición" value={formatAuditMetadata(schedule?.updatedBy, schedule?.updatedAt)} />
            </CardContent>
          </Card>

          <Tabs defaultValue="sessions">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <TabsList>
                <TabsTrigger value="sessions">Sesiones</TabsTrigger>
                <TabsTrigger value="enrollments">Matrículas</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Label htmlFor="month" className="text-sm">Periodo</Label>
                <Input id="month" type="month" value={month} onChange={(ev) => setMonth(ev.target.value)} className="w-40" />
              </div>
            </div>

            <TabsContent value="sessions" className="mt-4">
              <DataTable
                columns={sessionColumns}
                data={sessions}
                total={getInfiniteTotal(sessionQuery.data)}
                hasNextPage={sessionQuery.hasNextPage}
                onLoadMore={() => sessionQuery.fetchNextPage()}
                rowKey={(s) => s.id}
                isLoading={sessionQuery.isLoading}
                isError={sessionQuery.isError}
                onRetry={() => sessionQuery.refetch()}
                isFetchingNextPage={sessionQuery.isFetchingNextPage}
                autoLoadMore
                emptyMessage="Aún no hay sesiones generadas"
                actions={(s) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => selectSession(s)}>Ver</Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar sesión ${s.sequenceNumber}`}
                      title="Eliminar"
                      className="text-destructive hover:text-destructive"
                      onClick={() => requestDeleteSession(s)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              />
            </TabsContent>

            <TabsContent value="enrollments" className="mt-4">
              <DataTable
                columns={enrollmentColumns}
                data={enrollments}
                total={getInfiniteTotal(enrollmentQuery.data)}
                hasNextPage={enrollmentQuery.hasNextPage}
                onLoadMore={() => enrollmentQuery.fetchNextPage()}
                rowKey={(e) => e.id}
                isLoading={enrollmentQuery.isLoading}
                isError={enrollmentQuery.isError}
                onRetry={() => enrollmentQuery.refetch()}
                isFetchingNextPage={enrollmentQuery.isFetchingNextPage}
                autoLoadMore
                emptyMessage="Aún no hay matrículas en este horario"
              />
            </TabsContent>
          </Tabs>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Sesión</CardTitle>
            <CardDescription>Detalle y asistencia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedSession ? (
              <>
                <div className="space-y-1">
                  <p className="font-medium">Sesión {selectedSession.sequenceNumber}</p>
                  <p className="text-sm text-muted-foreground">{formatTableDate(selectedSession.date)} · {selectedSession.startTime}–{selectedSession.endTime}</p>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={selectedSession.status} onValueChange={(value) => handleSessionStatus(value as ScheduleSessionStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS.scheduleSession).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <Label>Reprogramar</Label>
                  <Input type="date" value={dateDraft} onChange={(ev) => setDateDraft(ev.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="time" value={startDraft} onChange={(ev) => setStartDraft(ev.target.value)} aria-label="Hora inicio" />
                    <Input type="time" value={endDraft} onChange={(ev) => setEndDraft(ev.target.value)} aria-label="Hora fin" />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={updateSession.isPending}
                    onClick={handleReschedule}
                  >
                    Guardar cambios
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    disabled={deleteSession.isPending}
                    onClick={() => requestDeleteSession(selectedSession)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar sesión
                  </Button>
                </div>
                <div className="space-y-3">
                  {selectedSession.attendance.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay alumnos activos para tomar asistencia.</p>
                  ) : selectedSession.attendance.map((entry) => (
                    <div key={entry.studentId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{entry.studentName}</p>
                        <p className="text-xs text-muted-foreground">{ATTENDANCE_STATUS_LABELS[entry.status]}</p>
                      </div>
                      <Select value={entry.status} onValueChange={(value) => handleAttendance(entry.studentId, value as AttendanceStatus)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {attendanceStatuses.map((status) => (
                            <SelectItem key={status} value={status}>{ATTENDANCE_STATUS_LABELS[status]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona una sesión para ver el detalle y registrar asistencia.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDeleteDialog
        open={pendingSessionStatus !== null}
        onOpenChange={(next) => {
          if (!next) setPendingSessionStatus(null);
        }}
        onConfirm={confirmSessionStatusChange}
        title={pendingSessionStatus
          ? `¿Cambiar estado de la sesión a "${STATUS_LABELS.scheduleSession[pendingSessionStatus]}"?`
          : '¿Cambiar estado de la sesión?'}
        description={pendingSessionStatus
          ? `Este cambio marcará la sesión como "${STATUS_LABELS.scheduleSession[pendingSessionStatus]}". Podrás revertirlo luego si es necesario.`
          : undefined}
        confirmLabel="Confirmar"
        loadingLabel="Confirmando..."
        isLoading={updateSession.isPending}
      />

      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          setConfirmDelete(next);
          if (!next) setSessionToDelete(null);
        }}
        onConfirm={handleDeleteSession}
        entityName={sessionToDelete ? `la sesión ${sessionToDelete.sequenceNumber}` : 'esta sesión'}
        isLoading={deleteSession.isPending}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
