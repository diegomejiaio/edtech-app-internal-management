'use client';

/**
 * CRM Explorer — pipeline view of conversations/leads. Two views of the same data:
 *  - Kanban: columns by lead state, drag a card to change its state.
 *  - Tabla: filterable grid; click a row to open the conversation.
 *
 * Inspired by wacrm's sales pipelines (Kanban + deals), but MVP projects the
 * existing `leadState` instead of a separate deal entity (see docs/10 §7).
 * Works backendless via the mock fallback. Persistence of lead state reuses
 * PATCH /wa/conversations/{id}.
 */

import { useMemo, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KanbanSquare, Table as TableIcon, Bot, CalendarClock } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import { useConversations, useUpdateConversation } from '@/hooks';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/filter-bar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  WA_LEAD_STATE_LABELS,
  WA_AI_MODE_LABELS,
  type WaConversation,
  type WaLeadState,
} from '@/lib/api';

const PIPELINE: WaLeadState[] = ['new', 'interested', 'visit', 'enrolled', 'paid', 'noreply', 'support'];

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function visitLabel(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function programLabel(p?: string | null): string {
  if (!p) return '';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export default function ExplorerPage() {
  const client = useApiClient();
  const router = useRouter();
  const { data, isLoading } = useConversations(client, { limit: 100 });
  const updateMutation = useUpdateConversation(client);
  const allConversations = useMemo(() => data?.items ?? [], [data]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overState, setOverState] = useState<WaLeadState | null>(null);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState<string>('all');

  const programs = useMemo(
    () => Array.from(new Set(allConversations.map((c) => c.program).filter(Boolean) as string[])).sort(),
    [allConversations],
  );

  const conversations = useMemo(
    () =>
      allConversations.filter((c) => {
        if (programFilter !== 'all' && c.program !== programFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!c.displayName.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
        }
        return true;
      }),
    [allConversations, programFilter, search],
  );

  const byState = useMemo(() => {
    const map: Record<WaLeadState, WaConversation[]> = {
      new: [], interested: [], visit: [], enrolled: [], paid: [], noreply: [], support: [],
    };
    for (const c of conversations) map[c.leadState]?.push(c);
    return map;
  }, [conversations]);

  function moveTo(conv: WaConversation, state: WaLeadState) {
    if (conv.leadState === state) return;
    updateMutation
      .mutateAsync({ id: conv.id, body: { leadState: state } })
      .catch(() => toast.error('No se pudo mover la conversación'));
  }

  function onDrop(e: DragEvent, state: WaLeadState) {
    e.preventDefault();
    setOverState(null);
    const id = dragId ?? e.dataTransfer.getData('text/plain');
    const conv = conversations.find((c) => c.id === id);
    if (conv) moveTo(conv, state);
    setDragId(null);
  }

  const openConversation = (id: string) => router.push(`/crm/inbox?c=${encodeURIComponent(id)}`);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <h1 className="text-sm font-semibold">Explorer</h1>
        <span className="text-xs text-muted-foreground">{conversations.length} contactos</span>
      </div>

      {/* Filter bar: prominent full-width search + program quick-filter (drywall/melamina/…) */}
      <div className="flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar contacto por nombre o teléfono…"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Programa:</span>
          <button
            type="button"
            onClick={() => setProgramFilter('all')}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              programFilter === 'all' ? 'border-primary bg-primary text-neutral-900' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Todos
          </button>
          {programs.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProgramFilter(p)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                programFilter === p ? 'border-primary bg-primary text-neutral-900' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {programLabel(p)}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="kanban" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-3 py-2">
          <TabsList>
            <TabsTrigger value="kanban" className="gap-1.5">
              <KanbanSquare className="size-4" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5">
              <TableIcon className="size-4" /> Tabla
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Kanban view */}
        <TabsContent value="kanban" className="min-h-0 flex-1 overflow-x-auto p-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <div className="flex h-full gap-3">
              {PIPELINE.map((state) => (
                <div
                  key={state}
                  onDragOver={(e) => { e.preventDefault(); setOverState(state); }}
                  onDragLeave={() => setOverState((s) => (s === state ? null : s))}
                  onDrop={(e) => onDrop(e, state)}
                  className={cn(
                    'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30',
                    overState === state && 'ring-2 ring-primary',
                  )}
                >
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-sm font-medium">{WA_LEAD_STATE_LABELS[state]}</span>
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5">{byState[state].length}</Badge>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto p-2">
                    {byState[state].length === 0 ? (
                      <p className="px-1 py-4 text-center text-xs text-muted-foreground">Sin contactos</p>
                    ) : (
                      byState[state].map((conv) => (
                        <article
                          key={conv.id}
                          draggable
                          onDragStart={(e) => { setDragId(conv.id); e.dataTransfer.setData('text/plain', conv.id); }}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => openConversation(conv.id)}
                          className={cn(
                            'cursor-pointer rounded-md border bg-background p-2.5 shadow-sm transition hover:border-primary',
                            dragId === conv.id && 'opacity-50',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7"><AvatarFallback className="text-[10px]">{initials(conv.displayName)}</AvatarFallback></Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{conv.displayName}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{conv.phone}</p>
                            </div>
                            {conv.unread > 0 && <Badge className="h-5 min-w-5 px-1.5">{conv.unread}</Badge>}
                          </div>
                          {conv.lastMessagePreview && (
                            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{conv.lastMessagePreview}</p>
                          )}
                          {conv.leadState === 'visit' && conv.visitAt && (
                            <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                              <CalendarClock className="size-3.5" />
                              Visita: {visitLabel(conv.visitAt)}
                            </div>
                          )}
                          {(conv.program || conv.aiMode !== 'off' || (conv.tags?.length ?? 0) > 0) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              {conv.program && (
                                <Badge className="bg-primary/15 px-1.5 py-0 text-[10px] font-medium text-primary hover:bg-primary/15">
                                  {programLabel(conv.program)}
                                </Badge>
                              )}
                              {conv.aiMode !== 'off' && (
                                <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
                                  <Bot className="size-3" />{WA_AI_MODE_LABELS[conv.aiMode]}
                                </Badge>
                              )}
                              {conv.tags?.map((t) => (
                                <Badge key={t} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">{t}</Badge>
                              ))}
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Table view */}
        <TabsContent value="table" className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Visita</TableHead>
                <TableHead>Modo IA</TableHead>
                <TableHead>Etiquetas</TableHead>
                <TableHead className="text-right">Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((conv) => (
                <TableRow
                  key={conv.id}
                  className="cursor-pointer"
                  onClick={() => openConversation(conv.id)}
                >
                  <TableCell className="font-medium">{conv.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">{conv.phone}</TableCell>
                  <TableCell>
                    {conv.program
                      ? <Badge className="bg-primary/15 font-medium text-primary hover:bg-primary/15">{programLabel(conv.program)}</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">{WA_LEAD_STATE_LABELS[conv.leadState]}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {conv.visitAt ? visitLabel(conv.visitAt) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{WA_AI_MODE_LABELS[conv.aiMode]}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {conv.tags?.length
                        ? conv.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">{t}</Badge>
                          ))
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(conv.lastMessageAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && conversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No hay contactos.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}