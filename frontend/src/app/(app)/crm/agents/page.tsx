'use client';

/**
 * CRM Agentes — multi-agent management. Left: list of agents (create / select / set
 * default / delete). Right: config of the selected agent (instructions, tools, safe
 * autopilot intents, confidence threshold). Microsoft Agent Framework in the real product
 * (Fase 3/4). Local state mock; the inbox assigns one of these agents per conversation.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Bot, Wrench, ShieldCheck, Save, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CRM_AGENTS } from '@/lib/crm/agents';
import { cn } from '@/lib/utils';

interface Tool { id: string; name: string; desc: string; enabled: boolean; }

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  instructions: string;
  tools: Tool[];
  safeIntents: string[];
  threshold: number;
}

const ALL_TOOLS: Omit<Tool, 'enabled'>[] = [
  { id: 'getHorarios', name: 'getHorarios', desc: 'Consulta horarios disponibles' },
  { id: 'getPrecios', name: 'getPrecios', desc: 'Consulta precios y matrícula' },
  { id: 'getSaldo', name: 'getSaldo', desc: 'Consulta saldo/deuda del alumno' },
  { id: 'getLink', name: 'getLinkInscripcion', desc: 'Devuelve el link de inscripción' },
  { id: 'agendarVisita', name: 'agendarVisita', desc: 'Agenda una visita presencial' },
  { id: 'marcarLead', name: 'marcarLead', desc: 'Cambia el estado del lead' },
  { id: 'derivarHumano', name: 'derivarHumano', desc: 'Escala la conversación a un agente' },
];

const ALL_INTENTS = ['Horarios', 'Precios', 'Ubicación', 'Requisitos', 'Link de inscripción', 'Agendar visita', 'Pagos', 'Reclamos'];
const SAFE_DEFAULT = ['Horarios', 'Precios', 'Ubicación', 'Requisitos', 'Link de inscripción', 'Agendar visita'];

const DEFAULT_INSTRUCTIONS =
  'Eres el asistente de Espacio Pro, una academia de Drywall y Melamina. Responde solo sobre ' +
  'horarios, precios, ubicación, requisitos, programas e inscripción. Sé cordial y breve, en ' +
  'español. Si el interesado quiere conocer la academia, ofrece agendar una visita presencial. ' +
  'Nunca inventes precios ni prometas cupos; ante pagos, reclamos o dudas, deriva a un humano.';

const uid = () => 'ag-' + Math.random().toString(36).slice(2, 8);

function seedConfig(): AgentConfig[] {
  return CRM_AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    isDefault: a.isDefault,
    instructions: DEFAULT_INSTRUCTIONS,
    tools: ALL_TOOLS.map((t) => ({ ...t, enabled: t.id !== 'getSaldo' })),
    safeIntents: [...SAFE_DEFAULT],
    threshold: 70,
  }));
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>(seedConfig);
  const [selectedId, setSelectedId] = useState(agents[0]?.id);
  const selected = agents.find((a) => a.id === selectedId) ?? agents[0];

  function update(id: string, patch: Partial<AgentConfig>) {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function createAgent() {
    const a: AgentConfig = {
      id: uid(),
      name: 'Nuevo agente',
      description: '',
      isDefault: false,
      instructions: DEFAULT_INSTRUCTIONS,
      tools: ALL_TOOLS.map((t) => ({ ...t, enabled: t.id !== 'getSaldo' })),
      safeIntents: [...SAFE_DEFAULT],
      threshold: 70,
    };
    setAgents((prev) => [...prev, a]);
    setSelectedId(a.id);
    toast.success('Agente creado');
  }
  function deleteAgent(id: string) {
    setAgents((prev) => {
      const target = prev.find((a) => a.id === id);
      let next = prev.filter((a) => a.id !== id);
      if (target?.isDefault && next.length) next = next.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
      if (id === selectedId && next.length) setSelectedId(next[0].id);
      return next;
    });
    toast.success('Agente eliminado');
  }
  function makeDefault(id: string) {
    setAgents((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    toast.success('Agente por defecto actualizado');
  }
  function toggleTool(toolId: string) {
    if (!selected) return;
    update(selected.id, { tools: selected.tools.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t)) });
  }
  function toggleIntent(name: string) {
    if (!selected) return;
    const has = selected.safeIntents.includes(name);
    update(selected.id, { safeIntents: has ? selected.safeIntents.filter((x) => x !== name) : [...selected.safeIntents, name] });
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[280px_1fr]">
      {/* Agent list */}
      <aside className="flex min-h-0 flex-col overflow-hidden border-r">
        <div className="flex items-center justify-between border-b p-3">
          <h1 className="text-sm font-semibold">Agentes</h1>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={createAgent}>
            <Plus className="size-4" /> Nuevo
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {agents.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  'flex w-full items-center gap-2 border-b px-3 py-2.5 text-left hover:bg-muted/50',
                  a.id === selected?.id && 'bg-muted',
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                  <Bot className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{a.description || 'Sin descripción'}</p>
                </div>
                {a.isDefault && <Badge className="shrink-0 gap-1 px-1.5 py-0 text-[10px] font-normal"><Star className="size-3" />Default</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Selected agent config */}
      {selected ? (
        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b p-3">
            <Bot className="size-4 text-primary" />
            <Input
              value={selected.name}
              onChange={(e) => update(selected.id, { name: e.target.value })}
              className="h-9 max-w-xs border-transparent bg-transparent px-2 text-sm font-semibold hover:border-input focus-visible:border-input"
              aria-label="Nombre del agente"
            />
            <Badge variant="secondary" className="font-normal">Microsoft Agent Framework</Badge>
            <div className="ml-auto flex items-center gap-2">
              {!selected.isDefault && (
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => makeDefault(selected.id)}>
                  <Star className="size-3.5" /> Hacer default
                </Button>
              )}
              {agents.length > 1 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label="Eliminar agente">
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
                      <AlertDialogAction onClick={() => deleteAgent(selected.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button size="sm" className="h-8 gap-1" onClick={() => toast.success('Agente guardado (demo)')}>
                <Save className="size-4" /> Guardar
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-3xl space-y-6">
              <section className="space-y-1.5">
                <Label className="text-xs">Descripción</Label>
                <Input value={selected.description} onChange={(e) => update(selected.id, { description: e.target.value })} placeholder="Para qué sirve este agente" />
              </section>

              <section className="space-y-2">
                <Label className="text-sm font-semibold">Instrucciones / persona</Label>
                <Textarea
                  value={selected.instructions}
                  onChange={(e) => update(selected.id, { instructions: e.target.value })}
                  rows={5}
                  className="resize-none text-sm"
                />
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="size-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Herramientas (API de Espacio Pro)</Label>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selected.tools.map((t) => (
                    <label key={t.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs">{t.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{t.desc}</p>
                      </div>
                      <Switch checked={t.enabled} onCheckedChange={() => toggleTool(t.id)} />
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Intents seguros para autopilot</Label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_INTENTS.map((name) => {
                    const on = selected.safeIntents.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleIntent(name)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          on ? 'border-primary bg-primary text-neutral-900' : 'text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <Label className="text-sm font-semibold">Umbral de confianza para responder solo</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selected.threshold}
                    onChange={(e) => update(selected.id, { threshold: Number(e.target.value) })}
                    className="flex-1 accent-[var(--primary)]"
                    aria-label="Umbral de confianza"
                  />
                  <span className="w-12 text-right text-sm font-medium">{selected.threshold}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Si la confianza es menor a {selected.threshold}%, no envía y marca la conversación para un humano.
                </p>
              </section>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex items-center justify-center text-sm text-muted-foreground">Crea un agente.</section>
      )}
    </div>
  );
}
