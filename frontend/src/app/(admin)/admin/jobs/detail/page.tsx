'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, Clock, AlertCircle, CheckCircle2, XCircle, SkipForward, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FadeIn } from '@/components/motion'
import { useJobDetail } from '@/hooks/use-jobs-admin'
import { cn } from '@/lib/utils'
import { formatLocalDate } from '@/lib/dates'
import type { JobStatus, StepStatus, JobStep } from '@/types'

// Status configuration
const statusConfig: Record<JobStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2; color: string }> = {
  pending: { label: 'Pendiente', variant: 'secondary', icon: Clock, color: 'text-yellow-500' },
  running: { label: 'En ejecución', variant: 'default', icon: Play, color: 'text-blue-500' },
  completed: { label: 'Completado', variant: 'outline', icon: CheckCircle2, color: 'text-green-500' },
  failed: { label: 'Error', variant: 'destructive', icon: XCircle, color: 'text-red-500' },
}

const stepStatusConfig: Record<StepStatus, { icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  running: { icon: Play, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  completed: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  failed: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  skipped: { icon: SkipForward, color: 'text-muted-foreground', bgColor: 'bg-muted/50' },
}

/** Format datetime in browser's local timezone with seconds */
function formatDateTime(dateStr?: string): string {
  return formatLocalDate(dateStr, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDuration(ms?: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

export default function JobDetailPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  
  const { data: job, isLoading, error, refetch, isFetching } = useJobDetail(id)

  if (!id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/jobs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No se especificó un ID de job
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/jobs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Error al cargar job: {error.message}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/jobs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Job no encontrado
          </CardContent>
        </Card>
      </div>
    )
  }

  const status = statusConfig[job.status]
  const StatusIcon = status.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/jobs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight font-mono">
                  {job.id}
                </h1>
                <Badge variant={status.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {job.company_name} • {job.ruc}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </FadeIn>

      {/* Error Alert */}
      {job.error && (
        <FadeIn delay={0.05}>
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Error en {job.error_step || 'ejecución'}</p>
                <p className="text-sm text-muted-foreground">{job.error}</p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Job Info */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Información del Job</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="Organización" value={job.tenant_name || job.tenant_id} />
              <InfoItem label="Empresa" value={job.company_name} />
              <InfoItem label="RUC" value={job.ruc} mono />
              <InfoItem label="Proceso" value={getProcessLabel(job.process)} />
              <InfoItem label="Iniciado" value={formatDateTime(job.started_at)} />
              <InfoItem label="Completado" value={formatDateTime(job.completed_at)} />
              <InfoItem label="Duración" value={formatDuration(job.duration_ms)} />
              <InfoItem label="Reintentos" value={String(job.retry_count)} />
            </div>

            {job.metrics && (
              <>
                <Separator className="my-4" />
                <div className="grid gap-4 sm:grid-cols-4">
                  <MetricItem label="Total" value={job.metrics.total} />
                  <MetricItem label="Nuevos" value={job.metrics.new} highlight={job.metrics.new > 0} />
                  <MetricItem label="Omitidos" value={job.metrics.skipped} />
                  <MetricItem label="Errores" value={job.metrics.errors} error={job.metrics.errors > 0} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Steps Timeline */}
      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle>Timeline de Ejecución</CardTitle>
            <CardDescription>
              {job.steps.length} paso{job.steps.length !== 1 ? 's' : ''} de ejecución
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {job.steps.map((step, index) => (
                <StepCard 
                  key={step.name} 
                  step={step} 
                  isLast={index === job.steps.length - 1}
                  isErrorStep={job.error_step === step.name}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('font-medium', mono && 'font-mono')}>{value}</p>
    </div>
  )
}

function MetricItem({ label, value, highlight, error }: { label: string; value: number; highlight?: boolean; error?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn(
        'text-2xl font-bold',
        highlight && 'text-green-600',
        error && 'text-red-600'
      )}>
        {value}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function StepCard({ step, isLast, isErrorStep }: { step: JobStep; isLast: boolean; isErrorStep: boolean }) {
  const config = stepStatusConfig[step.status]
  const Icon = config.icon

  return (
    <div className="relative flex gap-4">
      {/* Vertical Line */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
      )}

      {/* Icon */}
      <div className={cn(
        'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
        config.bgColor,
        isErrorStep ? 'border-red-500' : 'border-border'
      )}>
        <Icon className={cn('h-5 w-5', config.color)} />
      </div>

      {/* Content */}
      <div className={cn(
        'flex-1 rounded-lg border p-4 mb-4',
        isErrorStep && 'border-red-500/50 bg-red-500/5',
        step.status === 'skipped' && 'opacity-60'
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium capitalize">{step.name.replace(/_/g, ' ')}</span>
            <Badge variant="outline" className="text-xs">
              {step.status}
            </Badge>
          </div>
          {step.duration_ms !== undefined && (
            <span className="text-sm text-muted-foreground">
              {formatDuration(step.duration_ms)}
            </span>
          )}
        </div>

        {/* Input/Output */}
        <div className="space-y-2">
          {step.input && Object.keys(step.input).length > 0 && (
            <DataBlock label="Input" data={step.input} />
          )}
          {step.output && Object.keys(step.output).length > 0 && (
            <DataBlock label="Output" data={step.output} />
          )}
          {step.error && (
            <div className="rounded bg-red-500/10 px-3 py-2">
              <span className="text-xs font-medium text-red-600">Error: </span>
              <span className="text-sm text-red-600">{step.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DataBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div className="rounded bg-muted/50 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}: </span>
      <span className="text-sm font-mono">
        {Object.entries(data).map(([key, value], i) => (
          <span key={key}>
            {i > 0 && ', '}
            <span className="text-muted-foreground">{key}:</span>{' '}
            <span>{formatValue(value)}</span>
          </span>
        ))}
      </span>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function getProcessLabel(process: string): string {
  const labels: Record<string, string> = {
    sunat_notifications: 'SUNAT Notificaciones',
    sire_compras: 'SIRE Compras',
    sire_ventas: 'SIRE Ventas',
  }
  return labels[process] || process
}
