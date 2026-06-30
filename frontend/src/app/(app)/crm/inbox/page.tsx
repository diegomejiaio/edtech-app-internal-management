'use client';

/**
 * WhatsApp CRM inbox — 3-pane layout.
 *
 * Left: conversation list (search + status filter).
 * Center: message thread + composer (manual agent send).
 * Right: lead panel (lead state, AI mode, AI suggest, quick replies).
 *
 * Works backendless via the mock fallback in lib/api/whatsapp.ts.
 */

import { useMemo, useState, useEffect, useRef, Suspense, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Search, Send, Sparkles, Bot, User, MessageSquare, ArrowLeft, Pencil, X, Wand2, Plus, ImageIcon, FileText, Paperclip, SlidersHorizontal, CalendarClock } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import {
  useConversations,
  useInfiniteMessages,
  useUpdateConversation,
  useSendMessage,
  useAiSuggest,
  useImproveMessage,
  useIsMobile,
} from '@/hooks';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import {
  WA_STATUS_LABELS,
  WA_LEAD_STATE_LABELS,
  WA_AI_MODE_LABELS,
  type WaConversation,
  type WaStatus,
  type WaLeadState,
  type WaAiMode,
  type WaSender,
  type WaImproveAction,
  type WaAttachment,
} from '@/lib/api';
import { CRM_AGENTS, DEFAULT_AGENT } from '@/lib/crm/agents';

const STATUS_FILTERS: WaStatus[] = ['open', 'pending', 'closed'];
const LEAD_STATES: WaLeadState[] = ['new', 'interested', 'visit', 'enrolled', 'paid', 'noreply', 'support'];
const AI_MODES: WaAiMode[] = ['off', 'assist', 'autopilot'];

const AI_MODE_DESCRIPTIONS: Record<WaAiMode, string> = {
  off: 'La IA no participa en esta conversación. Respondes tú.',
  assist: 'La IA sugiere respuestas; tú las revisas antes de enviar.',
  autopilot: 'La IA responde sola a preguntas seguras (horarios, precios, ubicación, link) y deriva el resto.',
};

const DEFAULT_AUTOPILOT_OBJECTIVE =
  'Responde de forma cordial y breve las preguntas frecuentes (horarios, precios, ubicación, ' +
  'requisitos y link de inscripción). Si el interesado quiere conocer la academia antes de ' +
  'inscribirse, ofrécele agendar una visita presencial (L-V 9am-6pm) y marca el lead como ' +
  '"Visita presencial". Si preguntan por pagos, reclamos o algo fuera de esto, deriva a un ' +
  'humano. Responde siempre en español.';

const QUICK_REPLIES: { label: string; text: string }[] = [
  { label: 'Horarios', text: 'Tenemos horarios de mañana (8-10am) y tarde (6-8pm). ¿Cuál te conviene?' },
  { label: 'Precios', text: 'El curso cuesta S/350 al mes más S/100 de matrícula.' },
  { label: 'Ubicación', text: 'Estamos en Av. Principal 123, Lima. ¡Te esperamos!' },
  { label: 'Visita', text: 'Puedes visitarnos antes de inscribirte, de lunes a viernes de 9am a 6pm. ¿Qué día te queda bien?' },
  { label: 'Link', text: 'Te paso el link de inscripción: espaciopro.pe/inscripcion' },
];

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

const SENDER_ICON: Record<WaSender, typeof User> = { customer: User, agent: User, bot: Bot };

/**
 * `useSearchParams` (the `?c=<conversationId>` deep link) must be wrapped in a
 * Suspense boundary for the static-export prerender.
 */
export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando…</div>}>
      <InboxView />
    </Suspense>
  );
}

