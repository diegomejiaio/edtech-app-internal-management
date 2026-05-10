import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'
import type {
  CompanyContact,
  CompanyContactCreate,
  CompanyContactUpdate,
  CursorPaginatedResponse,
} from '@/types'

/**
 * Fetch contacts for a specific company
 */
export function useCompanyContacts(companyId: string | null | undefined) {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['company-contacts', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('Company ID is required')
      const token = await getToken()
      return api.get<CursorPaginatedResponse<CompanyContact>>(`/companies/${companyId}/contacts`, { token })
    },
    enabled: !!companyId,
  })
}

/**
 * Create a new contact for a company
 */
export function useCreateContact() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ companyId, data }: { companyId: string; data: CompanyContactCreate }) => {
      const token = await getToken()
      return api.post<CompanyContact>(`/companies/${companyId}/contacts`, data, { token })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-contacts', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

/**
 * Update a contact
 */
export function useUpdateContact() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      companyId,
      contactId,
      data,
    }: {
      companyId: string
      contactId: string
      data: CompanyContactUpdate
    }) => {
      const token = await getToken()
      return api.patch<CompanyContact>(`/companies/${companyId}/contacts/${contactId}`, data, { token })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-contacts', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

/**
 * Delete a contact
 */
export function useDeleteContact() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ companyId, contactId }: { companyId: string; contactId: string }) => {
      const token = await getToken()
      return api.delete<{ message: string }>(`/companies/${companyId}/contacts/${contactId}`, { token })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-contacts', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

/**
 * Toggle contact's receives_notifications flag
 */
export function useToggleContactNotifications() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      companyId,
      contactId,
      receives: receivesNotifications,
    }: {
      companyId: string
      contactId: string
      receives: boolean
    }) => {
      const token = await getToken()
      return api.patch<CompanyContact>(
        `/companies/${companyId}/contacts/${contactId}`,
        { receives_notifications: receivesNotifications },
        { token }
      )
    },
    onMutate: async ({ companyId, contactId, receives }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['company-contacts', companyId] })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<CursorPaginatedResponse<CompanyContact>>(['company-contacts', companyId])

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<CursorPaginatedResponse<CompanyContact>>(
          ['company-contacts', companyId],
          {
            ...previousData,
            items: previousData.items.map((contact) =>
              contact.id === contactId
                ? { ...contact, receives_notifications: receives }
                : contact
            ),
          }
        )
      }

      return { previousData }
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['company-contacts', variables.companyId], context.previousData)
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['company-contacts', variables.companyId] })
    },
  })
}
