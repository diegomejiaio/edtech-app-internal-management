'use client'

import { useState, useMemo } from 'react'
import { useUitConfig, useGlobalPeriods, useCompanies } from '@/hooks'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ShoppingCart,
  Building2,
  Trophy,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Search,
  RefreshCw,
  Download,
  Loader2,
} from 'lucide-react'
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts'
import { FadeIn } from '@/components/motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollTable } from '@/components/ui/scroll-table'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { MonthRangeSlider } from '@/components/dashboard/month-range-slider'
import {
  getMonthlyGlobalData,
  getGlobalKPIsByRange,
  getTopEmpresasByRange,
  getEmpresasUtilidadNegativaByRange,
  getEmpresasSummaryByRange,
  getPeriodosInRange,
  calcularImpuestoRenta,
  formatCurrency,
  formatCurrencyShort,
} from '../dashboard-data'

// Chart colors convention: utilidad=green, ventas=blue, compras=red
const chartColors = {
  utilidad: '#10b981',  // emerald-500
  ventas: '#3b82f6',    // blue-500
  compras: '#ef4444',   // red-500
}

// Chart config for interactive chart
const chartConfig = {
  utilidad: {
    label: 'Utilidad',
    color: chartColors.utilidad,
  },
  ventas: {
    label: 'Ventas',
    color: chartColors.ventas,
  },
  compras: {
    label: 'Compras',
    color: chartColors.compras,
  },
} satisfies ChartConfig

// Status badge mapping
const statusBadge: Record<'declarado' | 'pendiente', { variant: 'default' | 'secondary'; label: string }> = {
  declarado: { variant: 'default', label: 'Declarado' },
  pendiente: { variant: 'secondary', label: 'Pendiente' },
}

const MONTH_FULL_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

type SortField = 'utilidad' | 'ventas' | 'compras' | null
type SortDir = 'asc' | 'desc'

// Static available years (matches generateStaticParams in layout.tsx)
const availableYears = ['2024', '2025', '2026', '2027', '2028', '2029', '2030']

