/**
 * Unit tests for AI criticality column in the notifications table.
 *
 * Tests that AiCriticalityBadge is rendered correctly per notification
 * when used in a table-row context, and that null ai_summary produces
 * no badge.
 *
 * Note: Full NotificationTable integration requires mocking useNotifications
 * and useCompanies hooks. These tests use a lightweight table row renderer
 * to verify the badge rendering logic in isolation.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
    summary: "Resumen IA",
    key_amounts: [],
    deadline_hint: null,
    required_action: null,
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

/**
 * Simulates a single notification table row with Criticidad column
 * (matches the structure in notification-table.tsx lines 496-498).
 */
function NotificationTableRow({ aiSummary }: { aiSummary: AiSummary | null }) {
  return (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell data-testid="criticidad-cell">
            <AiCriticalityBadge aiSummary={aiSummary} />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Notification table — Criticidad column", () => {
  it("GIVEN notification with URGENTE ai_summary → criticidad cell shows 'Urgente'", () => {
    /**
     * GIVEN a notification row with ai_summary.criticality_level = 'URGENTE'
     * WHEN the table row renders the Criticidad cell
     * THEN the badge shows 'Urgente'
     */
    render(
      <NotificationTableRow
        aiSummary={makeAiSummary({ criticality_level: "URGENTE" })}
      />,
    );
    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it("GIVEN notification with IMPORTANTE ai_summary → criticidad cell shows 'Importante'", () => {
    /**
     * GIVEN a notification row with ai_summary.criticality_level = 'IMPORTANTE'
     * WHEN the table row renders the Criticidad cell
     * THEN the badge shows 'Importante'
     */
    render(
      <NotificationTableRow
        aiSummary={makeAiSummary({ criticality_level: "IMPORTANTE" })}
      />,
    );
    expect(screen.getByText("Importante")).toBeInTheDocument();
  });

  it("GIVEN notification with INFORMATIVO ai_summary → criticidad cell shows 'Informativo'", () => {
    /**
     * GIVEN a notification row with ai_summary.criticality_level = 'INFORMATIVO'
     * WHEN the table row renders the Criticidad cell
     * THEN the badge shows 'Informativo'
     */
    render(
      <NotificationTableRow
        aiSummary={makeAiSummary({ criticality_level: "INFORMATIVO" })}
      />,
    );
    expect(screen.getByText("Informativo")).toBeInTheDocument();
  });

  it("GIVEN notification with null ai_summary → criticidad cell is empty", () => {
    /**
     * GIVEN a notification row with ai_summary = null (old notification)
     * WHEN the table row renders the Criticidad cell
     * THEN the cell has no badge text
     */
    render(<NotificationTableRow aiSummary={null} />);
    const cell = screen.getByTestId("criticidad-cell");
    expect(cell.textContent).toBe("");
  });

  it("GIVEN notification with failed ai_summary → criticidad cell shows 'Sin resumen'", () => {
    /**
     * GIVEN a notification row with ai_summary.status = 'failed'
     * WHEN the table row renders the Criticidad cell
     * THEN the badge shows 'Sin resumen'
     */
    render(
      <NotificationTableRow
        aiSummary={makeAiSummary({
          status: "failed",
          criticality_level: null,
        })}
      />,
    );
    expect(screen.getByText("Sin resumen")).toBeInTheDocument();
  });

  it("GIVEN notification with skipped ai_summary → criticidad cell is empty", () => {
    /**
     * GIVEN a notification row with ai_summary.status = 'skipped'
     * WHEN the table row renders the Criticidad cell
     * THEN the cell is empty (skipped means no badge)
     */
    render(
      <NotificationTableRow aiSummary={makeAiSummary({ status: "skipped" })} />,
    );
    const cell = screen.getByTestId("criticidad-cell");
    expect(cell.textContent).toBe("");
  });

  it("GIVEN notification without criticality_level → shows 'Analizando' processing badge", () => {
    /**
     * GIVEN a notification row with ai_summary.criticality_level = null (pending)
     * WHEN the table row renders the Criticidad cell
     * THEN the badge shows 'Analizando' (processing state)
     */
    render(
      <NotificationTableRow
        aiSummary={makeAiSummary({ criticality_level: null })}
      />,
    );
    expect(screen.getByText("Analizando")).toBeInTheDocument();
  });

  it("GIVEN three rows with different levels → each row shows correct badge", () => {
    /**
     * GIVEN three notification rows with URGENTE, IMPORTANTE, INFORMATIVO
     * WHEN all rows are rendered
     * THEN each shows its correct badge label
     */
    render(
      <Table>
        <TableBody>
          {(["URGENTE", "IMPORTANTE", "INFORMATIVO"] as const).map((level) => (
            <TableRow key={level}>
              <TableCell>
                <AiCriticalityBadge
                  aiSummary={makeAiSummary({ criticality_level: level })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>,
    );

    expect(screen.getByText("Urgente")).toBeInTheDocument();
    expect(screen.getByText("Importante")).toBeInTheDocument();
    expect(screen.getByText("Informativo")).toBeInTheDocument();
  });
});
