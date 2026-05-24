'use client';

/**
 * Student detail client view.
 *
 * Tabs: Inscripciones · Pagos · Horarios activos (derived).
 */

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, CircleDollarSign, GraduationCap, Wallet } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import {
  flattenInfiniteItems,
  getInfiniteTotal,
  useInfiniteEnrollments,
  useInfiniteStudentPayments,
  useStudent,
} from '@/hooks';
import { DataTable, type Column } from '@/components/data';
import { PageBreadcrumb, PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DOC_TYPE_LABELS, ENROLLMENT_STATUS_LABELS } from '@/lib/api';
import { formatTableDate } from '@/lib/dates';
import type { Enrollment, EnrollmentStatus, StudentPayment } from '@/lib/api';

const enrollmentStatusColors: Record<EnrollmentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  pending: 'outline',
};

function currency(value: number | undefined) {
  return `S/ ${(value ?? 0).toFixed(2)}`;
}

export function StudentDetailView() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const client = useApiClient();

  const studentQuery = useStudent(client, id);
  const enrollmentsQuery = useInfiniteEnrollments(client, { studentId: id, limit: 20 });
  const paymentsQuery = useInfiniteStudentPayments(client, { studentId: id, limit: 20 });

  const enrollments = useMemo(
    () => flattenInfiniteItems(enrollmentsQuery.data, { sortBy: (e) => e.enrollmentDate }),
    [enrollmentsQuery.data],
  );
  const payments = useMemo(
    () => flattenInfiniteItems(paymentsQuery.data, { sortBy: (p) => p.date }),
    [paymentsQuery.data],
  );
  const activeEnrollments = useMemo(() => enrollments.filter((e) => e.status === 'active'), [enrollments]);
  const billableEnrollments = useMemo(() => enrollments.filter((e) => e.status !== 'cancelled'), [enrollments]);

  const student = studentQuery.data;
  const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const paidByEnrollment = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of payments) {
      totals.set(payment.enrollmentId, (totals.get(payment.enrollmentId) ?? 0) + payment.amount);
    }
    return totals;
  }, [payments]);
  const pendingBalance = useMemo(() => {
    const totalPrice = billableEnrollments.reduce((sum, enrollment) => sum + enrollment.schedulePrice, 0);
    return Math.max(0, totalPrice - totalPaid);
  }, [billableEnrollments, totalPaid]);
  const lastPaymentDate = useMemo(() => {
    if (payments.length === 0) return student?.lastPaymentDate ?? null;
    return payments.reduce((max, p) => (p.date > max ? p.date : max), payments[0].date);
  }, [payments, student?.lastPaymentDate]);

  const enrollmentColumns: Column<Enrollment>[] = [
    { key: 'schedule', header: 'Horario', cell: (e) => e.scheduleName },
    { key: 'date', header: 'Fecha inscripción', cell: (e) => formatTableDate(e.enrollmentDate) },
    { key: 'price', header: 'Precio', cell: (e) => currency(e.schedulePrice) },
    {
      key: 'balance',
      header: 'Saldo',
      cell: (e) => currency(e.status === 'cancelled' ? 0 : Math.max(0, e.schedulePrice - (paidByEnrollment.get(e.id) ?? 0))),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (e) => (
        <Badge variant={enrollmentStatusColors[e.status] ?? 'outline'}>
          {ENROLLMENT_STATUS_LABELS[e.status] ?? e.status}
        </Badge>
      ),
    },
  ];

  const paymentColumns: Column<StudentPayment>[] = [
    { key: 'date', header: 'Fecha', cell: (p) => formatTableDate(p.date) },
    { key: 'schedule', header: 'Horario', cell: (p) => p.scheduleName },
    { key: 'amount', header: 'Monto', cell: (p) => currency(p.amount) },
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

  const activeColumns: Column<Enrollment>[] = [
    { key: 'schedule', header: 'Horario', cell: (e) => e.scheduleName },
    { key: 'date', header: 'Inscrito el', cell: (e) => formatTableDate(e.enrollmentDate) },
    { key: 'price', header: 'Precio', cell: (e) => currency(e.schedulePrice) },
  ];

  const fullName = student ? `${student.firstName} ${student.lastName}` : 'Alumno';

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: 'Alumnos', href: '/students' },
          { label: student ? fullName : 'Detalle' },
        ]}
      />

      <PageHeader
        title={fullName}
        subtitle={student ? `${DOC_TYPE_LABELS[student.docType]} ${student.docNumber}` : 'Cargando...'}
        backHref="/students"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Inscripciones" value={student?.enrollmentCount ?? enrollments.length} icon={BookOpen} isLoading={studentQuery.isLoading} />
        <StatCard label="Total pagado" value={currency(totalPaid)} icon={CircleDollarSign} isLoading={paymentsQuery.isLoading} />
        <StatCard
          label="Saldo pendiente"
          value={currency(pendingBalance)}
          icon={Wallet}
          isLoading={enrollmentsQuery.isLoading || paymentsQuery.isLoading}
          valueClassName={pendingBalance > 0 ? 'text-orange-500' : undefined}
        />
        <StatCard label="Último pago" value={lastPaymentDate ? formatTableDate(lastPaymentDate) : '—'} icon={GraduationCap} isLoading={studentQuery.isLoading || paymentsQuery.isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del alumno</CardTitle>
          <CardDescription>Contacto y fuente de captación</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Info label="Teléfono" value={student?.phone ?? '—'} />
          <Info label="Email" value={student?.email ?? '—'} />
          <Info label="Fuente" value={student?.source ?? '—'} />
          <Info label="Estado" value={student?.active ? 'Activo' : 'Inactivo'} />
          <Info label="Notas" value={student?.notes ?? '—'} />
        </CardContent>
      </Card>

      <Tabs defaultValue="enrollments">
        <TabsList>
          <TabsTrigger value="enrollments">Inscripciones</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="active-schedules">Horarios activos</TabsTrigger>
        </TabsList>

        <TabsContent value="enrollments" className="mt-4">
          <DataTable
            columns={enrollmentColumns}
            data={enrollments}
            total={getInfiniteTotal(enrollmentsQuery.data)}
            hasNextPage={enrollmentsQuery.hasNextPage}
            onLoadMore={() => enrollmentsQuery.fetchNextPage()}
            rowKey={(e) => e.id}
            isLoading={enrollmentsQuery.isLoading}
            isFetchingNextPage={enrollmentsQuery.isFetchingNextPage}
            autoLoadMore
            emptyMessage="Este alumno aún no tiene inscripciones"
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
            isFetchingNextPage={paymentsQuery.isFetchingNextPage}
            autoLoadMore
            emptyMessage="Este alumno aún no tiene pagos registrados"
          />
        </TabsContent>

        <TabsContent value="active-schedules" className="mt-4">
          <DataTable
            columns={activeColumns}
            data={activeEnrollments}
            total={activeEnrollments.length}
            rowKey={(e) => e.id}
            isLoading={enrollmentsQuery.isLoading}
            emptyMessage="No hay inscripciones activas"
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