export default function DashboardPage() {
  const params = useParams()
  const router = useRouter()
  const year = params.year as string

  const [monthRange, setMonthRange] = useState<[number, number]>([1, 12])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeChart, setActiveChart] = useState<'utilidad' | 'ventas' | 'compras'>('utilidad')
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Fetch data from API
  const { data: periodsData, isLoading: isLoadingPeriods } = useGlobalPeriods(year)
  const { data: companiesData } = useCompanies({ limit: 200 })
  const { data: uitConfig } = useUitConfig(year)

  // Build company name lookup: ruc → business_name
  const companyNames = useMemo(
    () => new Map(companiesData?.items?.map(c => [c.ruc, c.business_name]) ?? []),
    [companiesData],
  )

  // All periods for the selected year
  const periods = useMemo(() => periodsData?.items ?? [], [periodsData])

  // Build period keys for the selected range
  const periodos = useMemo(
    () => getPeriodosInRange(monthRange[0], monthRange[1], year),
    [monthRange, year]
  )
  const periodoSet = useMemo(() => new Set(periodos), [periodos])

  // Get data based on selected range
  const globalKPIs = useMemo(() => getGlobalKPIsByRange(periods, periodos), [periods, periodos])

  const monthlyData = useMemo(() => getMonthlyGlobalData(periods, year), [periods, year])

  // Calculate totals for interactive chart (filtered by range)
  const chartTotals = useMemo(() => {
    const inRange = monthlyData.filter(d => periodoSet.has(d.periodo))
    return {
      utilidad: inRange.reduce((acc, curr) => acc + curr.utilidad, 0),
      ventas: inRange.reduce((acc, curr) => acc + curr.ventas, 0),
      compras: inRange.reduce((acc, curr) => acc + curr.compras, 0),
    }
  }, [monthlyData, periodoSet])

  // Chart data — always show all months, mark in-range
  const chartData = useMemo(() => {
    return monthlyData.map(d => ({
      ...d,
      _inRange: periodoSet.has(d.periodo),
    }))
  }, [monthlyData, periodoSet])

  const topEmpresas = useMemo(() => getTopEmpresasByRange(periods, 5, periodos, companyNames), [periods, periodos, companyNames])
  const empresasNegativas = useMemo(() => getEmpresasUtilidadNegativaByRange(periods, periodos, companyNames), [periods, periodos, companyNames])
  const empresasSummary = useMemo(() => getEmpresasSummaryByRange(periods, periodos, companyNames), [periods, periodos, companyNames])

  // Filter and sort companies
  const filteredEmpresas = useMemo(() => {
    let result = empresasSummary
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (empresa) => empresa.ruc.includes(searchTerm) ||
          (empresa.razon_social && empresa.razon_social.toLowerCase().includes(term))
      )
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        const diff = a[sortField] - b[sortField]
        return sortDir === 'desc' ? -diff : diff
      })
    }
    return result
  }, [empresasSummary, searchTerm, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'desc') setSortDir('asc')
      else { setSortField(null); setSortDir('desc') }
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    return sortDir === 'desc'
      ? <ArrowDown className="h-3 w-3 ml-1" />
      : <ArrowUp className="h-3 w-3 ml-1" />
  }

  const isFullYear = monthRange[0] === 1 && monthRange[1] === 12

  const periodoLabel = useMemo(() => {
    if (isFullYear) return `Acumulado ${year}`
    if (monthRange[0] === monthRange[1]) return `${MONTH_FULL_LABELS[monthRange[0] - 1]} ${year}`
    return `${MONTH_FULL_LABELS[monthRange[0] - 1]} – ${MONTH_FULL_LABELS[monthRange[1] - 1]} ${year}`
  }, [monthRange, year, isFullYear])

  if (isLoadingPeriods) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard Global</h1>
            <p className="text-muted-foreground">
              Visión ejecutiva de {globalKPIs.totalEmpresas} empresas
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Month range slider */}
            <MonthRangeSlider
              value={monthRange}
              onChange={setMonthRange}
              className="hidden sm:block w-72 lg:w-80"
            />
            {/* Year selector */}
            <Select value={year} onValueChange={(newYear) => router.push(`/dashboard/${newYear}`)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" aria-label="Exportar datos">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* KPI Cards */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Utilidad Total */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                Utilidad Total
              </CardDescription>
              {globalKPIs.totalUtilidad >= 0 ? (
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className={`text-xl sm:text-2xl font-bold tabular-nums truncate ${
                  globalKPIs.totalUtilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(globalKPIs.totalUtilidad)}
                </CardTitle>

              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">{periodoLabel}</p>
            </CardFooter>
          </Card>

          {/* Total Ventas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                Total Ventas
              </CardDescription>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-xl sm:text-2xl font-bold tabular-nums truncate text-blue-600 dark:text-blue-400">
                  {formatCurrency(globalKPIs.totalVentas)}
                </CardTitle>

              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">{periodoLabel}</p>
            </CardFooter>
          </Card>

          {/* Total Compras */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                Total Compras
              </CardDescription>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-xl sm:text-2xl font-bold tabular-nums truncate text-red-600 dark:text-red-400">
                  {formatCurrency(globalKPIs.totalCompras)}
                </CardTitle>

              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">{periodoLabel}</p>
            </CardFooter>
          </Card>

          {/* Empresas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                Empresas
              </CardDescription>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-xl sm:text-2xl font-bold tabular-nums">
                  {globalKPIs.totalEmpresas}
                </CardTitle>
                {empresasNegativas.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {empresasNegativas.length} en rojo
                  </Badge>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Con datos disponibles</p>
            </CardFooter>
          </Card>
        </div>
      </FadeIn>

        {/* Monthly Chart - Interactive */}
      <FadeIn delay={0.1}>
        <Card className="py-0">
          <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
            <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-5!">
              <CardTitle>Resumen Mensual</CardTitle>
              <CardDescription>
                Evolución mensual de todas las empresas combinadas
              </CardDescription>
            </div>
            <div className="flex">
              {(['utilidad', 'ventas', 'compras'] as const).map((key) => (
                <button
                  key={key}
                  data-active={activeChart === key}
                  className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-4 py-3 text-left even:border-l sm:border-t-0 sm:border-l sm:px-6 sm:py-4"
                  onClick={() => setActiveChart(key)}
                >
                  <span className="text-muted-foreground text-xs">
                    {chartConfig[key].label}
                  </span>
                  <span className={`text-base leading-none font-bold sm:text-2xl tabular-nums ${
                    key === 'utilidad'
                      ? chartTotals.utilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      : key === 'ventas'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(chartTotals[key])}
                  </span>
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:p-6">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-64 w-full"
            >
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{ top: 24, left: 0, right: 12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillUtilidad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.utilidad} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={chartColors.utilidad} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.ventas} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={chartColors.ventas} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillCompras" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.compras} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={chartColors.compras} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="mes"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrencyShort(value)}
                  tick={{ fontSize: 11 }}
                  width={50}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      className="w-40"
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey={activeChart}
                  stroke={`var(--color-${activeChart})`}
                  strokeWidth={2}
                  fill={`url(#fill${activeChart.charAt(0).toUpperCase() + activeChart.slice(1)})`}
                  dot={(props: Record<string, unknown>) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { periodo: string } }
                    const inRange = periodoSet.has(payload.periodo)
                    if (inRange) {
                      return (
                        <g key={`dot-${payload.periodo}`}>
                          <circle cx={cx} cy={cy} r={5} fill={`var(--color-${activeChart})`} stroke="white" strokeWidth={2} />
                        </g>
                      )
                    }
                    return <circle key={`dot-${payload.periodo}`} cx={cx} cy={cy} r={2} fill={`var(--color-${activeChart})`} opacity={0.3} />
                  }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey={activeChart}
                    position="top"
                    offset={10}
                    fontSize={10}
                    formatter={(value: number) => formatCurrencyShort(value)}
                  />
                </Area>
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Two Column Grid */}
      <FadeIn delay={0.15}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 Companies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Top 5 Empresas por Utilidad
              </CardTitle>
              <CardDescription>{periodoLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topEmpresas.map((empresa, index) => (
                  <Link
                    key={empresa.ruc}
                    href={`/dashboard/${year}/company?ruc=${empresa.ruc}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-muted text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" title={empresa.razon_social || empresa.ruc}>
                          {empresa.razon_social || empresa.ruc}
                        </p>
                        <p className="text-xs text-muted-foreground">Ventas: {formatCurrency(empresa.ventas)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`font-bold tabular-nums ${empresa.utilidad >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatCurrency(empresa.utilidad)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alerts - Companies with negative utility */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Top 5 Empresas con Mayor Pérdida
              </CardTitle>
              <CardDescription>{periodoLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {empresasNegativas.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No hay empresas con utilidad negativa en este período
                  </div>
                ) : (
                  empresasNegativas.slice(0, 5).map((empresa, index) => (
                    <Link
                      key={empresa.ruc}
                      href={`/dashboard/${year}/company?ruc=${empresa.ruc}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-muted text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate" title={empresa.razon_social || empresa.ruc}>
                            {empresa.razon_social || empresa.ruc}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ventas: {formatCurrency(empresa.ventas)} | Compras: {formatCurrency(empresa.compras)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-bold text-red-500 tabular-nums">
                          {formatCurrency(empresa.utilidad)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Company Summary Table */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Resumen por Empresa</CardTitle>
                <CardDescription>{periodoLabel} - {empresasSummary.length} empresas</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por RUC o nombre…"
                    className="pl-9 w-full sm:w-72"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" aria-label="Actualizar tabla">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollTable minWidth="700px">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">
                      <button className="inline-flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('utilidad')}>
                        Utilidad <SortIcon field="utilidad" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right hidden sm:table-cell">
                      <button className="inline-flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('ventas')}>
                        Ventas <SortIcon field="ventas" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      <button className="inline-flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('compras')}>
                        Compras <SortIcon field="compras" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Planilla</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Imp. Renta</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="w-15">Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmpresas.map((empresa) => (
                    <TableRow key={empresa.ruc}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate max-w-48" title={empresa.razon_social || empresa.ruc}>
                            {empresa.razon_social || empresa.ruc}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">{empresa.ruc}</p>
                        </div>
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold tabular-nums ${
                          empresa.utilidad >= 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {formatCurrency(empresa.utilidad)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">
                        {formatCurrency(empresa.ventas)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">
                        {formatCurrency(empresa.compras)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden lg:table-cell">
                        {formatCurrency(empresa.planilla)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden lg:table-cell text-amber-600 dark:text-amber-400">
                        {(() => {
                          const ir = calcularImpuestoRenta(empresa.utilidad, uitConfig ?? null)
                          return ir > 0 ? formatCurrency(ir) : '-'
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusBadge[empresa.estado].variant}>
                          {statusBadge[empresa.estado].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild aria-label={`Ver detalle de ${empresa.ruc}`}>
                          <Link href={`/dashboard/${year}/company?ruc=${empresa.ruc}`}>
                            <BarChart3 className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollTable>

            {/* Summary */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                {filteredEmpresas.length} empresas
              </p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
