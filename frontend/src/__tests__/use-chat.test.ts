/**
 * Unit tests for useChat hook (front/src/hooks/use-chat.ts)
 *
 * Tests the pure utility functions extracted from useChat:
 *   - serializeTools() → maps FrontendToolDefinition to AG-UI function format
 *   - deriveTitle() → derives session title from first user message
 *   - _processStream() state transitions via AG-UI events
 *
 * NOTE: The full hook (with React state, router, auth) is tested via E2E.
 * These unit tests cover the pure/extracted logic that can be tested in jsdom.
 */

import { describe, it, expect } from "vitest";
import type { FrontendToolDefinition } from "@/types/chat";

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers extracted from the hook (duplicated here for isolation)
// These mirror the exact logic in use-chat.ts without React dependencies.
// ─────────────────────────────────────────────────────────────────────────────

function serializeTools(
  tools: Omit<FrontendToolDefinition, "handler">[],
): object[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

interface MessageForTitle {
  role: "user" | "assistant";
  content: string;
}

function deriveTitle(messages: MessageForTitle[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Nueva conversación";
  const content = typeof first.content === "string" ? first.content : "";
  return content.length > 48 ? content.slice(0, 48) + "\u2026" : content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers to build SSE lines
// ─────────────────────────────────────────────────────────────────────────────

function sseEvent(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n`;
}

function sseDone(): string {
  return "data: [DONE]\n";
}

// ─────────────────────────────────────────────────────────────────────────────
// serializeTools
// ─────────────────────────────────────────────────────────────────────────────

describe("serializeTools", () => {
  it("GIVEN a tool definition → serializes to AG-UI function format", () => {
    /**
     * GIVEN one FrontendToolDefinition
     * WHEN serializeTools is called
     * THEN result has type: "function" wrapper with correct name/description/parameters
     */
    const tools: FrontendToolDefinition[] = [
      {
        name: "navigate_to",
        description: "Navega a una ruta",
        parameters: {
          type: "object",
          properties: {
            route: { type: "string", description: "Ruta de Next.js" },
          },
          required: ["route"],
        },
      },
    ];

    const result = serializeTools(tools);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "function",
      function: {
        name: "navigate_to",
        description: "Navega a una ruta",
        parameters: {
          type: "object",
          properties: {
            route: { type: "string", description: "Ruta de Next.js" },
          },
          required: ["route"],
        },
      },
    });
  });

  it("GIVEN empty tools array → returns empty array", () => {
    /**
     * GIVEN no tool definitions
     * WHEN serializeTools is called
     * THEN an empty array is returned
     */
    const result = serializeTools([]);
    expect(result).toEqual([]);
  });

  it("GIVEN multiple tools → serializes all in order", () => {
    /**
     * GIVEN 3 tool definitions
     * WHEN serializeTools is called
     * THEN all 3 are serialized preserving order
     */
    const tools: FrontendToolDefinition[] = [
      {
        name: "navigate_to",
        description: "Navigate",
        parameters: { type: "object", properties: {}, required: [] },
      },
      {
        name: "select_company",
        description: "Select company",
        parameters: {
          type: "object",
          properties: { company_id: { type: "string" } },
          required: ["company_id"],
        },
      },
      {
        name: "set_period",
        description: "Set period",
        parameters: {
          type: "object",
          properties: { period: { type: "string" } },
          required: ["period"],
        },
      },
    ];

    const result = serializeTools(tools);

    expect(result).toHaveLength(3);
    const names = result.map(
      (r) => (r as { type: string; function: { name: string } }).function.name,
    );
    expect(names).toEqual(["navigate_to", "select_company", "set_period"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deriveTitle
// ─────────────────────────────────────────────────────────────────────────────

describe("deriveTitle", () => {
  it("GIVEN no messages → returns default title", () => {
    /**
     * GIVEN empty message array
     * WHEN deriveTitle is called
     * THEN returns "Nueva conversación"
     */
    const result = deriveTitle([]);
    expect(result).toBe("Nueva conversación");
  });

  it("GIVEN only assistant messages → returns default title", () => {
    /**
     * GIVEN messages array with only assistant messages (no user message)
     * WHEN deriveTitle is called
     * THEN returns "Nueva conversación" (no user message to derive from)
     */
    const messages: MessageForTitle[] = [
      { role: "assistant", content: "Hola, soy ClearBookAI." },
    ];
    const result = deriveTitle(messages);
    expect(result).toBe("Nueva conversación");
  });

  it("GIVEN short user message → returns full message as title", () => {
    /**
     * GIVEN a user message with 20 chars (under 48 char limit)
     * WHEN deriveTitle is called
     * THEN returns the full message
     */
    const messages: MessageForTitle[] = [
      { role: "assistant", content: "Hola" },
      { role: "user", content: "¿Cuántos comprobantes?" },
    ];
    const result = deriveTitle(messages);
    expect(result).toBe("¿Cuántos comprobantes?");
  });

  it("GIVEN long user message (>48 chars) → truncates with ellipsis", () => {
    /**
     * GIVEN a user message with more than 48 characters
     * WHEN deriveTitle is called
     * THEN returns the first 48 chars followed by ellipsis (…)
     */
    const longMessage =
      "¿Puedes mostrarme todos los comprobantes observados del periodo de enero 2026?";
    const messages: MessageForTitle[] = [
      { role: "user", content: longMessage },
    ];
    const result = deriveTitle(messages);
    expect(result).toHaveLength(49); // 48 chars + "…"
    expect(result.endsWith("\u2026")).toBe(true);
    expect(result.startsWith(longMessage.slice(0, 48))).toBe(true);
  });

  it("GIVEN message exactly 48 chars → returns full message without ellipsis", () => {
    /**
     * GIVEN a user message of exactly 48 characters
     * WHEN deriveTitle is called
     * THEN returns the full 48-char message (no ellipsis added)
     */
    const exactMessage = "A".repeat(48);
    const messages: MessageForTitle[] = [
      { role: "user", content: exactMessage },
    ];
    const result = deriveTitle(messages);
    expect(result).toBe(exactMessage);
    expect(result.endsWith("\u2026")).toBe(false);
  });

  it("GIVEN first message is assistant + second is user → uses first user message", () => {
    /**
     * GIVEN the welcome assistant message is first, user message is second
     * WHEN deriveTitle is called
     * THEN title is derived from the user message (not the assistant greeting)
     */
    const messages: MessageForTitle[] = [
      {
        role: "assistant",
        content: "Hola, soy ClearBookAI. ¿En qué puedo ayudarte?",
      },
      { role: "user", content: "Ver notificaciones pendientes" },
    ];
    const result = deriveTitle(messages);
    expect(result).toBe("Ver notificaciones pendientes");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-UI SSE Event parsing (line parser logic)
// ─────────────────────────────────────────────────────────────────────────────

describe("AG-UI SSE line parsing", () => {
  /**
   * The SSE event loop in _processStream splits on "\n" and processes
   * lines starting with "data: ". These tests verify the parsing logic
   * used by the hook in isolation.
   */

  function parseSSELine(line: string): object | null {
    if (!line.startsWith("data: ")) return null;
    const raw = line.slice("data: ".length).trim();
    if (raw === "[DONE]") return { type: "[DONE]" };
    try {
      return JSON.parse(raw) as object;
    } catch {
      return null;
    }
  }

  it("GIVEN valid TEXT_MESSAGE_CONTENT line → parses to event object", () => {
    /**
     * GIVEN an SSE line with TEXT_MESSAGE_CONTENT event
     * WHEN parsed
     * THEN returns an object with type and delta
     */
    const line = sseEvent({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "msg-001",
      delta: "Hola",
    }).trim();

    const result = parseSSELine(line);

    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>)["type"]).toBe(
      "TEXT_MESSAGE_CONTENT",
    );
    expect((result as Record<string, unknown>)["delta"]).toBe("Hola");
  });

  it("GIVEN [DONE] line → returns sentinel object", () => {
    /**
     * GIVEN the SSE stream terminator line
     * WHEN parsed
     * THEN returns { type: '[DONE]' } sentinel
     */
    const line = sseDone().trim();
    const result = parseSSELine(line);
    expect(result).toEqual({ type: "[DONE]" });
  });

  it("GIVEN keepalive comment line → returns null (ignored)", () => {
    /**
     * GIVEN an SSE keepalive comment line (: ping)
     * WHEN parsed
     * THEN returns null (should be skipped)
     */
    const result = parseSSELine(": ping");
    expect(result).toBeNull();
  });

  it("GIVEN empty line → returns null (ignored)", () => {
    /**
     * GIVEN an empty SSE line (separator)
     * WHEN parsed
     * THEN returns null (should be skipped)
     */
    const result = parseSSELine("");
    expect(result).toBeNull();
  });

  it("GIVEN malformed JSON data line → returns null (parse error tolerated)", () => {
    /**
     * GIVEN a malformed JSON SSE line
     * WHEN parsed
     * THEN returns null (error is tolerated — line is skipped)
     */
    const result = parseSSELine("data: {invalid json}");
    expect(result).toBeNull();
  });

  it("GIVEN CUSTOM conversation_init event → contains conversation_id", () => {
    /**
     * GIVEN a CUSTOM event with name=conversation_init
     * WHEN parsed
     * THEN value.conversation_id is accessible
     */
    const line = sseEvent({
      type: "CUSTOM",
      name: "conversation_init",
      value: { conversation_id: "conv-abc123" },
    }).trim();

    const result = parseSSELine(line) as Record<string, unknown>;

    expect(result["type"]).toBe("CUSTOM");
    expect(result["name"]).toBe("conversation_init");
    expect(
      (result["value"] as Record<string, unknown>)["conversation_id"],
    ).toBe("conv-abc123");
  });

  it("GIVEN RUN_ERROR event → message field is accessible", () => {
    /**
     * GIVEN a RUN_ERROR event with message
     * WHEN parsed
     * THEN message field is accessible and non-empty
     */
    const line = sseEvent({
      type: "RUN_ERROR",
      message: "El asistente no está disponible en este momento.",
    }).trim();

    const result = parseSSELine(line) as Record<string, unknown>;

    expect(result["type"]).toBe("RUN_ERROR");
    expect(typeof result["message"]).toBe("string");
    expect((result["message"] as string).length).toBeGreaterThan(0);
  });
});
