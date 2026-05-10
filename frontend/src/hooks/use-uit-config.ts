import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'
import type {
  UitConfig,
  UitConfigCreate,
  UitConfigListResponse,
} from '@/types'

// ============================================================================
// Queries
// ============================================================================

/**
 * Fetch UIT config for a specific fiscal year.
 * GET /api/v1/uit/{year}
 * Available to Admin and Master roles only.
 */
export function useUitConfig(year: string | null | undefined) {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['uit-config', year],
    queryFn: async () => {
      if (!year) throw new Error('Year is required')
      const token = await getToken()
      return api.get<UitConfig>(`/uit/${year}`, { token })
    },
    enabled: !!year,
  })
}

/**
 * Fetch all UIT configs (Master only).
 * GET /api/v1/uit
 */
export function useUitConfigs() {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['uit-config', 'all'],
    queryFn: async () => {
      const token = await getToken()
      return api.get<UitConfigListResponse>('/uit', { token })
    },
  })
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create or replace UIT config for a year (Master only).
 * PUT /v1/uit/{year}
 */
export function useUpsertUitConfig() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      year,
      data,
    }: {
      year: string
      data: UitConfigCreate
    }) => {
      const token = await getToken()
      return api.put<UitConfig>(`/uit/${year}`, data, { token })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['uit-config', variables.year] })
      queryClient.invalidateQueries({ queryKey: ['uit-config', 'all'] })
    },
  })
}
