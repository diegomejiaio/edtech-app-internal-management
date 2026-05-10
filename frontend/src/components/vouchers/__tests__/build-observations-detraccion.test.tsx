/**
 * Unit tests for buildObservations() — detraccion branch.
 *
 * buildObservations() is a pure function exported indirectly via ObservationsSection
 * but tested here at the data-derivation level by inspecting what ObservationsSection
 * renders.
 *
 * These tests focus on the "detraccion" observation entry:
 * - entry created when detraccion_validation is present and not lifted
 * - entry NOT created when lifted=true
 * - description string formatting (pct + monto, string porDetraccion)
 *
 * Mocks:
 *   - useLiftTCObservation        — returns stub mutation state
 *   - useLiftDetraccionObservation — returns stub mutation state
 *   - useAuthContext               — returns a stub getToken
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObservationsSection } from "../vouchers-table";
import type { Voucher, DetraccionValidation } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();

vi.mock("@/hooks/use-tc-observation", () => ({
  useLiftTCObservation: vi.fn(),
}));

vi.mock("@/hooks/use-detraccion-observation", () => ({
  useLiftDetraccionObservation: vi.fn(),
}));

vi.mock("@/hooks/use-amount-observation", () => ({
  useLiftAmountObservation: vi.fn(),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuthContext: vi.fn(() => ({ getToken: vi.fn().mockResolvedValue("tok") })),
}));

import { useLiftTCObservation } from "@/hooks/use-tc-observation";
import { useLiftDetraccionObservation } from "@/hooks/use-detraccion-observation";
import { useLiftAmountObservation } from "@/hooks/use-amount-observation";

const mockUseLiftTC = vi.mocked(useLiftTCObservation);
const mockUseLiftDetraccion = vi.mocked(useLiftDetraccionObservation);
const mockUseLiftAmount = vi.mocked(useLiftAmountObservation);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDetraccionValidation(
  overrides: Partial<DetraccionValidation> = {},
): DetraccionValidation {
  return {
    detraccion_data: {
      porDetraccion: "14.00",
      mtoDetraccion: 280.0,
      nroCuenta: "00123456789",
      fechaVencimientoPago: "2024-03-20",
    },
    lifted: false,
    lifted_by: null,
    lifted_by_name: null,
    lifted_reason: null,
    lifted_at: null,
    ...overrides,
  };
}

function makeVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "vchr-test-001",
    tenant_id: "tnnt-test",
    company_id: "comp-test",
    voucher_type: "01",
    series: "F001",
    number: "00000001",
    issue_date: "2025-01-01",
    supplier_ruc: "20123456789",
    supplier_name: "Test Supplier",
    currency: "PEN",
    total_amount: 2000,
    igv_amount: 360,
    validation_status: "observado",
    tc_validation: null,
    detraccion_validation: null,
    ...overrides,
  } as Voucher;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLiftTC.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useLiftTCObservation>);
  mockUseLiftDetraccion.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useLiftDetraccionObservation>);
  mockUseLiftAmount.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useLiftAmountObservation>);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildObservations — detraccion branch", () => {
  it("GIVEN detraccion_validation is null -> renders nothing", () => {
    /**
     * GIVEN a voucher with no detraccion_validation
     * WHEN ObservationsSection is rendered
     * THEN nothing is rendered (no observations)
     */
    const { container } = render(
      <ObservationsSection
        voucher={makeVoucher({ detraccion_validation: null })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("GIVEN detraccion_validation present and not lifted -> shows Detraccion label and Activa badge", () => {
    /**
     * GIVEN a voucher with an unpaid detraccion (lifted=false)
     * WHEN ObservationsSection is rendered
     * THEN "Detraccion" label, "Activa" badge, and "Confirmar" button are visible
     */
    render(
      <ObservationsSection
        voucher={makeVoucher({
          detraccion_validation: makeDetraccionValidation({ lifted: false }),
        })}
      />,
    );

    expect(screen.getByText("Detracción")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirmar/i }),
    ).toBeInTheDocument();
  });

  it("GIVEN detraccion_validation lifted=true -> renders nothing (observation excluded from list)", () => {
    /**
     * GIVEN a voucher where the detraccion observation has already been lifted
     * WHEN ObservationsSection is rendered
     * THEN nothing is rendered — buildObservations() excludes lifted observations,
     *      so the section has no entries and returns null.
     *
     * Note: once lifted, the observation no longer appears in the UI. The audit
     * log (separate component) shows the historical record.
     */
    const { container } = render(
      <ObservationsSection
        voucher={makeVoucher({
          detraccion_validation: makeDetraccionValidation({ lifted: true }),
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("GIVEN porDetraccion is a string -> description formats correctly (pct + monto)", () => {
    /**
     * GIVEN porDetraccion='14.00' (string) and mtoDetraccion=280.00
     * WHEN ObservationsSection is rendered
     * THEN the description shows '14.0%' and the formatted monto
     * (porDetraccion is a SUNAT string — parseFloat must handle it)
     */
    render(
      <ObservationsSection
        voucher={makeVoucher({
          detraccion_validation: makeDetraccionValidation({
            detraccion_data: {
              porDetraccion: "14.00",
              mtoDetraccion: 280.0,
            },
            lifted: false,
          }),
        })}
      />,
    );

    // The description row should contain the formatted percentage
    expect(screen.getByText(/14\.0%/)).toBeInTheDocument();
    // And the formatted monto
    expect(screen.getByText(/280/)).toBeInTheDocument();
  });
});
