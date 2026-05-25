'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, CircleDollarSign, ClipboardList, Users } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import {
  flattenInfiniteItems,
  getInfiniteTotal,
  useInfiniteScheduleEnrollments,
  useInfiniteScheduleSessions,
  useSchedule,
  useScheduleDashboard,
  useUpdateScheduleSession,
} from '@/hooks';
import { DataTable, type Column } from '@/components/data';
import { PageBreadcrumb, PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ATTENDANCE_STATUS_LABELS, getApiErrorMessage, isApiError, SCHEDULE_SESSION_STATUS_LABELS, SCHEDULE_STATUS_LABELS } from '@/lib/api';
import { formatTableDate } from '@/lib/dates';
import type { AttendanceStatus, ScheduleEnrollment, ScheduleSession, ScheduleSessionStatus } from '@/lib/api';

const sessionStatusColors: Record<ScheduleSessionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
};

const attendanceStatuses: AttendanceStatus[] = ['present', 'absent', 'late', 'pending'];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function currency(value: number | undefined) {
  return `S/ ${(value ?? 0).toFixed(2)}`;
}

type ScheduleEnrollmentRow = ScheduleEnrollment & {
  amount: number;
  paidAmount: number;
  pendingAmount: number;
};

export function ScheduleDetailView() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const client = useApiClient();
  const [month, setMonth] = useState(currentMonth);
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);
  const [scheduleEtag, setScheduleEtag] = useState<string | undefined>();

  const scheduleQuery = useSchedule(client, id);
  const dashboardQuery = useScheduleDashboard(client, id, month);
  const sessionQuery = useInfiniteScheduleSessions(client, id, { limit: 20 });
  const enrollmentQuery = useInfiniteScheduleEnrollments(client, id, { limit: 20 });
  const updateSession = useUpdateScheduleSession(client);

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
        pendingAmount: Math.max(amount - paidAmount, 0),
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
        <Badge variant={sessionStatusColors[s.status] ?? 'outline'}>
          {SCHEDULE_SESSION_STATUS_LABELS[s.status] ?? s.status}
        </Badge>
      ),
    },
    { key: 'attendance', header: 'Asistencia', cell: (s) => `${s.attendance.filter((a) => a.status === 'present').length}/${s.attendance.length}` },
  ];

  const enrollmentColumns: Column<ScheduleEnrollmentRow>[] = [
    { key: 'student', header: 'Alumno', cell: (e) => e.studentName },
    { key: 'status', header: 'Estado', cell: (e) => e.status },
    { key: 'amount', header: 'Monto', cell: (e) => currency(e.amount) },
    { key: 'paid', header: 'Pagado', cell: (e) => currency(e.paidAmount) },
    { key: 'pending', header: 'Pendiente', cell: (e) => currency(e.pendingAmount) },
  ];

  function handleSessionStatus(status: ScheduleSessionStatus) {
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
          setSelectedSession(updated.session);
          setScheduleEtag(updated.scheduleEtag ?? undefined);
          toast.success('Sesión actualizada');
        },
        onError: (err) => toast.error(isApiError(err) ? getApiErrorMessage(err) : 'No se pudo actualizar la sesión'),
      },
    );
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
          setSelectedSession(updated.session);
          setScheduleEtag(updated.scheduleEtag ?? undefined);
          toast.success('Asistencia actualizada');
        },
        onError: (err) => toast.error(isApiError(err) ? getApiErrorMessage(err) : 'No se pudo actualizar la asistencia'),
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
          value={currency(dashboard?.summary.pendingAmount)}
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
              <Info label="Fecha inicio" value={schedule ? formatTableDate(schedule.startDate) : '—'} />
              <Info label="Fecha fin proyectada" value={schedule?.projectedEndDate ? formatTableDate(schedule.projectedEndDate) : '—'} />
              <Info label="Duración total" value={schedule?.courseDurationHours ? `${schedule.courseDurationHours} h` : '—'} />
              <Info label="Capacidad" value={schedule ? `${schedule.enrolledActiveCount}/${schedule.capacity}` : '—'} />
              <Info label="Precio" value={schedule ? currency(schedule.price) : '—'} />
              <Info label="Estado" value={schedule ? SCHEDULE_STATUS_LABELS[schedule.status] ?? schedule.status : '—'} />
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
                isFetchingNextPage={sessionQuery.isFetchingNextPage}
                autoLoadMore
                emptyMessage="Aún no hay sesiones generadas"
                actions={(s) => <Button variant="ghost" size="sm" onClick={() => setSelectedSession(s)}>Ver</Button>}
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
                      {Object.entries(SCHEDULE_SESSION_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
