'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Search, LayoutGrid, List, Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ColorPicker } from '@/components/ui/color-picker'
import { TemplateCard, TemplateCardSkeleton } from './template-card'
import { useEmailTemplates, useCreateEmailTemplate } from '@/hooks/use-email-templates'
import { CATEGORY_DEFAULT_COLORS } from '@/lib/email-constants'
import type { EmailTemplateCategory } from '@/types'

const CATEGORY_OPTIONS: { value: EmailTemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas las categorías' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'declaraciones', label: 'Declaraciones' },
  { value: 'cobranza', label: 'Cobranza' },
  { value: 'general', label: 'General' },
]

const CATEGORY_CREATE_OPTIONS: { value: EmailTemplateCategory; label: string }[] = [
  { value: 'documentos', label: 'Documentos' },
  { value: 'declaraciones', label: 'Declaraciones' },
  { value: 'cobranza', label: 'Cobranza' },
  { value: 'general', label: 'General' },
]

// Form schema for creating a template
const createTemplateSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  category: z.enum(['documentos', 'declaraciones', 'cobranza', 'general']),
  subject: z.string().min(3, 'Mínimo 3 caracteres'),
  body_text: z.string().min(10, 'Mínimo 10 caracteres'),
})

type CreateTemplateForm = z.infer<typeof createTemplateSchema>

export function EmailTemplatesTab() {
  const { data, isLoading, error } = useEmailTemplates()
  const createMutation = useCreateEmailTemplate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<EmailTemplateCategory | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [headerColor, setHeaderColor] = useState(CATEGORY_DEFAULT_COLORS.general)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateTemplateForm>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'general',
      subject: '',
      body_text: '',
    },
  })

  const selectedCategory = watch('category')

  // Update header color when category changes in create dialog
  useEffect(() => {
    setHeaderColor(CATEGORY_DEFAULT_COLORS[selectedCategory])
  }, [selectedCategory])

  // Filter templates
  const templates = data?.items ?? []
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      search === '' ||
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.description.toLowerCase().includes(search.toLowerCase()) ||
      template.subject.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'all' || template.category === category
    return matchesSearch && matchesCategory
  })

  const onSubmit = async (values: CreateTemplateForm) => {
    await createMutation.mutateAsync({
      ...values,
      header_color: headerColor,
    })
    setShowCreateDialog(false)
    reset()
    setHeaderColor(CATEGORY_DEFAULT_COLORS.general)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setShowCreateDialog(open)
    if (!open) {
      reset()
      setHeaderColor(CATEGORY_DEFAULT_COLORS.general)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar plantillas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as EmailTemplateCategory | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={viewMode}
            onValueChange={(value) => setViewMode(value as 'grid' | 'list')}
            className="hidden sm:flex"
          >
            <TabsList>
              <TabsTrigger value="grid">
                <LayoutGrid className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={showCreateDialog} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva plantilla
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nueva plantilla</DialogTitle>
                <DialogDescription>
                  Crea una plantilla de correo personalizada para tu estudio. Podrás agregar variables después de crearla.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    placeholder="ej: Recordatorio de pago"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Input
                    id="description"
                    placeholder="ej: Para recordar pagos pendientes"
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => setValue('category', value as EmailTemplateCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_CREATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-sm text-destructive">{errors.category.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="header_color">Color del encabezado</Label>
                  <ColorPicker
                    value={headerColor}
                    onChange={setHeaderColor}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Asunto</Label>
                  <Input
                    id="subject"
                    placeholder="ej: Recordatorio - {{cliente_nombre}}"
                    {...register('subject')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usa {`{{variable}}`} para insertar datos dinámicos
                  </p>
                  {errors.subject && (
                    <p className="text-sm text-destructive">{errors.subject.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body_text">Contenido</Label>
                  <Textarea
                    id="body_text"
                    placeholder="Estimado {{contacto_nombre}},&#10;&#10;Le escribimos para..."
                    className="min-h-[120px] font-mono text-sm"
                    {...register('body_text')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables disponibles: {`{{cliente_nombre}}`}, {`{{cliente_ruc}}`}, {`{{contacto_nombre}}`}, {`{{estudio_nombre}}`}
                  </p>
                  {errors.body_text && (
                    <p className="text-sm text-destructive">{errors.body_text.message}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Crear plantilla
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Templates Grid/List */}
      {isLoading ? (
        <div
          className={
            viewMode === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'space-y-4'
          }
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Error al cargar plantillas</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No pudimos cargar las plantillas. Intenta de nuevo.
          </p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No se encontraron plantillas</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {search || category !== 'all'
              ? 'Intenta con otros filtros de búsqueda.'
              : 'Crea tu primera plantilla personalizada.'}
          </p>
          {!search && category === 'all' && (
            <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear plantilla
            </Button>
          )}
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'space-y-4'
          }
        >
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      {/* Summary */}
      {!isLoading && !error && templates.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredTemplates.length} de {templates.length} plantillas
        </p>
      )}
    </div>
  )
}
