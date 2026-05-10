// Period and UIT Config types (matching BFF API responses)

// ============================================================================
// UIT Config
// ============================================================================

export interface TaxBracket {
  min_uit: number;
  max_uit: number | null;
  rate: number;
}

export interface UitConfig {
  id: string;
  year: string;
  uit_value: number;
  tax_brackets: TaxBracket[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UitConfigCreate {
  uit_value: number;
  tax_brackets?: TaxBracket[] | null;
}

export interface UitConfigListResponse {
  items: UitConfig[];
  total_count: number;
}

// ============================================================================
// Periods
// ============================================================================

/** 28 input fields for creating/replacing a period (PUT) */
export interface PeriodInput {
  // Ventas (4)
  ventas_gravadas: number;
  ventas_no_gravadas: number;
  ventas_exoneradas: number;
  exportaciones: number;
  // Compras (4)
  compras_gravadas: number;
  compras_no_gravadas: number;
  compras_exoneradas: number;
  importaciones: number;
  // ITAN (2)
  itan_pagado: number;
  itan_aplicado: number;
  // Planilla (10)
  remuneraciones_brutas: number;
  essalud: number;
  onp: number;
  renta_quinta: number;
  afp_aporte: number;
  afp_comision: number;
  afp_seguro: number;
  gratificaciones: number;
  cts: number;
  vacaciones: number;
  // Trabajadores (3 integers)
  trabajadores_activos: number;
  trabajadores_pensionistas: number;
  trabajadores_formadores: number;
  // Otros (6)
  pago_cuenta_renta: number;
  otros_tributos: number;
  multas: number;
  fraccionamientos: number;
  costos_gastos_deducibles: number;
  depreciacion_amortizacion: number;
  // Metadata
  fecha_declaracion: string | null;
}

/** Partial update fields (PATCH) — all optional */
export type PeriodUpdate = Partial<PeriodInput>;

/** Full period response from API (input fields + identity + timestamps) */
export interface PeriodResponse extends PeriodInput {
  id: string;
  tenant_id: string;
  company_id: string;
  ruc: string;
  year: string;
  period: string;
  created_at: string;
  updated_at: string;
}

export interface PeriodListResponse {
  items: PeriodResponse[];
  total_count: number;
}

// ============================================================================
// Derived / calculated types (computed in frontend)
// ============================================================================

/** Calculated fields derived from PeriodResponse input fields */
export interface PeriodCalculated {
  total_ventas: number;
  total_compras: number;
  total_planilla: number;
  igv_ventas: number;
  igv_compras: number;
  saldo_igv: number;
  utilidad: number;
}

/** Period response enriched with calculated fields */
export type PeriodEnriched = PeriodResponse & PeriodCalculated;
