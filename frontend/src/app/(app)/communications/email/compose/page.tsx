'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, FileText, Eye, AlertCircle, CheckCircle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/motion'
import { RecipientSelector } from '@/components/communications'
import { useEmailTemplates, usePreviewEmailTemplate } from '@/hooks/use-email-templates'
import { useSendEmail } from '@/hooks/use-email-notifications'
import { useCurrentTenant } from '@/hooks/use-tenants'
import type { EmailRecipient, EmailTemplateVariable } from '@/types'

/**
 * Get the previous month name and year in Spanish
 * Example: "Diciembre 2025" (when current month is January 2026)
 */
function getDefaultPeriodo(): string {
  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return prevMonth.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
}

/**
 * Get default due date (20th of current month)
 * Format: "20/01/2026"
 */
function getDefaultFechaVencimiento(): string {
  const now = new Date()
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 20)
  return dueDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Get default value for a variable based on its default_hint or key
 */
function getDefaultVariableValue(variable: EmailTemplateVariable): string {
  // Use default_hint if provided
  if (variable.default_hint) {
    switch (variable.default_hint) {
      case 'mes_anterior':
        return getDefaultPeriodo()
      case 'dia_20_mes_actual':
        return getDefaultFechaVencimiento()
      case 'fecha_actual':
        return new Date().toLocaleDateString('es-PE')
    }
  }
  
  // Fallback to key-based defaults
  switch (variable.key) {
    case 'periodo':
      return getDefaultPeriodo()
    case 'fecha_vencimiento':
      return getDefaultFechaVencimiento()
    case 'fecha_actual':
      return new Date().toLocaleDateString('es-PE')
    case 'mes_actual':
      return new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
    default:
      return ''
  }
}

/**
 * Get user-editable variables from template (those with is_system = false)
 */
function getUserEditableVariables(variables: EmailTemplateVariable[]): EmailTemplateVariable[] {
  return variables.filter(v => !v.is_system)
}

/**
 * Friendly placeholder labels for system variables
 */
const SYSTEM_VARIABLE_PLACEHOLDERS: Record<string, string> = {
  cliente_nombre: '[Nombre del cliente]',
  cliente_ruc: '[RUC del cliente]',
  contacto_nombre: '[Nombre del contacto]',
  contacto_email: '[Email del contacto]',
  empresa_nombre: '[Nombre de la empresa]',
  empresa_ruc: '[RUC de la empresa]',
  estudio_nombre: '[Nombre del estudio]',
}

/**
 * Render template string with variables using {{variable}} syntax
 * - User-editable variables are resolved from the variables object
 * - System variables show friendly placeholders
 * - Unknown variables remain as-is
 */
function renderTemplateString(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, varName) => {
    // First check user-provided variables
    if (variables[varName] !== undefined) {
      return variables[varName]
    }
    // Then check system variable placeholders
    if (SYSTEM_VARIABLE_PLACEHOLDERS[varName]) {
      return SYSTEM_VARIABLE_PLACEHOLDERS[varName]
    }
    // Unknown variables remain as-is
    return match
  })
}

