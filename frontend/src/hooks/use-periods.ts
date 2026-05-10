import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'
import type {
  PeriodInput,
  PeriodUpdate,
  PeriodResponse,
  PeriodListResponse,
} from '@/types'

// ============================================================================
// Queries
// ============================================================================

/**
 * Fetch all periods for a specific company in a given year.
 * GET /v1/companies/{companyId}/periods?year={year}
 */
export function useCompanyPeriods(companyId: string | null | undefined, year: string) {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['periods', 'company', companyId, year],
    queryFn: async () => {
      if (!companyId) throw new Error('Company ID is required')
      const token = await getToken()
      return api.get<PeriodListResponse>(`/companies/${companyId}/periods`, {
        token,
        params: { year },
      })
    },
    enabled: !!companyId && !!year,
  })
}

/**
 * Fetch all periods for all companies in the tenant for a given year.
 * GET /v1/periods?year={year}&period={period}&quarter={quarter}
 */
export function useGlobalPeriods(
  year: string,
  options?: { period?: string; quarter?: string },
) {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['periods', 'global', year, options?.period, options?.quarter],
    queryFn: async () => {
      const token = await getToken()
      return api.get<PeriodListResponse>('/periods', {
        token,
        params: {
          year,
          period: options?.period,
          quarter: options?.quarter,
        },
      })
    },
    enabled: !!year,
  })
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create or replace a period record (PUT upsert).
 * PUT /v1/companies/{companyId}/periods/{year}/{period}
 */
export function useUpsertPeriod() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      companyId,
      year,
      period,
      data,
    }: {
      companyId: string
      year: string
      period: string
      data: PeriodInput
    }) => {
      const token = await getToken()
      return api.put<PeriodResponse>(
        `/companies/${companyId}/periods/${year}/${period}`,
        data,
        { token },
      )
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['periods', 'company', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['periods', 'global', variables.year] })
    },
  })
}

/**
 * Partially update a period record (PATCH).
 * PATCH /v1/companies/{companyId}/periods/{year}/{period}
 */
export function useUpdatePeriod() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      companyId,
      year,
      period,
      data,
    }: {
      companyId: string
      year: string
      period: string
      data: PeriodUpdate
    }) => {
      const token = await getToken()
      return api.patch<PeriodResponse>(
        `/companies/${companyId}/periods/${year}/${period}`,
        data,
        { token },
      )
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['periods', 'company', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['periods', 'global', variables.year] })
    },
  })
}
