import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'
import type {
  EmailTemplate,
  EmailTemplateCreate,
  EmailTemplateUpdate,
  EmailTemplatePreviewRequest,
  EmailTemplatePreviewResponse,
  CursorPaginatedResponse,
} from '@/types'

/**
 * Fetch all email templates for the current tenant
 */
export function useEmailTemplates() {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const token = await getToken()
      return api.get<CursorPaginatedResponse<EmailTemplate>>('/email-templates', { token })
    },
  })
}

/**
 * Fetch a single email template by ID
 */
export function useEmailTemplate(templateId: string | null | undefined) {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['email-template', templateId],
    queryFn: async () => {
      if (!templateId) throw new Error('Template ID is required')
      const token = await getToken()
      return api.get<EmailTemplate>(`/email-templates/${templateId}`, { token })
    },
    enabled: !!templateId,
  })
}

/**
 * Create a new tenant email template
 */
export function useCreateEmailTemplate() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: EmailTemplateCreate) => {
      const token = await getToken()
      return api.post<EmailTemplate>('/email-templates', data, { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
    },
  })
}

/**
 * Update an email template (subject and body_text only)
 */
export function useUpdateEmailTemplate() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EmailTemplateUpdate }) => {
      const token = await getToken()
      return api.patch<EmailTemplate>(`/email-templates/${id}`, data, { token })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      queryClient.invalidateQueries({ queryKey: ['email-template', variables.id] })
    },
  })
}

/**
 * Delete a tenant email template
 */
export function useDeleteEmailTemplate() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (templateId: string) => {
      const token = await getToken()
      return api.delete<{ message: string }>(`/email-templates/${templateId}`, { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
    },
  })
}

/**
 * Preview a template with sample variables
 */
export function usePreviewEmailTemplate() {
  const { getToken } = useAuthContext()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EmailTemplatePreviewRequest }) => {
      const token = await getToken()
      return api.post<EmailTemplatePreviewResponse>(`/email-templates/${id}/preview`, data, { token })
    },
  })
}

/**
 * Reset a template to its default content
 */
export function useResetEmailTemplate() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (templateId: string) => {
      const token = await getToken()
      return api.post<EmailTemplate>(`/email-templates/${templateId}/reset`, {}, { token })
    },
    onSuccess: (_, templateId) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      queryClient.invalidateQueries({ queryKey: ['email-template', templateId] })
    },
  })
}
