'use client';

/**
 * Schedule Dashboard — M9 acceptance criteria.
 *
 * Displays a schedule selector, schedule info, enrolled students with
 * paid/debtor flag for the selected month, and a summary row.
 *
 * See docs/04-api-design.md §6.1 for the BFF response shape.
 */

import { useEffect, useMemo, useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, Users, UserCheck, AlertCircle, Percent } from 'lucide-react';
import type { ApiClient, ScheduleWithCounts } from '@/lib/api';
import { useSchedules, useScheduleDashboard } from '@/hooks';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

/** Returns `YYYY-MM` for the current month. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function formatScheduleTitle(schedule: ScheduleWithCounts): string {
  return `${schedule.course} · ${schedule.level} · ${schedule.weekdays} ${schedule.startTime}`;
}

function formatDateOnly(date: string | undefined): string {
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

function isScheduleInMonth(schedule: ScheduleWithCounts, month: string): boolean {
  return schedule.startDate.startsWith(month);
}

function getMonthDateRange(month: string): { startDateFrom: string; startDateTo: string } {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(month) ? month : currentMonth();
  const [yearRaw, monthRaw] = normalizedMonth.split('-');
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    startDateFrom: `${normalizedMonth}-01`,
    startDateTo: `${normalizedMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

interface ScheduleDashboardProps {
  client: ApiClient;
}

export function ScheduleDashboard({ client }: ScheduleDashboardProps) {
  const [scheduleId, setScheduleId] = useState<string | undefined>();
  const [month, setMonth] = useState(currentMonth());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const period = getMonthDateRange(month);

  const { data: scheduleList, isLoading: listLoading } = useSchedules(client, {
    status: 'active',
    startDateFrom: period.startDateFrom,
    startDateTo: period.startDateTo,
    limit: 100,
  });

  const schedulesForMonth = useMemo(
    () => (scheduleList?.items ?? []).filter((schedule) => isScheduleInMonth(schedule, month)),
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

  useEffect(() => {
    if (scheduleId && !selectedSchedule) {
      setScheduleId(undefined);
    }
  }, [scheduleId, selectedSchedule]);

  const { data: dashboard, isLoading: dashLoading } = useScheduleDashboard(
    client,
    dashboardScheduleId,
    month,
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
                            Inicio {formatDateOnly(schedule.startDate)} · Prof. {schedule.teacherName} ·{' '}
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
              {formatDateOnly(dashboard.schedule.startDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
                label="Pendientes"
                value={dashboard.summary.debtors}
                icon={AlertCircle}
                valueClassName={
                  dashboard.summary.debtors > 0 ? 'text-destructive' : undefined
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
          <CardHeader>
            <CardTitle className="text-base">
              Alumnos inscritos — {dashboard.month}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dashboard.enrollments.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Sin inscripciones"
                description="No hay alumnos inscritos en este horario"
                className="py-12"
              />
            ) : (
              <ScrollTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Estado pago</TableHead>
                      <TableHead>Último pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.enrollments.map((e) => (
                      <TableRow key={e.enrollmentId}>
                        <TableCell className="font-medium">{e.studentName}</TableCell>
                        <TableCell>{e.studentDoc}</TableCell>
                        <TableCell>
                          {e.paidThisMonth ? (
                            <Badge variant="success">Pagado</Badge>
                          ) : (
                            <Badge variant="warning">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.lastPaymentDate ?? '—'}
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