export default function ComposeEmailPage() {
  const { data: tenant } = useCurrentTenant()
  const { data: templatesData, isLoading: isLoadingTemplates } = useEmailTemplates()
  const previewMutation = usePreviewEmailTemplate()
  const sendMutation = useSendEmail()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [recipients, setRecipients] = useState<EmailRecipient[]>([])
  const [customMessage, setCustomMessage] = useState('')
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const templates = templatesData?.items ?? []
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  // Get user-editable variables for the selected template
  const editableVariables = useMemo(() => {
    if (!selectedTemplate) return []
    return getUserEditableVariables(selectedTemplate.variables)
  }, [selectedTemplate])

  // Initialize variables with defaults when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const defaults: Record<string, string> = {}
      editableVariables.forEach((v) => {
        defaults[v.key] = getDefaultVariableValue(v)
      })
      setVariables(defaults)
    } else {
      setVariables({})
    }
  }, [selectedTemplate, editableVariables])

  // Check if all required variables are filled
  const hasRequiredVariables = useMemo(() => {
    return editableVariables
      .filter(v => v.required)
      .every(v => variables[v.key]?.trim())
  }, [editableVariables, variables])

  const canSend = selectedTemplateId && recipients.length > 0 && hasRequiredVariables

  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }))
  }

  const handlePreview = async () => {
    if (!selectedTemplate) return
    
    // Build preview variables (user vars + sample auto-fill vars)
    const previewVariables: Record<string, string> = {
      ...variables,
      // Sample auto-fill values for preview
      cliente_nombre: 'Empresa Ejemplo SAC',
      cliente_ruc: '20123456789',
      contacto_nombre: 'Juan Pérez',
      contacto_email: 'juan@ejemplo.com',
      empresa_nombre: 'Empresa Ejemplo SAC',
      empresa_ruc: '20123456789',
    }
    
    if (tenant?.name) {
      previewVariables.estudio_nombre = tenant.name
    }
    
    const result = await previewMutation.mutateAsync({
      id: selectedTemplate.id,
      data: { 
        variables: previewVariables,
        additional_message: customMessage || undefined,
      },
    })
    setPreviewHtml(result.body_html)
    setShowPreview(true)
  }

  const handleSend = async () => {
    if (!selectedTemplate || recipients.length === 0) return
    
    setShowConfirm(false)
    setResult(null)
    
    try {
      const response = await sendMutation.mutateAsync({
        template_id: selectedTemplate.id,
        recipients,
        variables, // Send user-provided variables
        additional_message: customMessage || undefined,
      })
      
      setResult({
        success: true,
        message: `Se enviaron ${response.total_queued} correo${response.total_queued !== 1 ? 's' : ''} a la cola de envío.`,
      })
      
      // Clear form
      setSelectedTemplateId('')
      setRecipients([])
      setCustomMessage('')
      setVariables({})
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error al enviar correos',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/communications/email">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Volver</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Nuevo correo</h1>
              <p className="text-muted-foreground">
                Envía comunicaciones a tus clientes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={!selectedTemplate || previewMutation.isPending}
            >
              <Eye className="mr-2 h-4 w-4" />
              Vista previa
            </Button>
            <Button
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={!canSend || sendMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Result alert */}
      {result && (
        <FadeIn>
          <Alert variant={result.success ? 'default' : 'destructive'} className={result.success ? 'border-green-500/50 bg-green-500/10' : ''}>
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>{result.success ? 'Correos enviados' : 'Error'}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        </FadeIn>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <FadeIn delay={0.1} className="lg:col-span-2 space-y-6">
          {/* Template selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Plantilla</CardTitle>
                  <CardDescription>
                    Selecciona una plantilla de correo predefinida
                  </CardDescription>
                </div>
                {selectedTemplate && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/communications/email/templates/edit?id=${selectedTemplate.id}`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configurar
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingTemplates ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="template">Plantilla de correo</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Seleccionar plantilla..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>{template.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTemplate && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-medium">{selectedTemplate.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                  <div className="text-sm">
                    <span className="font-medium">Asunto:</span>{' '}
                    <span className="text-muted-foreground">
                      {renderTemplateString(selectedTemplate.subject, variables)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Variables - Only show if template has user-editable variables */}
          {selectedTemplate && editableVariables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Variables del correo</CardTitle>
                <CardDescription>
                  Completa los datos que se incluirán en el correo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {editableVariables.map((variable) => (
                    <div key={variable.key} className="space-y-2">
                      <Label htmlFor={variable.key}>
                        {variable.description}
                        {variable.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <Input
                        id={variable.key}
                        value={variables[variable.key] || ''}
                        onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                        placeholder={`Ingresa ${variable.description.toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Los datos del cliente (nombre, RUC) y del estudio se completan automáticamente.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Destinatarios</CardTitle>
              <CardDescription>
                Selecciona las empresas a las que enviar el correo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecipientSelector
                value={recipients}
                onChange={setRecipients}
              />
            </CardContent>
          </Card>

          {/* Custom message (optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mensaje adicional (opcional)</CardTitle>
              <CardDescription>
                Agrega un mensaje personalizado que se incluirá al final del correo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Escribe un mensaje adicional..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>
        </FadeIn>

        {/* Summary panel */}
        <FadeIn delay={0.2}>
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="text-lg">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plantilla:</span>
                  <span className="font-medium">
                    {selectedTemplate?.name || 'No seleccionada'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destinatarios:</span>
                  <span className="font-medium">{recipients.length} empresa{recipients.length !== 1 ? 's' : ''}</span>
                </div>
                {editableVariables.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Variables:</span>
                    <span className="font-medium">
                      {hasRequiredVariables ? 'Completas' : 'Incompletas'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mensaje adicional:</span>
                  <span className="font-medium">{customMessage ? 'Sí' : 'No'}</span>
                </div>
              </div>

              {/* Show variables summary */}
              {Object.keys(variables).length > 0 && (
                <div className="border-t pt-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Variables configuradas:</p>
                  {Object.entries(variables).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-medium truncate max-w-[150px]">{value || '-'}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground">
                Los correos se enviarán a los contactos configurados de cada empresa 
                que tengan activadas las notificaciones.
                </p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Vista previa del correo</DialogTitle>
            <DialogDescription>
              Así se verá el correo (con datos de ejemplo para el cliente)
            </DialogDescription>
          </DialogHeader>
          
          <div className="rounded-lg border bg-white p-4">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envío</DialogTitle>
            <DialogDescription>
              Estás a punto de enviar correos a {recipients.length} empresa{recipients.length !== 1 ? 's' : ''}.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          {/* Show variables in confirmation */}
          {Object.keys(variables).length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium mb-2">Variables del correo:</p>
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{key}:</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={sendMutation.isPending}>
              <Send className="mr-2 h-4 w-4" />
              {sendMutation.isPending ? 'Enviando...' : 'Confirmar envío'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
