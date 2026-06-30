'use client';

/**
 * CRM Flujos (Automations) — visual builder modeled on wacrm's automations system:
 *  - Dedicated trigger card (event that starts the flow) + its config.
 *  - Vertical step chain with per-type editors (message, template, tag, wait,
 *    condition, webhook, assign, schedule visit, …).
 *  - Condition steps branch into recursive "Sí / No" columns.
 *  - Full client-side CRUD: create (blank or from template), rename, delete,
 *    enable/pause; add / edit / reorder / delete steps end-to-end.
 * State is local (mock); the real engine + persistence arrive in Fase 4 (see docs/10).
 */

import { Fragment, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Clock, GitBranch, MessageSquare, FileText, Tag, Tags, UserCheck, CalendarClock,
  PencilLine, Webhook, CircleSlash, Plus, Power, Trash2, GripVertical, ArrowUp, ArrowDown,
  ChevronDown, MessageCircle, KeyRound, UserPlus, Bell, type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfigValue = string | number | string[] | undefined;
type Config = Record<string, ConfigValue>;

type TriggerKind =
  | 'first_message' | 'keyword' | 'new_contact' | 'tag_added' | 'assigned' | 'scheduled' | 'new_message';

type StepKind =
  | 'send_message' | 'send_template' | 'add_tag' | 'remove_tag' | 'assign'
  | 'schedule_visit' | 'update_field' | 'wait' | 'condition' | 'webhook' | 'close';

interface Trigger {
  kind: TriggerKind;
  config: Config;
}

interface Step {
  id: string;
  kind: StepKind;
  config: Config;
  branches?: { yes: Step[]; no: Step[] };
}

interface Flow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  runs: number;
  lastRunAt?: string | null;
  trigger: Trigger;
  steps: Step[];
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

const TRIGGER_META: Record<TriggerKind, { label: string; hint: string; icon: LucideIcon }> = {
  first_message: { label: 'Primer mensaje del contacto', hint: 'Se ejecuta cuando alguien escribe por primera vez.', icon: MessageCircle },
  keyword: { label: 'Coincide palabra clave', hint: 'Se ejecuta cuando el mensaje contiene una palabra clave.', icon: KeyRound },
  new_contact: { label: 'Nuevo contacto', hint: 'Se ejecuta al registrarse un contacto nuevo.', icon: UserPlus },
  tag_added: { label: 'Etiqueta agregada', hint: 'Se ejecuta cuando se agrega una etiqueta.', icon: Tag },
  assigned: { label: 'Conversación asignada', hint: 'Se ejecuta cuando la conversación se asigna a un agente.', icon: UserCheck },
  scheduled: { label: 'Programado', hint: 'Se ejecuta en un horario o intervalo definido.', icon: CalendarClock },
  new_message: { label: 'Mensaje nuevo', hint: 'Se ejecuta con cada mensaje entrante.', icon: Bell },
};

type StepCategory = 'messaging' | 'logic' | 'action';

const STEP_META: Record<StepKind, { label: string; icon: LucideIcon; accent: string; category: StepCategory }> = {
  send_message: { label: 'Enviar mensaje', icon: MessageSquare, accent: 'border-l-primary', category: 'messaging' },
  send_template: { label: 'Enviar plantilla', icon: FileText, accent: 'border-l-primary', category: 'messaging' },
  condition: { label: 'Condición (Sí / No)', icon: GitBranch, accent: 'border-l-amber-500', category: 'logic' },
  wait: { label: 'Esperar', icon: Clock, accent: 'border-l-border', category: 'logic' },
  add_tag: { label: 'Agregar etiqueta', icon: Tag, accent: 'border-l-primary', category: 'logic' },
  remove_tag: { label: 'Quitar etiqueta', icon: Tags, accent: 'border-l-primary', category: 'logic' },
  update_field: { label: 'Actualizar dato', icon: PencilLine, accent: 'border-l-primary', category: 'logic' },
  assign: { label: 'Asignar a agente', icon: UserCheck, accent: 'border-l-primary', category: 'action' },
  schedule_visit: { label: 'Agendar visita presencial', icon: CalendarClock, accent: 'border-l-primary', category: 'action' },
  webhook: { label: 'Llamar webhook', icon: Webhook, accent: 'border-l-primary', category: 'action' },
  close: { label: 'Cerrar conversación', icon: CircleSlash, accent: 'border-l-primary', category: 'action' },
};

const MENU_GROUPS: { id: StepCategory; label: string }[] = [
  { id: 'messaging', label: 'Mensajería' },
  { id: 'logic', label: 'Lógica y datos' },
  { id: 'action', label: 'Acciones' },
];

const TAG_OPTIONS = ['Interesado', 'Drywall', 'Melamina', 'Visita', 'VIP', 'Sin respuesta'];
const AGENT_OPTIONS = ['Asistente IA', 'Recepción', 'Ventas', 'Coordinación'];
const FIELD_OPTIONS = ['Nombre', 'Programa de interés', 'Teléfono', 'Fuente'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = () => Math.random().toString(36).slice(2, 9);
const s = (v: ConfigValue) => (typeof v === 'string' ? v : '');
const num = (v: ConfigValue, d = 1) => (typeof v === 'number' ? v : d);

function formatRelative(iso?: string | null): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function defaultStepConfig(kind: StepKind): Config {
  switch (kind) {
    case 'send_message': return { text: '' };
    case 'send_template': return { template: '', language: 'es' };
    case 'add_tag': case 'remove_tag': return { tag: TAG_OPTIONS[0] };
    case 'assign': return { mode: 'round_robin', agent: AGENT_OPTIONS[0] };
    case 'schedule_visit': return { note: 'Coordinar visita presencial' };
    case 'update_field': return { field: FIELD_OPTIONS[0], value: '' };
    case 'wait': return { amount: 10, unit: 'minutes' };
    case 'condition': return { subject: 'message_content', operand: 'contains', value: '' };
    case 'webhook': return { url: '', body: '{}' };
    case 'close': return {};
  }
}

function newStep(kind: StepKind): Step {
  const step: Step = { id: uid(), kind, config: defaultStepConfig(kind) };
  if (kind === 'condition') step.branches = { yes: [], no: [] };
  return step;
}

function newStepWith(kind: StepKind, config: Config): Step {
  return { ...newStep(kind), config: { ...defaultStepConfig(kind), ...config } };
}

function stepPreview(step: Step): string {
  const c = step.config;
  switch (step.kind) {
    case 'send_message': return s(c.text) || 'Sin mensaje';
    case 'send_template': return s(c.template) || 'Sin plantilla';
    case 'add_tag': case 'remove_tag': return s(c.tag);
    case 'assign': return s(c.mode) === 'specific' ? s(c.agent) : 'Round-robin';
    case 'schedule_visit': return s(c.note);
    case 'update_field': return `${s(c.field)} = ${s(c.value) || '…'}`;
    case 'wait': return `${num(c.amount)} ${unitLabel(s(c.unit))}`;
    case 'condition': return `${subjectLabel(s(c.subject))} ${operandLabel(s(c.operand))} ${s(c.value)}`.trim();
    case 'webhook': return s(c.url) || 'Sin URL';
    case 'close': return 'Marca la conversación como cerrada';
  }
}

const unitLabel = (u: string) => ({ minutes: 'minutos', hours: 'horas', days: 'días' }[u] ?? u);
const subjectLabel = (v: string) =>
  ({ message_content: 'El mensaje', tag_presence: 'La etiqueta', contact_field: 'El dato', time_of_day: 'La hora' }[v] ?? v);
const operandLabel = (v: string) =>
  ({ contains: 'contiene', equals: 'es igual a', not_equals: 'no es', present: 'existe', absent: 'no existe' }[v] ?? v);

// ---------------------------------------------------------------------------
// Seed flows
// ---------------------------------------------------------------------------

const INITIAL_FLOWS: Flow[] = [
  {
    id: 'f1',
    name: 'Bienvenida + clasificación',
    description: 'Saluda, espera y clasifica al lead según el programa que menciona.',
    enabled: true,
    runs: 128,
    lastRunAt: new Date(Date.now() - 22 * 60000).toISOString(),
    trigger: { kind: 'first_message', config: {} },
    steps: [
      { id: uid(), kind: 'send_message', config: { text: '¡Hola! 👋 Gracias por escribir a Espacio Pro. ¿Te interesa Drywall o Melamina?' } },
      { id: uid(), kind: 'wait', config: { amount: 10, unit: 'minutes' } },
      {
        id: uid(), kind: 'condition',
        config: { subject: 'message_content', operand: 'contains', value: 'drywall, melamina' },
        branches: {
          yes: [
            { id: uid(), kind: 'add_tag', config: { tag: 'Interesado' } },
            { id: uid(), kind: 'send_message', config: { text: '¡Genial! Te cuento sobre el programa y los próximos horarios. 📚' } },
          ],
          no: [
            { id: uid(), kind: 'send_message', config: { text: 'Cuéntame, ¿en qué te puedo ayudar?' } },
          ],
        },
      },
    ],
  },
  {
    id: 'f2',
    name: 'Agendar visita presencial',
    description: 'Aprox. 10% de los leads pide conocer el taller antes de inscribirse.',
    enabled: true,
    runs: 41,
    lastRunAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    trigger: { kind: 'keyword', config: { keywords: ['visita', 'conocer', 'taller'], match_type: 'contains' } },
    steps: [
      { id: uid(), kind: 'send_message', config: { text: '¡Claro! Puedes visitarnos de L-V 9am-6pm. ¿Qué día y hora te acomoda?' } },
      { id: uid(), kind: 'schedule_visit', config: { note: 'Coordinar visita presencial (drywall / melamina)' } },
      { id: uid(), kind: 'assign', config: { mode: 'specific', agent: 'Recepción' } },
    ],
  },
  {
    id: 'f3',
    name: 'Reactivar “Sin respuesta”',
    description: 'Reengancha a leads que no contestan hace 2 días.',
    enabled: false,
    runs: 0,
    lastRunAt: null,
    trigger: { kind: 'scheduled', config: { schedule: 'cada 48h' } },
    steps: [
      { id: uid(), kind: 'send_template', config: { template: 'seguimiento_48h', language: 'es' } },
      { id: uid(), kind: 'wait', config: { amount: 1, unit: 'days' } },
      { id: uid(), kind: 'close', config: {} },
    ],
  },
];

type TemplateId = 'blank' | 'welcome' | 'visit' | 'reactivate';

function flowFromTemplate(t: TemplateId): Flow {
  const base = { id: uid(), enabled: false, runs: 0, lastRunAt: null };
  switch (t) {
    case 'welcome':
      return {
        ...base, name: 'Bienvenida', description: 'Saludo automático al primer mensaje.',
        trigger: { kind: 'first_message', config: {} },
        steps: [newStepWith('send_message', { text: '¡Hola! 👋 Gracias por escribir a Espacio Pro.' })],
      };
    case 'visit':
      return {
        ...base, name: 'Agendar visita', description: 'Coordina una visita presencial.',
        trigger: { kind: 'keyword', config: { keywords: ['visita', 'conocer'], match_type: 'contains' } },
        steps: [newStepWith('send_message', { text: 'Puedes visitarnos de L-V 9am-6pm. ¿Qué día te acomoda?' }), newStep('schedule_visit')],
      };
    case 'reactivate':
      return {
        ...base, name: 'Reactivar lead', description: 'Seguimiento a leads inactivos.',
        trigger: { kind: 'scheduled', config: { schedule: 'cada 48h' } },
        steps: [newStep('send_template')],
      };
    default:
      return {
        ...base, name: 'Nuevo flujo', description: '',
        trigger: { kind: 'first_message', config: {} },
        steps: [newStep('send_message')],
      };
  }
}

const TEMPLATES: { id: TemplateId; label: string; icon: LucideIcon }[] = [
  { id: 'blank', label: 'Flujo en blanco', icon: Plus },
  { id: 'welcome', label: 'Bienvenida', icon: MessageCircle },
  { id: 'visit', label: 'Agendar visita', icon: CalendarClock },
  { id: 'reactivate', label: 'Reactivar lead', icon: Bell },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>(INITIAL_FLOWS);
  const [selectedId, setSelectedId] = useState('f1');
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const selected = flows.find((f) => f.id === selectedId) ?? flows[0];

  function updateFlow(id: string, patch: Partial<Flow>) {
    setFlows((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function createFlow(t: TemplateId) {
    const f = flowFromTemplate(t);
    setFlows((prev) => [f, ...prev]);
    setSelectedId(f.id);
    toast.success(t === 'blank' ? 'Flujo creado' : 'Flujo creado desde plantilla');
  }

  function deleteFlow(id: string) {
    setFlows((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (id === selectedId && next.length) setSelectedId(next[0].id);
      return next;
    });
    toast.success('Flujo eliminado');
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
      {/* Flow list */}
      <aside className="flex min-h-0 flex-col overflow-hidden border-r">
        <div className="flex items-center justify-between border-b p-3">
          <h1 className="text-sm font-semibold">Flujos</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1">
                <Plus className="size-4" /> Nuevo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Crear flujo
              </DropdownMenuLabel>
              {TEMPLATES.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => createFlow(t.id)}>
                  <t.icon className="size-4 text-muted-foreground" /> {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {flows.map((f) => {
            const TriggerIcon = TRIGGER_META[f.trigger.kind].icon;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => { setSelectedId(f.id); setExpandedStep(null); }}
                  className={cn(
                    'group flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left hover:bg-muted/50',
                    f.id === selected?.id && 'bg-muted',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                    {f.enabled ? (
                      <span className="relative flex size-2" aria-label="Activo">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                    ) : (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">Pausado</Badge>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <TriggerIcon className="size-3" />
                    <span className="truncate">{TRIGGER_META[f.trigger.kind].label}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {f.steps.length} pasos · {f.runs} ejec. · {formatRelative(f.lastRunAt)}
                  </span>
                </button>
              </li>
            );
          })}
          {flows.length === 0 && <li className="p-4 text-sm text-muted-foreground">No hay flujos. Crea uno.</li>}
        </ul>
      </aside>

      {/* Selected flow canvas */}
      {selected ? (
        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b p-3">
            <Input
              value={selected.name}
              onChange={(e) => updateFlow(selected.id, { name: e.target.value })}
              className="h-9 max-w-xs border-transparent bg-transparent px-2 text-sm font-semibold hover:border-input focus-visible:border-input"
              aria-label="Nombre del flujo"
            />
            <Badge
              variant="outline"
              className={cn(
                'gap-1 text-[10px]',
                selected.enabled
                  ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-500'
                  : 'border-border bg-muted text-muted-foreground',
              )}
            >
              {selected.enabled ? 'Activo' : 'Borrador'}
            </Badge>
            <span className="text-xs text-muted-foreground">{selected.runs} ejecuciones</span>
            <div className="ml-auto flex items-center gap-2">
              <Power className="size-4 text-muted-foreground" />
              <Switch checked={selected.enabled} onCheckedChange={(v) => updateFlow(selected.id, { enabled: v })} aria-label="Activar flujo" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label="Eliminar flujo">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar “{selected.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteFlow(selected.id)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle,theme(colors.border)_1px,transparent_1px)] [background-size:16px_16px] p-6">
            <div className="mx-auto max-w-lg">
              <TriggerCard
                key={selected.id}
                trigger={selected.trigger}
                onChange={(trigger) => updateFlow(selected.id, { trigger })}
              />
              <div className="mx-auto h-5 w-px bg-border" />
              <StepList
                steps={selected.steps}
                onChange={(steps) => updateFlow(selected.id, { steps })}
                expandedId={expandedStep}
                setExpandedId={setExpandedStep}
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="flex items-center justify-center text-sm text-muted-foreground">
          Selecciona o crea un flujo.
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trigger card
// ---------------------------------------------------------------------------

function TriggerCard({ trigger, onChange }: { trigger: Trigger; onChange: (t: Trigger) => void }) {
  const meta = TRIGGER_META[trigger.kind];
  const Icon = meta.icon;

  function setKind(kind: TriggerKind) {
    onChange({ kind, config: kind === 'keyword' ? { keywords: [], match_type: 'contains' } : {} });
  }

  return (
    <div className="rounded-xl border border-l-4 border-l-sky-500 bg-background p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-sky-500">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Disparador</p>
          <p className="truncate text-sm font-medium">{meta.label}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2 border-t pt-3">
        <Select value={trigger.kind} onValueChange={(v) => setKind(v as TriggerKind)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(TRIGGER_META) as TriggerKind[]).map((k) => (
              <SelectItem key={k} value={k}>{TRIGGER_META[k].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{meta.hint}</p>
        {trigger.kind === 'keyword' && (
          <KeywordsInput
            keywords={Array.isArray(trigger.config.keywords) ? trigger.config.keywords : []}
            matchType={s(trigger.config.match_type) || 'contains'}
            onChange={(keywords, match_type) => onChange({ ...trigger, config: { keywords, match_type } })}
          />
        )}
        {trigger.kind === 'scheduled' && (
          <Input
            value={s(trigger.config.schedule)}
            onChange={(e) => onChange({ ...trigger, config: { schedule: e.target.value } })}
            placeholder="Ej: cada 48h · 09:00"
            className="h-9"
          />
        )}
        {trigger.kind === 'tag_added' && (
          <TagSelect value={s(trigger.config.tag)} onChange={(tag) => onChange({ ...trigger, config: { tag } })} />
        )}
      </div>
    </div>
  );
}

function KeywordsInput({
  keywords, matchType, onChange,
}: { keywords: string[]; matchType: string; onChange: (k: string[], m: string) => void }) {
  const [draft, setDraft] = useState(keywords.join(', '));
  const commit = () => onChange(draft.split(',').map((k) => k.trim()).filter(Boolean), matchType);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Palabras clave</Label>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          placeholder="drywall, melamina, visita"
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Coincidencia</Label>
        <Select value={matchType} onValueChange={(m) => onChange(keywords, m)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contiene</SelectItem>
            <SelectItem value="exact">Exacta</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step list (recursive) + step card
// ---------------------------------------------------------------------------

interface StepListProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  branch?: boolean;
}

function StepList({ steps, onChange, expandedId, setExpandedId, branch }: StepListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function patchStep(id: string, next: Step) {
    onChange(steps.map((st) => (st.id === id ? next : st)));
  }
  function removeStep(id: string) {
    onChange(steps.filter((st) => st.id !== id));
    if (expandedId === id) setExpandedId(null);
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = steps.findIndex((st) => st.id === fromId);
    const to = steps.findIndex((st) => st.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...steps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }
  function add(kind: StepKind) {
    const step = newStep(kind);
    onChange([...steps, step]);
    setExpandedId(step.id);
  }

  return (
    <div className="flex flex-col">
      {steps.map((step, i) => (
        <Fragment key={step.id}>
          <StepCard
            step={step}
            index={i}
            total={steps.length}
            expanded={expandedId === step.id}
            dragging={draggingId === step.id}
            over={overId === step.id && draggingId !== null && draggingId !== step.id}
            onToggle={() => setExpandedId(expandedId === step.id ? null : step.id)}
            onChange={(next) => patchStep(step.id, next)}
            onDelete={() => removeStep(step.id)}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, 1)}
            onDragStart={() => setDraggingId(step.id)}
            onDragEnter={() => { if (draggingId && draggingId !== step.id) setOverId(step.id); }}
            onDrop={(fromId) => { if (fromId) reorder(fromId, step.id); setDraggingId(null); setOverId(null); }}
            onDragEnd={() => { setDraggingId(null); setOverId(null); }}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
          />
          {step.kind !== 'condition' && i < steps.length - 1 && <div className="mx-auto h-5 w-px bg-border" />}
        </Fragment>
      ))}
      <div className={cn(steps.length > 0 && 'pt-4')}>
        <AddStepMenu onAdd={add} small={branch} />
      </div>
    </div>
  );
}

interface StepCardProps {
  step: Step;
  index: number;
  total: number;
  expanded: boolean;
  dragging: boolean;
  over: boolean;
  onToggle: () => void;
  onChange: (next: Step) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: (fromId: string) => void;
  onDragEnd: () => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}

function StepCard({
  step, index, total, expanded, dragging, over, onToggle, onChange, onDelete, onMoveUp, onMoveDown,
  onDragStart, onDragEnter, onDrop, onDragEnd, expandedId, setExpandedId,
}: StepCardProps) {
  const meta = STEP_META[step.kind];
  const Icon = meta.icon;
  const isCondition = step.kind === 'condition';
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div
        ref={cardRef}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDragEnter={onDragEnter}
        onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain')); }}
        className={cn(
          'rounded-xl border border-l-4 bg-background shadow-sm transition',
          meta.accent,
          dragging && 'opacity-40',
          over && 'ring-2 ring-primary',
        )}
      >
        <div className="flex w-full items-center gap-2 px-3 py-2.5">
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', step.id);
              if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 16, 16);
              onDragStart();
            }}
            onDragEnd={onDragEnd}
            className="shrink-0 cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            aria-label="Arrastrar para reordenar"
            role="button"
            tabIndex={-1}
          >
            <GripVertical className="size-4" />
          </span>
          <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
              <p className="truncate text-sm font-medium">{stepPreview(step)}</p>
            </div>
            <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
        {expanded && (
          <div className="border-t px-3 py-3">
            <StepEditor step={step} onChange={onChange} />
            <div className="mt-3 flex items-center justify-between border-t pt-2.5">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-7" onClick={onMoveUp} disabled={index === 0} aria-label="Subir paso">
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={onMoveDown} disabled={index === total - 1} aria-label="Bajar paso">
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-destructive" onClick={onDelete}>
                <Trash2 className="size-3.5" /> Eliminar
              </Button>
            </div>
          </div>
        )}
      </div>

      {isCondition && step.branches && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <BranchColumn label="Sí" color="text-emerald-500">
            <StepList
              steps={step.branches.yes}
              onChange={(yes) => onChange({ ...step, branches: { yes, no: step.branches!.no } })}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              branch
            />
          </BranchColumn>
          <BranchColumn label="No" color="text-rose-400">
            <StepList
              steps={step.branches.no}
              onChange={(no) => onChange({ ...step, branches: { yes: step.branches!.yes, no } })}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              branch
            />
          </BranchColumn>
        </div>
      )}
    </div>
  );
}

function BranchColumn({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-2">
      <div className={cn('mb-2 text-[11px] font-semibold uppercase tracking-wide', color)}>{label}</div>
      {children}
    </div>
  );
}

function AddStepMenu({ onAdd, small }: { onAdd: (kind: StepKind) => void; small?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn('w-full border-dashed', small && 'h-8 text-xs')}>
          <Plus className={cn('mr-1.5', small ? 'size-3.5' : 'size-4')} /> Agregar paso
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-80 w-56 overflow-y-auto">
        {MENU_GROUPS.map((group, gi) => (
          <Fragment key={group.id}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            {(Object.keys(STEP_META) as StepKind[])
              .filter((k) => STEP_META[k].category === group.id)
              .map((k) => {
                const Icon = STEP_META[k].icon;
                return (
                  <DropdownMenuItem key={k} onClick={() => onAdd(k)}>
                    <Icon className="size-4 text-muted-foreground" /> {STEP_META[k].label}
                  </DropdownMenuItem>
                );
              })}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Per-type step editor
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TagSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || TAG_OPTIONS[0]} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        {TAG_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function StepEditor({ step, onChange }: { step: Step; onChange: (next: Step) => void }) {
  const c = step.config;
  const set = (patch: Config) => onChange({ ...step, config: { ...c, ...patch } });

  switch (step.kind) {
    case 'send_message':
      return (
        <Field label="Mensaje">
          <Textarea
            value={s(c.text)}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="¡Hola! Gracias por escribir…"
            rows={3}
            className="resize-none text-sm"
          />
        </Field>
      );
    case 'send_template':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Plantilla"><Input value={s(c.template)} onChange={(e) => set({ template: e.target.value })} placeholder="seguimiento_48h" className="h-9" /></Field>
          <Field label="Idioma"><Input value={s(c.language)} onChange={(e) => set({ language: e.target.value })} placeholder="es" className="h-9" /></Field>
        </div>
      );
    case 'add_tag':
    case 'remove_tag':
      return <Field label="Etiqueta"><TagSelect value={s(c.tag)} onChange={(tag) => set({ tag })} /></Field>;
    case 'assign':
      return (
        <div className="space-y-2">
          <Field label="Modo">
            <Select value={s(c.mode) || 'round_robin'} onValueChange={(mode) => set({ mode })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round-robin</SelectItem>
                <SelectItem value="specific">Agente específico</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {s(c.mode) === 'specific' && (
            <Field label="Agente">
              <Select value={s(c.agent) || AGENT_OPTIONS[0]} onValueChange={(agent) => set({ agent })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGENT_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
      );
    case 'schedule_visit':
      return (
        <Field label="Nota para la visita">
          <Input value={s(c.note)} onChange={(e) => set({ note: e.target.value })} placeholder="Coordinar visita presencial" className="h-9" />
        </Field>
      );
    case 'update_field':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Dato">
            <Select value={s(c.field) || FIELD_OPTIONS[0]} onValueChange={(field) => set({ field })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valor"><Input value={s(c.value)} onChange={(e) => set({ value: e.target.value })} placeholder="Texto o {{variable}}" className="h-9" /></Field>
        </div>
      );
    case 'wait':
      return (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cantidad">
            <Input type="number" min={1} value={num(c.amount)} onChange={(e) => set({ amount: Math.max(1, Number(e.target.value) || 1) })} className="h-9" />
          </Field>
          <Field label="Unidad">
            <Select value={s(c.unit) || 'minutes'} onValueChange={(unit) => set({ unit })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Días</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      );
    case 'condition':
      return (
        <div className="space-y-2">
          <Field label="Evaluar">
            <Select value={s(c.subject) || 'message_content'} onValueChange={(subject) => set({ subject })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="message_content">Contenido del mensaje</SelectItem>
                <SelectItem value="tag_presence">Presencia de etiqueta</SelectItem>
                <SelectItem value="contact_field">Dato del contacto</SelectItem>
                <SelectItem value="time_of_day">Hora del día</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Operador">
              <Select value={s(c.operand) || 'contains'} onValueChange={(operand) => set({ operand })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contiene</SelectItem>
                  <SelectItem value="equals">Es igual a</SelectItem>
                  <SelectItem value="not_equals">No es</SelectItem>
                  <SelectItem value="present">Existe</SelectItem>
                  <SelectItem value="absent">No existe</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {s(c.operand) !== 'present' && s(c.operand) !== 'absent' && (
              <Field label="Valor"><Input value={s(c.value)} onChange={(e) => set({ value: e.target.value })} placeholder="drywall, melamina" className="h-9" /></Field>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Define los pasos para “Sí” y “No” en las columnas de abajo.</p>
        </div>
      );
    case 'webhook':
      return (
        <div className="space-y-2">
          <Field label="URL"><Input value={s(c.url)} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className="h-9 font-mono text-xs" /></Field>
          <Field label="Cuerpo (JSON)"><Textarea value={s(c.body)} onChange={(e) => set({ body: e.target.value })} rows={2} className="resize-none font-mono text-xs" /></Field>
        </div>
      );
    case 'close':
      return <p className="text-xs text-muted-foreground">Marca la conversación como cerrada. No requiere configuración.</p>;
  }
}
