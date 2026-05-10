/**
 * Unit tests for the SIRE TXT generator (src/lib/sire-txt.ts).
 *
 * Tests cover:
 *  - File name generation (generateSireFileName)
 *  - Field formatting helpers (fmt2, fmt3)
 *  - Business rules: RN-01 (filtering), RN-08 (sorting), RN-09/RN-10 (fixed fields), RN-11 (exchange rate)
 *  - Edge cases: empty list, all excluded, fallback fields, exact line format
 */
import { describe, it, expect } from "vitest";
import {
  fmt2,
  fmt3,
  generateSireFileName,
  generateSireTxt,
  downloadTxtFile,
} from "@/lib/sire-txt";
import type { Voucher } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "vchr-test-001",
    tenant_id: "tnnt-test",
    company_id: "comp-test",
    period: "202602",
    supplier_ruc: "20123456789",
    supplier_name: "PROVEEDOR SAC",
    voucher_type: "01",
    voucher_type_label: "Factura",
    series: "F001",
    number: "00001234",
    currency: "PEN",
    total: 1180,
    detail_status: "completed",
    validation_status: "valido",
    has_detail: true,
    created_at: "2026-02-01T00:00:00Z",
    // SIRE amounts
    emission_date: "01/02/2026",
    taxable_base_dg: 1000,
    igv_ipm_dg: 180,
    taxable_base_dgng: 0,
    igv_ipm_dgng: 0,
    taxable_base_dng: 0,
    igv_ipm_dng: 0,
    non_taxed_acq_value: 0,
    isc: 0,
    icbper: 0,
    other_taxes_charges: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// fmt2
// ─────────────────────────────────────────────────────────────────────────────

