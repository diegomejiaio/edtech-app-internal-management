'use client';

/**
 * ActiveSchedulesCard — compact list of currently active schedules.
 *
 * Mirrors the "Próximas Sesiones" card from the reference project but uses
 * the existing `/schedules?status=active` endpoint and the project's
 * server-computed `enrolledActiveCount` / `occupancyPct` fields.
 */

import Link from 'next/link';
import { CalendarRange, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
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
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollTable } from '@/components/ui/scroll-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { useSchedules } from '@/hooks';
import type { ApiClient } from '@/lib/api';

interface ActiveSchedulesCardProps {
  client: ApiClient;
}

const TOP_LIMIT = 8;

export function ActiveSchedulesCard({ client }: ActiveSchedulesCardProps) {
  const { data, isLoading } = useSchedules(client, {
    status: 'active',
    limit: TOP_LIMIT,
    sort: 'course:asc',
  });

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Horarios activos</CardTitle>
        <Link
          href="/schedules"
          className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Sin horarios activos"
            description="Crea un horario para empezar a inscribir alumnos."
            className="py-12"
          />
        ) : (
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead className="hidden sm:table-cell">Nivel</TableHead>
                  <TableHead className="hidden md:table-cell">Profesor</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead className="text-right">Ocupación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => {
                  const pct = Math.round((s.occupancyPct ?? 0) * 100);
                  const variant =
                    pct >= 90 ? 'destructive' : pct >= 70 ? 'warning' : 'success';
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.course}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {s.level}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {s.teacherName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.weekdays} {s.startTime}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={variant}>
                          {s.enrolledActiveCount}/{s.capacity} · {pct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollTable>
        )}
      </CardContent>
    </Card>
  );
}
