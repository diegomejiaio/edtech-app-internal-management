/**
 * Dashboard data layer — pure aggregation functions.
 * All functions receive PeriodResponse[] from API hooks (no module-level state).
 */

import type { PeriodResponse, UitConfig } from '@/types'

// ============================================
// CONSTANTS
// ============================================

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ============================================
// CALCULATION HELPERS
// ============================================

/** Month period string ("01"–"12") → "Enero"–"Diciembre" */
export function getMonthName(period: string): string {
  return MONTH_NAMES[parseInt(period) - 1] ?? period
}

/** Month period string ("01"–"12") → "Ene"–"Dic" */
export function getMonthShort(period: string): string {
  return getMonthName(period).substring(0, 3)
}

/** Build period key "MM/YYYY" from a PeriodResponse */
export function periodKey(p: PeriodResponse): string {
  return `${p.period}/${p.year}`
}

export function calcTotalVentas(p: PeriodResponse): number {
  return p.ventas_gravadas + p.ventas_no_gravadas + p.ventas_exoneradas + p.exportaciones
}

export function calcTotalCompras(p: PeriodResponse): number {
  return p.compras_gravadas + p.compras_no_gravadas + p.compras_exoneradas + p.importaciones
}

export function calcTotalPlanilla(p: PeriodResponse): number {
  return p.remuneraciones_brutas + p.essalud + p.onp + p.renta_quinta
    + p.afp_aporte + p.afp_comision + p.afp_seguro
    + p.gratificaciones + p.cts + p.vacaciones
}

export function calcIgvVentas(p: PeriodResponse): number {
  return p.ventas_gravadas * 0.18
}

export function calcIgvCompras(p: PeriodResponse): number {
  return p.compras_gravadas * 0.18
}

export function calcUtilidad(p: PeriodResponse): number {
  return calcTotalVentas(p) - calcTotalCompras(p) - calcTotalPlanilla(p)
    - p.costos_gastos_deducibles - p.depreciacion_amortizacion
    - p.otros_tributos - p.multas - p.fraccionamientos
    - p.pago_cuenta_renta
}

// ============================================
// RANGE HELPERS (pure, no data dependency)
// ============================================

/** Build a period key string "MM/YYYY" from month number and year */
export function buildPeriodoKey(month: number, year: string): string {
  return `${String(month).padStart(2, '0')}/${year}`
}

/** Build array of period keys for a month range */
export function getPeriodosInRange(fromMonth: number, toMonth: number, year: string): string[] {
  return Array.from({ length: toMonth - fromMonth + 1 }, (_, i) =>
    buildPeriodoKey(fromMonth + i, year)
  )
}

// ============================================
// GLOBAL DASHBOARD AGGREGATIONS
// ============================================

/**
 * Get monthly aggregated data for global charts.
 * Returns all 12 months initialized (0 if no data).
 */
export function getMonthlyGlobalData(periods: PeriodResponse[], year: string) {
  // Initialize 12 months
  const buckets = new Map<string, {
    periodo: string
    mes: string
    utilidad: number
    ventas: number
    compras: number
    planilla: number
    empresasConDatos: number
  }>()

  for (let m = 1; m <= 12; m++) {
    const key = buildPeriodoKey(m, year)
    buckets.set(key, {
      periodo: key,
      mes: getMonthName(String(m).padStart(2, '0')),
      utilidad: 0,
      ventas: 0,
      compras: 0,
      planilla: 0,
      empresasConDatos: 0,
    })
  }

  // Track unique companies per month
  const rucsByMonth = new Map<string, Set<string>>()

  for (const p of periods) {
    const key = periodKey(p)
    const bucket = buckets.get(key)
    if (!bucket) continue

    const tv = calcTotalVentas(p)
    const tc = calcTotalCompras(p)

    bucket.utilidad += calcUtilidad(p)
    bucket.ventas += tv
    bucket.compras += tc
    bucket.planilla += calcTotalPlanilla(p)

    if (tv > 0 || tc > 0) {
      if (!rucsByMonth.has(key)) rucsByMonth.set(key, new Set())
      rucsByMonth.get(key)!.add(p.ruc)
    }
  }

  for (const [key, rucs] of rucsByMonth) {
    const bucket = buckets.get(key)
    if (bucket) bucket.empresasConDatos = rucs.size
  }

  return Array.from(buckets.values())
}

