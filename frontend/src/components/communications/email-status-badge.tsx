'use client'

import { Badge } from '@/components/ui/badge'
import {
  Clock,
  Loader2,
  CheckCircle,
  CheckCheck,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmailNotificationStatus } from '@/types'

interface EmailStatusBadgeProps {
  status: EmailNotificationStatus
  className?: string
}

const STATUS_CONFIG: Record<EmailNotificationStatus, {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  icon: typeof Clock
  className: string
}> = {
  queued: {
    label: 'En cola',
    variant: 'secondary',
    icon: Clock,
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  sending: {
    label: 'Enviando',
    variant: 'default',
    icon: Loader2,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  sent: {
    label: 'Enviado',
    variant: 'outline',
    icon: CheckCircle,
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  delivered: {
    label: 'Entregado',
    variant: 'default',
    icon: CheckCheck,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  failed: {
    label: 'Fallido',
    variant: 'destructive',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
}

export function EmailStatusBadge({ status, className }: EmailStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-transparent font-medium',
        config.className,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', status === 'sending' && 'animate-spin')} />
      {config.label}
    </Badge>
  )
}
