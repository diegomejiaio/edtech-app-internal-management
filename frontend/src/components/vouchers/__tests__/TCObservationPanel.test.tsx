/**
 * Unit tests for ObservationsSection component.
 *
 * Tests the inline observations panel inside VoucherDetailSheet:
 * badge rendering, lifted state, "Confirmar" button visibility,
 * and dialog open behavior.
 *
 * Replaces the deleted TCObservationPanel tests — TCObservationPanel was
 * removed in the generic-observations refactor and replaced by
 * ObservationsSection + CorrectObservationDialog.
 *
 * Mocks:
 *   - useLiftTCObservation — returns mutation state
 *   - useAuthContext       — returns a stub getToken
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObservationsSection } from "../vouchers-table";
import type { Voucher, TCValidation } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

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

const mockUseLiftTCObservation = vi.mocked(useLiftTCObservation);
const mockUseLiftDetraccionObservation = vi.mocked(
  useLiftDetraccionObservation,
);
const mockUseLiftAmountObservation = vi.mocked(useLiftAmountObservation);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeTCValidation(overrides: Partial<TCValidation> = {}): TCValidation {
  return {
    official_rate: 3.73,
    voucher_rate: 4.2,
    deviation_pct: 0.126,
    tolerance_pct: 0.05,
    passed: false,
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
    currency: "USD",
    total_amount: 1000,
    igv_amount: 180,
    validation_status: "observado",
    tc_validation: null,
    ...overrides,
  } as Voucher;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLiftTCObservation.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useLiftTCObservation>);
  mockUseLiftDetraccionObservation.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useLiftDetraccionObservation>);
  mockUseLiftAmountObservation.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useLiftAmountObservation>);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("ObservationsSection", () => {
  it("GIVEN voucher with no tc_validation → renders nothing", () => {
    /**
     * GIVEN a voucher without tc_validation (or tc_validation.passed = true)
     * WHEN ObservationsSection is rendered
     * THEN nothing is rendered (returns null)
     */
    const { container } = render(
      <ObservationsSection voucher={makeVoucher({ tc_validation: null })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("GIVEN tc_validation.passed=true → renders nothing (no observation)", () => {
    /**
     * GIVEN a voucher where TC validation passed (no observation needed)
     * WHEN ObservationsSection is rendered
     * THEN nothing is rendered — passed vouchers should not show an observation
     */
    const { container } = render(
      <ObservationsSection
        voucher={makeVoucher({
          tc_validation: makeTCValidation({ passed: true }),
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("GIVEN tc_validation not lifted → shows Activa badge and Confirmar button", () => {
    /**
     * GIVEN a voucher with an active TC observation (passed=false, lifted=false)
     * WHEN ObservationsSection is rendered
     * THEN the section header, "Tipo de Cambio" label, "Activa" badge,
     *      and "Confirmar" button are all visible
     */
    render(
      <ObservationsSection
        voucher={makeVoucher({
          tc_validation: makeTCValidation({ lifted: false }),
        })}
      />,
    );

    expect(screen.getByText(/observaciones/i)).toBeInTheDocument();
    expect(screen.getByText("Tipo de Cambio")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirmar/i }),
    ).toBeInTheDocument();
  });

  it("GIVEN tc_validation already lifted → shows Levantada badge, no Confirmar button", () => {
    /**
     * GIVEN a voucher whose TC observation has already been lifted
     * WHEN ObservationsSection is rendered
     * THEN "Levantada" badge is visible and there is NO "Confirmar" button
     */
    render(
      <ObservationsSection
        voucher={makeVoucher({
          tc_validation: makeTCValidation({ lifted: true }),
        })}
      />,
    );

    expect(screen.getByText("Levantada")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirmar/i }),
    ).not.toBeInTheDocument();
  });

  it("GIVEN active observation → clicking Confirmar opens the dialog", () => {
    /**
     * GIVEN an active TC observation
     * WHEN the user clicks the "Confirmar" button
     * THEN the CorrectObservationDialog opens (dialog role or title text visible)
     */
    render(
      <ObservationsSection
        voucher={makeVoucher({
          tc_validation: makeTCValidation({ lifted: false }),
        })}
      />,
    );

    const confirmarBtn = screen.getByRole("button", { name: /confirmar/i });
    fireEvent.click(confirmarBtn);

    // Dialog title should be visible after clicking
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