/**
 * Get global KPIs filtered by a set of period keys.
 */
export function getGlobalKPIsByRange(periods: PeriodResponse[], periodos: string[]) {
  const periodoSet = new Set(periodos)
  let totalUtilidad = 0
  let totalVentas = 0
  let totalCompras = 0
  let totalPlanilla = 0

  // Per-company aggregation for counting
  const companyStats = new Map<string, { utilidad: number; hasData: boolean }>()
  const allRucs = new Set<string>()

  for (const p of periods) {
    allRucs.add(p.ruc)
    if (!periodoSet.has(periodKey(p))) continue

    const tv = calcTotalVentas(p)
    const tc = calcTotalCompras(p)
    const util = calcUtilidad(p)

    totalUtilidad += util
    totalVentas += tv
    totalCompras += tc
    totalPlanilla += calcTotalPlanilla(p)

    let stats = companyStats.get(p.ruc)
    if (!stats) {
      stats = { utilidad: 0, hasData: false }
      companyStats.set(p.ruc, stats)
    }
    stats.utilidad += util
    if (tv > 0 || tc > 0) stats.hasData = true
  }

  let empresasConDatos = 0
  let empresasUtilidadNegativaCount = 0
  for (const stats of companyStats.values()) {
    if (stats.hasData) empresasConDatos++
    if (stats.utilidad < 0) empresasUtilidadNegativaCount++
  }

  return {
    totalEmpresas: allRucs.size,
    empresasConDatos,
    empresasUtilidadNegativa: empresasUtilidadNegativaCount,
    totalUtilidad,
    totalVentas,
    totalCompras,
    totalPlanilla,
    promedioVentasMensual: periodos.length > 0 ? totalVentas / periodos.length : 0,
  }
}

/**
 * Get top companies by utility filtered by range.
 */
export function getTopEmpresasByRange(
  periods: PeriodResponse[],
  limit: number,
  periodos: string[],
  companyNames: Map<string, string>,
) {
  const periodoSet = new Set(periodos)
  const companyAgg = new Map<string, { utilidad: number; ventas: number }>()

  for (const p of periods) {
    if (!periodoSet.has(periodKey(p))) continue
    let agg = companyAgg.get(p.ruc)
    if (!agg) {
      agg = { utilidad: 0, ventas: 0 }
      companyAgg.set(p.ruc, agg)
    }
    agg.utilidad += calcUtilidad(p)
    agg.ventas += calcTotalVentas(p)
  }

  return Array.from(companyAgg.entries())
    .map(([ruc, agg]) => ({
      ruc,
      razon_social: companyNames.get(ruc) ?? ruc,
      utilidad: agg.utilidad,
      ventas: agg.ventas,
      periodo: 'Rango seleccionado',
    }))
    .sort((a, b) => b.utilidad - a.utilidad)
    .slice(0, limit)
}

/**
 * Get companies with negative utility filtered by range.
 */
export function getEmpresasUtilidadNegativaByRange(
  periods: PeriodResponse[],
  periodos: string[],
  companyNames: Map<string, string>,
) {
  const periodoSet = new Set(periodos)
  const companyAgg = new Map<string, { utilidad: number; ventas: number; compras: number }>()

  for (const p of periods) {
    if (!periodoSet.has(periodKey(p))) continue
    let agg = companyAgg.get(p.ruc)
    if (!agg) {
      agg = { utilidad: 0, ventas: 0, compras: 0 }
      companyAgg.set(p.ruc, agg)
    }
    agg.utilidad += calcUtilidad(p)
    agg.ventas += calcTotalVentas(p)
    agg.compras += calcTotalCompras(p)
  }

  return Array.from(companyAgg.entries())
    .map(([ruc, agg]) => ({
      ruc,
      razon_social: companyNames.get(ruc) ?? ruc,
      utilidad: agg.utilidad,
      ventas: agg.ventas,
      compras: agg.compras,
    }))
    .filter(e => e.utilidad < 0)
    .sort((a, b) => a.utilidad - b.utilidad)
}

/**
 * Get all companies summary filtered by range.
 */
