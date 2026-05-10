/**
 * Unit tests for AiCriticalityBadge component.
 *
 * Tests correct badge rendering per all 7 criticality levels,
 * null/skipped/failed/processing states.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AiCriticalityBadge } from "../ai-criticality-badge";
import type { AiSummary } from "@/hooks/use-notifications";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeAiSummary(overrides: Partial<AiSummary> = {}): AiSummary {
  return {
    status: "completed",
    criticality_level: "URGENTE",
    criticality_reason: "Resolución de cobranza",
    summary: "Resolución de cobranza por deuda tributaria.",
    key_amounts: [],
    deadline_hint: null,
    required_action: "Pagar antes del 30/01",
    document_type_detected: null,
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

describe("AiCriticalityBadge", () => {
  it("GIVEN aiSummary is null → renders nothing", () => {
    /**
     * GIVEN no AI summary data
     * WHEN AiCriticalityBadge is rendered
     * THEN the component renders nothing
     */
    const { container } = render(<AiCriticalityBadge aiSummary={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("GIVEN status=skipped → renders nothing", () => {
    /**
     * GIVEN ai_summary.status is 'skipped'
     * WHEN AiCriticalityBadge is rendered
     * THEN the component renders nothing (skipped = no content to show)
     */
    const { container } = render(
      <AiCriticalityBadge aiSummary={makeAiSummary({ status: "skipped" })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("GIVEN status=failed → renders 'Sin resumen' badge", () => {
    /**
     * GIVEN ai_summary.status is 'failed'
     * WHEN AiCriticalityBadge is rendered
     * THEN a badge with 'Sin resumen' text is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({
          status: "failed",
          criticality_level: null,
        })}
      />,
    );
    expect(screen.getByText("Sin resumen")).toBeInTheDocument();
  });

  // ─── All 7 criticality levels ─────────────────────────────────────────────

  it("GIVEN status=completed, level=CRÍTICO → renders 'Crítico' badge", () => {
    /**
     * GIVEN ai_summary.criticality_level is 'CRÍTICO'
     * WHEN AiCriticalityBadge is rendered
     * THEN a badge with label 'Crítico' is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "CRÍTICO" })}
      />,
    );
    expect(screen.getByText("Crítico")).toBeInTheDocument();
  });

  it("GIVEN status=completed, level=URGENTE → renders 'Urgente' badge", () => {
    /**
     * GIVEN ai_summary.status is 'completed' and criticality_level is 'URGENTE'
     * WHEN AiCriticalityBadge is rendered
     * THEN a badge with label 'Urgente' is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "URGENTE" })}
      />,
    );
    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it("GIVEN status=completed, level=PREVENTIVO → renders 'Preventivo' badge", () => {
    /**
     * GIVEN ai_summary.criticality_level is 'PREVENTIVO'
     * WHEN AiCriticalityBadge is rendered
     * THEN a badge with label 'Preventivo' is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "PREVENTIVO" })}
      />,
    );
    expect(screen.getByText("Preventivo")).toBeInTheDocument();
  });

  it("GIVEN status=completed, level=IMPORTANTE → renders 'Importante' badge", () => {
    /**
     * GIVEN ai_summary.status is 'completed' and criticality_level is 'IMPORTANTE'
     * WHEN AiCriticalityBadge is rendered
     * THEN a badge with label 'Importante' is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "IMPORTANTE" })}
      />,
    );
    expect(screen.getByText("Importante")).toBeInTheDocument();
  });

  it("GIVEN status=completed, level=REVISAR → renders 'Revisar' badge", () => {
    /**
     * GIVEN ai_summary.criticality_level is 'REVISAR'
     * WHEN AiCriticalityBadge is rendered
     * THEN a badge with label 'Revisar' is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "REVISAR" })}
      />,
    );
    expect(screen.getByText("Revisar")).toBeInTheDocument();
  });

  it("GIVEN status=completed, level=INFORMATIVO → renders 'Informativo' badge", () => {
    /**
     * GIVEN ai_summary.status is 'completed' and criticality_level is 'INFORMATIVO'
     * WHEN AiCriticalityBadge is rendered
     * THEN a badge with label 'Informativo' is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "INFORMATIVO" })}
      />,
    );
    expect(screen.getByText("Informativo")).toBeInTheDocument();
  });

  it("GIVEN status=completed, level=HISTÓRICO → renders 'Histórico' badge", () => {
    /**
     * GIVEN ai_summary.criticality_level is 'HISTÓRICO'
     * WHEN AiCriticalityBadge is rendered
     * THEN a badge with label 'Histórico' is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "HISTÓRICO" })}
      />,
    );
    expect(screen.getByText("Histórico")).toBeInTheDocument();
  });

  it("GIVEN status=completed but criticality_level=null → renders 'Analizando' processing badge", () => {
    /**
     * GIVEN ai_summary.status is 'completed' but criticality_level is null (fallback state)
     * WHEN AiCriticalityBadge is rendered
     * THEN the processing/fallback badge 'Analizando' is shown
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: null })}
      />,
    );
    expect(screen.getByText("Analizando")).toBeInTheDocument();
  });

  // ─── Color class checks ───────────────────────────────────────────────────

  it("GIVEN status=completed, level=CRÍTICO → badge has red color class", () => {
    /**
     * GIVEN criticality_level is 'CRÍTICO'
     * WHEN AiCriticalityBadge is rendered
     * THEN the badge element has the red color CSS class
     */
    const { container } = render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "CRÍTICO" })}
      />,
    );
    const badge = container.querySelector("[class*='red']");
    expect(badge).not.toBeNull();
  });

  it("GIVEN status=completed, level=URGENTE → badge has red color class", () => {
    /**
     * GIVEN criticality_level is 'URGENTE'
     * WHEN AiCriticalityBadge is rendered
     * THEN the badge element has the red color CSS class
     */
    const { container } = render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "URGENTE" })}
      />,
    );
    const badge = container.querySelector("[class*='red']");
    expect(badge).not.toBeNull();
  });

  it("GIVEN status=completed, level=PREVENTIVO → badge has amber color class", () => {
    /**
     * GIVEN criticality_level is 'PREVENTIVO'
     * WHEN AiCriticalityBadge is rendered
     * THEN the badge element has the amber color CSS class
     */
    const { container } = render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "PREVENTIVO" })}
      />,
    );
    const badge = container.querySelector("[class*='amber']");
    expect(badge).not.toBeNull();
  });

  it("GIVEN status=completed, level=IMPORTANTE → badge has orange color class", () => {
    /**
     * GIVEN criticality_level is 'IMPORTANTE'
     * WHEN AiCriticalityBadge is rendered
     * THEN the badge element has the orange color CSS class
     */
    const { container } = render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "IMPORTANTE" })}
      />,
    );
    const badge = container.querySelector("[class*='orange']");
    expect(badge).not.toBeNull();
  });

  it("GIVEN status=completed, level=REVISAR → badge has blue color class", () => {
    /**
     * GIVEN criticality_level is 'REVISAR'
     * WHEN AiCriticalityBadge is rendered
     * THEN the badge element has the blue color CSS class
     */
    const { container } = render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "REVISAR" })}
      />,
    );
    const badge = container.querySelector("[class*='blue']");
    expect(badge).not.toBeNull();
  });

  it("GIVEN status=completed, level=INFORMATIVO → badge has slate color class", () => {
    /**
     * GIVEN criticality_level is 'INFORMATIVO'
     * WHEN AiCriticalityBadge is rendered
     * THEN the badge element has the slate color CSS class
     */
    const { container } = render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "INFORMATIVO" })}
      />,
    );
    const badge = container.querySelector("[class*='slate']");
    expect(badge).not.toBeNull();
  });

  it("GIVEN status=completed, level=HISTÓRICO → badge has muted color class", () => {
    /**
     * GIVEN criticality_level is 'HISTÓRICO'
     * WHEN AiCriticalityBadge is rendered
     * THEN the badge element has the muted color CSS class
     */
    const { container } = render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({ criticality_level: "HISTÓRICO" })}
      />,
    );
    const badge = container.querySelector("[class*='muted']");
    expect(badge).not.toBeNull();
  });

  it("GIVEN status=fallback, level=URGENTE → renders 'Urgente' badge (fallback status handled)", () => {
    /**
     * GIVEN ai_summary.status is 'fallback' with a valid criticality_level
     * WHEN AiCriticalityBadge is rendered
     * THEN the level badge is shown (fallback summaries still have valid criticality)
     */
    render(
      <AiCriticalityBadge
        aiSummary={makeAiSummary({
          status: "fallback",
          criticality_level: "URGENTE",
        })}
      />,
    );
    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });
});
