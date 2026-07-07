'use client';

/**
 * Schedule Dashboard — M9 acceptance criteria.
 *
 * Displays a schedule selector, schedule info, enrolled students with
 * paid/debtor flag for the selected month, and a summary row.
 *
 * See docs/04-api-design.md §6.1 for the BFF response shape.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollTable } from '@/components/ui/scroll-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, Users, UserCheck, AlertCircle, Percent, Wallet } from 'lucide-react';
import type { ApiClient, ScheduleWithCounts } from '@/lib/api';
import { useSchedules, useScheduleDashboard } from '@/hooks';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import { currentMonthInPeru, formatTableDate, isScheduleActiveInMonth } from '@/lib/dates';
import { formatCurrency } from '@/lib/money';
function formatScheduleTitle(schedule: ScheduleWithCounts): string {
  return `${schedule.course} · ${schedule.level} · ${schedule.weekdays} ${schedule.startTime}`;
}

interface ScheduleDashboardProps {
  client: ApiClient;
}

export function ScheduleDashboard({ client }: ScheduleDashboardProps) {
  const [scheduleId, setScheduleId] = useState<string | undefined>();
  const [month, setMonth] = useState(currentMonthInPeru());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);

  const { data: scheduleList, isLoading: listLoading } = useSchedules(client, {
    status: ['active'],
    limit: 100,
  });

  const schedulesForMonth = useMemo(
    () =>
      (scheduleList?.items ?? []).filter((schedule) =>
        isScheduleActiveInMonth(schedule.startDate, schedule.projectedEndDate, month),
      ),
    [scheduleList?.items, month],
  );

  const filteredSchedules = useMemo(() => {
    const term = scheduleSearch.trim().toLowerCase();
    if (!term) return schedulesForMonth;

    return schedulesForMonth.filter((schedule) => {
      const text = [
        schedule.course,
        schedule.level,
        schedule.weekdays,
        schedule.startTime,
        schedule.endTime,
        schedule.teacherName,
        schedule.startDate,
      ].join(' ').toLowerCase();
      return text.includes(term);
    });
  }, [scheduleSearch, schedulesForMonth]);

  const selectedSchedule = schedulesForMonth.find((schedule) => schedule.id === scheduleId);
  const dashboardScheduleId = selectedSchedule?.id;

  const { data: dashboard, isLoading: dashLoading } = useScheduleDashboard(
    client,
    dashboardScheduleId,
    month,
  );

  const visibleEnrollments = useMemo(
    () => showDebtorsOnly
      ? (dashboard?.enrollments ?? []).filter((enrollment) => !enrollment.paidThisMonth)
      : (dashboard?.enrollments ?? []),
    [dashboard?.enrollments, showDebtorsOnly],
  );

  return (
    <div className="space-y-6">
      {/* Filter row */}
      <FilterBar>
        <div className="flex w-full max-w-xl flex-col gap-1">
          <label className="text-xs text-muted-foreground">Horario</label>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={pickerOpen}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {selectedSchedule ? formatScheduleTitle(selectedSchedule) : 'Seleccionar horario...'}
                </span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[520px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Buscar por curso, nivel, profesor o fecha..."
                  value={scheduleSearch}
                  onValueChange={setScheduleSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    {listLoading ? 'Cargando horarios...' : 'Sin horarios para este periodo'}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredSchedules.map((schedule) => (
                      <CommandItem
                        key={schedule.id}
                        value={schedule.id}
                        onSelect={() => {
                          setScheduleId(schedule.id);
                          setPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            scheduleId === schedule.id ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{formatScheduleTitle(schedule)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            Inicio {formatTableDate(schedule.startDate)} · Prof. {schedule.teacherName} ·{' '}
                            {schedule.enrolledActiveCount}/{schedule.capacity}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (!e.target.value) return;
              setMonth(e.target.value);
              setScheduleSearch('');
            }}
            className="flex h-9 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </FilterBar>

      {/* Schedule info card */}
      {dashboard && (
        <Card>
          <CardHeader>
            <CardTitle>
              {dashboard.schedule.course} · {dashboard.schedule.level}
            </CardTitle>
            <CardDescription>
              {dashboard.schedule.weekdays} {dashboard.schedule.startTime}–
              {dashboard.schedule.endTime} · Prof.{' '}
              {dashboard.schedule.teacherName} · Inicio{' '}
              {formatTableDate(dashboard.schedule.startDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex justify-end">
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link href={`/collections?month=${dashboard.month}`}>Ver cobranzas del mes</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard
                label="Inscritos"
                value={dashboard.summary.enrolled}
                icon={Users}
              />
              <StatCard
                label="Pagaron"
                value={dashboard.summary.paid}
                icon={UserCheck}
                valueClassName="text-success"
              />
              <StatCard
                label="Deudores"
                value={dashboard.summary.debtors}
                icon={AlertCircle}
                valueClassName={dashboard.summary.debtors > 0 ? 'text-destructive' : undefined}
              />
              <StatCard
                label="Esperado"
                value={formatCurrency(dashboard.summary.expectedAmount)}
                icon={Wallet}
              />
              <StatCard
                label="Por cobrar (mes)"
                value={formatCurrency(dashboard.summary.pendingAmount)}
                icon={AlertCircle}
                valueClassName={
                  dashboard.summary.pendingAmount > 0 ? 'text-destructive' : undefined
                }
              />
              <StatCard
                label="Ocupación"
                value={`${Math.round(dashboard.summary.occupancyPct * 100)}%`}
                icon={Percent}
                valueClassName="text-info"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrollments table */}
      {dashLoading && dashboardScheduleId && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {dashboard && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">
              Alumnos inscritos — {dashboard.month}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="showDebtorsOnly"
                checked={showDebtorsOnly}
                onCheckedChange={setShowDebtorsOnly}
              />
              <Label htmlFor="showDebtorsOnly" className="text-xs text-muted-foreground">
                Solo deudores
              </Label>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {visibleEnrollments.length === 0 ? (
              <EmptyState
                icon={Users}
                title={showDebtorsOnly ? 'Sin deudores en este mes' : 'Sin inscripciones'}
                description={showDebtorsOnly
                  ? 'Todos los alumnos registraron pagos durante este mes.'
                  : 'No hay alumnos inscritos en este horario'}
                className="py-12"
              />
            ) : (
              <ScrollTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead className="text-right tabular-nums">Precio</TableHead>
                      <TableHead className="text-right tabular-nums">Pagado</TableHead>
                      <TableHead className="text-right tabular-nums">Saldo</TableHead>
                      <TableHead>Estado pago</TableHead>
                      <TableHead>Último pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleEnrollments.map((e) => (
                      <TableRow key={e.enrollmentId}>
                        <TableCell className="font-medium">{e.studentName}</TableCell>
                        <TableCell>{e.studentDoc}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(e.paidAmount)}</TableCell>
                        <TableCell
                          className={
                            e.pendingAmount > 0
                              ? 'font-medium text-right tabular-nums text-destructive'
                              : 'text-right tabular-nums text-muted-foreground'
                          }
                        >
                          {formatCurrency(e.pendingAmount)}
                        </TableCell>
                        <TableCell>
                          {e.paidThisMonth ? (
                            <Badge variant="success">Pagado</Badge>
                          ) : (
                            <Badge variant="warning">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatTableDate(e.lastPaymentDate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollTable>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
