/**
 * Unit tests for the mergedRows merge logic.
 *
 * The merge function joins compras (purchases) and ventas (sales) stats by
 * company_id. Compras companies are the primary list; ventas-only companies
 * are appended at the end.
 */
import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Types mirroring the production code
// ─────────────────────────────────────────────────────────────────────────────

interface ComprasItem {
  company_id: string;
  ruc: string;
  business_name: string;
  total_count: number;
  is_declared: boolean;
}

interface VentasItem {
  company_id: string;
  ruc: string;
  business_name: string;
  total: number;
}

interface UnifiedCompanyRow {
  company_id: string;
  ruc: string;
  business_name: string;
  compras_count: number;
  ventas_count: number;
  is_declared: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure merge function (extracted from the useMemo in page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

function mergeCompanyRows(
  comprasItems: ComprasItem[],
  ventasItems: VentasItem[],
): UnifiedCompanyRow[] {
  const ventasMap = new Map(ventasItems.map((v) => [v.company_id, v]));
  const comprasSet = new Set(comprasItems.map((c) => c.company_id));

  const rows: UnifiedCompanyRow[] = comprasItems.map((c) => ({
    company_id: c.company_id,
    ruc: c.ruc,
    business_name: c.business_name,
    compras_count: c.total_count,
    ventas_count: ventasMap.get(c.company_id)?.total ?? 0,
    is_declared: c.is_declared,
  }));

  // Append ventas-only companies (edge case)
  for (const v of ventasItems) {
    if (!comprasSet.has(v.company_id)) {
      rows.push({
        company_id: v.company_id,
        ruc: v.ruc,
        business_name: v.business_name,
        compras_count: 0,
        ventas_count: v.total,
        is_declared: false,
      });
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("mergeCompanyRows", () => {
  it("GIVEN both arrays empty → returns []", () => {
    /**
     * GIVEN no data in either compras or ventas
     * WHEN merging
     * THEN returns an empty array
     */
    const result = mergeCompanyRows([], []);
    expect(result).toEqual([]);
  });

  it("GIVEN compras-only companies → ventas_count is 0 for each", () => {
    /**
     * GIVEN 2 companies with compras data but no ventas data
     * WHEN merging
     * THEN ventas_count is 0 for every row, compras_count is preserved
     */
    const compras: ComprasItem[] = [
      {
        company_id: "comp-001",
        ruc: "20100000001",
        business_name: "Empresa A SAC",
        total_count: 150,
        is_declared: false,
      },
      {
        company_id: "comp-002",
        ruc: "20100000002",
        business_name: "Empresa B EIRL",
        total_count: 30,
        is_declared: true,
      },
    ];

    const result = mergeCompanyRows(compras, []);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      company_id: "comp-001",
      compras_count: 150,
      ventas_count: 0,
      is_declared: false,
    });
    expect(result[1]).toMatchObject({
      company_id: "comp-002",
      compras_count: 30,
      ventas_count: 0,
      is_declared: true,
    });
  });

  it("GIVEN ventas-only companies → appended at end with compras_count=0 and is_declared=false", () => {
    /**
     * GIVEN a company that appears only in ventas (no compras record)
     * WHEN merging
     * THEN that company is appended at the end with compras_count=0 and is_declared=false
     */
    const ventas: VentasItem[] = [
      {
        company_id: "comp-ventas-only",
        ruc: "20100000099",
        business_name: "Solo Ventas SRL",
        total: 80,
      },
    ];

    const result = mergeCompanyRows([], ventas);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      company_id: "comp-ventas-only",
      compras_count: 0,
      ventas_count: 80,
      is_declared: false,
    });
  });

  it("GIVEN companies in both datasets → counts populated independently", () => {
    /**
     * GIVEN 2 companies present in both compras and ventas
     * WHEN merging
     * THEN each row has both compras_count and ventas_count correctly populated
     */
    const compras: ComprasItem[] = [
      {
        company_id: "comp-A",
        ruc: "20111111111",
        business_name: "Alpha SAC",
        total_count: 200,
        is_declared: true,
      },
      {
        company_id: "comp-B",
        ruc: "20222222222",
        business_name: "Beta SRL",
        total_count: 50,
        is_declared: false,
      },
    ];
    const ventas: VentasItem[] = [
      {
        company_id: "comp-A",
        ruc: "20111111111",
        business_name: "Alpha SAC",
        total: 120,
      },
      {
        company_id: "comp-B",
        ruc: "20222222222",
        business_name: "Beta SRL",
        total: 35,
      },
    ];

    const result = mergeCompanyRows(compras, ventas);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      company_id: "comp-A",
      compras_count: 200,
      ventas_count: 120,
    });
    expect(result[1]).toMatchObject({
      company_id: "comp-B",
      compras_count: 50,
      ventas_count: 35,
    });
  });

  it("GIVEN mixed dataset → compras-first order, ventas-only appended at end", () => {
    /**
     * GIVEN compras companies + a ventas-only company
     * WHEN merging
     * THEN the compras companies come first in order, ventas-only appended last
     */
    const compras: ComprasItem[] = [
      {
        company_id: "comp-1",
        ruc: "20100000001",
        business_name: "Primero SAC",
        total_count: 10,
        is_declared: false,
      },
    ];
    const ventas: VentasItem[] = [
      {
        company_id: "comp-1",
        ruc: "20100000001",
        business_name: "Primero SAC",
        total: 5,
      },
      {
        company_id: "comp-2",
        ruc: "20100000002",
        business_name: "Solo Ventas SA",
        total: 99,
      },
    ];

    const result = mergeCompanyRows(compras, ventas);

    expect(result).toHaveLength(2);
    expect(result[0].company_id).toBe("comp-1");
    expect(result[0].ventas_count).toBe(5);
    expect(result[1].company_id).toBe("comp-2");
    expect(result[1].compras_count).toBe(0);
    expect(result[1].ventas_count).toBe(99);
  });

  it("GIVEN declared compras company → is_declared is true", () => {
    /**
     * GIVEN a company with is_declared=true in compras
     * WHEN merging
     * THEN the merged row preserves is_declared=true
     */
    const compras: ComprasItem[] = [
      {
        company_id: "comp-declared",
        ruc: "20300000001",
        business_name: "Declarada SA",
        total_count: 1,
        is_declared: true,
      },
    ];

    const result = mergeCompanyRows(compras, []);

    expect(result[0].is_declared).toBe(true);
  });
});
