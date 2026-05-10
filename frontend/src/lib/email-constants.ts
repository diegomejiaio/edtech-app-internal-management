import type { EmailTemplateCategory } from '@/types'

/**
 * Default colors for each email template category
 * Used for header_color when creating templates
 */
export const CATEGORY_DEFAULT_COLORS: Record<EmailTemplateCategory, string> = {
  documentos: '#2563eb',
  declaraciones: '#059669',
  cobranza: '#7c3aed',
  general: '#6b7280',
}

/**
 * Configuration for email template categories
 * Used for consistent styling across template-related components
 */
export const EMAIL_CATEGORY_CONFIG: Record<
  EmailTemplateCategory,
  {
    label: string
    className: string
    color: string
  }
> = {
  documentos: {
    label: 'Documentos',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    color: '#2563eb',
  },
  declaraciones: {
    label: 'Declaraciones',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    color: '#059669',
  },
  cobranza: {
    label: 'Cobranza',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    color: '#7c3aed',
  },
  general: {
    label: 'General',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    color: '#6b7280',
  },
}

/**
 * Sample values for template variable preview
 * Used when previewing email templates with placeholder data
 */
export const EMAIL_SAMPLE_VARIABLES: Record<string, string> = {
  empresa_nombre: 'Mi Empresa SAC',
  empresa_ruc: '20123456789',
  contacto_nombre: 'Juan Pérez',
  estudio_nombre: 'Contadores Asociados',
  estudio_telefono: '01-234-5678',
  estudio_email: 'contacto@estudio.com',
  fecha_actual: new Date().toLocaleDateString('es-PE'),
  mes_actual: new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }),
}

/**
 * Get sample value for a template variable key
 * Returns a placeholder if the key is not found in predefined samples
 */
export function getSampleVariableValue(key: string): string {
  return EMAIL_SAMPLE_VARIABLES[key] || `[${key}]`
}

/**
 * Build sample variables object from template variables
 */
export function buildSampleVariables(
  variables: Array<{ key: string }>
): Record<string, string> {
  const result: Record<string, string> = {}
  variables.forEach((v) => {
    result[v.key] = getSampleVariableValue(v.key)
  })
  return result
}
