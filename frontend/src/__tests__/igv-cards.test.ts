/**
 * Unit tests for the igvCards pure derivation logic.
 *
 * Mirrors the useMemo inside CompanyDetailView in page.tsx:
 *   igvVentas = sum(salesItems[].igv_ipm ?? 0)
 *   igvCompras = sum(purchaseItems[].igv_ipm_dg + igv_ipm_dgng + igv_ipm_dng)
 *   igvAPagar = igvVentas - igvCompras
 */
import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Types — minimal subset needed for derivation
// ─────────────────────────────────────────────────────────────────────────────

interface SalesVoucherForIgv {
  igv_ipm?: number | null;
}

interface PurchaseVoucherForIgv {
  igv_ipm_dg?: number | null;
  igv_ipm_dgng?: number | null;
  igv_ipm_dng?: number | null;
}

interface IgvCards {
  igvVentas: number;
  igvCompras: number;
  igvAPagar: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivation function (extracted from the useMemo in page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

function deriveIgvCards(
  salesItems: SalesVoucherForIgv[],
  purchaseItems: PurchaseVoucherForIgv[],
): IgvCards {
  const igvVentas = salesItems.reduce((sum, v) => sum + (v.igv_ipm ?? 0), 0);
  const igvCompras = purchaseItems.reduce(
    (sum, v) =>
      sum + (v.igv_ipm_dg ?? 0) + (v.igv_ipm_dgng ?? 0) + (v.igv_ipm_dng ?? 0),
    0,
  );
  return { igvVentas, igvCompras, igvAPagar: igvVentas - igvCompras };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("deriveIgvCards", () => {
  it("GIVEN empty arrays → all three values are 0", () => {
    /**
     * GIVEN no purchase or sales vouchers
     * WHEN deriving IGV cards
     * THEN igvVentas, igvCompras, igvAPagar are all 0
     */
    const result = deriveIgvCards([], []);
    expect(result.igvVentas).toBe(0);
    expect(result.igvCompras).toBe(0);
    expect(result.igvAPagar).toBe(0);
  });

  it("GIVEN sales vouchers with igv_ipm values → igvVentas sums correctly", () => {
    /**
     * GIVEN 3 sales vouchers each with igv_ipm
     * WHEN deriving IGV cards
     * THEN igvVentas equals the sum of all igv_ipm values
     */
    const sales: SalesVoucherForIgv[] = [
      { igv_ipm: 100 },
      { igv_ipm: 250.5 },
      { igv_ipm: 49.5 },
    ];

    const result = deriveIgvCards(sales, []);

    expect(result.igvVentas).toBeCloseTo(400);
    expect(result.igvCompras).toBe(0);
    expect(result.igvAPagar).toBeCloseTo(400);
  });

  it("GIVEN purchase vouchers with null igv_ipm_* fields → treated as 0", () => {
    /**
     * GIVEN purchase vouchers where igv_ipm_dg, igv_ipm_dgng, igv_ipm_dng are null/undefined
     * WHEN deriving IGV cards
     * THEN those fields are treated as 0 (no NaN, no crash)
     */
    const purchases: PurchaseVoucherForIgv[] = [
      { igv_ipm_dg: null, igv_ipm_dgng: null, igv_ipm_dng: null },
      {
        igv_ipm_dg: undefined,
        igv_ipm_dgng: undefined,
        igv_ipm_dng: undefined,
      },
      { igv_ipm_dg: 50 },
    ];

    const result = deriveIgvCards([], purchases);

    expect(result.igvCompras).toBe(50);
    expect(result.igvAPagar).toBe(-50);
  });

  it("GIVEN igvVentas < igvCompras → igvAPagar is negative", () => {
    /**
     * GIVEN purchases exceed sales in IGV
     * WHEN deriving IGV cards
     * THEN igvAPagar is negative (credit position)
     */
    const sales: SalesVoucherForIgv[] = [{ igv_ipm: 100 }];
    const purchases: PurchaseVoucherForIgv[] = [
      { igv_ipm_dg: 200, igv_ipm_dgng: 0, igv_ipm_dng: 0 },
    ];

    const result = deriveIgvCards(sales, purchases);

    expect(result.igvVentas).toBe(100);
    expect(result.igvCompras).toBe(200);
    expect(result.igvAPagar).toBe(-100);
  });

  it("GIVEN purchase vouchers with multiple IGV fields → all three summed per voucher", () => {
    /**
     * GIVEN a purchase voucher with all three IGV fields populated
     * WHEN deriving IGV cards
     * THEN igvCompras sums igv_ipm_dg + igv_ipm_dgng + igv_ipm_dng
     */
    const purchases: PurchaseVoucherForIgv[] = [
      { igv_ipm_dg: 10, igv_ipm_dgng: 5, igv_ipm_dng: 3 },
      { igv_ipm_dg: 20, igv_ipm_dgng: 0, igv_ipm_dng: 2 },
    ];

    const result = deriveIgvCards([], purchases);

    // 10+5+3 + 20+0+2 = 40
    expect(result.igvCompras).toBe(40);
  });

  it("GIVEN both sales and purchases → igvAPagar equals igvVentas minus igvCompras", () => {
    /**
     * GIVEN typical scenario with both sales and purchases
     * WHEN deriving IGV cards
     * THEN igvAPagar = igvVentas - igvCompras
     */
    const sales: SalesVoucherForIgv[] = [{ igv_ipm: 500 }, { igv_ipm: 300 }];
    const purchases: PurchaseVoucherForIgv[] = [
      { igv_ipm_dg: 200, igv_ipm_dgng: 50, igv_ipm_dng: 0 },
    ];

    const result = deriveIgvCards(sales, purchases);

    expect(result.igvVentas).toBe(800);
    expect(result.igvCompras).toBe(250);
    expect(result.igvAPagar).toBe(550);
  });
});
