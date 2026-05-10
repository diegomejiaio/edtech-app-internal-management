import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'
import type { ActiveBatchResponse, JobProcess, SyncTriggerResponse } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// useSyncTrigger - POST /sync/trigger
// ─────────────────────────────────────────────────────────────────────────────

interface TriggerParams {
  process: JobProcess
  /** Period to sync in YYYYMM format (required for SIRE processes) */
  period?: string
  company_id?: string
}

/**
 * Trigger async sync - creates batch and enqueues jobs
 * Returns batch_id immediately, poll with useActiveBatch for progress
 */
export function useSyncTrigger() {
  const queryClient = useQueryClient()
  const { getToken } = useAuthContext()

  return useMutation({
    mutationFn: async (params: TriggerParams) => {
      const token = await getToken()
      return api.post<SyncTriggerResponse>('/sync/trigger', params, { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync', 'active'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useActiveBatch - GET /sync/batches/active?process=xxx (poll 3s)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll for active batch status
 * Returns null if no active batch (204)
 * Polls every 3s while batch is running
 */
export function useActiveBatch(process: JobProcess) {
  const { getToken } = useAuthContext()

  return useQuery({
    queryKey: ['sync', 'active', process],
    queryFn: async (): Promise<ActiveBatchResponse | null> => {
      const token = await getToken()
      // api.get now returns null for 204 No Content
      const result = await api.get<ActiveBatchResponse | null>('/sync/batches/active', {
        token,
        params: { process },
      })
      return result
    },
    refetchInterval: (query) => {
      const data = query.state.data
      // Poll every 3s while batch is active (pending or running)
      // Stop polling when data is null (no active batch) or batch completed/failed
      if (data && (data.status === 'running' || data.status === 'pending')) {
        return 3000
      }
      return false
    },
    staleTime: 1000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useBatchComplete - Effect to detect batch completion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to run callback when batch transitions to complete state
 * Detects both:
 * 1. batch.status changes from running/pending to completed/failed
 * 2. batch transitions from running/pending to null (API returns 204)
 */
export function useBatchComplete(
  batch: ActiveBatchResponse | null | undefined,
  onComplete: (batch: ActiveBatchResponse | null) => void
) {
  const queryClient = useQueryClient()
  const prevBatchRef = useRef<ActiveBatchResponse | null>(null)

  useEffect(() => {
    const prevBatch = prevBatchRef.current
    const wasRunning = prevBatch && (prevBatch.status === 'running' || prevBatch.status === 'pending')

    // Case 1: batch went from running to completed/failed status
    if (batch && wasRunning && !['pending', 'running'].includes(batch.status)) {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-stats'] })
      queryClient.invalidateQueries({ queryKey: ['vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['vouchers-stats'] })
      onComplete(batch)
    }
    
    // Case 2: batch went from running to null (204 No Content - batch completed and removed)
    // This happens when backend returns 204 because batch is no longer active
    if (!batch && wasRunning) {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-stats'] })
      queryClient.invalidateQueries({ queryKey: ['vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['vouchers-stats'] })
      // Pass the previous batch so we can show stats about it
      onComplete(prevBatch)
    }

    // Update ref for next comparison
    prevBatchRef.current = batch ?? null
  }, [batch, onComplete, queryClient])
}

