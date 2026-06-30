'use client';

/**
 * CRM Reutilizables (Library) — reusable content with full client-side CRUD: create,
 * edit and delete assets (text / image / voice / video / link / rich / template). Image
 * and video assets show a small icon (no oversized preview). State is local (mock); real
 * upload goes to Azure Blob in Fase 1 (see docs/10).
 */

import { useMemo, useState } from 'react';
import {
  Type, Image as ImageIcon, Mic, Video, Link2, LayoutTemplate, Files,
  Plus, Copy, Pencil, Trash2, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/filter-bar';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type AssetKind = 'text' | 'image' | 'voice' | 'video' | 'link' | 'rich' | 'template';

interface Asset {
  id: string;
  kind: AssetKind;
  title: string;
  preview: string;
  tags: string[];
  meta?: string;
}

const KIND_META: Record<AssetKind, { label: string; icon: LucideIcon }> = {
  text: { label: 'Texto', icon: Type },
  image: { label: 'Imagen', icon: ImageIcon },
  voice: { label: 'Audio', icon: Mic },
  video: { label: 'Video', icon: Video },
  link: { label: 'Link', icon: Link2 },
  rich: { label: 'Mensaje rico', icon: Files },
  template: { label: 'Plantilla Meta', icon: LayoutTemplate },
};

const FILTERS: { value: AssetKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'text', label: 'Textos' },
  { value: 'image', label: 'Imágenes' },
  { value: 'voice', label: 'Audios' },
  { value: 'video', label: 'Videos' },
  { value: 'link', label: 'Links' },
  { value: 'rich', label: 'Mensajes ricos' },
  { value: 'template', label: 'Plantillas' },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const INITIAL_ASSETS: Asset[] = [
  { id: uid(), kind: 'text', title: 'Horarios', preview: 'Tenemos horarios de mañana (8-10am) y tarde (6-8pm). ¿Cuál te conviene?', tags: ['FAQ'] },
  { id: uid(), kind: 'text', title: 'Precios', preview: 'El curso cuesta S/350 al mes más S/100 de matrícula.', tags: ['FAQ'] },
  { id: uid(), kind: 'text', title: 'Visita presencial', preview: 'Puedes visitarnos de lunes a viernes de 9am a 6pm. ¿Qué día te queda bien?', tags: ['Visita'] },
  { id: uid(), kind: 'link', title: 'Link de inscripción', preview: 'espaciopro.pe/inscripcion', tags: ['Conversión'] },
  { id: uid(), kind: 'image', title: 'Aula Drywall', preview: 'aula-drywall.jpg', meta: 'JPG · 240 KB', tags: ['Drywall'] },
  { id: uid(), kind: 'image', title: 'Aula Melamina', preview: 'aula-melamina.jpg', meta: 'JPG · 198 KB', tags: ['Melamina'] },
  { id: uid(), kind: 'voice', title: 'Audio bienvenida', preview: 'bienvenida.ogg', meta: '0:18', tags: ['Saludo'] },
  { id: uid(), kind: 'video', title: 'Tour de la academia', preview: 'tour.mp4', meta: '1:12', tags: [] },
  { id: uid(), kind: 'rich', title: 'Brochure Drywall', preview: 'Texto + 2 imágenes + link de inscripción', tags: ['Drywall', 'Conversión'] },
  { id: uid(), kind: 'template', title: 'recordatorio_visita', preview: 'Hola {{1}}, te recordamos tu visita el {{2}}.', meta: 'Utility · Aprobada', tags: ['Visita'] },
  { id: uid(), kind: 'template', title: 'promo_matricula', preview: 'Aprovecha {{1}}% de descuento en tu matrícula.', meta: 'Marketing · Pendiente', tags: ['Promo'] },
  { id: uid(), kind: 'text', title: 'Ubicación', preview: 'Estamos en Av. Principal 123, Lima. ¡Te esperamos!', tags: ['FAQ'] },
];

const emptyAsset = (): Asset => ({ id: uid(), kind: 'text', title: '', preview: '', tags: [], meta: '' });

export default function LibraryPage() {
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [filter, setFilter] = useState<AssetKind | 'all'>('all');
  const [search, setSearch] = useState('');

  const [editor, setEditor] = useState<{ open: boolean; editing: boolean }>({ open: false, editing: false });
  const [draft, setDraft] = useState<Asset>(emptyAsset());
  const [tagsInput, setTagsInput] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      assets.filter((a) => {
        if (filter !== 'all' && a.kind !== filter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!a.title.toLowerCase().includes(q) && !a.preview.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [assets, filter, search],
  );

  function openCreate() {
    setDraft(emptyAsset());
    setTagsInput('');
    setEditor({ open: true, editing: false });
  }
  function openEdit(a: Asset) {
    setDraft({ ...a });
    setTagsInput(a.tags.join(', '));
    setEditor({ open: true, editing: true });
  }
  function save() {
    if (!draft.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const asset = { ...draft, tags };
    setAssets((prev) => (prev.some((a) => a.id === asset.id) ? prev.map((a) => (a.id === asset.id ? asset : a)) : [asset, ...prev]));
    setEditor({ open: false, editing: false });
    toast.success(editor.editing ? 'Elemento actualizado' : 'Elemento creado');
  }
  function remove(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setDeleteId(null);
    toast.success('Elemento eliminado');
  }

  const isMedia = (k: AssetKind) => k === 'image' || k === 'video' || k === 'voice';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold">Reutilizables</h1>
          <span className="text-xs text-muted-foreground">{visible.length} elementos</span>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={openCreate}>
          <Plus className="size-4" /> Nuevo
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar contenido por título o etiqueta…"
        />
        <div className="flex shrink-0 flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                filter === f.value ? 'border-primary bg-primary text-neutral-900' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin resultados.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((a) => {
              const meta = KIND_META[a.kind];
              const Icon = meta.icon;
              return (
                <article key={a.id} className="group flex flex-col rounded-lg border bg-background p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      isMedia(a.kind) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.preview}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="size-7" aria-label="Copiar" onClick={() => toast.success('Copiado (demo)')}>
                        <Copy className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" aria-label="Editar" onClick={() => openEdit(a)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" aria-label="Eliminar" onClick={() => setDeleteId(a.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {(a.meta || a.tags.length > 0) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {a.meta && <span className="text-[10px] text-muted-foreground">{a.meta}</span>}
                      {a.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">{t}</Badge>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={editor.open} onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor.editing ? 'Editar elemento' : 'Nuevo elemento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={draft.kind} onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as AssetKind }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_META) as AssetKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Ej: Horarios" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isMedia(draft.kind) ? 'Archivo / contenido' : 'Contenido'}</Label>
              <Textarea
                value={draft.preview}
                onChange={(e) => setDraft((d) => ({ ...d, preview: e.target.value }))}
                rows={3}
                className="resize-none text-sm"
                placeholder={isMedia(draft.kind) ? 'Nombre del archivo (la subida real va a Blob)' : 'Texto / link…'}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Etiquetas (separadas por coma)</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="FAQ, Visita" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button onClick={save}>{editor.editing ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar elemento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
