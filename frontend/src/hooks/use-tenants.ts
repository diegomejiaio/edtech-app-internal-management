import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'
import type { Tenant, CursorPaginatedResponse } from '@/types'

interface TenantCreate {
  id: string
  name: string
  plan?: 'basic' | 'pro'
  contact?: {
    name: string
    email: string
    phone?: string
  }
}

interface TenantUpdate {
  name?: string
  plan?: 'basic' | 'pro'
  contact?: {
    name: string
    email: string
    phone?: string
  }
}

interface UseTenantsOptions {
  status?: 'pending' | 'active' | 'suspended'
  enabled?: boolean
}

/**
 * Get the current user's tenant (their own organization)
 * 
 * This validates that the user's Clerk org is linked to a tenant in our database.
 * Returns error if:
 * - 403: Clerk org exists but not linked to a tenant
 * - 404: Tenant not found
 */
export function useCurrentTenant() {
  const { getToken, isSignedIn, orgId } = useAuthContext()
  
  return useQuery({
    queryKey: ['tenant', 'me'],
    queryFn: async () => {
      const token = await getToken()
      return api.get<Tenant>('/tenants/me', { token })
    },
    // Only run if user is signed in and has an org
    enabled: isSignedIn && !!orgId,
    // Don't retry on errors - 403/404 are expected for users without tenant
    retry: false,
    // Cache the result (including errors) to avoid repeated calls
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (garbage collection)
    // Don't refetch automatically
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })
}

/**
 * Update the current user's tenant
 */
export function useUpdateCurrentTenant() {
  const queryClient = useQueryClient()
  const { getToken } = useAuthContext()

  return useMutation({
    mutationFn: async (data: TenantUpdate) => {
      const token = await getToken()
      return api.patch<Tenant>('/tenants/me', data, { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

/**
 * List all tenants (Master only)
 */
export function useTenants(options: UseTenantsOptions = {}) {
  const { status, enabled = true } = options
  const { getToken } = useAuthContext()
  
  return useQuery({
    queryKey: ['tenants', { status }],
    queryFn: async () => {
      const token = await getToken()
      console.log('[useTenants] Token:', token ? `${token.substring(0, 20)}...` : 'NULL')
      const params: Record<string, string | undefined> = {}
      if (status) params.status = status
      return api.get<CursorPaginatedResponse<Tenant>>('/tenants', { token, params })
    },
    enabled,
  })
}

export function useCreateTenant() {
  const queryClient = useQueryClient()
  const { getToken } = useAuthContext()

  return useMutation({
    mutationFn: async (data: TenantCreate) => {
      const token = await getToken()
      return api.post<Tenant>('/tenants', data, { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useActivateTenant() {
  const queryClient = useQueryClient()
  const { getToken } = useAuthContext()

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      return api.patch<Tenant>(`/tenants/${id}/activate`, {}, { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useSuspendTenant() {
  const queryClient = useQueryClient()
  const { getToken } = useAuthContext()

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      return api.patch<Tenant>(`/tenants/${id}/suspend`, {}, { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useUpdateTenant() {
  const queryClient = useQueryClient()
  const { getToken } = useAuthContext()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TenantCreate> }) => {
      const token = await getToken()
      return api.patch<Tenant>(`/tenants/${id}`, data, { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

