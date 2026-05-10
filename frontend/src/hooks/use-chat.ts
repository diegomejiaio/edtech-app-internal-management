"use client";

/**
 * useChat — AG-UI native hook for ClearBookAI.
 *
 * Uses @ag-ui/client HttpAgent.run() directly (RxJS Observable) to stream
 * AG-UI SSE events from the BFF proxy. No CopilotKit Runtime required.
 *
 * Event flow:
 *   HttpAgent.run(RunAgentInput) → Observable<BaseEvent>
 *     TEXT_MESSAGE_START       → add streaming message to displayMessages
 *     TEXT_MESSAGE_CONTENT     → append delta to last assistant message
 *     TEXT_MESSAGE_END         → mark streaming=false
 *     TOOL_CALL_START          → record tool name
 *     TOOL_CALL_ARGS           → accumulate args JSON
 *     TOOL_CALL_END            → dispatch tool handler
 *     RUN_FINISHED             → set isLoading=false
 *     RUN_ERROR                → set error, set isLoading=false
 *     CUSTOM (conversation_init) → store conversation_id for thread tracking
 *
 * Frontend tools are declared as plain JSON schema objects sent in
 * RunAgentInput.tools so the LLM can call them. Tool results are dispatched
 * manually in onToolCallEnd. This replaces useCopilotAction() ×9.
 *
 * Thread tracking:
 *   The first RUN sends threadId=undefined → the backend generates a conv-id
 *   and emits CUSTOM conversation_init → we store it → subsequent runs use it.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { useRouter } from "next/navigation";
import type { RunAgentInput, BaseEvent } from "@ag-ui/client";
import type { Message as AguiMessage } from "@ag-ui/client";
import { useAssistantAgent } from "@/providers/copilotkit-provider";
import { useAuthContext } from "@/providers/auth-provider";
import { DEV_MODE } from "@/lib/env";
import { genId } from "@/lib/chat-utils";
import type { UseChatOptions, UseChatReturn } from "@/types/chat";
import { UI_ACTION_TOOLS } from "@/types/chat";
import {
  useChatContextStore,
  serializePageContext,
} from "@/hooks/use-chat-context-store";

// ─── Re-export types consumed by chat-bubble.tsx ─────────────────────────────

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** "action" = tool-only confirmation chip shown after a tool-only LLM turn */
  /** "tool_call" = inline indicator shown during/after each tool execution */
  kind?: "action" | "tool_call";
  // tool_call kind fields
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolStatus?: "running" | "done";
};