function InboxView() {
  const client = useApiClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WaStatus | 'all'>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [leadFilter, setLeadFilter] = useState<WaLeadState[]>([]);
  const [aiFilter, setAiFilter] = useState<WaAiMode[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [attachments, setAttachments] = useState<WaAttachment[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const { data: convData, isLoading: loadingConvs } = useConversations(client, {
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const allConversations = useMemo(() => convData?.items ?? [], [convData]);
  const availableTags = useMemo(
    () => Array.from(new Set(allConversations.flatMap((c) => c.tags ?? []))).sort(),
    [allConversations],
  );
  const conversations = useMemo(
    () =>
      allConversations.filter((c) => {
        if (onlyUnread && c.unread === 0) return false;
        if (leadFilter.length && !leadFilter.includes(c.leadState)) return false;
        if (aiFilter.length && !aiFilter.includes(c.aiMode)) return false;
        if (tagFilter.length && !tagFilter.some((t) => c.tags?.includes(t))) return false;
        return true;
      }),
    [allConversations, onlyUnread, leadFilter, aiFilter, tagFilter],
  );

  const activeFilterCount =
    leadFilter.length + aiFilter.length + tagFilter.length + (onlyUnread ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || statusFilter !== 'all';

  function toggleFrom<T>(list: T[], value: T, setter: (v: T[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function clearFilters() {
    setStatusFilter('all');
    setOnlyUnread(false);
    setLeadFilter([]);
    setAiFilter([]);
    setTagFilter([]);
  }

  // Selection is driven by the `?c=` query param so every chat is deep-linkable.
  const selectedId = searchParams.get('c') ?? undefined;
  const selected = conversations.find((c) => c.id === selectedId);
  const activeId = selected?.id;

  const selectConversation = (id: string) => router.push(`/crm/inbox?c=${encodeURIComponent(id)}`);
  const clearSelection = () => router.push('/crm/inbox');

  const {
    data: msgPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMessages(client, activeId, 25);
  // Pages arrive newest-first (DESC); flatten and sort ASC for chronological display.
  const messages = useMemo(() => {
    const all = msgPages?.pages.flatMap((p) => p.items) ?? [];
    return all.slice().sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  }, [msgPages]);

  const updateMutation = useUpdateConversation(client);
  const sendMutation = useSendMessage(client);
  const suggestMutation = useAiSuggest(client);
  const improveMutation = useImproveMessage(client);

  // Scroll to bottom when switching conversation or when a new latest message arrives.
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [activeId, lastMessageId]);

  // On desktop, open the most recent conversation by default (deep link via ?c=).
  // On mobile we keep the list visible until the user taps a chat.
  useEffect(() => {
    if (isMobile || loadingConvs || selectedId || conversations.length === 0) return;
    const mostRecent = conversations.reduce((a, b) =>
      (a.lastMessageAt ?? '') >= (b.lastMessageAt ?? '') ? a : b);
    router.replace(`/crm/inbox?c=${encodeURIComponent(mostRecent.id)}`);
  }, [isMobile, loadingConvs, selectedId, conversations, router]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeId || (!draft.trim() && attachments.length === 0)) return;
    sendMutation
      .mutateAsync({ conversationId: activeId, body: { text: draft.trim(), attachments: attachments.length ? attachments : undefined } })
      .then(() => {
        setDraft('');
        setAttachments([]);
      })
      .catch(() => toast.error('No se pudo enviar el mensaje'));
  }

  function onPickFiles(kind: WaAttachment['kind'], files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked: WaAttachment[] = Array.from(files).map((f) => ({
      kind,
      url: URL.createObjectURL(f), // MVP: local object URL. Real upload → Azure Blob (Fase 1).
      name: f.name,
      mimeType: f.type,
    }));
    setAttachments((prev) => [...prev, ...picked]);
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.url.startsWith('blob:')) URL.revokeObjectURL(removed.url);
      return next;
    });
  }

  function handleSuggest() {
    if (!activeId) return;
    suggestMutation
      .mutateAsync({ conversationId: activeId, instruction: aiInstruction.trim() || undefined })
      .then((s) => {
        setDraft(s.suggestion);
        setAiInstruction('');
      })
      .catch(() => toast.error('No se pudo generar la sugerencia'));
  }

  function handleImprove(action: WaImproveAction, instruction?: string) {
    const text = draft.trim();
    if (!text) return;
    improveMutation
      .mutateAsync({ text, action, instruction })
      .then((r) => setDraft(r.text))
      .catch(() => toast.error('No se pudo ajustar el mensaje'));
  }

  function handleImproveCustom() {
    const instruction = window.prompt('¿Cómo quieres ajustar el mensaje?');
    if (instruction && instruction.trim()) handleImprove('custom', instruction.trim());
  }

  function patch(body: Partial<{ leadState: WaLeadState; aiMode: WaAiMode; status: WaStatus; program: string | null; visitAt: string | null; assignedTo: string | null }>) {
    if (!activeId) return;
    updateMutation
      .mutateAsync({ id: activeId, body })
      .catch(() => toast.error('No se pudo actualizar la conversación'));
  }

  // datetime-local <-> ISO helpers for the visit scheduler
  function toLocalInput(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(300px,3fr)_minmax(0,7fr)] lg:grid-cols-[minmax(300px,3fr)_minmax(0,5fr)_minmax(260px,2fr)]">
        {/* Pane 1: conversation list — full screen on mobile until a chat is opened */}
        <aside className={cn('min-h-0 flex-col overflow-hidden border-r min-w-0', activeId ? 'hidden md:flex' : 'flex')}>
          <div className="space-y-2 border-b p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Mensajes</h2>
              <span className="text-xs text-muted-foreground">{conversations.length}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contacto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Quick filters: status segmented + unread toggle + advanced popover */}
            <div className="flex flex-wrap items-center gap-1">
              {(['all', ...STATUS_FILTERS] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    statusFilter === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {s === 'all' ? 'Todas' : WA_STATUS_LABELS[s]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setOnlyUnread((v) => !v)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  onlyUnread
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                No leídas
              </button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto h-7 gap-1 px-2">
                    <SlidersHorizontal className="size-3.5" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">{activeFilterCount}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-4">
                  <FilterGroup
                    title="Estado del lead"
                    options={LEAD_STATES.map((s) => ({ value: s, label: WA_LEAD_STATE_LABELS[s] }))}
                    selected={leadFilter}
                    onToggle={(v) => toggleFrom(leadFilter, v as WaLeadState, setLeadFilter)}
                  />
                  <FilterGroup
                    title="Modo IA"
                    options={AI_MODES.map((m) => ({ value: m, label: WA_AI_MODE_LABELS[m] }))}
                    selected={aiFilter}
                    onToggle={(v) => toggleFrom(aiFilter, v as WaAiMode, setAiFilter)}
                  />
                  {availableTags.length > 0 && (
                    <FilterGroup
                      title="Etiquetas"
                      options={availableTags.map((t) => ({ value: t, label: t }))}
                      selected={tagFilter}
                      onToggle={(v) => toggleFrom(tagFilter, v, setTagFilter)}
                    />
                  )}
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1">
                {onlyUnread && (
                  <FilterChip label="No leídas" onRemove={() => setOnlyUnread(false)} />
                )}
                {leadFilter.map((s) => (
                  <FilterChip
                    key={`lead-${s}`}
                    label={WA_LEAD_STATE_LABELS[s]}
                    onRemove={() => toggleFrom(leadFilter, s, setLeadFilter)}
                  />
                ))}
                {aiFilter.map((m) => (
                  <FilterChip
                    key={`ai-${m}`}
                    label={WA_AI_MODE_LABELS[m]}
                    onRemove={() => toggleFrom(aiFilter, m, setAiFilter)}
                  />
                ))}
                {tagFilter.map((t) => (
                  <FilterChip key={`tag-${t}`} label={t} onRemove={() => toggleFrom(tagFilter, t, setTagFilter)} />
                ))}
              </div>
            )}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {loadingConvs ? (
              <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {hasActiveFilters ? 'Sin resultados con estos filtros.' : 'No hay conversaciones.'}
              </p>
            ) : (
              <ul>
                {conversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conv={c}
                    active={c.id === activeId}
                    onClick={() => selectConversation(c.id)}
                  />
                ))}
              </ul>
            )}
          </ScrollArea>
        </aside>

        {/* Pane 2: thread + composer — full screen on mobile, hidden until a chat is opened */}
        <section className={cn('min-h-0 min-w-0 flex-col overflow-hidden', activeId ? 'flex' : 'hidden md:flex')}>
          {!selected ? (
            <EmptyState
              icon={MessageSquare}
              title="Selecciona una conversación"
              description="Elige un contacto de la lista para ver el chat."
            />
          ) : (
            <>
              <header className="flex items-center gap-3 border-b p-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-1 size-8 shrink-0 md:hidden"
                  onClick={clearSelection}
                  aria-label="Volver a la lista"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <Avatar className="size-9"><AvatarFallback>{initials(selected.displayName)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selected.displayName}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs text-muted-foreground">{selected.phone}</p>
                    {selected.program && (
                      <Badge className="bg-primary/15 px-1.5 py-0 text-[10px] font-medium text-primary hover:bg-primary/15">
                        {selected.program.charAt(0).toUpperCase() + selected.program.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>
                <Select value={selected.leadState} onValueChange={(v) => patch({ leadState: v as WaLeadState })}>
                  <SelectTrigger className="ml-auto h-8 w-[150px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{WA_LEAD_STATE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </header>
              {selected.leadState === 'visit' && (
                <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2">
                  <CalendarClock className="size-4 text-primary" />
                  <span className="text-sm font-medium">Visita presencial:</span>
                  <input
                    type="datetime-local"
                    aria-label="Fecha y hora de la visita presencial"
                    value={toLocalInput(selected.visitAt)}
                    onChange={(e) => patch({ visitAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  />
                  {selected.visitAt && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => patch({ visitAt: '' })}>
                      Quitar
                    </Button>
                  )}
                </div>
              )}
              <ScrollArea className="min-h-0 flex-1 p-4">
                <div className="space-y-3">
                  {hasNextPage && (
                    <div className="flex justify-center pb-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                      >
                        {isFetchingNextPage ? 'Cargando…' : 'Cargar mensajes anteriores'}
                      </Button>
                    </div>
                  )}
                  {messages.map((m) => {
                    const mine = m.sender !== 'customer';
                    const Icon = SENDER_ICON[m.sender];
                    return (
                      <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                          mine
                            ? 'bg-primary text-neutral-900 dark:bg-[oklch(0.48_0.13_55)] dark:text-white'
                            : 'bg-muted text-foreground',
                        )}>
                          <p className={cn(
                            'mb-0.5 flex items-center gap-1 text-[10px]',
                            mine ? 'text-neutral-900/80 dark:text-white/70' : 'text-muted-foreground',
                          )}>
                            <Icon className="size-3" />
                            {m.sender === 'bot' ? 'IA' : m.sender === 'agent' ? 'Agente' : 'Cliente'}
                            {' · '}{timeAgo(m.ts)}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          {m.attachments?.length ? (
                            <div className="mt-1.5 space-y-1.5">
                              {m.attachments.map((a, i) =>
                                a.kind === 'image' ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={i}
                                    src={a.url}
                                    alt={a.name ?? 'imagen'}
                                    className="max-h-48 rounded-md object-cover"
                                  />
                                ) : (
                                  <a
                                    key={i}
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 rounded-md bg-background/20 px-2 py-1.5 text-xs underline-offset-2 hover:underline"
                                  >
                                    <FileText className="size-4 shrink-0" />
                                    <span className="truncate">{a.name ?? 'documento'}</span>
                                  </a>
                                ),
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>
              </ScrollArea>
              <form onSubmit={handleSend} className="space-y-2 border-t p-3">
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((a, i) => (
                      <div key={i} className="group relative">
                        {a.kind === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.url} alt={a.name ?? ''} className="size-16 rounded-md border object-cover" />
                        ) : (
                          <div className="flex size-16 flex-col items-center justify-center gap-1 rounded-md border p-1 text-center">
                            <FileText className="size-5 text-muted-foreground" />
                            <span className="w-full truncate text-[9px] text-muted-foreground">{a.name}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          aria-label="Quitar adjunto"
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow ring-1 ring-border"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      onPickFiles('image', e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    multiple
                    hidden
                    onChange={(e) => {
                      onPickFiles('document', e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" aria-label="Adjuntar" title="Adjuntar">
                        <Plus className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-44">
                      <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
                        <ImageIcon className="mr-2 size-4" /> Imágenes
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => docInputRef.current?.click()}>
                        <Paperclip className="mr-2 size-4" /> Documento
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escribe un mensaje…"
                    rows={2}
                    className="min-h-0 flex-1 resize-none"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!draft.trim() || improveMutation.isPending}
                        aria-label="Asistente de redacción"
                        title="Mejorar con IA"
                      >
                        <Wand2 className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="w-48">
                      <DropdownMenuItem onSelect={() => handleImprove('rewrite')}>Reescribir</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleImprove('proofread')}>Corregir</DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Ajustar tono</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onSelect={() => handleImprove('concise')}>Conciso</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleImprove('longer')}>Más largo</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleImprove('casual')}>Casual</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleImprove('professional')}>Profesional</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleImprove('confident')}>Seguro</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleImprove('enthusiastic')}>Entusiasta</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => handleImproveCustom()}>Personalizado…</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={(!draft.trim() && attachments.length === 0) || sendMutation.isPending}
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>

        {/* Pane 3: student data + quick replies (scroll) and AI widget (sticky bottom) */}
        <aside className="hidden min-h-0 flex-col overflow-hidden border-l lg:flex">
          {selected ? (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <StudentDataCard key={selected.id} conv={selected} />
                <Separator />
                <div className="space-y-2">
                  <Label>Respuestas rápidas</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_REPLIES.map((q) => (
                      <Button key={q.label} variant="secondary" size="sm" onClick={() => setDraft(q.text)}>
                        {q.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2 border-t bg-sidebar/40 p-4">
                <div className="space-y-1.5">
                  <Label>Agente asignado</Label>
                  <Select
                    value={selected.assignedTo ?? DEFAULT_AGENT.id}
                    onValueChange={(v) => patch({ assignedTo: v })}
                  >
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CRM_AGENTS.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}{a.isDefault ? ' · default' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selected.assignedTo && (
                    <p className="text-[11px] text-muted-foreground">Usando el agente por defecto. Puedes asignar otro.</p>
                  )}
                </div>
                <Separator />
                <Label>Modo IA</Label>
                <div className="grid grid-cols-3 gap-1 rounded-lg border p-1">
                  {AI_MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patch({ aiMode: m })}
                      aria-pressed={selected.aiMode === m}
                      className={cn(
                        'rounded-md px-1.5 py-1.5 text-[11px] font-medium leading-tight transition-colors',
                        selected.aiMode === m
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {WA_AI_MODE_LABELS[m]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {AI_MODE_DESCRIPTIONS[selected.aiMode]}
                </p>

                {selected.aiMode === 'assist' && (
                  <>
                    <Textarea
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      placeholder='Instrucción puntual (opcional). Ej: "dile que solo atendemos los lunes"'
                      rows={2}
                      className="resize-none text-sm"
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleSuggest}
                      disabled={suggestMutation.isPending}
                    >
                      <Sparkles className="mr-2 size-4" />
                      {aiInstruction.trim() ? 'Generar respuesta' : 'Sugerir con IA'}
                    </Button>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Si lo dejas vacío, la IA usa el contexto de la conversación y propone la mejor respuesta.
                    </p>
                  </>
                )}

                {selected.aiMode === 'autopilot' && (
                  <AutopilotObjectiveCard key={selected.id} />
                )}
              </div>
            </>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Selecciona una conversación.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

const DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'dni', label: 'DNI' },
  { value: 'ce', label: 'CE' },
  { value: 'passport', label: 'Pasaporte' },
];

const SOURCE_OPTIONS = ['Instagram', 'Facebook', 'Recomendación', 'Google', 'Volante', 'Otro'];

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return [full.trim(), ''];
  return [parts[0], parts.slice(1).join(' ')];
}

function docTypeLabel(value: string): string {
  return DOC_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/**
 * Student/lead data panel. Read-only by default with an "Editar" toggle. Fields mirror
 * the real Student entity (Nombre/Apellido/Tipo+N° documento/Teléfono/Email/Fuente/Notas)
 * plus CRM attributes (Etiquetas, Interesado en). Persistence is an MVP stub.
 */
function StudentDataCard({ conv }: { conv: WaConversation }) {
  const [firstSeed, lastSeed] = splitName(conv.displayName);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(firstSeed);
  const [lastName, setLastName] = useState(lastSeed);
  const [docType, setDocType] = useState('dni');
  const [docNumber, setDocNumber] = useState('');
  const [phone, setPhone] = useState(conv.phone ?? '');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [interest, setInterest] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  function save() {
    setEditing(false);
    // MVP stub: real persistence to the Student entity arrives with the backend wiring.
    toast.success('Datos del alumno guardados (demo)');
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || conv.displayName;
  const docLine = docNumber ? `${docTypeLabel(docType)} ${docNumber}` : '';

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Datos del alumno</Label>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 size-3.5" /> Editar
          </Button>
        </div>
        <dl className="space-y-2">
          <ReadRow label="Nombre" value={fullName} />
          <ReadRow label="Documento" value={docLine} />
          <ReadRow label="Teléfono" value={phone} />
          <ReadRow label="Email" value={email} />
          <ReadRow label="Fuente" value={source} />
          <ReadRow label="Interesado en" value={interest} />
          <ReadRow label="Notas" value={notes} />
        </dl>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Etiquetas</p>
          {tags.length ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin etiquetas</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Datos del alumno</Label>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" />
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" />
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DOC_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="N° documento" />
      </div>
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" />
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
      <Select value={source || undefined} onValueChange={setSource}>
        <SelectTrigger><SelectValue placeholder="¿Cómo nos encontró?" /></SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Interesado en (curso/programa)" />
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas"
        rows={2}
        className="resize-none text-sm"
      />
      <div className="space-y-1">
        <Label className="text-xs">Etiquetas</Label>
        {tags.length ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                {t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  aria-label={`Quitar ${t}`}
                  className="rounded-sm hover:bg-background/40"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex gap-1">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Añadir etiqueta"
            className="h-8"
          />
          <Button type="button" size="sm" variant="outline" onClick={addTag}>Añadir</Button>
        </div>
      </div>
      <Button size="sm" className="w-full" onClick={save}>
        Guardar datos
      </Button>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

/**
 * Autopilot objective for THIS conversation. Read-only by default with an "Editar"
 * toggle; edits override the default for this lead only (resets per conversation via
 * `key`). Persistence is an MVP stub (will live on the conversation/agentConfig).
 */
function AutopilotObjectiveCard() {
  const [objective, setObjective] = useState(DEFAULT_AUTOPILOT_OBJECTIVE);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_AUTOPILOT_OBJECTIVE);
  const isCustom = objective.trim() !== DEFAULT_AUTOPILOT_OBJECTIVE;

  function startEdit() {
    setDraft(objective);
    setEditing(true);
  }
  function save() {
    setObjective(draft.trim() || DEFAULT_AUTOPILOT_OBJECTIVE);
    setEditing(false);
    toast.success('Objetivo guardado para este contacto (demo)');
  }

  if (!editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Objetivo del autopilot</Label>
            <Badge variant={isCustom ? 'default' : 'outline'} className="px-1.5 py-0 text-[10px] font-normal">
              {isCustom ? 'Personalizado' : 'Predeterminado'}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={startEdit}>
            <Pencil className="mr-1 size-3.5" /> Editar
          </Button>
        </div>
        <p className="whitespace-pre-wrap rounded-md border bg-background/40 p-2 text-xs leading-snug text-muted-foreground">
          {objective}
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Aplica solo a este contacto. La IA responde según este objetivo y deriva a un humano si no está segura.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Objetivo del autopilot · este contacto</Label>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        className="resize-none text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={save}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
      {draft.trim() !== DEFAULT_AUTOPILOT_OBJECTIVE && (
        <Button
          size="sm"
          variant="link"
          className="h-auto px-0 text-[11px]"
          onClick={() => setDraft(DEFAULT_AUTOPILOT_OBJECTIVE)}
        >
          Restablecer al predeterminado
        </Button>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => onToggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Quitar ${label}`} className="rounded-sm hover:bg-background/40">
        <X className="size-3" />
      </button>
    </Badge>
  );
}

function ConversationRow({
  conv,
  active,
  onClick,
}: {
  conv: WaConversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-3 border-b px-3 py-2.5 text-left hover:bg-muted/50',
          active && 'bg-muted',
        )}
      >
        <Avatar className="mt-0.5 size-9 shrink-0"><AvatarFallback>{initials(conv.displayName)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{conv.displayName}</p>
            <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(conv.lastMessageAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{conv.lastMessagePreview}</p>
            {conv.unread > 0 && <Badge className="h-5 min-w-5 shrink-0 px-1.5">{conv.unread}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
              {WA_LEAD_STATE_LABELS[conv.leadState]}
            </Badge>
            {conv.aiMode !== 'off' && (
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
                <Bot className="size-3" />
                {WA_AI_MODE_LABELS[conv.aiMode]}
              </Badge>
            )}
            {conv.tags?.map((t) => (
              <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </button>
    </li>
  );
}
