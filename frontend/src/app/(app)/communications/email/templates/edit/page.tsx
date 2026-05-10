'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Save, RotateCcw, Eye, Tag, Info, Plus, Pencil, Trash2, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { TemplateEditor, TemplateInput } from '@/components/ui/template-editor'
import { ColorPicker } from '@/components/ui/color-picker'
import { FadeIn } from '@/components/motion'
import { useEmailTemplate, useUpdateEmailTemplate, useResetEmailTemplate, usePreviewEmailTemplate } from '@/hooks/use-email-templates'
import { cn } from '@/lib/utils'
import { EMAIL_CATEGORY_CONFIG, buildSampleVariables } from '@/lib/email-constants'
import type { EmailTemplate, EmailTemplateVariable, EmailVariableType } from '@/types'

/**
 * Variable type configuration
 */
const VARIABLE_TYPE_CONFIG: Record<EmailVariableType, { label: string; description: string }> = {
  text: { label: 'Texto', description: 'Texto libre' },
  date: { label: 'Fecha', description: 'Fecha (ej: 15/01/2026)' },
  number: { label: 'Número', description: 'Valor numérico' },
  currency: { label: 'Monto', description: 'Monto en soles o dólares' },
}

/**
 * Separate system variables from custom (user-editable) variables
 */
function separateVariables(variables: EmailTemplateVariable[]) {
  const systemVars = variables.filter(v => v.is_system)
  const customVars = variables.filter(v => !v.is_system)
  return { systemVars, customVars }
}

export default function TemplateEditorPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('id')

  if (!templateId) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <Button asChild variant="ghost" size="sm">
            <Link href="/communications/email?tab=templates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a plantillas
            </Link>
          </Button>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              No se especificó una plantilla. Selecciona una plantilla de la lista.
            </AlertDescription>
          </Alert>
        </FadeIn>
      </div>
    )
  }

  return <TemplateEditorContent id={templateId} />
}

interface TemplateEditorContentProps {
  id: string
}

function TemplateEditorContent({ id }: TemplateEditorContentProps) {
  const { data: template, isLoading, error } = useEmailTemplate(id)
  const updateMutation = useUpdateEmailTemplate()
  const resetMutation = useResetEmailTemplate()
  const previewMutation = usePreviewEmailTemplate()

  if (isLoading) {
    return <TemplateEditorSkeleton />
  }

  if (error || !template) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <Button asChild variant="ghost" size="sm">
            <Link href="/communications/email?tab=templates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a plantillas
            </Link>
          </Button>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              No se pudo cargar la plantilla. Verifica que existe o intenta de nuevo.
            </AlertDescription>
          </Alert>
        </FadeIn>
      </div>
    )
  }

  return (
    <TemplateEditorForm
      key={template.id}
      template={template}
      updateMutation={updateMutation}
      resetMutation={resetMutation}
      previewMutation={previewMutation}
    />
  )
}

interface TemplateEditorFormProps {
  template: EmailTemplate
  updateMutation: ReturnType<typeof useUpdateEmailTemplate>
  resetMutation: ReturnType<typeof useResetEmailTemplate>
  previewMutation: ReturnType<typeof usePreviewEmailTemplate>
}

