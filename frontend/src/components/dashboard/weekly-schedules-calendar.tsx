'use client';

/**
 * WeeklySchedulesCalendar — Monday-first week grid of active schedules.
 *
 * Renders a navigable real-week view: each column shows the actual date and
 * highlights "today". Each schedule appears as a tinted session card in every
 * weekday it recurs on (decoded from the `weekdays` catalog code), sorted by
 * `startTime`. Clicking a card opens the schedule detail page.
 *
 * The recurrence pattern itself is week-agnostic in v1 — navigation only
 * re-anchors the date labels; the same schedules appear every week until a
 * future iteration brings cancellations/exceptions into scope.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSchedules } from '@/hooks';
import type { ApiClient, ScheduleWithCounts } from '@/lib/api';
import {
  parseWeekdays,
  WEEKDAY_SHORT_LABELS,
  WEEK_ORDER,
} from '@/lib/schedule-weekdays';

interface WeeklySchedulesCalendarProps {
  client: ApiClient;
}

const COURSE_PALETTE = [
  { bg: 'bg-primary/10', border: 'border-l-primary', text: 'text-primary' },
  { bg: 'bg-success/10', border: 'border-l-success', text: 'text-success' },
  { bg: 'bg-warning/10', border: 'border-l-warning', text: 'text-warning' },
  { bg: 'bg-info/10', border: 'border-l-info', text: 'text-info' },
  { bg: 'bg-accent/30', border: 'border-l-accent-foreground', text: 'text-accent-foreground' },
] as const;

function courseColor(course: string, courseIndex: Map<string, number>) {
  let idx = courseIndex.get(course);
  if (idx === undefined) {
    idx = courseIndex.size;
    courseIndex.set(course, idx);
  }
  return COURSE_PALETTE[idx % COURSE_PALETTE.length];
}

function occupancyVariant(pct: number): 'success' | 'warning' | 'destructive' {
  if (pct >= 90) return 'destructive';
  if (pct >= 70) return 'warning';
  return 'success';
}

// Position of a weekday index in the Monday-first WEEK_ORDER array.
const ORDER_INDEX: Record<number, number> = WEEK_ORDER.reduce(
  (acc, day, i) => ({ ...acc, [day]: i }),
  {} as Record<number, number>,
);

export function WeeklySchedulesCalendar({ client }: WeeklySchedulesCalendarProps) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );

  const { data, isLoading } = useSchedules(client, {
    status: 'active',
    limit: 100,
    sort: 'course:asc',
  });

  const items = data?.items ?? [];

  const sessionsByDay = useMemo(() => {
    const map = new Map<number, ScheduleWithCounts[]>();
    for (const day of WEEK_ORDER) map.set(day, []);

    for (const s of items) {
      for (const day of parseWeekdays(s.weekdays)) {
        map.get(day)?.push(s);
      }
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    return map;
  }, [items]);

  const courseIndex = useMemo(() => new Map<string, number>(), [data]);

  const totalRendered = useMemo(
    () => Array.from(sessionsByDay.values()).reduce((sum, l) => sum + l.length, 0),
    [sessionsByDay],
  );

  const weekEnd = addDays(weekStart, 6);
  // Range label uses month abbreviation only when the week spans two months
  // to keep the header compact in the common single-month case.
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const rangeLabel = sameMonth
    ? `${format(weekStart, 'd', { locale: es })}–${format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}`
    : `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`;

  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const goPrev = () => setWeekStart((w) => addWeeks(w, -1));
  const goNext = () => setWeekStart((w) => addWeeks(w, 1));
  const isCurrentWeek = isSameDay(
    weekStart,
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Calendario semanal</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToday}
            disabled={isCurrentWeek}
            className="h-8 px-3 text-xs"
          >
            Hoy
          </Button>
          <div className="inline-flex items-center rounded-md border bg-card">
            <Button
              variant="ghost"
              size="sm"
              onClick={goPrev}
              className="h-8 w-8 p-0"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-xs font-medium capitalize tabular-nums select-none min-w-[12rem] text-center">
              {rangeLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={goNext}
              className="h-8 w-8 p-0"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Link
            href="/schedules"
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1 p-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : items.length === 0 || totalRendered === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Sin horarios activos"
            description="Crea un horario para empezar a inscribir alumnos."
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[840px] border-t">
              {WEEK_ORDER.map((day) => {
                const sessions = sessionsByDay.get(day) ?? [];
                const isWeekend = day === 0 || day === 6;
                const dayDate = addDays(weekStart, ORDER_INDEX[day]);
                const isToday = isSameDay(dayDate, today);
                return (
                  <div
                    key={day}
                    className={cn(
                      'flex flex-col border-r last:border-r-0',
                      isWeekend && 'bg-muted/30',
                      isToday && 'bg-primary/5',
                    )}
                  >
                    <div
                      className={cn(
                        'px-2 py-2 text-center border-b sticky top-0 bg-card',
                        isToday && 'bg-primary/10',
                      )}
                    >
                      <p
                        className={cn(
                          'text-[10px] font-medium uppercase tracking-wide',
                          isToday ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {WEEKDAY_SHORT_LABELS[day]}
                      </p>
                      <p
                        className={cn(
                          'text-lg font-semibold tabular-nums mt-0.5',
                          isToday && 'text-primary',
                        )}
                      >
                        {format(dayDate, 'd')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {sessions.length === 0
                          ? '—'
                          : `${sessions.length} ${sessions.length === 1 ? 'clase' : 'clases'}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 p-1.5 min-h-[200px]">
                      {sessions.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground/60 text-center mt-4">
                          Sin clases
                        </p>
                      ) : (
                        sessions.map((s) => {
                          const color = courseColor(s.course, courseIndex);
                          const pct = Math.round((s.occupancyPct ?? 0) * 100);
                          return (
                            <button
                              key={`${day}-${s.id}`}
                              type="button"
                              onClick={() => router.push(`/schedules/${s.id}`)}
                              className={cn(
                                'group w-full text-left rounded-md border border-l-[3px] p-2 transition-all',
                                'hover:shadow-sm hover:-translate-y-0.5',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                color.bg,
                                color.border,
                              )}
                            >
                              <p className={cn('text-xs font-semibold truncate', color.text)}>
                                {s.course}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {s.level}
                              </p>
                              <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span className="tabular-nums">
                                  {s.startTime}–{s.endTime}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {s.teacherName}
                              </p>
                              <div className="flex items-center justify-between mt-1.5">
                                <Badge variant={occupancyVariant(pct)} className="text-[10px] px-1.5 py-0">
                                  <Users className="h-2.5 w-2.5 mr-0.5" />
                                  {s.enrolledActiveCount}/{s.capacity}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {pct}%
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