export interface Session {
  id: string;
  title: string;
  conversationId: string | null;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export type PanelView = "chat" | "history";

// ─── AG-UI event type discriminants ──────────────────────────────────────────
// We cast BaseEvent to these to avoid deep import coupling.

type AguiEvent = BaseEvent & {
  type: string;
  messageId?: string;
  delta?: string;
  toolCallId?: string;
  toolCallName?: string; // AG-UI spec field (was incorrectly named toolName)
  result?: string;
  name?: string;
  value?: unknown;
  message?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Nueva conversación";
  const content = first.content;
  return content.length > 48 ? content.slice(0, 48) + "\u2026" : content;
}

function buildUrl(route: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return route;
  const url = new URL(route, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.pathname + url.search;
}

const ROUTE_LABELS: Record<string, string> = {
  "/notifications": "Notificaciones",
  "/comprobantes": "Comprobantes",
  "/companies": "Empresas",
  "/communications/email": "Comunicaciones",
  "/communications/email/compose": "Redactar email",
  "/dashboard": "Dashboard",
  "/settings": "Configuración",
};

/**
 * Returns a Spanish label for a tool call indicator.
 * Used by both chat-bubble (inline indicators) and buildToolConfirmation.
 */
export function buildToolLabel(
  toolName: string,
  args: Record<string, unknown>,
  status: "running" | "done",
): string {
  switch (toolName) {
    case "navigate_to": {
      const route = args.route as string | undefined;
      const label = (route && ROUTE_LABELS[route]) ?? route ?? "la pantalla";
      return status === "running"
        ? `Navegando hacia ${label}`
        : `Navegado hacia ${label}`;
    }
    case "select_company":
      return status === "running"
        ? "Seleccionando empresa"
        : "Empresa seleccionada";
    case "set_period":
      return status === "running" ? "Cambiando período" : "Período cambiado";
    case "apply_filter":
      return status === "running" ? "Aplicando filtro" : "Filtro aplicado";
    case "open_voucher_detail":
      return status === "running"
        ? "Abriendo comprobante"
        : "Comprobante abierto";
    case "get_current_page":
    case "get_selected_company":
    case "get_active_period":
    case "get_active_filters":
      return status === "running" ? "Leyendo contexto" : "Contexto leído";
    default:
      return status === "running" ? "Consultando datos" : "Datos consultados";
  }
}

/**
 * Builds a short Spanish confirmation string when the LLM emitted only tool
 * calls with no text content (tool-only response). Prevents blank bubbles.
 * Returns { text, isAction } — isAction=true renders as an action chip.
 */
function buildToolConfirmation(
  tools: Array<{ name: string; args: Record<string, unknown> }>,
): { text: string; isAction: boolean } {
  const parts: string[] = [];
  let isAction = false;
  for (const { name, args } of tools) {
    switch (name) {
      case "navigate_to": {
        const route = args.route as string | undefined;
        const label = (route && ROUTE_LABELS[route]) ?? route ?? "la pantalla";
        parts.push(`Fui a ${label}`);
        isAction = true;
        break;
      }
      case "select_company": {
        const companyName = args.company_name as string | undefined;
        parts.push(
          companyName ? `Empresa: ${companyName}` : "Empresa seleccionada",
        );
        isAction = true;
        break;
      }
      case "set_period": {
        parts.push(`Período: ${args.period ?? "—"}`);
        isAction = true;
        break;
      }
      case "apply_filter": {
        parts.push(`Filtro: ${args.filter_name} = ${args.value}`);
        isAction = true;
        break;
      }
      case "open_voucher_detail": {
        parts.push("Comprobante abierto");
        isAction = true;
        break;
      }
      default:
        break;
    }
  }
  const text = parts.length > 0 ? parts.join(" · ") : "Listo.";
  return { text, isAction };
}

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content: "Hola, soy ClearBookAI. ¿En qué puedo ayudarte hoy?",
  timestamp: new Date(),
  isStreaming: false,
};

function newSession(): Session {
  const now = new Date();
  return {
    id: genId(),
    title: "Nueva conversación",
    conversationId: null,
    messages: [GREETING],
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Frontend tool definitions (AG-UI Tool schema) ────────────────────────────
// AG-UI Tool shape: { name, description, parameters, metadata? }
// (NOT the OpenAI { type: "function", function: {...} } wrapper)
// Sent to the backend in RunAgentInput.tools so the LLM can invoke them.

// Single source of truth: tool definitions live in @/types/chat (UI_ACTION_TOOLS).
// Cast to RunAgentInput["tools"] for the AG-UI POST payload.
const FRONTEND_TOOLS = UI_ACTION_TOOLS as RunAgentInput["tools"];

// Context-read tools that run silently — they provide no user-visible value
// in the chat and would only add noise. They still execute normally; we just
// don't create a tool_call message for them.
const SILENT_TOOLS = new Set([
  "get_current_page",
  "get_selected_company",
  "get_active_period",
  "get_active_filters",
]);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const router = useRouter();
  const agent = useAssistantAgent();
  const auth = useAuthContext();

  // ── Message state ──────────────────────────────────────────────────────────
  const [displayMessages, setDisplayMessages] = useState<Message[]>([GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Thread tracking — persist conversation_id across sends within a session
  const threadIdRef = useRef<string | undefined>(undefined);

  // Abort current stream on stop/reset
  const abortRef = useRef<(() => void) | null>(null);

  // AG-UI MessagesSnapshot — the canonical message history as seen by the backend.
  // Captured from MESSAGES_SNAPSHOT events and used as the base for the next turn's
  // history. This ensures tool calls and their results are included exactly as
  // the backend recorded them, fixing the "silent after tool call" issue where
  // OpenAI rejects a history that has tool_calls with no matching tool results.
  const messagesSnapshotRef = useRef<AguiMessage[] | null>(null);

  // ── Streaming delta buffer ─────────────────────────────────────────────────
  // Instead of calling setDisplayMessages on every token delta (which causes a
  // React re-render per token), we accumulate deltas in a ref and flush them
  // once per animation frame (~60fps). This makes streaming feel as smooth as
  // ChatGPT/Claude without blocking the main thread between frames.
  const streamingDeltaRef = useRef<string>("");
  const rafIdRef = useRef<number | null>(null);

  // ── Session list (for history panel) ──────────────────────────────────────
  const [sessions, setSessions] = useState<Session[]>(() => [newSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => sessions[0].id,
  );
  const [view, setView] = useState<PanelView>("chat");

  // ── Tool dispatcher ────────────────────────────────────────────────────────

  const dispatchTool = useCallback(
    (toolName: string, argsStr: string): unknown => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(argsStr || "{}");
      } catch {
        // ignore malformed args
      }

      switch (toolName) {
        case "navigate_to": {
          const url = buildUrl(
            args.route as string,
            args.params as Record<string, string> | undefined,
          );
          if (options.onNavigate) {
            options.onNavigate(url);
          } else {
            router.push(url);
          }
          return { success: true };
        }

        case "select_company": {
          const companyId = args.company_id as string;
          if (options.onSelectCompany) {
            options.onSelectCompany(companyId);
          } else {
            // Fallback: navigate to the comprobantes detail URL directly
            const pageCtx = useChatContextStore.getState().pageContext;
            const period = (pageCtx as Record<string, unknown> | null)
              ?.period as string | undefined;
            const url = buildUrl("/comprobantes", {
              company: companyId,
              ...(period ? { period } : {}),
            });
            router.push(url);
          }
          return { success: true, company_id: companyId };
        }

        case "set_period": {
          if (options.onSetPeriod) {
            options.onSetPeriod(args.period as string);
          }
          return { success: true, period: args.period };
        }

        case "apply_filter": {
          if (options.onApplyFilter) {
            options.onApplyFilter(
              args.filter_name as string,
              args.value as string,
            );
          }
          return {
            success: true,
            filter_name: args.filter_name,
            value: args.value,
          };
        }

        case "open_voucher_detail": {
          if (options.onOpenVoucher) {
            options.onOpenVoucher(args.voucher_id as string);
          }
          return { success: true, voucher_id: args.voucher_id };
        }

        case "get_current_page":
          return {
            path:
              typeof window !== "undefined" ? window.location.pathname : "/",
          };

        case "get_selected_company": {
          if (options.getContext) {
            const ctx = options.getContext();
            return {
              company_id: ctx.selectedCompanyId,
              name: ctx.selectedCompanyName,
            };
          }
          return { company_id: null, name: null };
        }

        case "get_active_period": {
          if (options.getContext) {
            const ctx = options.getContext();
            return { period: ctx.activePeriod };
          }
          return { period: null };
        }

        case "get_active_filters": {
          if (options.getContext) {
            const ctx = options.getContext();
            return { filters: ctx.activeFilters ?? {} };
          }
          return { filters: {} };
        }

        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      options.onNavigate,
      options.onSelectCompany,
      options.onSetPeriod,
      options.onApplyFilter,
      options.onOpenVoucher,
      options.getContext,
    ],
  );

  // ── Core run (one AG-UI turn) ─────────────────────────────────────────────

  const runAgentTurn = useCallback(
    async (userText: string) => {
      if (!agent) return;

      setIsLoading(true);
      setError(null);

      // ── Refresh JWT before every request so stale tokens never cause 401s ──
      // Clerk's getToken() returns a fresh token (cached but auto-refreshed).
      // DEV_MODE uses a static mock token and skips the refresh.
      if (!DEV_MODE) {
        try {
          const freshToken = await auth.getToken();
          if (freshToken) {
            agent.headers = {
              ...agent.headers,
              Authorization: `Bearer ${freshToken}`,
            };
          }
        } catch {
          // Non-fatal: the existing token may still be valid; proceed anyway.
        }
      }

      // If no threadId yet, generate one and immediately store it so subsequent
      // messages in the same session reuse the same ID — before the backend
      // has a chance to emit CUSTOM conversation_init with the canonical id.
      if (!threadIdRef.current) {
        threadIdRef.current = genId();
      }
      const threadId = threadIdRef.current;

      // ── Build full conversation history for this turn ───────────────────────
      // AG-UI protocol: send the complete prior history on every request so the
      // LLM sees the full context. run_agent_stream creates a fresh AgentSession
      // on each call, so the only way to pass prior turns is via body.messages.
      //
      // PREFERRED: use the last MessagesSnapshotEvent captured from the backend.
      // The snapshot is the canonical history as the backend/LLM sees it — it
      // includes assistant tool_call messages with their paired tool result
      // messages (role: "tool"). Without those results, OpenAI rejects the
      // history and the LLM goes silent after executing a frontend tool call.
      //
      // FALLBACK: if no snapshot is available (first turn), build from
      // displayMessages, excluding UI-only artifacts.
      let historyMessages: RunAgentInput["messages"];
      if (
        messagesSnapshotRef.current &&
        messagesSnapshotRef.current.length > 0
      ) {
        // Use snapshot verbatim — it already has the right shape for RunAgentInput
        historyMessages =
          messagesSnapshotRef.current as RunAgentInput["messages"];
      } else {
        historyMessages = displayMessages
          .filter(
            (m) =>
              m.id !== "greeting" &&
              m.kind !== "action" &&
              m.kind !== "tool_call" &&
              !m.isStreaming &&
              m.content.trim() !== "",
          )
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }));
      }

      const userMsg: RunAgentInput["messages"][number] = {
        id: genId(),
        role: "user",
        content: userText,
      };

      const input: RunAgentInput = {
        threadId,
        runId: genId(),
        messages: [...historyMessages, userMsg],
        tools: FRONTEND_TOOLS,
        context: (() => {
          const pageCtx = useChatContextStore.getState().pageContext;
          return pageCtx
            ? [
                {
                  description: "Contexto UI actual",
                  value: serializePageContext(pageCtx),
                },
              ]
            : [];
        })(),
        forwardedProps: {},
      };

      // Pending tool call accumulator
      let pendingToolName = "";
      let pendingToolArgs = "";
      let pendingToolCallId = ""; // real backend ID (for result mapping)
      let pendingDisplayMessageId = ""; // synthetic UI message ID (React key)
      // Track tool calls executed this turn (for empty-message fallback and follow-up)
      const executedTools: Array<{
        name: string;
        args: Record<string, unknown>;
      }> = [];
      // Parallel array: real backend tool call IDs for the follow-up tool result messages
      const executedToolCallIds: string[] = [];
      // Parallel array: results returned by dispatchTool (stored so follow-up doesn't re-execute)
      const executedToolResults: unknown[] = [];
      // Whether the agent emitted any text content this turn
      let agentEmittedText = false;

      const subscription = agent.run(input).subscribe({
        next: (rawEvent: BaseEvent) => {
          const ev = rawEvent as AguiEvent;

          switch (ev.type) {
            // ── Conversation init ──────────────────────────────────────────
            case "CUSTOM": {
              if (ev.name === "conversation_init") {
                const val = ev.value as
                  | { conversation_id?: string }
                  | undefined;
                if (val?.conversation_id) {
                  threadIdRef.current = val.conversation_id;
                }
              }
              break;
            }

            // ── Text streaming ─────────────────────────────────────────────
            case "TEXT_MESSAGE_START": {
              const msgId = ev.messageId ?? genId();
              setDisplayMessages((prev) => [
                ...prev,
                {
                  id: msgId,
                  role: "assistant",
                  content: "",
                  timestamp: new Date(),
                  isStreaming: true,
                },
              ]);
              break;
            }

            case "TEXT_MESSAGE_CONTENT": {
              const delta = ev.delta ?? "";
              if (delta) agentEmittedText = true;
              // Accumulate delta in buffer — flush at most once per animation
              // frame (~60fps) instead of triggering a React re-render per token.
              streamingDeltaRef.current += delta;
              if (rafIdRef.current === null) {
                rafIdRef.current = requestAnimationFrame(() => {
                  rafIdRef.current = null;
                  const buffered = streamingDeltaRef.current;
                  if (!buffered) return;
                  streamingDeltaRef.current = "";
                  startTransition(() => {
                    setDisplayMessages((prev) => {
                      const last = prev[prev.length - 1];
                      if (!last || last.role !== "assistant") return prev;
                      return [
                        ...prev.slice(0, -1),
                        { ...last, content: last.content + buffered },
                      ];
                    });
                  });
                });
              }
              break;
            }

            case "TEXT_MESSAGE_END": {
              // Cancel any pending RAF and flush remaining buffered delta first.
              // Tokens that arrived between the last RAF flush and TEXT_MESSAGE_END
              // would otherwise be lost.
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }
              const remainingDelta = streamingDeltaRef.current;
              streamingDeltaRef.current = "";

              setDisplayMessages((prev) => {
                // The empty text bubble may NOT be the last message if the LLM
                // interleaved TOOL_CALL_START/END events after TEXT_MESSAGE_START.
                // Search backwards for the last non-tool_call assistant message
                // that is still streaming so we target the right bubble.
                const targetIdx = [...prev]
                  .reverse()
                  .findIndex(
                    (m) =>
                      m.role === "assistant" &&
                      m.kind !== "tool_call" &&
                      m.isStreaming,
                  );
                if (targetIdx === -1) return prev;
                // Convert reversed index to forward index
                const idx = prev.length - 1 - targetIdx;
                // Flush any buffered delta that arrived between the last RAF
                // flush and this TEXT_MESSAGE_END event.
                const target = {
                  ...prev[idx],
                  content: prev[idx].content + remainingDelta,
                };

                if (target.content.trim() === "") {
                  // If the message is empty and tools were executed, the
                  // tool_call messages already provide visual feedback — drop
                  // the empty bubble.
                  const hasVisibleToolCalls = prev.some(
                    (m) => m.kind === "tool_call",
                  );
                  if (hasVisibleToolCalls) {
                    // Remove the empty assistant bubble at idx
                    return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
                  }
                  if (executedTools.length > 0) {
                    // No tool_call messages visible but tools ran — synthesize chip
                    const { text, isAction } =
                      buildToolConfirmation(executedTools);
                    return [
                      ...prev.slice(0, idx),
                      {
                        ...target,
                        content: text,
                        kind: isAction ? ("action" as const) : undefined,
                        isStreaming: false,
                      },
                      ...prev.slice(idx + 1),
                    ];
                  }
                  // Truly empty message with no tools — drop it silently
                  return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
                }
                // Has content — just mark it done
                return [
                  ...prev.slice(0, idx),
                  { ...target, isStreaming: false },
                  ...prev.slice(idx + 1),
                ];
              });
              break;
            }

            // ── Tool calls ─────────────────────────────────────────────────
            case "TOOL_CALL_START": {
              pendingToolName = ev.toolCallName ?? "";
              pendingToolArgs = "";
              // Capture the REAL backend toolCallId from the event — this is
              // what appears in the assistant message's toolCalls array and must
              // match the tool result message's toolCallId in the history.
              pendingToolCallId = ev.toolCallId ?? genId();
              // Use a separate synthetic ID for the React display message so we
              // avoid duplicate-key issues if the backend reuses the same toolCallId.
              pendingDisplayMessageId = genId();

              // Context-read tools run silently — no bubble in the chat.
              if (SILENT_TOOLS.has(pendingToolName)) break;

              const displayMsgId = pendingDisplayMessageId;
              const toolName = pendingToolName;
              setDisplayMessages((prev) => [
                ...prev,
                {
                  id: displayMsgId,
                  role: "assistant" as const,
                  content: "",
                  timestamp: new Date(),
                  kind: "tool_call" as const,
                  toolName,
                  toolArgs: {},
                  toolStatus: "running" as const,
                },
              ]);
              break;
            }

            case "TOOL_CALL_ARGS": {
              pendingToolArgs += ev.delta ?? "";
              // Try to parse partial JSON to update the label live.
              // Only update state if parsing succeeds (complete JSON).
              // Partial chunks will fail silently — no state update until valid.
              const liveId = pendingDisplayMessageId;
              let liveParsed: Record<string, unknown> | null = null;
              try {
                liveParsed = JSON.parse(pendingToolArgs);
              } catch {
                // Partial JSON — skip state update this tick
              }
              if (liveParsed !== null) {
                const snapshot = liveParsed;
                setDisplayMessages((prev) =>
                  prev.map((m) =>
                    m.id === liveId && m.kind === "tool_call"
                      ? { ...m, toolArgs: snapshot }
                      : m,
                  ),
                );
              }
              break;
            }

            case "TOOL_CALL_END": {
              if (pendingToolName) {
                let parsedArgs: Record<string, unknown> = {};
                try {
                  parsedArgs = JSON.parse(pendingToolArgs || "{}");
                } catch {
                  // ignore
                }
                executedTools.push({ name: pendingToolName, args: parsedArgs });
                // Save the backend ID before reset — needed for follow-up tool results
                if (pendingToolCallId) {
                  executedToolCallIds.push(pendingToolCallId);
                }
                // Always dispatch the tool (even silent ones need to run)
                const toolResult = dispatchTool(
                  pendingToolName,
                  pendingToolArgs,
                );
                executedToolResults.push(toolResult);
                // Silent tools don't have a display message — skip the state update
                if (!SILENT_TOOLS.has(pendingToolName)) {
                  // Capture before reset so the updater fn closes over correct values
                  const displayMsgIdToUpdate = pendingDisplayMessageId;
                  const toolNameToUpdate = pendingToolName;
                  setDisplayMessages((prev) =>
                    prev.map((m) =>
                      m.id === displayMsgIdToUpdate && m.kind === "tool_call"
                        ? {
                            ...m,
                            toolArgs: parsedArgs,
                            toolName: toolNameToUpdate,
                            toolStatus: "done" as const,
                          }
                        : m,
                    ),
                  );
                }
              }
              pendingToolName = "";
              pendingToolArgs = "";
              pendingToolCallId = "";
              pendingDisplayMessageId = "";
              break;
            }

            // ── Messages snapshot ──────────────────────────────────────────
            // The backend emits MESSAGES_SNAPSHOT at the end of each run with
            // the full, canonical history including:
            //   - user messages
            //   - assistant messages with toolCalls (tool_call_id + name + args)
            //   - tool result messages (role: "tool", toolCallId, content)
            //
            // We store this snapshot and use it verbatim as the history in the
            // NEXT turn. This is the canonical AG-UI fix for the "silent after
            // tool call" issue — without the paired tool result messages,
            // OpenAI rejects the history or the LLM stops generating text.
            case "MESSAGES_SNAPSHOT": {
              const snapEvent = ev as AguiEvent & { messages?: AguiMessage[] };
              if (snapEvent.messages && snapEvent.messages.length > 0) {
                messagesSnapshotRef.current = snapEvent.messages;
              }
              break;
            }

            // ── Error ──────────────────────────────────────────────────────
            case "RUN_ERROR": {
              // Cancel any pending RAF so stale deltas don't render after error
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }
              streamingDeltaRef.current = "";
              setError(
                ev.message ?? "Error en el asistente. Intenta de nuevo.",
              );
              setIsLoading(false);
              break;
            }

            // ── Other events (RUN_STARTED, STEP_STARTED, RUN_FINISHED…) ───
            default:
              break;
          }
        },

        error: (err: unknown) => {
          console.error("[useChat] AG-UI stream error", err);
          // Cancel any pending RAF so stale deltas don't render after error
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          streamingDeltaRef.current = "";
          setError("Error de conexión con el asistente. Intenta de nuevo.");
          // Flush any running tool_calls to "done" so they don't freeze
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.kind === "tool_call" && m.toolStatus === "running"
                ? { ...m, toolStatus: "done" as const }
                : m,
            ),
          );
          setIsLoading(false);
        },

        complete: () => {
          // Cancel any pending RAF and flush remaining buffer on stream close
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          const remainingOnComplete = streamingDeltaRef.current;
          streamingDeltaRef.current = "";
          if (remainingOnComplete) {
            setDisplayMessages((prev) => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== "assistant") return prev;
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + remainingOnComplete },
              ];
            });
          }
          // Safety net: flush any tool_calls that never received TOOL_CALL_END
          // (can happen if the backend ends the stream early).
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.kind === "tool_call" && m.toolStatus === "running"
                ? { ...m, toolStatus: "done" as const }
                : m,
            ),
          );

          // ── Follow-up turn after frontend tool execution ─────────────────
          // The MAF backend treats frontend tools as "declaration-only": it emits
          // TOOL_CALL_START/END events so the frontend can execute them, but then
          // terminates the run WITHOUT a second agent turn. The LLM never gets a
          // chance to see the tool results and generate a follow-up text response.
          //
          // AG-UI protocol fix: if tools were executed and the agent emitted no
          // text this turn, automatically send a second request to the backend
          // with the tool results appended to the history. The backend's LLM will
          // then produce a natural-language response based on what was done.
          //
          // We only do this when:
          //   1. At least one tool was executed this turn
          //   2. The agent did NOT emit any text content (tool-only turn)
          //   3. The snapshot exists (so we have the assistant's tool_call message)
          if (
            executedToolCallIds.length > 0 &&
            !agentEmittedText &&
            messagesSnapshotRef.current &&
            messagesSnapshotRef.current.length > 0
          ) {
            // Build tool result messages — one per executed tool call
            const toolResultMessages: AguiMessage[] = executedToolCallIds.map(
              (tcId, idx) => ({
                id: genId(),
                role: "tool" as const,
                toolCallId: tcId,
                // Use the already-captured result — do NOT re-dispatch (would re-execute side effects)
                content: JSON.stringify(
                  executedToolResults[idx] ?? { success: true },
                ),
              }),
            );

            // Build the follow-up history:
            //   snapshot (user + assistant with tool_calls) + tool results
            const followUpMessages: RunAgentInput["messages"] = [
              ...(messagesSnapshotRef.current as RunAgentInput["messages"]),
              ...toolResultMessages,
            ];

            // Update the snapshot so the NEXT turn (if any) sees the tool results too
            messagesSnapshotRef.current = followUpMessages as AguiMessage[];

            if (DEV_MODE) {
              console.debug(
                "[useChat] Sending follow-up turn with tool results",
                { toolCallIds: executedToolCallIds, followUpMessages },
              );
            }

            // Fire follow-up request — no new user message, just tool results
            const followUpInput: RunAgentInput = {
              threadId,
              runId: genId(),
              messages: followUpMessages,
              tools: FRONTEND_TOOLS,
              context: (() => {
                const pageCtx = useChatContextStore.getState().pageContext;
                return pageCtx
                  ? [
                      {
                        description: "Contexto UI actual",
                        value: serializePageContext(pageCtx),
                      },
                    ]
                  : [];
              })(),
              forwardedProps: {},
            };

            // Keep isLoading=true during the follow-up turn (user sees spinner)
            // Re-subscribe with a new inner subscription for the follow-up stream.
            // We intentionally do NOT reset executedTools / agentEmittedText here —
            // they are local to the outer closure and won't interfere with the
            // new inner subscription's own closure variables.
            const followUpSub = agent.run(followUpInput).subscribe({
              next: (rawEvent: BaseEvent) => {
                const fev = rawEvent as AguiEvent;
                switch (fev.type) {
                  case "TEXT_MESSAGE_START": {
                    const msgId = fev.messageId ?? genId();
                    setDisplayMessages((prev) => [
                      ...prev,
                      {
                        id: msgId,
                        role: "assistant",
                        content: "",
                        timestamp: new Date(),
                        isStreaming: true,
                      },
                    ]);
                    break;
                  }
                  case "TEXT_MESSAGE_CONTENT": {
                    const delta = fev.delta ?? "";
                    streamingDeltaRef.current += delta;
                    if (rafIdRef.current === null) {
                      rafIdRef.current = requestAnimationFrame(() => {
                        rafIdRef.current = null;
                        const buffered = streamingDeltaRef.current;
                        if (!buffered) return;
                        streamingDeltaRef.current = "";
                        startTransition(() => {
                          setDisplayMessages((prev) => {
                            const last = prev[prev.length - 1];
                            if (!last || last.role !== "assistant") return prev;
                            return [
                              ...prev.slice(0, -1),
                              {
                                ...last,
                                content: last.content + buffered,
                              },
                            ];
                          });
                        });
                      });
                    }
                    break;
                  }
                  case "TEXT_MESSAGE_END": {
                    if (rafIdRef.current !== null) {
                      cancelAnimationFrame(rafIdRef.current);
                      rafIdRef.current = null;
                    }
                    const rem = streamingDeltaRef.current;
                    streamingDeltaRef.current = "";
                    setDisplayMessages((prev) => {
                      const targetIdx = [...prev]
                        .reverse()
                        .findIndex(
                          (m) =>
                            m.role === "assistant" &&
                            m.kind !== "tool_call" &&
                            m.isStreaming,
                        );
                      if (targetIdx === -1) return prev;
                      const idx = prev.length - 1 - targetIdx;
                      const target = {
                        ...prev[idx],
                        content: prev[idx].content + rem,
                        isStreaming: false,
                      };
                      if (target.content.trim() === "") {
                        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
                      }
                      return [
                        ...prev.slice(0, idx),
                        target,
                        ...prev.slice(idx + 1),
                      ];
                    });
                    break;
                  }
                  case "MESSAGES_SNAPSHOT": {
                    const snapEv = fev as AguiEvent & {
                      messages?: AguiMessage[];
                    };
                    if (snapEv.messages && snapEv.messages.length > 0) {
                      messagesSnapshotRef.current = snapEv.messages;
                    }
                    break;
                  }
                  case "RUN_ERROR": {
                    if (rafIdRef.current !== null) {
                      cancelAnimationFrame(rafIdRef.current);
                      rafIdRef.current = null;
                    }
                    streamingDeltaRef.current = "";
                    setError(
                      fev.message ?? "Error en el asistente. Intenta de nuevo.",
                    );
                    setIsLoading(false);
                    break;
                  }
                  default:
                    break;
                }
              },
              error: (err: unknown) => {
                console.error("[useChat] Follow-up stream error", err);
                if (rafIdRef.current !== null) {
                  cancelAnimationFrame(rafIdRef.current);
                  rafIdRef.current = null;
                }
                streamingDeltaRef.current = "";
                setIsLoading(false);
              },
              complete: () => {
                if (rafIdRef.current !== null) {
                  cancelAnimationFrame(rafIdRef.current);
                  rafIdRef.current = null;
                }
                const rem2 = streamingDeltaRef.current;
                streamingDeltaRef.current = "";
                if (rem2) {
                  setDisplayMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (!last || last.role !== "assistant") return prev;
                    return [
                      ...prev.slice(0, -1),
                      { ...last, content: last.content + rem2 },
                    ];
                  });
                }
                setIsLoading(false);
              },
            });

            // Register follow-up abort so stop/reset can cancel it
            abortRef.current = () => followUpSub.unsubscribe();
          } else {
            setIsLoading(false);
          }
        },
      });

      // Store abort fn for stop/reset
      abortRef.current = () => subscription.unsubscribe();
    },
    [agent, auth, dispatchTool],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.();
      // Cancel any pending RAF to avoid setState after unmount
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      streamingDeltaRef.current = "";
    };
  }, []);

  // ── Session management ────────────────────────────────────────────────────

  function handleNewSession() {
    abortRef.current?.();
    abortRef.current = null;

    // Flush any in-flight tool_call messages to "done" so they don't get
    // saved to session history with a frozen spinner.
    const flushedMessages = displayMessages.map((m) =>
      m.kind === "tool_call" && m.toolStatus === "running"
        ? { ...m, toolStatus: "done" as const }
        : m,
    );

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              title: deriveTitle(flushedMessages),
              messages: flushedMessages,
              updatedAt: new Date(),
            }
          : s,
      ),
    );

    const session = newSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setDisplayMessages([GREETING]);
    threadIdRef.current = undefined;
    messagesSnapshotRef.current = null; // clear canonical history for new session
    setView("chat");
    setError(null);
    setIsLoading(false);
  }

  function handleSelectSession(id: string) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              title: deriveTitle(displayMessages),
              messages: displayMessages,
              updatedAt: new Date(),
            }
          : s,
      ),
    );
    const target = sessions.find((s) => s.id === id);
    setDisplayMessages(target?.messages ?? [GREETING]);
    setActiveSessionId(id);
    threadIdRef.current = target?.conversationId ?? undefined;
    setView("chat");
    setError(null);
  }

  function resetConversation() {
    abortRef.current?.();
    handleNewSession();
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string): Promise<void> => {
      if (isLoading || !text.trim()) return;

      // Optimistically add user message to display
      const userMsg: Message = {
        id: genId(),
        role: "user",
        content: text,
        timestamp: new Date(),
        isStreaming: false,
      };
      setDisplayMessages((prev) => [...prev, userMsg]);

      runAgentTurn(text);
    },
    [isLoading, runAgentTurn],
  );

  // ── Build activeSession ───────────────────────────────────────────────────

  const activeSessionBase = sessions.find((s) => s.id === activeSessionId);

  const activeSession: Session = {
    id: activeSessionId,
    title: activeSessionBase?.title ?? "Nueva conversación",
    conversationId: threadIdRef.current ?? null,
    messages: displayMessages,
    createdAt: activeSessionBase?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };

  // ── HITL stubs (interface compat) ─────────────────────────────────────────
  const approveAction = useCallback(
    async (_id: string): Promise<void> => {},
    [],
  );
  const rejectAction = useCallback(
    async (_id: string): Promise<void> => {},
    [],
  );

  return {
    sessions,
    activeSession,
    view,
    isTyping: isLoading,
    isLoading,
    error,
    pendingApproval: null,
    setView,
    handleNewSession,
    handleSelectSession,
    handleSend,
    resetConversation,
    approveAction,
    rejectAction,
  };
}
