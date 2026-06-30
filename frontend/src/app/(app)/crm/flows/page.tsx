'use client';

/**
 * CRM Flujos (Automations) — visual builder with full client-side CRUD:
 *  - Create / rename / delete flows, toggle enabled.
 *  - Add / edit / delete steps (trigger → action → wait → condition).
 * State is local (mock); the real engine + persistence arrive in Fase 4 (see docs/10).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Zap, Clock, GitBranch, Send, Plus, Power, Pencil, Trash2, GripVertical, type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type StepKind = 'trigger' | 'action' | 'wait' | 'condition';

interface Step {
  id: string;
  kind: StepKind;
  title: string;
  detail: string;
}

interface Flow {
  id: string;
  name: string;
  enabled: boolean;
  runs: number;
  steps: Step[];
}

const STEP_META: Record<StepKind, { label: string; icon: LucideIcon; className: string }> = {
  trigger: { label: 'Disparador', icon: Zap, className: 'text-amber-500' },
  action: { label: 'Acción', icon: Send, className: 'text-primary' },
  wait: { label: 'Espera', icon: Clock, className: 'text-sky-500' },
  condition: { label: 'Condición', icon: GitBranch, className: 'text-violet-500' },
};

const uid = () => Math.random().toString(36).slice(2, 9);

const INITIAL_FLOWS: Flow[] = [
  {
    id: 'f1', name: 'Bienvenida + clasificación', enabled: true, runs: 128,
    steps: [
      { id: uid(), kind: 'trigger', title: 'Primer mensaje del contacto', detail: 'Cuando un contacto escribe por primera vez' },
      { id: uid(), kind: 'action', title: 'Enviar saludo', detail: '“¡Hola! 👋 Gracias por escribir a Espacio Pro.”' },
      { id: uid(), kind: 'wait', title: 'Esperar 10 minutos', detail: 'Da tiempo a que el cliente responda' },
      { id: uid(), kind: 'condition', title: 'Si menciona “drywall” o “melamina”', detail: '→ Etiquetar con el programa y marcar Interesado' },
    ],
  },
  {
    id: 'f2', name: 'Agendar visita presencial', enabled: true, runs: 41,
    steps: [
      { id: uid(), kind: 'trigger', title: 'Palabra clave: “visita” / “conocer”', detail: 'El cliente quiere conocer la academia' },
      { id: uid(), kind: 'action', title: 'Enviar horarios de visita', detail: 'L-V 9am-6pm + pedir día y hora' },
      { id: uid(), kind: 'action', title: 'Marcar lead como “Visita presencial”', detail: 'Mueve la tarjeta en el pipeline' },
      { id: uid(), kind: 'condition', title: 'Si no confirma en 24h', detail: '→ Recordatorio y derivar a un agente' },
    ],
  },
  {
    id: 'f3', name: 'Reactivar “Sin respuesta”', enabled: false, runs: 0,
    steps: [
      { id: uid(), kind: 'trigger', title: 'Lead sin respuesta 48h', detail: 'No contesta hace 2 días' },
      { id: uid(), kind: 'action', title: 'Enviar plantilla de seguimiento', detail: 'Utility template aprobado por Meta' },
    ],
  },
];

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>(INITIAL_FLOWS);
  const [selectedId, setSelectedId] = useState('f1');
  const selected = flows.find((f) => f.id === selectedId) ?? flows[0];

  // Step editor dialog state
  const [stepDialog, setStepDialog] = useState<{ open: boolean; editing?: Step }>({ open: false });
  const [draftStep, setDraftStep] = useState<Step>({ id: '', kind: 'action', title: '', detail: '' });

  function updateFlow(id: string, patch: Partial<Flow>) {
    setFlows((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function createFlow() {
    const f: Flow = {
      id: uid(),
      name: 'Nuevo flujo',
      enabled: false,
      runs: 0,
      steps: [{ id: uid(), kind: 'trigger', title: 'Primer mensaje del contacto', detail: '' }],
    };
    setFlows((prev) => [f, ...prev]);
    setSelectedId(f.id);
    toast.success('Flujo creado');
  }

  function deleteFlow(id: string) {
    setFlows((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (id === selectedId && next.length) setSelectedId(next[0].id);
      return next;
    });
    toast.success('Flujo eliminado');
  }

  function openAddStep() {
    setDraftStep({ id: uid(), kind: 'action', title: '', detail: '' });
    setStepDialog({ open: true });
  }
  function openEditStep(step: Step) {
    setDraftStep({ ...step });
    setStepDialog({ open: true, editing: step });
  }
  function saveStep() {
    if (!draftStep.title.trim()) {
      toast.error('El paso necesita un título');
      return;
    }
    if (!selected) return;
    const exists = selected.steps.some((s) => s.id === draftStep.id);
    const steps = exists
      ? selected.steps.map((s) => (s.id === draftStep.id ? draftStep : s))
      : [...selected.steps, draftStep];
    updateFlow(selected.id, { steps });
    setStepDialog({ open: false });
    toast.success(exists ? 'Paso actualizado' : 'Paso agregado');
  }
  function deleteStep(stepId: string) {
    if (!selected) return;
    updateFlow(selected.id, { steps: selected.steps.filter((s) => s.id !== stepId) });
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
      {/* Flow list */}
      <aside className="flex min-h-0 flex-col overflow-hidden border-r">
        <div className="flex items-center justify-between border-b p-3">
          <h1 className="text-sm font-semibold">Flujos</h1>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={createFlow}>
            <Plus className="size-4" /> Nuevo
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {flows.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={cn(
                  'group flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left hover:bg-muted/50',
                  f.id === selected?.id && 'bg-muted',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                  <Badge variant={f.enabled ? 'default' : 'secondary'} className="px-1.5 py-0 text-[10px] font-normal">
                    {f.enabled ? 'Activo' : 'Pausado'}
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground">{f.steps.length} pasos · {f.runs} ejecuciones</span>
              </button>
            </li>
          ))}
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
            <div className="mx-auto max-w-md space-y-0">
              {selected.steps.map((step, i) => {
                const meta = STEP_META[step.kind];
                const Icon = meta.icon;
                return (
                  <div key={step.id}>
                    <div className="group rounded-xl border bg-background p-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <GripVertical className="size-4 shrink-0 text-muted-foreground/40" />
                        <div className={cn('flex size-8 items-center justify-center rounded-lg bg-muted', meta.className)}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
                          <p className="truncate text-sm font-medium">{step.title}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="size-7 opacity-0 transition group-hover:opacity-100" aria-label="Editar paso" onClick={() => openEditStep(step)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100" aria-label="Eliminar paso" onClick={() => deleteStep(step.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      {step.detail && <p className="mt-1.5 pl-14 text-xs text-muted-foreground">{step.detail}</p>}
                    </div>
                    {i < selected.steps.length - 1 && <div className="mx-auto h-5 w-px bg-border" />}
                  </div>
                );
              })}
              <div className="pt-5">
                <Button variant="outline" className="w-full border-dashed" onClick={openAddStep}>
                  <Plus className="mr-2 size-4" /> Agregar paso
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex items-center justify-center text-sm text-muted-foreground">
          Selecciona o crea un flujo.
        </section>
      )}

      {/* Step editor dialog */}
      <Dialog open={stepDialog.open} onOpenChange={(open) => setStepDialog((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stepDialog.editing ? 'Editar paso' : 'Agregar paso'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={draftStep.kind} onValueChange={(v) => setDraftStep((d) => ({ ...d, kind: v as StepKind }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STEP_META) as StepKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{STEP_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={draftStep.title} onChange={(e) => setDraftStep((d) => ({ ...d, title: e.target.value }))} placeholder="Ej: Enviar saludo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Detalle (opcional)</Label>
              <Input value={draftStep.detail} onChange={(e) => setDraftStep((d) => ({ ...d, detail: e.target.value }))} placeholder="Descripción del paso" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button onClick={saveStep}>{stepDialog.editing ? 'Guardar' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
