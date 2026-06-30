'use client';

/**
 * CRM Métricas — operational KPIs and the lead funnel with a period selector and a
 * Metabase-style drill-down: clicking a funnel stage (or program) opens a side panel
 * listing the associated conversations, each linking to the inbox. KPIs are
 * representative; the funnel records come from the conversations mock so the drill-down
 * shows real rows. Real product feeds from the Cosmos change feed (see docs/10).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Bot, UserCheck, TrendingUp, MessageSquare, CalendarClock, X, ChevronRight, Table2, MousePointerClick } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import { useConversations } from '@/hooks';
import { WA_LEAD_STATE_LABELS, type WaConversation, type WaLeadState } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

const FUNNEL: WaLeadState[] = ['new', 'interested', 'visit', 'enrolled', 'paid'];

const PERIODS = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

// Representative funnel volumes per period (illustrative).
const FUNNEL_BY_PERIOD: Record<Period, Record<WaLeadState, number>> = {
  '7d': { new: 124, interested: 71, visit: 12, enrolled: 21, paid: 18, noreply: 0, support: 0 },
  '30d': { new: 488, interested: 270, visit: 46, enrolled: 83, paid: 71, noreply: 0, support: 0 },
  '90d': { new: 1390, interested: 760, visit: 131, enrolled: 232, paid: 205, noreply: 0, support: 0 },
};

const KPIS: Record<Period, { icon: typeof Clock; label: string; value: string; hint: string; tone: string }[]> = {
  '7d': [
    { icon: Clock, label: 'TTFR (1ª respuesta)', value: '2m 14s', hint: 'Promedio', tone: 'text-sky-500' },
    { icon: Bot, label: '% resuelto por IA', value: '38%', hint: 'Sin intervención humana', tone: 'text-primary' },
    { icon: UserCheck, label: '% derivado a humano', value: '22%', hint: 'IA cedió el control', tone: 'text-violet-500' },
    { icon: TrendingUp, label: 'Conversión a inscrito', value: '17%', hint: 'Nuevo → Inscrito', tone: 'text-emerald-500' },
    { icon: MessageSquare, label: 'Mensajes / día', value: '143', hint: 'Entrantes + salientes', tone: 'text-amber-500' },
    { icon: CalendarClock, label: 'Visitas agendadas', value: '~10%', hint: 'De los leads piden visita', tone: 'text-rose-500' },
  ],
  '30d': [
    { icon: Clock, label: 'TTFR (1ª respuesta)', value: '2m 02s', hint: 'Promedio', tone: 'text-sky-500' },
    { icon: Bot, label: '% resuelto por IA', value: '41%', hint: 'Sin intervención humana', tone: 'text-primary' },
    { icon: UserCheck, label: '% derivado a humano', value: '20%', hint: 'IA cedió el control', tone: 'text-violet-500' },
    { icon: TrendingUp, label: 'Conversión a inscrito', value: '17%', hint: 'Nuevo → Inscrito', tone: 'text-emerald-500' },
    { icon: MessageSquare, label: 'Mensajes / día', value: '156', hint: 'Entrantes + salientes', tone: 'text-amber-500' },
    { icon: CalendarClock, label: 'Visitas agendadas', value: '~9%', hint: 'De los leads piden visita', tone: 'text-rose-500' },
  ],
  '90d': [
    { icon: Clock, label: 'TTFR (1ª respuesta)', value: '2m 21s', hint: 'Promedio', tone: 'text-sky-500' },
    { icon: Bot, label: '% resuelto por IA', value: '36%', hint: 'Sin intervención humana', tone: 'text-primary' },
    { icon: UserCheck, label: '% derivado a humano', value: '24%', hint: 'IA cedió el control', tone: 'text-violet-500' },
    { icon: TrendingUp, label: 'Conversión a inscrito', value: '15%', hint: 'Nuevo → Inscrito', tone: 'text-emerald-500' },
    { icon: MessageSquare, label: 'Mensajes / día', value: '148', hint: 'Entrantes + salientes', tone: 'text-amber-500' },
    { icon: CalendarClock, label: 'Visitas agendadas', value: '~9%', hint: 'De los leads piden visita', tone: 'text-rose-500' },
  ],
};

const PROGRAM_SPLIT = [
  { key: 'drywall', label: 'Drywall', value: 58, className: 'bg-primary' },
  { key: 'melamina', label: 'Melamina', value: 42, className: 'bg-sky-500' },
];

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

type Drill =
  | { type: 'stage'; value: WaLeadState }
  | { type: 'program'; value: string };

export default function MetricsPage() {
  const client = useApiClient();
  const router = useRouter();
  const { data } = useConversations(client, { limit: 100 });
  const conversations = useMemo(() => data?.items ?? [], [data]);

  const [period, setPeriod] = useState<Period>('7d');
  const [drill, setDrill] = useState<Drill | null>(null);

  const counts = FUNNEL_BY_PERIOD[period];
  const maxCount = Math.max(1, ...FUNNEL.map((s) => counts[s]));
  const topCount = Math.max(1, counts.new);

  const drillRows = useMemo<WaConversation[]>(() => {
    if (!drill) return [];
    if (drill.type === 'stage') return conversations.filter((c) => c.leadState === drill.value);
    return conversations.filter((c) => c.program === drill.value);
  }, [drill, conversations]);

  const drillTitle = drill
    ? drill.type === 'stage'
      ? `Leads en “${WA_LEAD_STATE_LABELS[drill.value]}”`
      : `Programa “${drill.value.charAt(0).toUpperCase() + drill.value.slice(1)}”`
    : '';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <h1 className="text-sm font-semibold">Métricas</h1>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs transition-colors',
                period === p.value ? 'bg-primary text-neutral-900' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {KPIS[period].map((k) => (
            <StatCard
              key={k.label}
              variant="badge"
              icon={k.icon}
              iconClassName={k.tone}
              value={k.value}
              label={k.label}
              description={k.hint}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Lead funnel */}
          <div className="rounded-lg border bg-background p-4 shadow-sm xl:col-span-2">
            <h2 className="text-sm font-semibold">Embudo de leads</h2>
            <p className="text-xs text-muted-foreground">Clic en una etapa para ver los registros</p>
            <div className="mt-4 space-y-2">
              {FUNNEL.map((st) => {
                const n = counts[st];
                const widthPct = Math.round((n / maxCount) * 100);
                const convPct = Math.round((n / topCount) * 100);
                const active = drill?.type === 'stage' && drill.value === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDrill({ type: 'stage', value: st })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-muted/50',
                      active && 'bg-muted',
                    )}
                  >
                    <span className="w-32 shrink-0 text-sm">{WA_LEAD_STATE_LABELS[st]}</span>
                    <div className="h-7 flex-1 overflow-hidden rounded-md bg-muted">
                      <div
                        className="flex h-full items-center rounded-md bg-primary px-2 text-xs font-medium text-neutral-900 transition-all"
                        style={{ width: `${Math.max(widthPct, n > 0 ? 8 : 0)}%` }}
                      >
                        {n > 0 ? n : ''}
                      </div>
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{convPct}%</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Program split */}
          <div className="rounded-lg border bg-background p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Por programa</h2>
            <p className="text-xs text-muted-foreground">Clic para ver los registros</p>
            <div className="mt-4 space-y-3">
              {PROGRAM_SPLIT.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setDrill({ type: 'program', value: p.key })}
                  className={cn(
                    'w-full rounded-md p-1 text-left transition-colors hover:bg-muted/50',
                    drill?.type === 'program' && drill.value === p.key && 'bg-muted',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{p.label}</span>
                    <span className="text-muted-foreground">{p.value}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', p.className)} style={{ width: `${p.value}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data explorer (Metabase-style) — full width below, uses the available space */}
        <div className="rounded-lg border bg-background shadow-sm">
          <div className="flex items-center justify-between border-b p-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Table2 className="size-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Explorador de datos</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {drill ? `${drillTitle} · ${drillRows.length} registros` : 'Clic en una etapa del embudo o un programa para ver los registros asociados.'}
                </p>
              </div>
            </div>
            {drill && (
              <button type="button" onClick={() => setDrill(null)} aria-label="Limpiar selección" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>

          {!drill ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MousePointerClick className="size-5" />
              </div>
              <p className="text-sm font-medium">Selecciona una etapa o programa</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Al hacer clic en una barra del embudo o en un programa, aquí aparecerán los contactos asociados.
              </p>
            </div>
          ) : drillRows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">Sin registros en la muestra actual.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {drillRows.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/crm/inbox?c=${encodeURIComponent(c.id)}`)}
                  className="flex items-center gap-3 rounded-lg border bg-background p-2.5 text-left transition-colors hover:border-primary hover:bg-muted/50"
                >
                  <Avatar className="size-9"><AvatarFallback className="text-[11px]">{initials(c.displayName)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.phone}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">{WA_LEAD_STATE_LABELS[c.leadState]}</Badge>
                    {c.program && (
                      <Badge className="bg-primary/15 px-1.5 py-0 text-[10px] font-medium text-primary hover:bg-primary/15">
                        {c.program.charAt(0).toUpperCase() + c.program.slice(1)}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
