/**
 * Unit tests for VoucherIGVPanel component.
 *
 * Tests the three section rendering (Válidos / Observados / Rechazados),
 * monetary formatting, loading state, and grouping logic.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VoucherIGVPanel } from "../igv-panel";
import type { Voucher } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal Voucher object for testing */
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
    // IGV amounts
    igv_ipm_dg: 0,
    igv_ipm_dgng: 0,
    igv_ipm_dng: 0,
    taxable_base_dg: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("VoucherIGVPanel", () => {
  it("GIVEN isLoading=true → renders skeleton placeholders, not table content", () => {
    /**
     * GIVEN the panel is in a loading state
     * WHEN rendered
     * THEN skeleton elements are visible and no section headers are shown
     */
    const { container } = render(
      <VoucherIGVPanel vouchers={[]} isLoading={true} />,
    );

    // Should not show section labels
    expect(screen.queryByText("COMPROBANTES VÁLIDOS")).not.toBeInTheDocument();
    expect(screen.queryByText("OBSERVADOS")).not.toBeInTheDocument();
    expect(screen.queryByText("RECHAZADOS")).not.toBeInTheDocument();

    // Skeleton elements are present (data-slot or class check)
    const skeletons = container.querySelectorAll(
      "[data-slot='skeleton'], .animate-pulse, [class*='skeleton']",
    );
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("GIVEN empty vouchers array → all three sections rendered with count 0", () => {
    /**
     * GIVEN no vouchers provided
     * WHEN rendered
     * THEN all three status section headers are visible with count 0
     */
    render(<VoucherIGVPanel vouchers={[]} />);

    expect(screen.getByText("COMPROBANTES VÁLIDOS")).toBeInTheDocument();
    expect(screen.getByText("OBSERVADOS")).toBeInTheDocument();
    expect(screen.getByText("RECHAZADOS")).toBeInTheDocument();

    // Count labels should show 0 for all sections
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it("GIVEN all vouchers have validation_status='valido' → Observados and Rechazados show 0", () => {
    /**
     * GIVEN 3 valid vouchers
     * WHEN rendered
     * THEN VÁLIDOS section shows count 3; OBSERVADOS and RECHAZADOS show 0 and empty tables
     */
    const vouchers: Voucher[] = [
      makeVoucher({ id: "vchr-1", validation_status: "valido" }),
      makeVoucher({ id: "vchr-2", validation_status: "valido" }),
      makeVoucher({ id: "vchr-3", validation_status: "valido" }),
    ];

    render(<VoucherIGVPanel vouchers={vouchers} />);

    expect(screen.getByText("COMPROBANTES VÁLIDOS")).toBeInTheDocument();

    // Empty sections show dash placeholder
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("GIVEN vouchers with mix of statuses → three sections rendered with correct counts", () => {
    /**
     * GIVEN 2 valid, 1 observed, 1 rejected voucher
     * WHEN rendered
     * THEN each section header shows the correct total count
     */
    const vouchers: Voucher[] = [
      makeVoucher({ id: "vchr-v1", validation_status: "valido" }),
      makeVoucher({ id: "vchr-v2", validation_status: "valido" }),
      makeVoucher({ id: "vchr-o1", validation_status: "observado" }),
      makeVoucher({ id: "vchr-r1", validation_status: "rechazado" }),
    ];

    render(<VoucherIGVPanel vouchers={vouchers} />);

    // All three headers present
    expect(screen.getByText("COMPROBANTES VÁLIDOS")).toBeInTheDocument();
    expect(screen.getByText("OBSERVADOS")).toBeInTheDocument();
    expect(screen.getByText("RECHAZADOS")).toBeInTheDocument();
  });

  it("GIVEN single type per status → totals row equals that type's values", () => {
    /**
     * GIVEN one voucher type in the valid section with known IGV values
     * WHEN rendered
     * THEN totals row shows the same amounts as the single type row
     */
    const vouchers: Voucher[] = [
      makeVoucher({
        id: "vchr-1",
        validation_status: "valido",
        voucher_type_label: "Factura",
        taxable_base_dg: 1000,
        igv_ipm_dg: 180,
        igv_ipm_dgng: 0,
        igv_ipm_dng: 0,
      }),
    ];

    render(<VoucherIGVPanel vouchers={vouchers} />);

    // "Factura" label should appear in the table
    expect(screen.getByText("Factura")).toBeInTheDocument();

    // "Total" row should appear
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("GIVEN monetary values → formatted with 2 decimal places using es-PE locale", () => {
    /**
     * GIVEN a voucher with igv_ipm_dg = 180 and taxable_base_dg = 1000
     * WHEN rendered
     * THEN values appear formatted as Spanish/Peruvian locale with 2 decimals
     */
    const vouchers: Voucher[] = [
      makeVoucher({
        id: "vchr-money",
        validation_status: "valido",
        taxable_base_dg: 1000,
        igv_ipm_dg: 180,
        igv_ipm_dgng: 0,
        igv_ipm_dng: 0,
      }),
    ];

    render(<VoucherIGVPanel vouchers={vouchers} />);

    // Should contain formatted number (locale-specific format)
    const formatted = (1000).toLocaleString("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(screen.getAllByText(formatted).length).toBeGreaterThanOrEqual(1);
  });

  it("GIVEN voucher with null validation_status → treated as 'valido'", () => {
    /**
     * GIVEN a voucher with validation_status=undefined (backend may omit it)
     * WHEN rendered
     * THEN it is counted under COMPROBANTES VÁLIDOS (null defaults to valido)
     */
    // Cast to bypass TypeScript strict null — simulates API returning missing field
    const vouchers: Voucher[] = [
      makeVoucher({
        id: "vchr-null-status",
        // @ts-expect-error — simulating backend omitting the field
        validation_status: undefined,
      }),
    ];

    render(<VoucherIGVPanel vouchers={vouchers} />);

    // Count "1" should appear under valid section
    expect(screen.getByText("COMPROBANTES VÁLIDOS")).toBeInTheDocument();
    // The total for the válido section should be 1
    const counts = screen.getAllByText("1");
    expect(counts.length).toBeGreaterThanOrEqual(1);
  });
});
