'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Mail, Download, Search, Filter, RefreshCw, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { EmailHistoryTable } from './email-history-table'
import { EmailStatusBadge } from './email-status-badge'
import { CompanyCombobox } from '@/components/company-combobox'
import { useEmailNotifications } from '@/hooks/use-email-notifications'
import { useCompanies } from '@/hooks/use-companies'
import type { EmailNotificationStatus } from '@/types'

const STATUS_OPTIONS: { value: EmailNotificationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'queued', label: 'En cola' },
  { value: 'sending', label: 'Enviando' },
  { value: 'sent', label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'failed', label: 'Fallido' },
]

const PERIOD_OPTIONS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '15', label: 'Últimos 15 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: 'custom', label: 'Personalizado' },
]

const STATUS_LABELS: Record<EmailNotificationStatus, string> = {
  queued: 'En cola',
  sending: 'Enviando',
  sent: 'Enviado',
  delivered: 'Entregado',
  failed: 'Fallido',
}

export function EmailHistoryTab() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EmailNotificationStatus | 'all'>('all')
  const [companyId, setCompanyId] = useState<string>('all')
  const [period, setPeriod] = useState('15')
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({ from: undefined, to: undefined })

  // Calculate date range
  const dateRange = useMemo(() => {
    if (period === 'custom' && customDateRange.from) {
      return {
        start_date: format(customDateRange.from, 'yyyy-MM-dd'),
        end_date: customDateRange.to ? format(customDateRange.to, 'yyyy-MM-dd') : undefined,
      }
    }
    const days = parseInt(period, 10)
    return {
      start_date: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      end_date: undefined,
    }
  }, [period, customDateRange])

  const { data: companiesData, isLoading: isLoadingCompanies } = useCompanies({ is_active: true, limit: 100 })

  // Query for table - filtered by all criteria
  const { data, isLoading, error, refetch, isFetching } = useEmailNotifications({
    status: status === 'all' ? undefined : status,
    company_id: companyId === 'all' ? undefined : companyId,
    start_date: dateRange.start_date,
    end_date: dateRange.end_date,
    limit: 100,
  })

  const companies = companiesData?.items ?? []
  const emailsData = data?.items

  const downloadExcel = () => {
    const headers = ['Empresa', 'RUC', 'Contacto', 'Email', 'Asunto', 'Estado', 'Fecha']
    const rows = filteredEmails.map((email) => [
      email.company_name,
      email.company_ruc,
      email.contact_name,
      email.contact_email,
      email.subject,
      STATUS_LABELS[email.status] || email.status,
      format(new Date(email.created_at), 'dd/MM/yyyy HH:mm', { locale: es }),
    ])
    const csvContent =
      '\ufeff' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `emails-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Filter by search (client-side)
  const filteredEmails = useMemo(() => {
    const emails = emailsData ?? []
    if (!search) return emails
    const searchLower = search.toLowerCase()
    return emails.filter(
      (email) =>
        email.company_name.toLowerCase().includes(searchLower) ||
        email.company_ruc.includes(searchLower) ||
        email.contact_name.toLowerCase().includes(searchLower) ||
        email.contact_email.toLowerCase().includes(searchLower) ||
        email.subject.toLowerCase().includes(searchLower)
    )
  }, [emailsData, search])

  // Cache stats when in "all" mode (no filters)
  const [cachedStats, setCachedStats] = useState<Record<EmailNotificationStatus, number> | null>(null)
  
  const noFiltersActive = status === 'all' && companyId === 'all'

  // Calculate stats from current data
  const currentStats = useMemo(() => {
    const emails = data?.items ?? []
    const byStatus: Record<EmailNotificationStatus, number> = {
      queued: 0,
      sending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    }
    emails.forEach((email) => {
      if (email.status in byStatus) {
        byStatus[email.status as EmailNotificationStatus]++
      }
    })
    return byStatus
  }, [data])

  // Cache stats when no filters are active and we have data
  useEffect(() => {
    if (noFiltersActive && data?.items && data.items.length > 0) {
      setCachedStats(currentStats)
    }
  }, [noFiltersActive, data?.items, currentStats])

  // Reset cached stats when date range changes
  useEffect(() => {
    setCachedStats(null)
  }, [dateRange.start_date, dateRange.end_date])

  // Use cached stats when filters are active, otherwise use current stats
  const stats = (!noFiltersActive && cachedStats) ? cachedStats : currentStats

  const totalEmails = data?.total_count ?? data?.items?.length ?? 0

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-5">
        {STATUS_OPTIONS.filter((s) => s.value !== 'all').map((option) => {
          const count = stats[option.value as EmailNotificationStatus] || 0
          const isSelected = status === option.value
          return (
            <button
              key={option.value}
              onClick={() => setStatus(isSelected ? 'all' : option.value as EmailNotificationStatus)}
              className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                isSelected ? 'border-primary bg-muted/50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <EmailStatusBadge status={option.value as EmailNotificationStatus} />
                <span className="text-2xl font-semibold">{count}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar correos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as EmailNotificationStatus | 'all')}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CompanyCombobox
            companies={companies}
            value={companyId}
            onValueChange={setCompanyId}
            showAllOption
            allOptionText="Todas las empresas"
            isLoading={isLoadingCompanies}
            placeholder="Seleccionar empresa"
          />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {customDateRange.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, 'dd/MM', { locale: es })} -{' '}
                        {format(customDateRange.to, 'dd/MM', { locale: es })}
                      </>
                    ) : (
                      format(customDateRange.from, 'dd/MM/yyyy', { locale: es })
                    )
                  ) : (
                    'Seleccionar fechas'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) =>
                    setCustomDateRange({ from: range?.from, to: range?.to })
                  }
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadExcel}
                  disabled={filteredEmails.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Descargar como Excel</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <Mail className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Error al cargar historial</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No pudimos cargar el historial de correos. Intenta de nuevo.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <EmailHistoryTable emails={filteredEmails} isLoading={isLoading} />
      )}

      {/* Summary */}
      {!isLoading && !error && totalEmails > 0 && (
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredEmails.length} de {totalEmails} correos
        </p>
      )}
    </div>
  )
}
