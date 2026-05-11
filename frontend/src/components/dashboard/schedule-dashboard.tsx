'use client';

/**
 * Schedule Dashboard — M9 acceptance criteria.
 *
 * Displays a schedule selector, schedule info, enrolled students with
 * paid/debtor flag for the selected month, and a summary row.
 *
 * See docs/04-api-design.md §6.1 for the BFF response shape.
 */

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ApiClient } from '@/lib/api';
import { useSchedules, useScheduleDashboard } from '@/hooks';

/** Returns `YYYY-MM` for the current month. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface ScheduleDashboardProps {
  client: ApiClient;
}

export function ScheduleDashboard({ client }: ScheduleDashboardProps) {
  const [scheduleId, setScheduleId] = useState<string | undefined>();
  const [month, setMonth] = useState(currentMonth());

  const { data: scheduleList, isLoading: listLoading } = useSchedules(client, {
    status: 'active',
    limit: 100,
  });

  const { data: dashboard, isLoading: dashLoading } = useScheduleDashboard(
    client,
    scheduleId,
    month,
  );

  return (
    <div className="space-y-6">
      {/* Selector row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-72">
          <label className="mb-1 block text-sm font-medium">Horario</label>
          {listLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={scheduleId} onValueChange={setScheduleId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar horario..." />
              </SelectTrigger>
              <SelectContent>
                {scheduleList?.items.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.course} · {s.level} · {s.weekdays} {s.startTime}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="w-44">
          <label className="mb-1 block text-sm font-medium">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

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
              {dashboard.schedule.teacherName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Inscritos" value={dashboard.summary.enrolled} />
              <Stat label="Pagaron" value={dashboard.summary.paid} />
              <Stat
                label="Pendientes"
                value={dashboard.summary.debtors}
                variant={dashboard.summary.debtors > 0 ? 'destructive' : 'default'}
              />
              <Stat
                label="Ocupación"
                value={`${Math.round(dashboard.summary.occupancyPct * 100)}%`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrollments table */}
      {dashLoading && scheduleId && (
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
                {dashboard.enrollments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Sin inscripciones activas
                    </TableCell>
                  </TableRow>
                )}
                {dashboard.enrollments.map((e) => (
                  <TableRow key={e.enrollmentId}>
                    <TableCell className="font-medium">{e.studentName}</TableCell>
                    <TableCell>{e.studentDoc}</TableCell>
                    <TableCell>
                      {e.paidThisMonth ? (
                        <Badge variant="default">Pagado</Badge>
                      ) : (
                        <Badge variant="destructive">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.lastPaymentDate ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'destructive';
}) {
  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-bold ${variant === 'destructive' ? 'text-destructive' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
