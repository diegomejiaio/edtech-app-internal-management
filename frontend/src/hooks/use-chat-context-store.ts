/**
 * Chat context store — Zustand store that pages use to publish their UI state
 * so ClearBookAI can be aware of what the user is currently viewing.
 *
 * Pages call `usePublishChatContext()` to push their context snapshot here.
 * `use-chat.ts` reads `useChatContextStore.getState().pageContext` on every
 * sendMessage call and injects it into RunAgentInput.context[].
 *
 * Design goals:
 *  - Zero coupling: pages publish; chat reads. No shared prop drilling needed.
 *  - Serializable: PageContext is plain JSON — safe to pass to AG-UI context[].
 *  - Incremental: each page publishes only what it knows.
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// PageContext — the snapshot a page publishes
// ---------------------------------------------------------------------------

export interface PageContext {
  /** Page identifier: "comprobantes" | "notifications" | "companies" | "dashboard" | etc. */
  page: string;

  /** Currently selected company (if any) */
  company?: {
    id: string;
    name: string;
    ruc?: string;
  } | null;

  /** Active accounting period in YYYYMM format */
  period?: string | null;

  /** Human-readable period label, e.g. "Marzo 2025" */
  periodLabel?: string | null;

  /** Active tab within the page, e.g. "compras" | "ventas" */
  tab?: string | null;

  /** Active filters the user has applied */
  filters?: Record<string, string | number | boolean | null> | null;

  /** Key numeric stats visible on screen */
  stats?: Record<string, number | string | null> | null;

  /** Declaration / lock status */
  declarationStatus?: "declared" | "pending" | null;

  /** Free-form additional context the LLM can read directly */
  summary?: string | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ChatContextState {
  pageContext: PageContext | null;
  setPageContext: (ctx: PageContext | null) => void;
  clearPageContext: () => void;
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  pageContext: null,
  setPageContext: (ctx) => set({ pageContext: ctx }),
  clearPageContext: () => set({ pageContext: null }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serializes a PageContext into a human-readable string suitable for injection
 * into RunAgentInput.context[].value.
 *
 * The LLM receives this as a structured text block — it describes what the
 * user is currently viewing without requiring tool calls to discover it.
 */
export function serializePageContext(ctx: PageContext): string {
  const lines: string[] = [`Página actual: ${ctx.page}`];

  if (ctx.company) {
    lines.push(
      `Empresa seleccionada: ${ctx.company.name}${ctx.company.ruc ? ` (RUC: ${ctx.company.ruc})` : ""} — ID: ${ctx.company.id}`,
    );
  }

  if (ctx.period) {
    const label = ctx.periodLabel ? ` (${ctx.periodLabel})` : "";
    lines.push(`Período contable activo: ${ctx.period}${label}`);
  }

  if (ctx.tab) {
    lines.push(`Tab activa: ${ctx.tab}`);
  }

  if (ctx.declarationStatus) {
    lines.push(
      `Estado de declaración: ${ctx.declarationStatus === "declared" ? "Declarado (bloqueado)" : "Pendiente de declarar"}`,
    );
  }

  if (ctx.stats && Object.keys(ctx.stats).length > 0) {
    lines.push("Datos visibles en pantalla:");
    for (const [key, value] of Object.entries(ctx.stats)) {
      if (value !== null && value !== undefined) {
        lines.push(`  - ${key}: ${value}`);
      }
    }
  }

  if (ctx.filters && Object.keys(ctx.filters).length > 0) {
    const activeFilters = Object.entries(ctx.filters).filter(
      ([, v]) => v !== null && v !== undefined && v !== "" && v !== "all",
    );
    if (activeFilters.length > 0) {
      lines.push(
        `Filtros activos: ${activeFilters.map(([k, v]) => `${k}=${v}`).join(", ")}`,
      );
    }
  }

  if (ctx.summary) {
    lines.push(ctx.summary);
  }

  return lines.join("\n");
}
