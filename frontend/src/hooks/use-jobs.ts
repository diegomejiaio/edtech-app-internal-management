import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'
import type { JobTrigger, JobResponse, JobProcess } from '@/types'

export function useTriggerJob() {
  const { getToken } = useAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: JobTrigger) => {
      const token = await getToken()
      return api.post<JobResponse>('/jobs/trigger', data, { token })
    },
    onSuccess: () => {
      // Invalidate notifications after job is triggered (they'll refresh soon)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// Convenience hooks for specific job types
export function useSyncNotifications() {
  const triggerJob = useTriggerJob()

  return {
    ...triggerJob,
    trigger: (companyId?: string) => 
      triggerJob.mutate({ 
        process: 'sunat_notifications' as JobProcess, 
        company_id: companyId 
      }),
    triggerAsync: (companyId?: string) => 
      triggerJob.mutateAsync({ 
        process: 'sunat_notifications' as JobProcess, 
        company_id: companyId 
      }),
  }
}

export function useSyncSireCompras() {
  const triggerJob = useTriggerJob()

  return {
    ...triggerJob,
    trigger: (companyId?: string) => 
      triggerJob.mutate({ 
        process: 'sire_compras' as JobProcess, 
        company_id: companyId 
      }),
    triggerAsync: (companyId?: string) => 
      triggerJob.mutateAsync({ 
        process: 'sire_compras' as JobProcess, 
        company_id: companyId 
      }),
  }
}

export function useSyncSireVentas() {
  const triggerJob = useTriggerJob()

  return {
    ...triggerJob,
    trigger: (companyId?: string) => 
      triggerJob.mutate({ 
        process: 'sire_ventas' as JobProcess, 
        company_id: companyId 
      }),
    triggerAsync: (companyId?: string) => 
      triggerJob.mutateAsync({ 
        process: 'sire_ventas' as JobProcess, 
        company_id: companyId 
      }),
  }
}
