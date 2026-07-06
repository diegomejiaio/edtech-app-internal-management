'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { HandCoins } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useApiClient } from '@/hooks/use-api-client';
import { useSchedules } from '@/hooks';
import { DataTable, type Column } from '@/components/data';
import { PageHeader } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currentMonthInPeru, formatTableDate } from '@/lib/dates';
import { getDebtors, type Debtor } from '@/lib/api';
import { sumMoney } from '@/lib/money';

interface DebtorTableRow extends Debtor {
  scheduleId: string;
  scheduleName: string;
  daysLate: number;
}

const columns: Column<DebtorTableRow>[] = [
  {
    key: 'student',
    header: 'Alumno',
    cell: (debtor) => (
      <div>
        <p className="font-medium">{debtor.studentName}</p>
        <p className="text-xs text-muted-foreground">{debtor.studentDoc}</p>
      </div>
    ),
  },
  {
    key: 'schedule',
    header: 'Horario',
    cell: (debtor) => debtor.scheduleName,
  },
  {
    key: 'lastPaymentDate',
    header: 'Último pago',
    cell: (debtor) => debtor.lastPaymentDate ? formatTableDate(debtor.lastPaymentDate) : 'Sin pagos previos',
  },
  {
    key: 'daysLate',
    header: 'Días de mora',
    cell: (debtor) => `${debtor.daysLate} días`,
  },
  {
    key: 'amount',
    header: 'Saldo',
    cell: (debtor) => `S/ ${debtor.amount.toFixed(2)}`,
    className: 'font-medium text-destructive',
  },
];

export default function CollectionsPage() {
  const client = useApiClient();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(() => {
    const monthFromQuery = searchParams.get('month');
    return isMonthString(monthFromQuery) ? monthFromQuery : currentMonthInPeru();
  });

  const schedulesQuery = useSchedules(client, { status: ['active'], limit: 100 });
  const activeSchedules = schedulesQuery.data?.items ?? [];

  const debtorsQueries = useQueries({
    queries: activeSchedules.map((schedule) => ({
      queryKey: ['student-payments', 'debtors', schedule.id, month],
      queryFn: () => getDebtors(client, { scheduleId: schedule.id, month }),
      enabled: activeSchedules.length > 0,
    })),
  });

  const debtorRows = useMemo<DebtorTableRow[]>(() => {
    return debtorsQueries
      .flatMap((query) => {
        const response = query.data;
        if (!response) return [];
        return response.debtors.map((debtor) => ({
          ...debtor,
          scheduleId: response.scheduleId,
          scheduleName: response.scheduleName,
          daysLate: calculateDaysLate(debtor.lastPaymentDate, month),
        }));
      })
      .sort((a, b) => {
        if (a.daysLate !== b.daysLate) return b.daysLate - a.daysLate;
        return a.studentName.localeCompare(b.studentName);
      });
  }, [debtorsQueries, month]);

  const totalPending = useMemo(
    () => sumMoney(debtorRows.map((debtor) => debtor.amount)),
    [debtorRows],
  );
  const isLoading = schedulesQuery.isLoading || debtorsQueries.some((query) => query.isLoading);
  const isError = schedulesQuery.isError || debtorsQueries.some((query) => query.isError);

  function retryAll() {
    void schedulesQuery.refetch();
    for (const query of debtorsQueries) {
      void query.refetch();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Cobranzas" subtitle="Deudores del mes seleccionado" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="collectionsMonth">Mes</Label>
          <Input
            id="collectionsMonth"
            type="month"
            value={month}
            onChange={(event) => {
              if (!event.target.value) return;
              setMonth(event.target.value);
            }}
            className="w-full sm:w-44"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={debtorRows}
        total={debtorRows.length}
        rowKey={(debtor) => debtor.enrollmentId}
        isLoading={isLoading}
        isError={isError}
        onRetry={retryAll}
        emptyState={{
          icon: HandCoins,
          title: activeSchedules.length === 0 ? 'No hay horarios activos' : 'No hay deudores en este mes',
          description: activeSchedules.length === 0
            ? 'Activa o crea horarios para consultar cobranzas.'
            : 'Todos los alumnos registraron pagos durante este mes.',
        }}
        summary={{
          label: 'Total adeudado (mes)',
          value: `S/ ${totalPending.toFixed(2)}`,
          description: `${debtorRows.length} ${debtorRows.length === 1 ? 'deudor' : 'deudores'}`,
        }}
        animated={false}
      />
    </div>
  );
}

function isMonthString(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

function calculateDaysLate(lastPaymentDate: string | null | undefined, month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  const monthStartDate = new Date(year, monthNumber - 1, 1);
  const referenceDate = lastPaymentDate ? new Date(`${lastPaymentDate}T00:00:00`) : monthStartDate;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((Date.now() - referenceDate.getTime()) / msPerDay));
}
