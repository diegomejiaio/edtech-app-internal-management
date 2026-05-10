'use client'

import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ActiveBatchResponse, BatchStatus } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Status Config
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig: Record<BatchStatus, { 
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  icon?: React.ReactNode
}> = {
  pending: { label: 'Iniciando...', variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  running: { label: 'Sincronizando', variant: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { label: 'Completado', variant: 'outline', icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: 'Error', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelado', variant: 'secondary' },
}

// ─────────────────────────────────────────────────────────────────────────────
// SyncProgress Component
// ─────────────────────────────────────────────────────────────────────────────

interface SyncProgressProps {
  batch: ActiveBatchResponse
  className?: string
}

export function SyncProgress({ batch, className }: SyncProgressProps) {
  const { status, total_jobs, completed_jobs, failed_jobs, progress_percent } = batch
  const config = statusConfig[status]
  
  // Determine if completed with errors
  const hasErrors = failed_jobs > 0
  const isCompleteWithErrors = status === 'completed' && hasErrors
  
  const displayStatus = isCompleteWithErrors 
    ? { label: 'Completado con errores', variant: 'outline' as const, icon: <AlertCircle className="h-3 w-3 text-yellow-500" /> }
    : config

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Progress bar */}
      <div className="flex-1 min-w-32">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full transition-all duration-300',
              status === 'failed' ? 'bg-destructive' : 
              isCompleteWithErrors ? 'bg-yellow-500' : 
              'bg-primary'
            )}
            style={{ width: `${progress_percent}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {completed_jobs}/{total_jobs}
        {hasErrors && <span className="text-yellow-600"> • {failed_jobs} errores</span>}
      </span>

      {/* Status badge */}
      <Badge variant={displayStatus.variant} className="gap-1">
        {displayStatus.icon}
        {displayStatus.label}
      </Badge>
    </div>
  )
}