describe("fmt2", () => {
  it("GIVEN a positive number → formats to 2 decimal places", () => {
    /**
     * GIVEN a numeric value
     * WHEN formatting to 2 decimals
     * THEN returns string with 2 decimal places
     */
    expect(fmt2(1000)).toBe("1000.00");
    expect(fmt2(180.5)).toBe("180.50");
    expect(fmt2(0)).toBe("0.00");
  });

  it("GIVEN null → returns '0.00'", () => {
    /**
     * GIVEN null
     * WHEN formatting
     * THEN returns "0.00"
     */
    expect(fmt2(null)).toBe("0.00");
  });

  it("GIVEN undefined → returns '0.00'", () => {
    /**
     * GIVEN undefined
     * WHEN formatting
     * THEN returns "0.00"
     */
    expect(fmt2(undefined)).toBe("0.00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fmt3
// ─────────────────────────────────────────────────────────────────────────────

describe("fmt3", () => {
  it("GIVEN a number → formats to 3 decimal places", () => {
    /**
     * GIVEN a numeric value
     * WHEN formatting to 3 decimals
     * THEN returns string with 3 decimal places
     */
    expect(fmt3(3.658)).toBe("3.658");
    expect(fmt3(3.5)).toBe("3.500");
  });

  it("GIVEN null → returns empty string", () => {
    /**
     * GIVEN null
     * WHEN formatting
     * THEN returns ""
     */
    expect(fmt3(null)).toBe("");
  });

  it("GIVEN undefined → returns empty string", () => {
    /**
     * GIVEN undefined
     * WHEN formatting
     * THEN returns ""
     */
    expect(fmt3(undefined)).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateSireFileName
// ─────────────────────────────────────────────────────────────────────────────

describe("generateSireFileName", () => {
  it("GIVEN RUC 20611404426 and period 202602 → produces correct SUNAT filename", () => {
    /**
     * GIVEN a company RUC and a period
     * WHEN generating the SIRE TXT filename
     * THEN the name follows LE{RUC}{AAAA}{MM}00080400{CC}{O}{I}{M}{G}.txt
     */
    const filename = generateSireFileName("20611404426", "202602");
    expect(filename).toBe("LE2061140442620260200080400021112.txt");
  });

  it("GIVEN period 202412 → year=2024 month=12 in filename", () => {
    /**
     * GIVEN a different period
     * WHEN generating the filename
     * THEN year and month are extracted correctly
     */
    const filename = generateSireFileName("20500000001", "202412");
    expect(filename).toBe("LE2050000000120241200080400021112.txt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateSireTxt — business rules
// ─────────────────────────────────────────────────────────────────────────────

describe("generateSireTxt", () => {
  it("GIVEN empty array → returns empty string", () => {
    /**
     * GIVEN no vouchers
     * WHEN generating the TXT
     * THEN result is an empty string
     */
    const result = generateSireTxt([], "20611404426", "ABC SAC", "202602");
    expect(result).toBe("");
  });

  it("GIVEN all vouchers are observado/rechazado → returns empty string", () => {
    /**
     * GIVEN all vouchers are observado or rechazado
     * WHEN generating the TXT
     * THEN result is an empty string (no eligible vouchers)
     */
    const vouchers = [
      makeVoucher({ validation_status: "observado" }),
      makeVoucher({ id: "vchr-2", validation_status: "rechazado" }),
    ];
    const result = generateSireTxt(
      vouchers,
      "20611404426",
      "ABC SAC",
      "202602",
    );
    expect(result).toBe("");
  });

  it("RN-01: voucher with validation_status=valido is included", () => {
    /**
     * GIVEN a valido voucher
     * WHEN generating the TXT
     * THEN the result is non-empty
     */
    const v = makeVoucher({ validation_status: "valido" });
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    expect(result).not.toBe("");
  });

  it("RN-01: voucher without validation_status is included (treated as valid)", () => {
    /**
     * GIVEN a voucher without validation_status field
     * WHEN generating the TXT
     * THEN that voucher IS included (treated as valid per RN-01)
     */
    // @ts-expect-error intentionally omit validation_status to test RN-01
    const v = makeVoucher({ validation_status: undefined });
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    expect(result).not.toBe("");
    expect(result.split("\n")).toHaveLength(1);
  });

  it("RN-01: observado and rechazado vouchers are excluded — specific IDs verified", () => {
    /**
     * GIVEN a mix of valido, observado, rechazado vouchers (4 total)
     * WHEN generating the TXT
     * THEN:
     *   - Only the 2 valido vouchers (v1: F001/001, v4: F001/004) appear
     *   - observado (v2: F001/002) is NOT present in any line
     *   - rechazado (v3: F001/003) is NOT present in any line
     *
     * State-mutation pattern (unit level):
     *   Baseline:  [v1=valido, v2=observado, v3=rechazado, v4=valido] → 2 lines
     *   Mutation:  mark v4 as observado                               → 1 line
     *   Restore:   mark v4 back to valido                             → 2 lines
     */
    const baseVouchers = [
      makeVoucher({
        id: "v1",
        validation_status: "valido",
        series: "F001",
        number: "001",
      }),
      makeVoucher({
        id: "v2",
        validation_status: "observado",
        series: "F001",
        number: "002",
      }),
      makeVoucher({
        id: "v3",
        validation_status: "rechazado",
        series: "F001",
        number: "003",
      }),
      makeVoucher({
        id: "v4",
        validation_status: "valido",
        series: "F001",
        number: "004",
      }),
    ];

    // ── BASELINE ──────────────────────────────────────────────────────────
    const baseline = generateSireTxt(
      baseVouchers,
      "20611404426",
      "ABC SAC",
      "202602",
    );
    const baseLines = baseline.split("\n");

    // Assert count
    expect(baseLines).toHaveLength(2);

    // Assert WHICH vouchers are PRESENT (series + number columns)
    expect(
      baseLines.some((l) => l.includes("|F001|") && l.includes("|001|")),
    ).toBe(true); // v1 in
    expect(
      baseLines.some((l) => l.includes("|F001|") && l.includes("|004|")),
    ).toBe(true); // v4 in

    // Assert WHICH vouchers are ABSENT
    expect(
      baseLines.some((l) => l.includes("|F001|") && l.includes("|002|")),
    ).toBe(false); // v2 (observado) out
    expect(
      baseLines.some((l) => l.includes("|F001|") && l.includes("|003|")),
    ).toBe(false); // v3 (rechazado) out

    // ── MUTATION: flip v4 from valido → observado ─────────────────────────
    const mutatedVouchers = baseVouchers.map((v) =>
      v.id === "v4" ? { ...v, validation_status: "observado" as const } : v,
    );
    const mutated = generateSireTxt(
      mutatedVouchers,
      "20611404426",
      "ABC SAC",
      "202602",
    );
    const mutatedLines = mutated.split("\n");

    expect(mutatedLines).toHaveLength(1);
    expect(
      mutatedLines.some((l) => l.includes("|F001|") && l.includes("|001|")),
    ).toBe(true); // v1 still in
    expect(
      mutatedLines.some((l) => l.includes("|F001|") && l.includes("|004|")),
    ).toBe(false); // v4 now out

    // ── RESTORE: flip v4 back to valido ────────────────────────────────────
    const restoredVouchers = mutatedVouchers.map((v) =>
      v.id === "v4" ? { ...v, validation_status: "valido" as const } : v,
    );
    const restored = generateSireTxt(
      restoredVouchers,
      "20611404426",
      "ABC SAC",
      "202602",
    );
    const restoredLines = restored.split("\n");

    expect(restoredLines).toHaveLength(2); // back to baseline
    expect(
      restoredLines.some((l) => l.includes("|F001|") && l.includes("|004|")),
    ).toBe(true); // v4 back in
  });

  it("RN-08: vouchers are sorted by series asc then number asc", () => {
    /**
     * GIVEN vouchers in random order
     * WHEN generating the TXT
     * THEN lines appear sorted by series then number ascending
     */
    const vouchers = [
      makeVoucher({ id: "v3", series: "F002", number: "00000001" }),
      makeVoucher({ id: "v1", series: "F001", number: "00000002" }),
      makeVoucher({ id: "v2", series: "F001", number: "00000001" }),
    ];
    const result = generateSireTxt(
      vouchers,
      "20611404426",
      "ABC SAC",
      "202602",
    );
    const lines = result.split("\n");
    expect(lines).toHaveLength(3);
    // line[0] → F001/00000001
    expect(lines[0]).toContain("|F001|");
    expect(lines[0]).toContain("|00000001|");
    // line[1] → F001/00000002
    expect(lines[1]).toContain("|F001|");
    expect(lines[1]).toContain("|00000002|");
    // line[2] → F002/00000001
    expect(lines[2]).toContain("|F002|");
  });

  it("RN-06/RN-07: each line has exactly 37 pipe-separated fields", () => {
    /**
     * GIVEN a complete voucher
     * WHEN generating the TXT
     * THEN each line has exactly 37 pipe-separated fields
     */
    const v = makeVoucher();
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    const fields = result.split("|");
    expect(fields).toHaveLength(37);
  });

  it("RN-09: field 04 (CAR SUNAT) is always empty → two consecutive pipes", () => {
    /**
     * GIVEN any voucher
     * WHEN field 04 (CAR SUNAT) is mapped
     * THEN it is always empty (two consecutive "|" at that position)
     */
    const v = makeVoucher();
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    const fields = result.split("|");
    // field 04 is index 3 (0-indexed)
    expect(fields[3]).toBe("");
  });

  it("RN-10: field 37 (estado rectificatoria) is always empty", () => {
    /**
     * GIVEN any voucher
     * WHEN field 37 is mapped
     * THEN it is always empty
     */
    const v = makeVoucher();
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    const fields = result.split("|");
    expect(fields[36]).toBe("");
  });

  it("RN-11: exchange rate field is empty for PEN voucher", () => {
    /**
     * GIVEN a voucher with currency=PEN
     * WHEN generating field 27 (tipo de cambio)
     * THEN field 27 is empty
     */
    const v = makeVoucher({ currency: "PEN" });
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    const fields = result.split("|");
    // field 26 = currency (index 25), field 27 = exchange rate (index 26)
    expect(fields[25]).toBe("PEN");
    expect(fields[26]).toBe("");
  });

  it("RN-11: exchange rate has 3 decimals for non-PEN voucher", () => {
    /**
     * GIVEN a voucher with currency=USD and exchange_rate=3.658
     * WHEN generating field 27 (tipo de cambio)
     * THEN field 27 contains "3.658"
     */
    const v = makeVoucher({ currency: "USD", exchange_rate: 3.658 });
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    const fields = result.split("|");
    expect(fields[25]).toBe("USD");
    expect(fields[26]).toBe("3.658");
  });

  it("GIVEN companyRuc and companyName → they appear in fields 01 and 02", () => {
    /**
     * GIVEN companyRuc="20611404426" and companyName="ABC SAC"
     * WHEN generating the TXT
     * THEN field 01 is the RUC and field 02 is the company name
     */
    const v = makeVoucher();
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    const fields = result.split("|");
    expect(fields[0]).toBe("20611404426");
    expect(fields[1]).toBe("ABC SAC");
  });

  it("GIVEN valid voucher → field 03 uses voucher period", () => {
    /**
     * GIVEN a voucher with period="202602"
     * WHEN generating the TXT
     * THEN field 03 contains "202602"
     */
    const v = makeVoucher({ period: "202602" });
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    const fields = result.split("|");
    expect(fields[2]).toBe("202602");
  });

  it("GIVEN voucher with null period → field 03 falls back to period param", () => {
    /**
     * GIVEN a voucher without period field
     * WHEN generating the TXT with period param "202602"
     * THEN field 03 uses the fallback period "202602"
     */
    const v = makeVoucher({ period: undefined as unknown as string });
    const result = generateSireTxt([v], "20611404426", "ABC SAC", "202602");
    const fields = result.split("|");
    expect(fields[2]).toBe("202602");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// downloadTxtFile — smoke test (DOM interaction)
// ─────────────────────────────────────────────────────────────────────────────

describe("downloadTxtFile", () => {
  it("GIVEN content and filename → creates and revokes a blob URL", () => {
    /**
     * GIVEN file content and a filename
     * WHEN calling downloadTxtFile
     * THEN it creates a blob URL and triggers download without throwing
     */
    // jsdom does not implement createObjectURL so we mock it
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
    });

    expect(() =>
      downloadTxtFile("field1|field2", "LE2061140442620260200080400021112.txt"),
    ).not.toThrow();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });
});
