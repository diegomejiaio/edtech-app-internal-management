'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useUitConfig, useGlobalPeriods, useCompanies } from '@/hooks'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Wallet,
  Landmark,
  Calendar,
  BarChart3,
  Percent,
  Receipt,
  Pencil,
  Loader2,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ReferenceLine,
} from 'recharts'
import { FadeIn } from '@/components/motion'
import { MonthRangeSlider } from '@/components/dashboard/month-range-slider'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  getEmpresaMonthlyData,
  getEmpresaMargenData,
  getEmpresaIGVData,
  getPeriodosInRange,
  calcularImpuestoRenta,
  calcTotalVentas,
  calcTotalCompras,
  calcTotalPlanilla,
  calcUtilidad,
  periodKey,
  formatCurrency,
  formatCurrencyShort,
  formatPercent,
} from '../../dashboard-data'
import { EditPeriodSheet } from '@/components/dashboard/edit-period-sheet'

// Chart colors convention: utilidad=green, ventas=blue, compras=red
const chartColors = {
  positive: '#10b981', // emerald-500 (positive utility)
  negative: '#ef4444', // red-500 (losses)
  ventas: '#3b82f6',   // blue-500
  compras: '#ef4444',  // red-500
  planilla: '#6b7280', // gray-500
  primary: '#6366f1',  // indigo-500 (brand)
  muted: '#9ca3af',    // gray-400
  utilidad: '#10b981', // emerald-500 (utility line)
}

// Chart configs
const utilidadChartConfig = {
  utilidad: { label: 'Utilidad', color: chartColors.positive },
} satisfies ChartConfig

const ventasComprasChartConfig = {
  ventas: { label: 'Ventas', color: chartColors.ventas },
  compras: { label: 'Compras', color: chartColors.compras },
} satisfies ChartConfig

const margenChartConfig = {
  margen: { label: 'Margen %', color: '#8b5cf6' }, // violet-500
} satisfies ChartConfig

const igvChartConfig = {
  saldo: { label: 'Saldo IGV', color: '#f59e0b' },   // amber-500
} satisfies ChartConfig

