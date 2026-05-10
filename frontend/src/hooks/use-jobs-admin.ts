import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'
import type { JobsListResponse, JobDetail, JobsFilters } from '@/types'

interface UseJobsOptions extends JobsFilters {
  limit?: number
  cursor?: string
  enabled?: boolean
}

/**
 * List jobs with filters (Admin/Master only)
 */
export function useJobsAdmin(options: UseJobsOptions = {}) {
  const { getToken } = useAuthContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: ['jobs', 'admin', filters],
    queryFn: async () => {
      const token = await getToken()
      const params: Record<string, string | number | undefined> = {}
      
      if (filters.tenant_id) params.tenant_id = filters.tenant_id
      if (filters.company_id) params.company_id = filters.company_id
      if (filters.ruc) params.ruc = filters.ruc
      if (filters.process) params.process = filters.process
      if (filters.status) params.status = filters.status
      if (filters.from_date) params.from_date = filters.from_date
      if (filters.to_date) params.to_date = filters.to_date
      if (filters.limit) params.limit = filters.limit
      if (filters.cursor) params.cursor = filters.cursor

      return api.get<JobsListResponse>('/jobs', { token, params })
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}

/**
 * Get job detail with steps (Admin/Master only)
 */
export function useJobDetail(jobId: string | null) {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['jobs', 'detail', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('Job ID required')
      const token = await getToken()
      return api.get<JobDetail>(`/jobs/${jobId}`, { token })
    },
    enabled: !!jobId,
    staleTime: 60 * 1000, // 1 minute
  })
}
