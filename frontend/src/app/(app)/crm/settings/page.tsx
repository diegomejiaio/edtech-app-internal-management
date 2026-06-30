'use client';

/**
 * CRM Ajustes — WhatsApp channel + inbox policy settings. Connection (Cloud API),
 * business hours, opt-in/opt-out and 24h-window policy, and team/assignment. Secrets are
 * never shown in clear (verify token masked); real values live in app settings / Key Vault
 * with Managed Identity (see docs/10). Static mock with local state + stub save.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Plug, Clock, ShieldCheck, Users, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TEAM = [
  { name: 'Diego Mejía', email: 'diego@espaciopro.pe', role: 'Admin' },
  { name: 'Recepción', email: 'recepcion@espaciopro.pe', role: 'Agente' },
];

export default function CrmSettingsPage() {
  const [phoneNumberId, setPhoneNumberId] = useState('109876543210987');
  const [wabaId, setWabaId] = useState('203040506070809');
  const [displayName, setDisplayName] = useState('Espacio Pro');
  const [hoursStart, setHoursStart] = useState('09:00');
  const [hoursEnd, setHoursEnd] = useState('18:00');
  const [activeDays, setActiveDays] = useState<string[]>(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']);
  const [requireOptIn, setRequireOptIn] = useState(true);
  const [respectOptOut, setRespectOptOut] = useState(true);
  const [outsideWindowTemplates, setOutsideWindowTemplates] = useState(true);

  function toggleDay(d: string) {
    setActiveDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <h1 className="text-sm font-semibold">Ajustes</h1>
        <Button size="sm" className="h-8 gap-1" onClick={() => toast.success('Ajustes guardados (demo)')}>
          <Save className="size-4" /> Guardar
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Connection */}
          <section className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Plug className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Conexión WhatsApp Cloud API</h2>
              <Badge variant="secondary" className="font-normal">No conectado</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone Number ID</Label>
                <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WABA ID</Label>
                <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Verify token</Label>
                <Input value="••••••••••••" readOnly className="font-mono" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Los secretos (token WABA, verify token) se guardan en app settings / Key Vault con Managed Identity, nunca en el repo.
            </p>
          </section>

          {/* Business hours */}
          <section className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Horario de atención</h2>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Desde</Label>
                <Input type="time" value={hoursStart} onChange={(e) => setHoursStart(e.target.value)} className="w-32" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hasta</Label>
                <Input type="time" value={hoursEnd} onChange={(e) => setHoursEnd(e.target.value)} className="w-32" />
              </div>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={
                      'rounded-md border px-2.5 py-1.5 text-xs transition-colors ' +
                      (activeDays.includes(d)
                        ? 'border-primary bg-primary text-neutral-900'
                        : 'text-muted-foreground hover:bg-muted')
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Policy */}
          <section className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Cumplimiento (Meta)</h2>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Requerir opt-in antes de enviar mensajes</span>
                <Switch checked={requireOptIn} onCheckedChange={setRequireOptIn} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Respetar opt-out / bloqueos</span>
                <Switch checked={respectOptOut} onCheckedChange={setRespectOptOut} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Fuera de la ventana de 24h, solo plantillas aprobadas</span>
                <Switch checked={outsideWindowTemplates} onCheckedChange={setOutsideWindowTemplates} />
              </label>
            </div>
          </section>

          {/* Team */}
          <section className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Equipo y asignación</h2>
            </div>
            <ul className="divide-y">
              {TEAM.map((m) => (
                <li key={m.email} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Badge variant={m.role === 'Admin' ? 'default' : 'secondary'} className="font-normal">{m.role}</Badge>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="mt-2" disabled>Invitar miembro</Button>
          </section>
        </div>
      </div>
    </div>
  );
}
