/**
 * Unit tests for vouchers-excel.ts — Excel export pure functions.
 *
 * Tests buildHeaderRows, buildItemRows, deriveYear, calcOriginalTotal,
 * and filename helpers. Does NOT test downloadAsExcel (browser-coupled).
 */
import { describe, it, expect } from "vitest";
import {
  buildHeaderRows,
  buildItemRows,
  deriveYear,
  calcOriginalTotal,
  headersFilename,
  itemsFilename,
  HEADER_COLUMNS,
  ITEM_COLUMNS,
} from "@/lib/vouchers-excel";
import type { Voucher } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal Voucher for testing */
function makeVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "vchr-test-1",
    tenant_id: "tnnt-test",
    company_id: "comp-test",
    period: "202501",
    supplier_ruc: "20100000001",
    supplier_name: "Proveedor Test SAC",
    voucher_type: "01",
    voucher_type_label: "Factura",
    series: "F001",
    number: "000001",
    currency: "PEN",
    total: 1180,
    detail_status: "completed",
    validation_status: "valido",
    has_detail: true,
    created_at: "2025-01-01T00:00:00",
    emission_date: "15/01/2025",
    due_date: "15/02/2025",
    taxable_base_dg: 1000,
    igv_ipm_dg: 180,
    igv_ipm_dgng: 0,
    igv_ipm_dng: 0,
    taxable_base_dgng: 0,
    taxable_base_dng: 0,
    non_taxed_acq_value: 0,
    isc: 0,
    icbper: 0,
    other_taxes_charges: 0,
    description_summary: "Item A@@Item B",
    ...overrides,
  };
}

const RUC = "20123456789";
const NAME = "Empresa Test SAC";

// ─────────────────────────────────────────────────────────────────────────────
// deriveYear
// ─────────────────────────────────────────────────────────────────────────────

