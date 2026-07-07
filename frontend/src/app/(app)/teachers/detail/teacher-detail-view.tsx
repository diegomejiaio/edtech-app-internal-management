'use client';

/**
 * Teacher detail client view.
 *
 * Tabs: Horarios · Pagos recibidos.
 */

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, CalendarRange, CircleDollarSign, Users } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import {
  flattenInfiniteItems,
  getInfiniteTotal,
  useInfiniteSchedules,
  useInfiniteTeacherPayments,
  useTeacher,
} from '@/hooks';
import { DataTable, StatusBadge, type Column } from '@/components/data';
import { PageBreadcrumb, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DOC_TYPE_LABELS } from '@/lib/api';
import { formatAuditMetadata } from '@/lib/audit';
import { formatTableDate } from '@/lib/dates';
import { formatCurrency, sumMoney } from '@/lib/money';
import { STATUS_LABELS, STATUS_VARIANTS } from '@/lib/status';
import type { ScheduleWithCounts, TeacherPayment } from '@/lib/api';

export function TeacherDetailView() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const client = useApiClient();

  const teacherQuery = useTeacher(client, id);
  const schedulesQuery = useInfiniteSchedules(client, { teacherId: id, limit: 20 });
  const paymentsQuery = useInfiniteTeacherPayments(client, { teacherId: id, limit: 20 });

  const schedules = useMemo(
    () => flattenInfiniteItems(schedulesQuery.data, { sortBy: (s) => s.startDate }),
    [schedulesQuery.data],
  );
  const payments = useMemo(
    () => flattenInfiniteItems(paymentsQuery.data, { sortBy: (p) => p.date }),
    [paymentsQuery.data],
  );
  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.status === 'active' || s.status === 'inProgress'),
    [schedules],
  );
  const totalStudents = useMemo(
    () => activeSchedules.reduce((sum, s) => sum + (s.enrolledActiveCount ?? 0), 0),
    [activeSchedules],
  );
  const totalPaid = useMemo(() => sumMoney(payments.map((payment) => payment.amount)), [payments]);

  const teacher = teacherQuery.data;

  const scheduleColumns: Column<ScheduleWithCounts>[] = [
    { key: 'name', header: 'Horario', cell: (s) => `${s.course} · ${s.level}` },
    { key: 'days', header: 'Días', cell: (s) => `${s.weekdays} ${s.startTime}–${s.endTime}` },
    { key: 'start', header: 'Inicio', cell: (s) => formatTableDate(s.startDate) },
    { key: 'capacity', header: 'Cupos', cell: (s) => `${s.enrolledActiveCount}/${s.capacity}` },
    {
      key: 'status',
      header: 'Estado',
      cell: (s) => (
        <StatusBadge
          value={s.status}
          labels={STATUS_LABELS.schedule}
          variants={STATUS_VARIANTS.schedule}
        />
      ),
    },
  ];

  const paymentColumns: Column<TeacherPayment>[] = [
    { key: 'date', header: 'Fecha', cell: (p) => formatTableDate(p.date) },
    { key: 'amount', header: 'Monto', cell: (p) => formatCurrency(p.amount), className: 'text-right tabular-nums' },
    { key: 'concept', header: 'Concepto', cell: (p) => p.concept },
    { key: 'method', header: 'Medio', cell: (p) => p.paymentMethod },
    { key: 'notes', header: 'Notas', cell: (p) => p.notes ?? '—' },
  ];

  const fullName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Profesor';

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: 'Profesores', href: '/teachers' },
          { label: teacher ? fullName : 'Detalle' },
        ]}
      />

      <PageHeader
        title={fullName}
        subtitle={teacher ? `${DOC_TYPE_LABELS[teacher.docType]} ${teacher.docNumber}` : 'Cargando...'}
        backHref="/teachers"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Horarios activos" value={activeSchedules.length} icon={CalendarRange} isLoading={schedulesQuery.isLoading} />
        <StatCard label="Total horarios" value={getInfiniteTotal(schedulesQuery.data) ?? schedules.length} icon={BookOpen} isLoading={schedulesQuery.isLoading} />
        <StatCard label="Alumnos activos" value={totalStudents} icon={Users} isLoading={schedulesQuery.isLoading} />
        <StatCard label="Total pagado" value={formatCurrency(totalPaid)} icon={CircleDollarSign} isLoading={paymentsQuery.isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del profesor</CardTitle>
          <CardDescription>Contacto y especialidad</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Info label="Teléfono" value={teacher?.phone ?? '—'} />
          <Info label="Email" value={teacher?.email ?? '—'} />
          <Info label="Especialidad" value={teacher?.specialty ?? '—'} />
          <Info label="Estado" value={teacher?.active ? 'Activo' : 'Inactivo'} />
          <Info label="Creado por" value={formatAuditMetadata(teacher?.createdBy, teacher?.createdAt)} />
          <Info label="Última edición" value={formatAuditMetadata(teacher?.updatedBy, teacher?.updatedAt)} />
        </CardContent>
      </Card>

      <Tabs defaultValue="schedules">
        <TabsList>
          <TabsTrigger value="schedules">Horarios</TabsTrigger>
          <TabsTrigger value="payments">Pagos recibidos</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="mt-4">
          <DataTable
            columns={scheduleColumns}
            data={schedules}
            total={getInfiniteTotal(schedulesQuery.data)}
            hasNextPage={schedulesQuery.hasNextPage}
            onLoadMore={() => schedulesQuery.fetchNextPage()}
            rowKey={(s) => s.id}
            isLoading={schedulesQuery.isLoading}
            isError={schedulesQuery.isError}
            onRetry={() => schedulesQuery.refetch()}
            isFetchingNextPage={schedulesQuery.isFetchingNextPage}
            autoLoadMore
            emptyMessage="Este profesor aún no tiene horarios asignados"
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <DataTable
            columns={paymentColumns}
            data={payments}
            total={getInfiniteTotal(paymentsQuery.data)}
            hasNextPage={paymentsQuery.hasNextPage}
            onLoadMore={() => paymentsQuery.fetchNextPage()}
            rowKey={(p) => p.id}
            isLoading={paymentsQuery.isLoading}
            isError={paymentsQuery.isError}
            onRetry={() => paymentsQuery.refetch()}
            isFetchingNextPage={paymentsQuery.isFetchingNextPage}
            autoLoadMore
            emptyMessage="Este profesor aún no tiene pagos registrados"
          />
        </TabsContent>
      </Tabs>
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
