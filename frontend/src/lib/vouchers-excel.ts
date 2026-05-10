/**
 * Excel export for Comprobantes de Compras (purchase vouchers).
 *
 * Two export modes:
 *  - **Headers**: one row per voucher, 40 columns matching SUNAT SIRE report layout + detraction payment fields.
 *  - **Items**: one row per item line inside each voucher, 23 columns (v2 layout).
 *
 * The transformation functions (`buildHeaderRows`, `buildItemRows`) are pure
 * and return an intermediate `ExcelRow[]` structure — easy to test with Vitest.
 *
 * The `downloadAsExcel` function uses exceljs via dynamic import so the ~500KB
 * bundle only loads when the user actually clicks export.
 */

import type { Voucher, VoucherDetailData } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Intermediate row — each key is a column header, value is cell content. */
export type ExcelRow = Record<string, string | number | null>;

/** Column definition used to build the header row and apply styles. */
export interface ColumnDef {
  header: string;
  key: string;
  /** When true, the cell is formatted as a number with 2 decimal places. */
  isNumeric?: boolean;
  /** Custom Excel number format string. Overrides the default "#,##0.00" when isNumeric is true. */
  numFmt?: string;
  width?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Column definitions — Cabeceras (40 columns, matches SUNAT SIRE report order + detraction payment)
// ─────────────────────────────────────────────────────────────────────────────

export const HEADER_COLUMNS: ColumnDef[] = [
  { header: "RUC", key: "ruc", width: 14 },
  {
    header: "Apellidos y Nombres o Razón Social",
    key: "razon_social",
    width: 40,
  },
  { header: "Periodo", key: "periodo", width: 10 },
  { header: "CAR SUNAT", key: "car_sunat", width: 14 },
  { header: "Fecha Emisión", key: "fecha_emision", width: 14 },
  { header: "Fecha Vencimiento", key: "fecha_vencimiento", width: 14 },
  { header: "Tipo Doc", key: "tipo_doc", width: 10 },
  { header: "Serie", key: "serie", width: 10 },
  { header: "Año", key: "anio", width: 8 },
  { header: "Número", key: "numero", width: 14 },
  { header: "Tipo Doc Identidad", key: "tipo_doc_identidad", width: 12 },
  { header: "Nro Doc Identidad", key: "nro_doc_identidad", width: 14 },
  { header: "Apellidos Nombres / Razón Social", key: "proveedor", width: 40 },
  { header: "Descripción", key: "descripcion", width: 50 },
  { header: "BI Gravado DG", key: "bi_gravado_dg", isNumeric: true, width: 16 },
  { header: "IGV / IPM DG", key: "igv_ipm_dg", isNumeric: true, width: 14 },
  {
    header: "BI Gravado DGNG",
    key: "bi_gravado_dgng",
    isNumeric: true,
    width: 16,
  },
  { header: "IGV / IPM DGNG", key: "igv_ipm_dgng", isNumeric: true, width: 14 },
  {
    header: "BI Gravado DNG",
    key: "bi_gravado_dng",
    isNumeric: true,
    width: 16,
  },
  { header: "IGV / IPM DNG", key: "igv_ipm_dng", isNumeric: true, width: 14 },
  { header: "Valor Adq. NG", key: "valor_adq_ng", isNumeric: true, width: 14 },
  { header: "ISC", key: "isc", isNumeric: true, width: 12 },
  { header: "ICBPER", key: "icbper", isNumeric: true, width: 12 },
  {
    header: "Otros Tributos",
    key: "otros_tributos",
    isNumeric: true,
    width: 14,
  },
  {
    header: "Total (Moneda Original)",
    key: "total_moneda_original",
    isNumeric: true,
    width: 20,
  },
  {
    header: "Total (Equivalente Soles)",
    key: "total_soles",
    isNumeric: true,
    width: 20,
  },
  { header: "Moneda", key: "moneda", width: 10 },
  {
    header: "Tipo Cambio Sunat",
    key: "tipo_cambio",
    isNumeric: true,
    numFmt: "#,##0.000",
    width: 16,
  },
  {
    header: "Fecha Emisión Doc Modificado",
    key: "fecha_emision_mod",
    width: 18,
  },
  { header: "Tipo CP Modificado", key: "tipo_cp_mod", width: 14 },
  { header: "Serie CP Modificado", key: "serie_cp_mod", width: 14 },
  { header: "COD. DAM O DSI", key: "cod_dam_dsi", width: 14 },
  { header: "Nro CP Modificado", key: "nro_cp_mod", width: 14 },
  { header: "Detracción", key: "detraccion", width: 14 },
  { header: "Fecha Pago Detracción", key: "fecha_pago_detraccion", width: 20 },
  {
    header: "Constancia Pago Detracción",
    key: "constancia_pago_detraccion",
    width: 24,
  },
  {
    header: "Monto Pago Detracción",
    key: "monto_pago_detraccion",
    isNumeric: true,
    width: 22,
  },
  {
    header: "Cuenta Pago Detracción",
    key: "cuenta_pago_detraccion",
    width: 22,
  },
  {
    header: "Fecha Consulta Detracción",
    key: "fecha_consulta_detraccion",
    width: 22,
  },
  { header: "Validación", key: "validacion", width: 14 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Column definitions — Items v2 (23 columns, issue #25 layout)
// ─────────────────────────────────────────────────────────────────────────────

export const ITEM_COLUMNS: ColumnDef[] = [
  { header: "RUC", key: "ruc", width: 14 },
  {
    header: "Apellidos y Nombres o Razón Social",
    key: "razon_social",
    width: 40,
  },
  { header: "Periodo", key: "periodo", width: 10 },
  { header: "CAR SUNAT", key: "car_sunat", width: 14 },
  { header: "Fecha Emisión", key: "fecha_emision", width: 14 },
  { header: "Fecha Vencimiento", key: "fecha_vencimiento", width: 14 },
  { header: "Tipo Doc", key: "tipo_doc", width: 10 },
  { header: "Serie", key: "serie", width: 10 },
  { header: "Año", key: "anio", width: 8 },
  { header: "Número", key: "numero", width: 14 },
  { header: "Tipo Doc Identidad", key: "tipo_doc_identidad", width: 12 },
  { header: "Nro Doc Identidad", key: "nro_doc_identidad", width: 14 },
  { header: "Apellidos Nombres / Razón Social", key: "proveedor", width: 40 },
  { header: "Moneda", key: "moneda", width: 10 },
  {
    header: "Tipo Cambio Sunat",
    key: "tipo_cambio",
    isNumeric: true,
    numFmt: "#,##0.000",
    width: 16,
  },
  { header: "Unidad", key: "unidad", width: 12 },
  { header: "Cantidad", key: "cantidad", isNumeric: true, width: 12 },
  { header: "Descripción por ITEMS", key: "descripcion_item", width: 50 },
  {
    header: "Valor Unitario",
    key: "valor_unitario",
    isNumeric: true,
    width: 16,
  },
  { header: "Valor Total", key: "valor_total", isNumeric: true, width: 16 },
  { header: "IGV Total", key: "igv_total", isNumeric: true, width: 14 },
  { header: "Total Venta", key: "total_venta", isNumeric: true, width: 16 },
  {
    header: "Total Venta Equivalente S/",
    key: "total_venta_soles",
    isNumeric: true,
    width: 22,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Round to 2 decimal places. Returns 0 for null/undefined. */
function n2(v: number | null | undefined): number {
  if (v == null) return 0;
  return Math.round(v * 100) / 100;
}

/** Return the raw number value without rounding. Returns 0 for null/undefined. */
function nRaw(v: number | null | undefined): number {
  if (v == null) return 0;
  return v;
}

/**
 * Format an ISO datetime string (e.g. "2026-04-01T05:19:57.000Z")
 * to "DD/MM/YYYY". Returns "" for null/undefined/invalid input.
 */
function formatIsoToDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

/**
 * Derive the year from an emission_date string.
 * Handles "DD/MM/YYYY" (SIRE format) and "YYYY-MM-DD" (ISO).
 */
export function deriveYear(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  // DD/MM/YYYY
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    return parts.length === 3 ? parts[2] : "";
  }
  // YYYY-MM-DD
  if (dateStr.includes("-")) {
    return dateStr.slice(0, 4);
  }
  return "";
}

/**
 * Calculate total in original currency.
 * If currency is PEN, original = total. Otherwise original = total / exchange_rate.
 */
export function calcOriginalTotal(
  total: number,
  currency: string,
  exchangeRate: number | null | undefined,
): number {
  if (currency === "PEN" || !exchangeRate || exchangeRate <= 0) {
    return n2(total);
  }
  return n2(total / exchangeRate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build common base fields (columns 1–13 shared between headers & items)
// ─────────────────────────────────────────────────────────────────────────────

function buildBaseFields(
  v: Voucher,
  companyRuc: string,
  companyName: string,
): ExcelRow {
  return {
    ruc: companyRuc,
    razon_social: companyName,
    periodo: v.period ?? "",
    car_sunat: v.sunat_car ?? "",
    fecha_emision: v.emission_date ?? "",
    fecha_vencimiento: v.due_date ?? "",
    tipo_doc: v.voucher_type ?? "",
    serie: v.series ?? "",
    anio: deriveYear(v.emission_date),
    numero: v.number ?? "",
    tipo_doc_identidad: "6", // always RUC for purchase vouchers
    nro_doc_identidad: v.supplier_ruc ?? "",
    proveedor: v.supplier_name ?? "",
  };
}

/** Build columns 16–35 (shared between headers & items rows) */
function buildTailFields(v: Voucher): ExcelRow {
  return {
    igv_ipm_dg: n2(v.igv_ipm_dg),
    bi_gravado_dgng: n2(v.taxable_base_dgng),
    igv_ipm_dgng: n2(v.igv_ipm_dgng),
    bi_gravado_dng: n2(v.taxable_base_dng),
    igv_ipm_dng: n2(v.igv_ipm_dng),
    valor_adq_ng: n2(v.non_taxed_acq_value),
    isc: n2(v.isc),
    icbper: n2(v.icbper),
    otros_tributos: n2(v.other_taxes_charges),
    total_moneda_original: calcOriginalTotal(
      v.total,
      v.currency ?? "PEN",
      v.exchange_rate,
    ),
    total_soles: n2(v.total),
    moneda: v.currency ?? "PEN",
    tipo_cambio: v.exchange_rate != null ? nRaw(v.exchange_rate) : null,
    fecha_emision_mod: v.modified_doc?.issue_date ?? "",
    tipo_cp_mod: v.modified_doc?.voucher_type ?? "",
    serie_cp_mod: v.modified_doc?.series ?? "",
    cod_dam_dsi: "", // not available v1
    nro_cp_mod: v.modified_doc?.number ?? "",
    detraccion: v.detraction ?? "",
    fecha_pago_detraccion: v.detraction_payment?.fec_pago ?? "",
    constancia_pago_detraccion: v.detraction_payment?.num_constancia ?? "",
    monto_pago_detraccion: v.detraction_payment?.validated
      ? n2(v.detraction_payment.mto_detraccion)
      : null,
    cuenta_pago_detraccion: v.detraction_payment?.num_cuenta ?? "",
    fecha_consulta_detraccion: formatIsoToDate(
      v.detraction_payment?.validated_at ?? null,
    ),
    validacion: v.validation_status ?? "valido",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — pure transformation functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build header rows — one row per voucher.
 *
 * @param vouchers   All vouchers for the company/period
 * @param companyRuc RUC of the company (client/receiver)
 * @param companyName Business name of the company
 */
export function buildHeaderRows(
  vouchers: Voucher[],
  companyRuc: string,
  companyName: string,
): ExcelRow[] {
  return vouchers.map((v) => ({
    ...buildBaseFields(v, companyRuc, companyName),
    descripcion: (v.description_summary ?? "").replace(/@@/g, " "),
    bi_gravado_dg: n2(v.taxable_base_dg),
    ...buildTailFields(v),
  }));
}

/**
 * Build item rows (v2) — one row per item line within each voucher.
 * 23 columns per issue #25. All vouchers are included regardless of detail_status.
 * Vouchers without extracted item lines (pending, failed, no detail_data)
 * emit a single row with columns 1–15 filled and columns 16–23 empty.
 *
 * Tipo Cambio rules:
 *  - PEN: forced to 1
 *  - USD with null/0 exchange_rate: use 0
 *
 * Total Venta Equivalente S/ = Total Venta × Tipo Cambio Sunat.
 *
 * @param vouchers   All vouchers for the company/period
 * @param companyRuc RUC of the company (client/receiver)
 * @param companyName Business name of the company
 */
export function buildItemRows(
  vouchers: Voucher[],
  companyRuc: string,
  companyName: string,
): ExcelRow[] {
  const rows: ExcelRow[] = [];

  for (const v of vouchers) {
    const detailData = v.detail_data as VoucherDetailData | undefined;
    const items = detailData?.comprobantes?.[0]?.informacionItems ?? [];

    const base = buildBaseFields(v, companyRuc, companyName);

    // Tipo Cambio Sunat: PEN → 1, USD → exchange_rate as-is (all digits)
    const currency = v.currency ?? "PEN";
    const tipoCambio = currency === "PEN" ? 1 : nRaw(v.exchange_rate ?? 0);

    // Base fields (cols 1–15)
    const cols1to15: ExcelRow = {
      ruc: base.ruc,
      razon_social: base.razon_social,
      periodo: base.periodo,
      car_sunat: base.car_sunat,
      fecha_emision: base.fecha_emision,
      fecha_vencimiento: base.fecha_vencimiento,
      tipo_doc: base.tipo_doc,
      serie: base.serie,
      anio: base.anio,
      numero: base.numero,
      tipo_doc_identidad: base.tipo_doc_identidad,
      nro_doc_identidad: base.nro_doc_identidad,
      proveedor: base.proveedor,
      moneda: currency,
      tipo_cambio: tipoCambio,
    };

    if (items.length === 0) {
      // No item lines — cols 16–23 are empty (B2 requirement)
      rows.push({
        ...cols1to15,
        unidad: null,
        cantidad: null,
        descripcion_item: null,
        valor_unitario: null,
        valor_total: null,
        igv_total: null,
        total_venta: null,
        total_venta_soles: null,
      });
      continue;
    }

    for (const item of items) {
      const cantidad = n2(item.cntItems);
      const valorUnitario = n2(item.mtoValUnitario);
      const totalVenta = n2(item.mtoImpTotal);
      // Valor Total = Cantidad × Valor Unitario
      const valorTotal = n2(cantidad * valorUnitario);
      // IGV Total = Total Venta - Valor Total
      const igvTotal = n2(totalVenta - valorTotal);
      // Total Venta Equivalente S/ = Total Venta × Tipo Cambio
      const totalVentaSoles = n2(totalVenta * tipoCambio);

      rows.push({
        ...cols1to15,
        unidad: item.desUnidadMedida ?? null,
        cantidad,
        descripcion_item: (item.desItem ?? "").replace(/@@/g, " ") || null,
        valor_unitario: valorUnitario,
        valor_total: valorTotal,
        igv_total: igvTotal,
        total_venta: totalVenta,
        total_venta_soles: totalVentaSoles,
      });
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel generation & download (coupled to exceljs via dynamic import)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a styled .xlsx workbook and trigger a browser download.
 *
 * Uses `import("exceljs")` so the ~500KB library only loads on demand.
 *
 * @param rows      Array of row data produced by `buildHeaderRows` or `buildItemRows`
 * @param columns   Column definitions (HEADER_COLUMNS or ITEM_COLUMNS)
 * @param sheetName Name of the worksheet tab
 * @param filename  Download file name (e.g. "Compras_Cabeceras_RUC_PERIOD.xlsx")
 */
export async function downloadAsExcel(
  rows: ExcelRow[],
  columns: ColumnDef[],
  sheetName: string,
  filename: string,
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  // Configure columns
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 14,
  }));

  // Style header row: blue background (#1F4E79), white bold text
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E79" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
  headerRow.height = 28;

  // Add data rows
  for (const row of rows) {
    const addedRow = sheet.addRow(row);

    // Apply numeric formatting to numeric columns
    columns.forEach((col, colIdx) => {
      if (col.isNumeric) {
        const cell = addedRow.getCell(colIdx + 1);
        if (typeof cell.value === "number") {
          cell.numFmt = col.numFmt ?? "#,##0.00";
        }
      }
    });
  }

  // Auto-filter on header row
  if (columns.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1 + rows.length, column: columns.length },
    };
  }

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Filename helpers
// ─────────────────────────────────────────────────────────────────────────────

export function headersFilename(ruc: string, period: string): string {
  return `Compras_Cabeceras_${ruc}_${period}.xlsx`;
}

export function itemsFilename(ruc: string, period: string): string {
  return `Compras_Items_${ruc}_${period}.xlsx`;
}