describe("deriveYear", () => {
  it("GIVEN DD/MM/YYYY format -> returns YYYY", () => {
    /**
     * GIVEN a date string in SIRE DD/MM/YYYY format
     * WHEN deriving the year
     * THEN returns the last 4 characters (the year)
     */
    expect(deriveYear("15/01/2025")).toBe("2025");
  });

  it("GIVEN YYYY-MM-DD (ISO) format -> returns YYYY", () => {
    /**
     * GIVEN a date string in ISO format
     * WHEN deriving the year
     * THEN returns the first 4 characters (the year)
     */
    expect(deriveYear("2025-01-15")).toBe("2025");
  });

  it("GIVEN null/undefined -> returns empty string", () => {
    /**
     * GIVEN null or undefined input
     * WHEN deriving the year
     * THEN returns empty string
     */
    expect(deriveYear(null)).toBe("");
    expect(deriveYear(undefined)).toBe("");
    expect(deriveYear("")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcOriginalTotal
// ─────────────────────────────────────────────────────────────────────────────

describe("calcOriginalTotal", () => {
  it("GIVEN PEN currency -> returns total as-is (rounded to 2dp)", () => {
    /**
     * GIVEN total=1180 and currency=PEN
     * WHEN calculating original total
     * THEN returns 1180 (no conversion needed)
     */
    expect(calcOriginalTotal(1180, "PEN", null)).toBe(1180);
  });

  it("GIVEN USD currency with exchange_rate=3.5 -> returns total/3.5", () => {
    /**
     * GIVEN total=350 in USD with exchange_rate=3.5
     * WHEN calculating original total
     * THEN returns 350/3.5 = 100
     */
    expect(calcOriginalTotal(350, "USD", 3.5)).toBe(100);
  });

  it("GIVEN USD currency with exchange_rate=3.7 -> rounds to 2dp", () => {
    /**
     * GIVEN total=1000 in USD with exchange_rate=3.7
     * WHEN calculating original total
     * THEN returns 1000/3.7 rounded to 2 decimal places
     */
    const result = calcOriginalTotal(1000, "USD", 3.7);
    expect(result).toBe(Math.round((1000 / 3.7) * 100) / 100);
  });

  it("GIVEN exchange_rate=0 -> treats as PEN (returns total)", () => {
    /**
     * GIVEN an exchange rate of 0 (invalid)
     * WHEN calculating original total
     * THEN falls back to returning total as-is
     */
    expect(calcOriginalTotal(500, "USD", 0)).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildHeaderRows
// ─────────────────────────────────────────────────────────────────────────────

describe("buildHeaderRows", () => {
  it("GIVEN empty vouchers array -> returns empty rows array", () => {
    /**
     * GIVEN no vouchers
     * WHEN building header rows
     * THEN returns an empty array
     */
    const rows = buildHeaderRows([], RUC, NAME);
    expect(rows).toHaveLength(0);
  });

  it("GIVEN 2 vouchers -> returns 2 rows with correct base fields", () => {
    /**
     * GIVEN 2 vouchers
     * WHEN building header rows
     * THEN returns 2 rows, each with RUC, razon_social, and period from the voucher
     */
    const vouchers = [
      makeVoucher({ id: "vchr-1" }),
      makeVoucher({ id: "vchr-2", supplier_ruc: "20200000002" }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);

    expect(rows).toHaveLength(2);
    expect(rows[0].ruc).toBe(RUC);
    expect(rows[0].razon_social).toBe(NAME);
    expect(rows[0].periodo).toBe("202501");
    expect(rows[0].nro_doc_identidad).toBe("20100000001");
    expect(rows[1].nro_doc_identidad).toBe("20200000002");
  });

  it("GIVEN USD voucher with exchange_rate=3.5 -> total_moneda_original = total/3.5", () => {
    /**
     * GIVEN a USD voucher with total=350 and exchange_rate=3.5
     * WHEN building header rows
     * THEN total_moneda_original equals 100 (350/3.5)
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-usd",
        currency: "USD",
        total: 350,
        exchange_rate: 3.5,
      }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);

    expect(rows[0].total_moneda_original).toBe(100);
    expect(rows[0].total_soles).toBe(350);
    expect(rows[0].moneda).toBe("USD");
    expect(rows[0].tipo_cambio).toBe(3.5);
  });

  it("GIVEN USD voucher with exchange_rate=3.375 -> tipo_cambio preserves all decimals", () => {
    /**
     * GIVEN a USD voucher with exchange_rate=3.375 (3 decimal digits)
     * WHEN building header rows
     * THEN tipo_cambio is 3.375 (not rounded to 3.38)
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-usd-3dec",
        currency: "USD",
        total: 337.5,
        exchange_rate: 3.375,
      }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);

    expect(rows[0].tipo_cambio).toBe(3.375);
  });

  it("GIVEN voucher with null modified_doc fields -> columns 29-33 are empty strings", () => {
    /**
     * GIVEN a voucher (modified_doc not available in frontend API)
     * WHEN building header rows
     * THEN modified doc fields are empty strings
     */
    const vouchers = [makeVoucher({ id: "vchr-nomod" })];
    const rows = buildHeaderRows(vouchers, RUC, NAME);

    expect(rows[0].fecha_emision_mod).toBe("");
    expect(rows[0].tipo_cp_mod).toBe("");
    expect(rows[0].serie_cp_mod).toBe("");
    expect(rows[0].cod_dam_dsi).toBe("");
    expect(rows[0].nro_cp_mod).toBe("");
  });

  it("GIVEN voucher with validation_status='observado' -> validacion column = 'observado'", () => {
    /**
     * GIVEN a voucher with validation_status="observado"
     * WHEN building header rows
     * THEN the validacion field is "observado"
     */
    const vouchers = [
      makeVoucher({ id: "vchr-obs", validation_status: "observado" }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);
    expect(rows[0].validacion).toBe("observado");
  });

  it("GIVEN description_summary with @@ -> replaced with spaces", () => {
    /**
     * GIVEN a voucher with description_summary containing @@ separators
     * WHEN building header rows
     * THEN @@ is replaced with spaces
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-desc",
        description_summary: "Item A@@Item B@@Item C",
      }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);
    expect(rows[0].descripcion).toBe("Item A Item B Item C");
  });

  it("GIVEN voucher with emission_date -> anio is derived correctly", () => {
    /**
     * GIVEN a voucher with emission_date in DD/MM/YYYY format
     * WHEN building header rows
     * THEN the anio field is the year extracted from emission_date
     */
    const vouchers = [
      makeVoucher({ id: "vchr-year", emission_date: "20/06/2024" }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);
    expect(rows[0].anio).toBe("2024");
  });

  it("GIVEN column definitions -> HEADER_COLUMNS has 40 columns", () => {
    /**
     * GIVEN the HEADER_COLUMNS constant
     * WHEN checking its length
     * THEN it has exactly 40 columns (35 SIRE + 5 detraction payment fields)
     */
    expect(HEADER_COLUMNS).toHaveLength(40);
  });

  it("GIVEN voucher with detraction_payment.validated=true -> all 5 detraction columns populated", () => {
    /**
     * GIVEN a voucher with confirmed detraction payment (real data from merkicont_dev, period 202603)
     *   detraction_payment: { validated: true, num_constancia: "300295781", num_cuenta: "00023048523",
     *                         fec_pago: "17/03/2026", mto_detraccion: 208, validated_at: "2026-04-09T03:49:25.218Z" }
     * WHEN building header rows
     * THEN columns 35-39 show payment data and column 40 (validacion) is last
     */
    const vouchers = [
      makeVoucher({
        id: "voucher-20601809045-01-FF01-1152",
        detraction: "D",
        detraction_payment: {
          validated: true,
          num_constancia: "300295781",
          num_cuenta: "00023048523",
          fec_pago: "17/03/2026",
          mto_detraccion: 208,
          validated_at: "2026-04-09T03:49:25.218Z",
          source: "auto",
        },
        validation_status: "valido",
      }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);
    const row = rows[0];

    expect(row.detraccion).toBe("D");
    expect(row.fecha_pago_detraccion).toBe("17/03/2026");
    expect(row.constancia_pago_detraccion).toBe("300295781");
    expect(row.monto_pago_detraccion).toBe(208);
    expect(row.cuenta_pago_detraccion).toBe("00023048523");
    expect(row.fecha_consulta_detraccion).toBe("09/04/2026");
    // Validacion must remain the last key
    const keys = Object.keys(row);
    expect(keys[keys.length - 1]).toBe("validacion");
  });

  it("GIVEN voucher without detraction_payment -> detraction columns are empty/null", () => {
    /**
     * GIVEN a voucher with no detraction payment data
     * WHEN building header rows
     * THEN columns 35-39 are empty strings / null
     */
    const vouchers = [makeVoucher({ id: "vchr-no-detraction" })];
    const rows = buildHeaderRows(vouchers, RUC, NAME);
    const row = rows[0];

    expect(row.fecha_pago_detraccion).toBe("");
    expect(row.constancia_pago_detraccion).toBe("");
    expect(row.monto_pago_detraccion).toBeNull();
    expect(row.cuenta_pago_detraccion).toBe("");
    expect(row.fecha_consulta_detraccion).toBe("");
  });

  it("GIVEN voucher with detraction_payment.validated=false -> monto is null (not 0)", () => {
    /**
     * GIVEN a voucher with detraction_payment present but not yet validated
     * WHEN building header rows
     * THEN monto_pago_detraccion is null so Excel cell appears empty (not 0.00)
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-not-validated",
        detraction: "D",
        detraction_payment: {
          validated: false,
          num_constancia: "",
          num_cuenta: "",
          fec_pago: "",
          mto_detraccion: 0,
          validated_at: "",
          source: "auto",
        },
      }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);
    expect(rows[0].monto_pago_detraccion).toBeNull();
  });

  it("GIVEN detraction monto with decimals -> rounded to 2dp", () => {
    /**
     * GIVEN a validated detraction with mto_detraccion = 173.555
     * WHEN building header rows
     * THEN monto_pago_detraccion is 173.56 (rounded 2dp)
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-det-decimal",
        detraction: "D",
        detraction_payment: {
          validated: true,
          num_constancia: "299026621",
          num_cuenta: "00023048523",
          fec_pago: "05/03/2026",
          mto_detraccion: 173.555,
          validated_at: "2026-04-09T03:49:25.195Z",
          source: "auto",
        },
      }),
    ];
    const rows = buildHeaderRows(vouchers, RUC, NAME);
    expect(rows[0].monto_pago_detraccion).toBe(173.56);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildItemRows
// ─────────────────────────────────────────────────────────────────────────────

describe("buildItemRows", () => {
  it("GIVEN empty vouchers array -> returns empty rows array", () => {
    /**
     * GIVEN no vouchers
     * WHEN building item rows
     * THEN returns an empty array
     */
    const rows = buildItemRows([], RUC, NAME);
    expect(rows).toHaveLength(0);
  });

  it("GIVEN voucher with detail_status='pending' -> generates empty row (no item lines yet)", () => {
    /**
     * GIVEN a voucher whose detail has not been extracted yet (pending)
     * WHEN building item rows
     * THEN one empty row is generated (voucher is still present in the export)
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-pending",
        detail_status: "pending",
        description_summary: "Factura pendiente",
        // no detail_data / items — not yet extracted
      }),
    ];
    const rows = buildItemRows(vouchers, RUC, NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0].descripcion_item).toBeNull();
    expect(rows[0].valor_unitario).toBeNull();
    expect(rows[0].total_venta).toBeNull();
  });

  it("GIVEN voucher with 3 items -> generates 3 rows with parent data repeated", () => {
    /**
     * GIVEN a completed voucher with 3 items in detail_data
     * WHEN building item rows
     * THEN 3 rows are generated, each carrying the parent voucher's base fields
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-3items",
        detail_status: "completed",
        detail_data: {
          comprobantes: [
            {
              informacionItems: [
                { desItem: "Item A", mtoValUnitario: 100, mtoImpTotal: 118 },
                { desItem: "Item B", mtoValUnitario: 200, mtoImpTotal: 236 },
                { desItem: "Item C", mtoValUnitario: 50, mtoImpTotal: 59 },
              ],
            },
          ],
        },
      }),
    ];
    const rows = buildItemRows(vouchers, RUC, NAME);

    expect(rows).toHaveLength(3);
    // All rows carry the parent's base fields
    expect(rows[0].ruc).toBe(RUC);
    expect(rows[1].ruc).toBe(RUC);
    expect(rows[2].ruc).toBe(RUC);
    // Each row has its own item description
    expect(rows[0].descripcion_item).toBe("Item A");
    expect(rows[1].descripcion_item).toBe("Item B");
    expect(rows[2].descripcion_item).toBe("Item C");
    // Item-specific numeric fields: valor_unitario and total_venta
    expect(rows[0].valor_unitario).toBe(100);
    expect(rows[0].total_venta).toBe(118);
    expect(rows[1].valor_unitario).toBe(200);
    expect(rows[1].total_venta).toBe(236);
    // Parent voucher currency fields are carried through to each row
    expect(rows[0].moneda).toBe("PEN");
    expect(rows[1].moneda).toBe("PEN");
    expect(rows[2].moneda).toBe("PEN");
  });

  it("GIVEN voucher with detail_status='completed' but no items -> generates empty row", () => {
    /**
     * GIVEN a completed voucher with empty items array
     * WHEN building item rows
     * THEN one empty row is generated so the voucher appears in the export
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-no-items",
        detail_status: "completed",
        detail_data: {
          comprobantes: [{ informacionItems: [] }],
        },
      }),
    ];
    const rows = buildItemRows(vouchers, RUC, NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0].valor_unitario).toBeNull();
    expect(rows[0].total_venta).toBeNull();
  });

  it("GIVEN voucher with no detail_data -> generates empty row", () => {
    /**
     * GIVEN a completed voucher but detail_data is undefined
     * WHEN building item rows
     * THEN one empty row is generated
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-no-detail",
        detail_status: "completed",
        detail_data: undefined,
      }),
    ];
    const rows = buildItemRows(vouchers, RUC, NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0].valor_unitario).toBeNull();
  });

  it("GIVEN mix of completed and pending vouchers -> all appear; items-filled rows have item data", () => {
    /**
     * GIVEN 3 vouchers: 1 completed with 2 items, 1 pending with items in detail_data, 1 completed with no items
     * WHEN building item rows
     * THEN 4 rows total: 2 item rows from the first voucher + 1 empty row for pending + 1 empty row for no-items
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-ok",
        detail_status: "completed",
        detail_data: {
          comprobantes: [
            {
              informacionItems: [
                { desItem: "Item X", mtoValUnitario: 50, mtoImpTotal: 59 },
                { desItem: "Item Y", mtoValUnitario: 75, mtoImpTotal: 88.5 },
              ],
            },
          ],
        },
      }),
      makeVoucher({
        id: "vchr-pending",
        detail_status: "pending",
        detail_data: {
          comprobantes: [
            {
              informacionItems: [
                { desItem: "Ignored", mtoValUnitario: 10, mtoImpTotal: 11.8 },
              ],
            },
          ],
        },
      }),
      makeVoucher({
        id: "vchr-empty",
        detail_status: "completed",
        detail_data: { comprobantes: [{ informacionItems: [] }] },
      }),
    ];
    const rows = buildItemRows(vouchers, RUC, NAME);
    expect(rows).toHaveLength(4);
    expect(rows[0].descripcion_item).toBe("Item X");
    expect(rows[1].descripcion_item).toBe("Item Y");
  });

  it("GIVEN item description with @@ -> replaced with spaces", () => {
    /**
     * GIVEN an item with desItem containing @@ separators
     * WHEN building item rows
     * THEN @@ is replaced with spaces
     */
    const vouchers = [
      makeVoucher({
        id: "vchr-at",
        detail_status: "completed",
        detail_data: {
          comprobantes: [
            {
              informacionItems: [
                {
                  desItem: "Servicio@@Consultoría",
                  mtoValUnitario: 100,
                  mtoImpTotal: 118,
                },
              ],
            },
          ],
        },
      }),
    ];
    const rows = buildItemRows(vouchers, RUC, NAME);
    expect(rows[0].descripcion_item).toBe("Servicio Consultoría");
  });

  it("GIVEN column definitions -> ITEM_COLUMNS has 23 columns", () => {
    /**
     * GIVEN the ITEM_COLUMNS constant
     * WHEN checking its length
     * THEN it has exactly 23 columns per issue #25 layout
     */
    expect(ITEM_COLUMNS).toHaveLength(23);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filename helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("filename helpers", () => {
  it("headersFilename generates correct pattern", () => {
    /**
     * GIVEN a RUC and period
     * WHEN generating the headers filename
     * THEN it follows the convention Compras_Cabeceras_{RUC}_{PERIOD}.xlsx
     */
    expect(headersFilename("20123456789", "202501")).toBe(
      "Compras_Cabeceras_20123456789_202501.xlsx",
    );
  });

  it("itemsFilename generates correct pattern", () => {
    /**
     * GIVEN a RUC and period
     * WHEN generating the items filename
     * THEN it follows the convention Compras_Items_{RUC}_{PERIOD}.xlsx
     */
    expect(itemsFilename("20123456789", "202501")).toBe(
      "Compras_Items_20123456789_202501.xlsx",
    );
  });
});
