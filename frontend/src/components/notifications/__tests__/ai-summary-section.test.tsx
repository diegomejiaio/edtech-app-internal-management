/**
 * Unit tests for AiSummarySection component.
 *
 * Tests rendering logic: null/skipped (renders nothing), failed state,
 * completed with summary, expand/collapse behavior, key_amounts display.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AiSummarySection } from "../ai-summary-section";
import type { AiSummary } from "@/hooks/use-notifications";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeAiSummary(overrides: Partial<AiSummary> = {}): AiSummary {
  return {
    status: "completed",
    criticality_level: "URGENTE",
    criticality_reason: "Resolución de cobranza con plazo inmediato",
    summary:
      "La SUNAT ha emitido una resolución de cobranza por deuda tributaria del ejercicio 2024.",
    key_amounts: [
      { concept: "Deuda principal", amount: 1500.0, currency: "PEN" },
      { concept: "Intereses", amount: 75.5, currency: "PEN" },
    ],
    deadline_hint: "30 de enero de 2026",
    required_action: "Pagar deuda o solicitar fraccionamiento antes del 30/01.",
    document_type_detected: "Resolución de Cobranza",
    source_used: "pdf",
    processed_at: "2026-01-15T10:00:00Z",
    model_version: "gpt-4o-mini",
    prompt_version: "v1",
    processing_notes: null,
    error: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("AiSummarySection", () => {
  // Null / skip states
  it("GIVEN aiSummary is null → renders nothing", () => {
    /**
     * GIVEN no AI summary data
     * WHEN AiSummarySection is rendered
     * THEN the component renders nothing (null guard)
     */
    const { container } = render(<AiSummarySection aiSummary={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("GIVEN status=skipped → renders nothing", () => {
    /**
     * GIVEN ai_summary.status is 'skipped'
     * WHEN AiSummarySection is rendered
     * THEN nothing is rendered (skipped means there was no content to analyze)
     */
    const { container } = render(
      <AiSummarySection aiSummary={makeAiSummary({ status: "skipped" })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  // Failed state
  it("GIVEN status=failed → renders error message", () => {
    /**
     * GIVEN ai_summary.status is 'failed'
     * WHEN AiSummarySection is rendered
     * THEN the error message is visible
     */
    render(
      <AiSummarySection
        aiSummary={makeAiSummary({
          status: "failed",
          criticality_level: null,
          summary: null,
          key_amounts: [],
        })}
      />,
    );
    expect(
      screen.getByText(/no se pudo generar el resumen/i),
    ).toBeInTheDocument();
  });

  // Completed state — collapsed by default
  it("GIVEN status=completed with summary → renders header and summary preview", () => {
    /**
     * GIVEN ai_summary.status is 'completed' and summary is set
     * WHEN AiSummarySection is rendered
     * THEN 'Resumen IA' header is visible and summary text is shown (collapsed)
     */
    render(<AiSummarySection aiSummary={makeAiSummary()} />);

    expect(screen.getByText("Resumen IA")).toBeInTheDocument();
    expect(
      screen.getByText(/La SUNAT ha emitido una resolución de cobranza/i),
    ).toBeInTheDocument();
  });

  it("GIVEN completed summary → 'Ver más' button is visible when collapsed", () => {
    /**
     * GIVEN ai_summary is completed
     * WHEN rendered in initial (collapsed) state
     * THEN 'Ver más' link is shown to expand
     */
    render(<AiSummarySection aiSummary={makeAiSummary()} />);
    expect(screen.getByText("Ver más")).toBeInTheDocument();
  });

  it("GIVEN completed summary → expand button toggles expanded details", () => {
    /**
     * GIVEN ai_summary is completed with required_action and deadline_hint
     * WHEN the expand button (ChevronDown) is clicked
     * THEN the required action and deadline_hint are shown
     */
    render(<AiSummarySection aiSummary={makeAiSummary()} />);

    // Initially collapsed — details not visible
    expect(screen.queryByText("Acción requerida")).not.toBeInTheDocument();

    // Click expand button
    const expandBtn = screen.getByLabelText("Ver resumen completo");
    fireEvent.click(expandBtn);

    // Now expanded — required_action section visible
    expect(screen.getByText("Acción requerida")).toBeInTheDocument();
    expect(
      screen.getByText(/Pagar deuda o solicitar fraccionamiento/i),
    ).toBeInTheDocument();
  });

  it("GIVEN expanded state → 'Ver más' changes to collapse button", () => {
    /**
     * GIVEN the section is expanded via the ChevronDown button
     * WHEN the button is checked again
     * THEN the button aria-label changes to 'Ocultar resumen'
     */
    render(<AiSummarySection aiSummary={makeAiSummary()} />);

    const expandBtn = screen.getByLabelText("Ver resumen completo");
    fireEvent.click(expandBtn);

    expect(screen.getByLabelText("Ocultar resumen")).toBeInTheDocument();
  });

  it("GIVEN expanded state with key_amounts → renders amount rows", () => {
    /**
     * GIVEN ai_summary is completed and expanded, with 2 key_amounts entries
     * WHEN the section is expanded
     * THEN both concept labels and formatted amounts are shown
     */
    render(<AiSummarySection aiSummary={makeAiSummary()} />);

    // Expand
    fireEvent.click(screen.getByLabelText("Ver resumen completo"));

    expect(screen.getByText("Deuda principal")).toBeInTheDocument();
    expect(screen.getByText("Intereses")).toBeInTheDocument();
    // Formatted as S/ 1,500.00 (locale es-PE)
    expect(screen.getByText(/S\/\s*1[,.]500/)).toBeInTheDocument();
  });

  it("GIVEN expanded with deadline_hint → renders deadline section", () => {
    /**
     * GIVEN ai_summary is completed and expanded with a deadline_hint
     * WHEN the section is expanded
     * THEN the Plazo / Fecha clave section shows the deadline text
     */
    render(<AiSummarySection aiSummary={makeAiSummary()} />);
    fireEvent.click(screen.getByLabelText("Ver resumen completo"));

    expect(screen.getByText("Plazo / Fecha clave")).toBeInTheDocument();
    expect(screen.getByText("30 de enero de 2026")).toBeInTheDocument();
  });

  it("GIVEN expanded with document_type_detected → renders type badge", () => {
    /**
     * GIVEN ai_summary is completed and expanded with document_type_detected
     * WHEN the section is expanded
     * THEN the document type badge is shown
     */
    render(<AiSummarySection aiSummary={makeAiSummary()} />);
    fireEvent.click(screen.getByLabelText("Ver resumen completo"));

    expect(screen.getByText("Resolución de Cobranza")).toBeInTheDocument();
  });

  it("GIVEN completed but key_amounts empty → amounts section not shown", () => {
    /**
     * GIVEN ai_summary is completed with key_amounts = []
     * WHEN the section is expanded
     * THEN 'Importes clave' section is not shown
     */
    render(<AiSummarySection aiSummary={makeAiSummary({ key_amounts: [] })} />);
    fireEvent.click(screen.getByLabelText("Ver resumen completo"));

    expect(screen.queryByText("Importes clave")).not.toBeInTheDocument();
  });

  it("GIVEN 'Ver más' link clicked → section expands", () => {
    /**
     * GIVEN the section is in collapsed state with 'Ver más' link visible
     * WHEN 'Ver más' is clicked
     * THEN the section expands and shows required_action details
     */
    render(<AiSummarySection aiSummary={makeAiSummary()} />);

    fireEvent.click(screen.getByText("Ver más"));

    expect(screen.getByText("Acción requerida")).toBeInTheDocument();
  });

  it("GIVEN completed with USD key_amount → formats with US$ symbol", () => {
    /**
     * GIVEN a key_amount with currency = 'USD'
     * WHEN the section is expanded
     * THEN the amount is formatted with US$ prefix
     */
    render(
      <AiSummarySection
        aiSummary={makeAiSummary({
          key_amounts: [
            { concept: "Impuesto", amount: 500.0, currency: "USD" },
          ],
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText("Ver resumen completo"));

    expect(screen.getByText("Impuesto")).toBeInTheDocument();
    expect(screen.getByText(/US\$\s*500/)).toBeInTheDocument();
  });

  it("GIVEN key_amount with null amount → renders dash", () => {
    /**
     * GIVEN a key_amount with amount = null
     * WHEN the section is expanded
     * THEN the amount cell shows '—' (em-dash)
     */
    render(
      <AiSummarySection
        aiSummary={makeAiSummary({
          key_amounts: [
            { concept: "Monto pendiente", amount: null, currency: "PEN" },
          ],
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText("Ver resumen completo"));

    expect(screen.getByText("Monto pendiente")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