function TemplateEditorForm({
  template,
  updateMutation,
  resetMutation,
  previewMutation,
}: TemplateEditorFormProps) {
  const [subject, setSubject] = useState(template.subject)
  const [bodyText, setBodyText] = useState(template.body_text)
  const [headerColor, setHeaderColor] = useState(
    template.header_color || EMAIL_CATEGORY_CONFIG[template.category].color
  )
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  // Custom variables management
  const { systemVars, customVars: initialCustomVars } = separateVariables(template.variables)
  const [customVariables, setCustomVariables] = useState<EmailTemplateVariable[]>(initialCustomVars)
  const [showVariableDialog, setShowVariableDialog] = useState(false)
  const [editingVariable, setEditingVariable] = useState<EmailTemplateVariable | null>(null)

  // All variables for display (system + custom)
  const allVariables = [...systemVars, ...customVariables]

  // Track if variables have changed
  const variablesChanged = JSON.stringify(customVariables) !== JSON.stringify(initialCustomVars)
  const hasChanges = 
    subject !== template.subject || 
    bodyText !== template.body_text || 
    headerColor !== (template.header_color || EMAIL_CATEGORY_CONFIG[template.category].color) ||
    variablesChanged

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      id: template.id,
      data: { 
        subject, 
        body_text: bodyText, 
        header_color: headerColor,
        variables: customVariables 
      },
    })
  }

  const handleReset = async () => {
    await resetMutation.mutateAsync(template.id)
    setShowResetDialog(false)
  }

  const handlePreview = async () => {
    const sampleVariables = buildSampleVariables(allVariables)
    
    // Send current form values for live preview of unsaved changes
    const result = await previewMutation.mutateAsync({
      id: template.id,
      data: { 
        variables: sampleVariables,
        subject,
        body_text: bodyText,
        header_color: headerColor,
      },
    })
    setPreviewHtml(result.body_html)
    setShowPreviewDialog(true)
  }

  const insertVariable = (key: string) => {
    const variable = `{{${key}}}`
    setBodyText((prev) => prev + variable)
  }

  // Variable CRUD handlers
  const handleAddVariable = () => {
    setEditingVariable(null)
    setShowVariableDialog(true)
  }

  const handleEditVariable = (variable: EmailTemplateVariable) => {
    setEditingVariable(variable)
    setShowVariableDialog(true)
  }

  const handleDeleteVariable = (key: string) => {
    setCustomVariables((prev) => prev.filter((v) => v.key !== key))
  }

  const handleSaveVariable = (variable: EmailTemplateVariable) => {
    if (editingVariable) {
      // Update existing
      setCustomVariables((prev) =>
        prev.map((v) => (v.key === editingVariable.key ? variable : v))
      )
    } else {
      // Add new
      setCustomVariables((prev) => [...prev, variable])
    }
    setShowVariableDialog(false)
    setEditingVariable(null)
  }

  const categoryConfig = EMAIL_CATEGORY_CONFIG[template.category]

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/communications/email?tab=templates">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Volver</span>
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
                <Badge
                  variant="outline"
                  className={cn('border-transparent text-xs', categoryConfig.className)}
                >
                  <Tag className="mr-1 h-3 w-3" />
                  {categoryConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">{template.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {template.is_customized && (
              <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restaurar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Restaurar plantilla</DialogTitle>
                    <DialogDescription>
                      Se restaurará la plantilla a su contenido original. Perderás todos los cambios personalizados.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowResetDialog(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReset}
                      disabled={resetMutation.isPending}
                    >
                      {resetMutation.isPending ? 'Restaurando...' : 'Restaurar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
            >
              <Eye className="mr-2 h-4 w-4" />
              Vista previa
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor */}
        <FadeIn delay={0.1} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contenido</CardTitle>
              <CardDescription>
                Edita el asunto y cuerpo del correo. Usa variables para personalizar el contenido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Asunto</Label>
                <TemplateInput
                  id="subject"
                  value={subject}
                  onChange={setSubject}
                  placeholder="Asunto del correo..."
                  variableKeys={allVariables.map((v) => v.key)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Cuerpo del mensaje</Label>
                <TemplateEditor
                  value={bodyText}
                  onChange={setBodyText}
                  placeholder="Escribe el contenido del correo..."
                  variableKeys={allVariables.map((v) => v.key)}
                  minHeight="300px"
                />
                <p className="text-xs text-muted-foreground">
                  Usa la sintaxis {`{{variable}}`} para insertar variables dinámicas.
                  <span className="ml-2 inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded bg-blue-100 dark:bg-blue-900/50" />
                    <span>Variable válida</span>
                    <span className="ml-2 inline-block h-2 w-2 rounded bg-red-100 dark:bg-red-900/50" />
                    <span>Variable desconocida</span>
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Header Color */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Color del encabezado</CardTitle>
              <CardDescription>
                Selecciona el color para el encabezado del correo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ColorPicker
                value={headerColor}
                onChange={setHeaderColor}
              />
            </CardContent>
          </Card>
        </FadeIn>

        {/* Variables Panel */}
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Variables disponibles</CardTitle>
                  <CardDescription>
                    Haz clic en una variable para insertarla en el cuerpo del mensaje.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddVariable}>
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {allVariables.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta plantilla no tiene variables configuradas.
                </p>
              ) : (
                <>
                  {/* System Variables */}
                  {systemVars.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Variables del sistema
                        </p>
                        <Badge variant="secondary" className="text-xs">Auto</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Se completan automáticamente con datos del cliente y estudio.
                      </p>
                      <div className="space-y-1.5">
                        {systemVars.map((variable) => (
                          <VariableChip
                            key={variable.key}
                            variable={variable}
                            onClick={() => insertVariable(variable.key)}
                            isSystem
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Variables */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Variables personalizadas
                      </p>
                      <Badge variant="outline" className="text-xs">Editable</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      El usuario las completa al enviar el correo.
                    </p>
                    {customVariables.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-2">
                        No hay variables personalizadas. Haz clic en &quot;Agregar&quot; para crear una.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {customVariables.map((variable) => (
                          <VariableChip
                            key={variable.key}
                            variable={variable}
                            onClick={() => insertVariable(variable.key)}
                            onEdit={() => handleEditVariable(variable)}
                            onDelete={() => handleDeleteVariable(variable.key)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Variable Edit Dialog */}
      <VariableEditDialog
        open={showVariableDialog}
        onOpenChange={setShowVariableDialog}
        variable={editingVariable}
        existingKeys={allVariables.map((v) => v.key)}
        onSave={handleSaveVariable}
      />

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Vista previa del correo</DialogTitle>
            <DialogDescription>
              Así se verá el correo con datos de ejemplo.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-lg border bg-white p-4">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface VariableChipProps {
  variable: EmailTemplateVariable
  onClick: () => void
  isSystem?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

function VariableChip({ variable, onClick, isSystem, onEdit, onDelete }: VariableChipProps) {
  const typeConfig = VARIABLE_TYPE_CONFIG[variable.type || 'text']
  
  // Variables with default_hint are protected (cannot be deleted)
  const isProtected = !!variable.default_hint
  const canDelete = !isSystem && !isProtected && onDelete

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors',
              'hover:bg-muted/50',
              isSystem && 'border-dashed opacity-75',
              isProtected && !isSystem && 'border-amber-300 dark:border-amber-700'
            )}
          >
            <button
              type="button"
              onClick={onClick}
              className="flex-1 text-left focus:outline-none"
            >
              <code className="text-sm font-medium">{`{{${variable.key}}}`}</code>
            </button>
            <div className="flex items-center gap-1">
              {isProtected && !isSystem && (
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400">
                  Esencial
                </Badge>
              )}
              {!isSystem && variable.type && variable.type !== 'text' && (
                <Badge variant="outline" className="text-xs">
                  {typeConfig.label}
                </Badge>
              )}
              {variable.required && (
                <Badge variant="secondary" className="text-xs">
                  Requerido
                </Badge>
              )}
              {!isSystem && onEdit && (
                <div className="flex items-center gap-0.5 ml-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[200px]">
          <p className="text-sm">{variable.description}</p>
          {isSystem && (
            <p className="text-xs text-muted-foreground mt-1">
              Se completa automáticamente
            </p>
          )}
          {isProtected && !isSystem && (
            <p className="text-xs text-amber-700 mt-1">
              Variable esencial de la plantilla (no se puede eliminar)
            </p>
          )}
          {!isSystem && variable.default_value && (
            <p className="text-xs text-muted-foreground mt-1">
              Valor por defecto: {variable.default_value}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// =============================================================================
// Date Picker Field
// =============================================================================

interface DatePickerFieldProps {
  value: string
  onChange: (value: string) => void
}

/**
 * DatePicker that stores value as DD/MM/YYYY string (Peru format)
 */
function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  // Parse string to Date for the calendar
  const parseDate = (str: string): Date | undefined => {
    if (!str) return undefined
    try {
      return parse(str, 'dd/MM/yyyy', new Date())
    } catch {
      return undefined
    }
  }

  // Format Date to string for storage
  const formatDate = (date: Date | undefined): string => {
    if (!date) return ''
    return format(date, 'dd/MM/yyyy')
  }

  const selectedDate = parseDate(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value || 'Seleccionar fecha'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(formatDate(date))}
          locale={es}
        />
        {value && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange('')}
            >
              Limpiar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// =============================================================================
// Variable Edit Dialog
// =============================================================================

interface VariableEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variable: EmailTemplateVariable | null
  existingKeys: string[]
  onSave: (variable: EmailTemplateVariable) => void
}

function VariableEditDialog({
  open,
  onOpenChange,
  variable,
  existingKeys,
  onSave,
}: VariableEditDialogProps) {
  const isEditing = variable !== null

  // Form state
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<EmailVariableType>('text')
  const [required, setRequired] = useState(true)
  const [defaultValue, setDefaultValue] = useState('')

  // Validation state
  const [keyError, setKeyError] = useState('')

  // Populate form when variable changes or dialog opens
  useEffect(() => {
    if (open) {
      if (variable) {
        setKey(variable.key)
        setDescription(variable.description)
        setType(variable.type || 'text')
        setRequired(variable.required)
        setDefaultValue(variable.default_value || '')
      } else {
        setKey('')
        setDescription('')
        setType('text')
        setRequired(true)
        setDefaultValue('')
      }
      setKeyError('')
    }
  }, [open, variable])

  // Handle dialog close
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  // Validate key format
  const validateKey = (value: string): boolean => {
    // Only allow lowercase letters, numbers, and underscores
    if (!/^[a-z][a-z0-9_]*$/.test(value)) {
      setKeyError('Solo letras minúsculas, números y guiones bajos. Debe empezar con letra.')
      return false
    }
    // Check for duplicates (except when editing the same key)
    if (!isEditing || variable?.key !== value) {
      if (existingKeys.includes(value)) {
        setKeyError('Ya existe una variable con este nombre')
        return false
      }
    }
    setKeyError('')
    return true
  }

  const handleKeyChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    setKey(normalized)
    if (normalized) {
      validateKey(normalized)
    } else {
      setKeyError('')
    }
  }

  const handleSave = () => {
    if (!key || !description) return
    if (!validateKey(key)) return

    onSave({
      key,
      description,
      required,
      is_system: false,
      type,
      default_value: defaultValue || undefined,
    })
  }

  const canSave = key && description && !keyError

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar variable' : 'Nueva variable'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos de la variable personalizada.'
              : 'Crea una nueva variable que el usuario completará al enviar el correo.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Key */}
          <div className="space-y-2">
            <Label htmlFor="var-key">
              Nombre de la variable <span className="text-destructive">*</span>
            </Label>
            <Input
              id="var-key"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="ej: fecha_limite"
              disabled={isEditing} // Can't change key when editing
            />
            {keyError && (
              <p className="text-xs text-destructive">{keyError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Se usará como {`{{${key || 'nombre'}}}`} en la plantilla
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="var-description">
              Descripción <span className="text-destructive">*</span>
            </Label>
            <Input
              id="var-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ej: Fecha límite para entregar documentos"
            />
            <p className="text-xs text-muted-foreground">
              Se mostrará como ayuda al usuario al completar la variable
            </p>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="var-type">Tipo de dato</Label>
            <Select value={type} onValueChange={(v) => setType(v as EmailVariableType)}>
              <SelectTrigger id="var-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VARIABLE_TYPE_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label} - {config.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default Value */}
          <div className="space-y-2">
            <Label htmlFor="var-default">Valor por defecto (opcional)</Label>
            {type === 'date' ? (
              <DatePickerField
                value={defaultValue}
                onChange={setDefaultValue}
              />
            ) : (
              <Input
                id="var-default"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder={
                  type === 'number' ? 'ej: 100' :
                  type === 'currency' ? 'ej: S/ 1,500.00' :
                  'ej: valor inicial'
                }
              />
            )}
          </div>

          {/* Required */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="var-required"
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
            />
            <Label htmlFor="var-required" className="cursor-pointer">
              Variable requerida
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isEditing ? 'Guardar cambios' : 'Crear variable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemplateEditorSkeleton() {
  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </FadeIn>
      <div className="grid gap-6 lg:grid-cols-3">
        <FadeIn delay={0.1} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-[300px] w-full" />
              </div>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