export function getEmpresasSummaryByRange(
  periods: PeriodResponse[],
  periodos: string[],
  companyNames: Map<string, string>,
) {
  const periodoSet = new Set(periodos)
  const companyAgg = new Map<string, {
    utilidad: number
    ventas: number
    compras: number
    planilla: number
    trabajadores: number
    declarada: boolean
  }>()

  for (const p of periods) {
    if (!periodoSet.has(periodKey(p))) continue
    let agg = companyAgg.get(p.ruc)
    if (!agg) {
      agg = { utilidad: 0, ventas: 0, compras: 0, planilla: 0, trabajadores: 0, declarada: false }
      companyAgg.set(p.ruc, agg)
    }
    agg.utilidad += calcUtilidad(p)
    agg.ventas += calcTotalVentas(p)
    agg.compras += calcTotalCompras(p)
    agg.planilla += calcTotalPlanilla(p)
    agg.trabajadores = Math.max(agg.trabajadores, p.trabajadores_activos)
    if (p.fecha_declaracion) agg.declarada = true
  }

  return Array.from(companyAgg.entries())
    .map(([ruc, agg]) => ({
      ruc,
      razon_social: companyNames.get(ruc) ?? ruc,
      utilidad: agg.utilidad,
      ventas: agg.ventas,
      compras: agg.compras,
      planilla: agg.planilla,
      trabajadores: agg.trabajadores,
      estado: (agg.declarada ? 'declarado' : 'pendiente') as 'declarado' | 'pendiente',
    }))
    .sort((a, b) => b.utilidad - a.utilidad)
}

// ============================================
// EMPRESA DASHBOARD (Single company)
// ============================================

/**
 * Get company monthly data for charts.
 * Accepts periods pre-filtered by company (ruc).
 */
export function getEmpresaMonthlyData(periods: PeriodResponse[]) {
  return periods
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(p => ({
      periodo: periodKey(p),
      mes: getMonthShort(p.period),
      utilidad: calcUtilidad(p),
      ventas: calcTotalVentas(p),
      compras: calcTotalCompras(p),
      planilla: calcTotalPlanilla(p),
      otros: p.costos_gastos_deducibles + p.depreciacion_amortizacion,
    }))
}

/**
 * Get company margin % data for charts (Margen = utilidad / ventas × 100).
 */
export function getEmpresaMargenData(periods: PeriodResponse[]) {
  return periods
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(p => {
      const ventas = calcTotalVentas(p)
      const utilidad = calcUtilidad(p)
      return {
        periodo: periodKey(p),
        mes: getMonthShort(p.period),
        margen: ventas > 0 ? (utilidad / ventas) * 100 : 0,
        utilidad,
        ventas,
      }
    })
}

/**
 * Get company IGV data for charts (Débito vs Crédito fiscal).
 */
export function getEmpresaIGVData(periods: PeriodResponse[]) {
  return periods
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(p => {
      const debito = calcIgvVentas(p)
      const credito = calcIgvCompras(p)
      return {
        periodo: periodKey(p),
        mes: getMonthShort(p.period),
        debito,
        credito,
        saldo: debito - credito,
      }
    })
}

// ============================================
// HELPERS
// ============================================

/**
 * Calculate Impuesto a la Renta (MYPE Tributario) based on annual utility.
 * Only makes sense on full-year (annual) basis.
 * If utility <= 0, tax is 0.
 * Accepts a UitConfig from the API (or null if not loaded yet).
 */
export function calcularImpuestoRenta(utilidadAnual: number, uitConfig: UitConfig | null): number {
  if (utilidadAnual <= 0) return 0
  if (!uitConfig) return 0

  let impuesto = 0
  const uitValue = uitConfig.uit_value
  const brackets = uitConfig.tax_brackets ?? []

  for (const bracket of brackets) {
    const minSoles = bracket.min_uit * uitValue
    const maxSoles = bracket.max_uit !== null ? bracket.max_uit * uitValue : Infinity

    if (utilidadAnual <= minSoles) break

    const taxableInBracket = Math.min(utilidadAnual, maxSoles) - minSoles
    impuesto += taxableInBracket * bracket.rate
  }

  return impuesto
}

export function formatCurrency(value: number): string {
  const formatted = new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value))
  
  return value < 0 ? `-S/ ${formatted}` : `S/ ${formatted}`
}

export function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  
  if (abs >= 1_000_000) {
    return `${sign}S/ ${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${sign}S/ ${(abs / 1_000).toFixed(0)}K`
  }
  return `${sign}S/ ${abs.toFixed(0)}`
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-PE').format(value)
}