export default function EmpresaDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const year = params.year as string
  const ruc = searchParams.get('ruc')

  // Sheet state for editing period data
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [selectedPeriodo, setSelectedPeriodo] = useState('')

  // Month range slider state
  const [monthRange, setMonthRange] = useState<[number, number]>([1, 12])

  // Fetch data from API
  const { data: periodsData, isLoading: isLoadingPeriods } = useGlobalPeriods(year)
  const { data: companiesData } = useCompanies({ limit: 200 })
  const { data: uitConfig } = useUitConfig(year)

  // Build company name lookup: ruc → business_name
  const companyNames = useMemo(
    () => new Map(companiesData?.items?.map(c => [c.ruc, c.business_name]) ?? []),
    [companiesData],
  )

  // Get the company name for this RUC
  const companyName = useMemo(
    () => (ruc ? companyNames.get(ruc) ?? '' : ''),
    [ruc, companyNames],
  )

  // Filter periods for this company
  const companyPeriods = useMemo(
    () => (periodsData?.items ?? []).filter(p => p.ruc === ruc),
    [periodsData, ruc],
  )

  // Get company chart data (all months)
  const allMonthlyData = useMemo(() => getEmpresaMonthlyData(companyPeriods), [companyPeriods])
  const allMargenData = useMemo(() => getEmpresaMargenData(companyPeriods), [companyPeriods])
  const allIgvData = useMemo(() => getEmpresaIGVData(companyPeriods), [companyPeriods])

  // Period keys for the selected range
  const selectedPeriodos = useMemo(
    () => new Set(getPeriodosInRange(monthRange[0], monthRange[1], year)),
    [monthRange, year]
  )
  const isFullYear = monthRange[0] === 1 && monthRange[1] === 12

  // Range-filtered data for charts
  const monthlyData = useMemo(
    () => allMonthlyData.filter(d => selectedPeriodos.has(d.periodo)),
    [allMonthlyData, selectedPeriodos]
  )
  const margenData = useMemo(
    () => allMargenData.filter(d => selectedPeriodos.has(d.periodo)),
    [allMargenData, selectedPeriodos]
  )
  const igvData = useMemo(
    () => allIgvData.filter(d => selectedPeriodos.has(d.periodo)),
    [allIgvData, selectedPeriodos]
  )

  // Range-filtered KPIs
  const kpis = useMemo(() => {
    if (companyPeriods.length === 0) return null
    let totalUtilidad = 0, totalVentas = 0, totalCompras = 0, totalPlanilla = 0
    let totalTrabajadores = 0, mesesConDatos = 0
    for (const p of companyPeriods) {
      if (!selectedPeriodos.has(periodKey(p))) continue
      const tv = calcTotalVentas(p)
      const tc = calcTotalCompras(p)
      totalUtilidad += calcUtilidad(p)
      totalVentas += tv
      totalCompras += tc
      totalPlanilla += calcTotalPlanilla(p)
      totalTrabajadores = Math.max(totalTrabajadores, p.trabajadores_activos)
      if (tv > 0 || tc > 0) mesesConDatos++
    }
    return {
      ruc: ruc!,
      totalUtilidad, totalVentas, totalCompras, totalPlanilla, totalTrabajadores,
      promedioVentas: mesesConDatos > 0 ? totalVentas / mesesConDatos : 0,
      margenUtilidad: totalVentas > 0 ? (totalUtilidad / totalVentas) * 100 : 0,
      mesesConDatos,
    }
  }, [companyPeriods, selectedPeriodos, ruc])

  // Accumulated IGV saldo (range-filtered)
  const igvTotal = useMemo(() => {
    return igvData.reduce((sum, d) => sum + d.saldo, 0)
  }, [igvData])

  // Not found state
  if (isLoadingPeriods) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ruc || companyPeriods.length === 0 || !kpis) {
    return (
      <div className="p-6">
        <FadeIn>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Empresa no encontrada</h2>
                <p className="text-muted-foreground mb-4">
                  {ruc ? `No se encontró la empresa con RUC ${ruc}` : 'No se especificó un RUC'}
                </p>
                <Button asChild>
                  <Link href={`/dashboard/${year}`}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver al Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild aria-label="Volver al dashboard">
                <Link href={`/dashboard/${year}`}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {companyName || ruc}
                </h1>
                <p className="text-sm font-mono text-muted-foreground">{ruc}</p>
              </div>
            </div>
            <p className="text-muted-foreground mt-1 ml-12">Análisis contable - Año {year} ({kpis.mesesConDatos} meses con datos)</p>
          </div>
          <MonthRangeSlider
            value={monthRange}
            onChange={setMonthRange}
            className="hidden sm:block w-72 lg:w-80"
          />
        </div>
      </FadeIn>

      {/* KPI Cards */}
      <FadeIn delay={0.1}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Utilidad Acumulada */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                Utilidad Acumulada
              </CardDescription>
              {kpis.totalUtilidad >= 0 ? (
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className={`text-xl sm:text-2xl font-bold tabular-nums truncate ${
                  kpis.totalUtilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(kpis.totalUtilidad)}
                </CardTitle>
                {kpis.margenUtilidad !== 0 && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${kpis.margenUtilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    <TrendingUp className="mr-1 h-3 w-3" />
                    {formatPercent(kpis.margenUtilidad)}
                  </Badge>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Margen sobre ventas</p>
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
                  {formatCurrency(kpis.totalVentas)}
                </CardTitle>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Prom. {formatCurrency(kpis.promedioVentas)}/mes
              </p>
            </CardFooter>
          </Card>

          {/* Total Compras */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                Total Compras
              </CardDescription>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-xl sm:text-2xl font-bold tabular-nums truncate text-red-600 dark:text-red-400">
                  {formatCurrency(kpis.totalCompras)}
                </CardTitle>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Planilla: {formatCurrency(kpis.totalPlanilla)}
              </p>
            </CardFooter>
          </Card>

          {/* Impuesto a la Renta (MYPE Tributario) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                Imp. Renta
              </CardDescription>
              <Landmark className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-xl sm:text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {(() => {
                    const ir = calcularImpuestoRenta(kpis.totalUtilidad, uitConfig ?? null)
                    return ir > 0 ? formatCurrency(ir) : '-'
                  })()}
                </CardTitle>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                {isFullYear ? 'MYPE Tributario anual' : 'Proyectado (parcial)'}
              </p>
            </CardFooter>
          </Card>
        </div>
      </FadeIn>

      {/* Charts Row */}
      <FadeIn delay={0.15}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Utilidad Trend */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Tendencia de Utilidad
                  </CardTitle>
                  <CardDescription>Evolución mensual de la utilidad</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Acumulado</p>
                  <p className={`text-base font-bold tabular-nums ${
                    kpis.totalUtilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(kpis.totalUtilidad)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={utilidadChartConfig} className="h-60 w-full">
                <AreaChart data={monthlyData} margin={{ top: 20, right: 10, bottom: 10, left: 0 }}>
                  <defs>
                    <linearGradient id="fillUtilidad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.utilidad} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColors.utilidad} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCurrencyShort(value)}
                    tick={{ fontSize: 11 }}
                    width={55}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="utilidad"
                    fill="url(#fillUtilidad)"
                    stroke={chartColors.utilidad}
                    strokeWidth={2}
                    dot={{ fill: chartColors.utilidad, stroke: chartColors.utilidad, r: 3 }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      dataKey="utilidad"
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

          {/* Ventas vs Compras */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Ventas vs Compras
                  </CardTitle>
                  <CardDescription>Comparativo mensual superpuesto</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs text-muted-foreground">Ventas</span>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {formatCurrency(kpis.totalVentas)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs text-muted-foreground">Compras</span>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
                      {formatCurrency(kpis.totalCompras)}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={ventasComprasChartConfig} className="h-60 w-full">
                <AreaChart
                  data={monthlyData}
                  margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
                >
                  <defs>
                    <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.ventas} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColors.ventas} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fillCompras" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.compras} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColors.compras} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCurrencyShort(value)}
                    tick={{ fontSize: 11 }}
                    width={55}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span>{formatCurrency(Number(value))}</span>
                        )}
                      />
                    }
                  />
                  <Area
                    dataKey="ventas"
                    name="Ventas"
                    type="monotone"
                    fill="url(#fillVentas)"
                    stroke={chartColors.ventas}
                    strokeWidth={2}
                    dot={{ fill: chartColors.ventas, stroke: chartColors.ventas, r: 3 }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      position="top"
                      offset={8}
                      fontSize={10}
                      fill={chartColors.ventas}
                      formatter={(value: number) => formatCurrencyShort(value)}
                    />
                  </Area>
                  <Area
                    dataKey="compras"
                    name="Compras"
                    type="monotone"
                    fill="url(#fillCompras)"
                    stroke={chartColors.compras}
                    strokeWidth={2}
                    dot={{ fill: chartColors.compras, stroke: chartColors.compras, r: 3 }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      position="bottom"
                      offset={8}
                      fontSize={10}
                      fill={chartColors.compras}
                      formatter={(value: number) => formatCurrencyShort(value)}
                    />
                  </Area>
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Margen & IGV Charts */}
      <FadeIn delay={0.2}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Margen Bruto % */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    Margen Bruto
                  </CardTitle>
                  <CardDescription>Rentabilidad mensual (utilidad/ventas × 100)</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Acumulado</p>
                  <p className={`text-base font-bold tabular-nums ${
                    kpis.margenUtilidad >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatPercent(kpis.margenUtilidad)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={margenChartConfig} className="h-60 w-full">
                <AreaChart data={margenData} margin={{ top: 20, right: 10, bottom: 10, left: 0 }}>
                  <defs>
                    <linearGradient id="fillMargen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    tick={{ fontSize: 11 }}
                    width={40}
                  />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, props) => {
                          const d = props.payload
                          return (
                            <div className="space-y-1">
                              <p className="text-violet-500 font-medium">Margen: {Number(d.margen).toFixed(1)}%</p>
                              <p className="text-muted-foreground text-xs">Utilidad: {formatCurrency(d.utilidad)}</p>
                              <p className="text-muted-foreground text-xs">Ventas: {formatCurrency(d.ventas)}</p>
                            </div>
                          )
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="margen"
                    fill="url(#fillMargen)"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', stroke: '#8b5cf6', r: 3 }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      dataKey="margen"
                      position="top"
                      offset={10}
                      fontSize={10}
                      formatter={(value: number) => `${value.toFixed(0)}%`}
                    />
                  </Area>
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Saldo IGV Mensual */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Saldo IGV Mensual
                  </CardTitle>
                  <CardDescription>Positivo = a pagar · Negativo = crédito a favor</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs text-muted-foreground">A pagar</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-muted-foreground">Crédito a favor</span>
                    </div>
                  </div>
                  <div className="border-l pl-4 text-right">
                    <p className="text-muted-foreground text-xs">Acumulado</p>
                    <p className={`text-sm font-bold tabular-nums ${
                      igvTotal >= 0 ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                      {formatCurrency(igvTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={igvChartConfig} className="h-60 w-full">
                <BarChart data={igvData} margin={{ top: 20, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCurrencyShort(value)}
                    tick={{ fontSize: 11 }}
                    width={50}
                  />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel={false}
                        hideIndicator
                        formatter={(value, name, props) => {
                          const d = props.payload
                          const saldo = Number(d.saldo)
                          return (
                            <div className="space-y-1">
                              <p className="text-blue-500 text-xs">Débito: {formatCurrency(d.debito)}</p>
                              <p className="text-red-500 text-xs">Crédito: {formatCurrency(d.credito)}</p>
                              <p className={`font-medium ${saldo >= 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {saldo >= 0 ? `A pagar: ${formatCurrency(saldo)}` : `A favor: ${formatCurrency(Math.abs(saldo))}`}
                              </p>
                            </div>
                          )
                        }}
                      />
                    }
                  />
                  <Bar dataKey="saldo" radius={0}>
                    {igvData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.saldo >= 0 ? '#f59e0b' : '#10b981'}
                      />
                    ))}
                    <LabelList
                      dataKey="saldo"
                      position="top"
                      offset={5}
                      fontSize={10}
                      formatter={(value: number) => formatCurrencyShort(value)}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Monthly Table */}
      <FadeIn delay={0.3}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Detalle Mensual
            </CardTitle>
            <CardDescription>Resumen por período</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollTable minWidth="600px">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">Planilla</TableHead>
                    <TableHead className="text-right">Utilidad</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {allMonthlyData.map((row) => {
                      const inRange = selectedPeriodos.has(row.periodo)
                      return (
                      <TableRow key={row.periodo} className={inRange ? '' : 'opacity-30'}>
                        <TableCell className="font-medium">{row.mes}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.ventas)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.compras)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.planilla)}
                        </TableCell>
                        <TableCell className={`text-right font-bold tabular-nums ${
                          row.utilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCurrency(row.utilidad)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedPeriodo(row.periodo)
                              setEditSheetOpen(true)
                            }}
                            aria-label={`Editar ${row.mes}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollTable>
            </CardContent>
          </Card>
      </FadeIn>

      {/* Edit Period Sheet */}
      <EditPeriodSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        ruc={ruc}
        periodo={selectedPeriodo}
        razonSocial={companyName}
        periodData={companyPeriods.find(p => periodKey(p) === selectedPeriodo)}
        companyId={companyPeriods[0]?.company_id}
      />
    </div>
  )
}
