"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Plus,
  X,
  MessageSquare,
  AlertTriangle,
  Zap,
  Navigation,
  Building2,
  Calendar,
  Filter,
  FileText,
  Eye,
  Search,
  Loader2,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useChat, buildToolLabel } from "@/hooks/use-chat";
import { formatTime, formatRelativeDate } from "@/lib/chat-utils";
import { useAssistantAvailable } from "@/providers/copilotkit-provider";
import type { Message, Session } from "@/hooks/use-chat";
import type { ApprovalRequest } from "@/types/chat";

// ─── AI sparkle icon ──────────────────────────────────────────────────────────

function AiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2C12 2 13.5 7.5 16 10C18.5 12.5 22 12 22 12C22 12 18.5 11.5 16 14C13.5 16.5 12 22 12 22C12 22 10.5 16.5 8 14C5.5 11.5 2 12 2 12C2 12 5.5 12.5 8 10C10.5 7.5 12 2 12 2Z"
        fill="currentColor"
      />
      <path
        d="M19 3C19 3 19.75 5.25 21 6.5C22.25 7.75 24 8 24 8C24 8 22.25 7.75 21 9C19.75 10.25 19 12 19 12C19 12 18.25 10.25 17 9C15.75 7.75 14 8 14 8C14 8 15.75 7.75 17 6.5C18.25 5.25 19 3 19 3Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

// ─── Markdown components for assistant messages ───────────────────────────────
// react-markdown v10 removed className from top-level props.
// We pass styled component overrides instead of a wrapper className.

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mt-2 text-sm font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-2 text-sm font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-1.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-1 text-sm font-medium first:mt-0">{children}</h4>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <code
        className={cn(
          "block rounded-lg bg-black/10 dark:bg-white/10 p-2.5 text-xs overflow-x-auto",
          className,
        )}
      >
        {children}
      </code>
    ) : (
      <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 text-xs">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-1 overflow-x-auto">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-current pl-2.5 opacity-70 my-1">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="border-current opacity-20 my-2" />,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
};

// ─── Tool call icon mapper ────────────────────────────────────────────────────

function ToolIcon({
  toolName,
  className,
}: {
  toolName: string;
  className?: string;
}) {
  const props = { className: cn("h-3 w-3", className), "aria-hidden": true };
  switch (toolName) {
    case "navigate_to":
      return <Navigation {...props} />;
    case "select_company":
      return <Building2 {...props} />;
    case "set_period":
      return <Calendar {...props} />;
    case "apply_filter":
      return <Filter {...props} />;
    case "open_voucher_detail":
      return <FileText {...props} />;
    case "get_current_page":
      return <Eye {...props} />;
    case "get_selected_company":
    case "get_active_period":
    case "get_active_filters":
      return <Search {...props} />;
    default:
      return <Zap {...props} />;
  }
}

// ─── Tool args summary (human-readable, compact) ─────────────────────────────

function ToolArgsSummary({
  toolName,
  args,
}: {
  toolName: string;
  args: Record<string, unknown>;
}) {
  if (!args || Object.keys(args).length === 0) return null;

  // Per-tool readable summary
  switch (toolName) {
    case "navigate_to": {
      const route = args.route as string | undefined;
      return route ? (
        <span className="text-[10px] font-mono text-muted-foreground/60 truncate">
          {route}
        </span>
      ) : null;
    }
    case "select_company": {
      const name = (args.company_name ?? args.company_id) as string | undefined;
      return name ? (
        <span className="text-[10px] text-muted-foreground/60 truncate">
          {name}
        </span>
      ) : null;
    }
    case "set_period": {
      const period = args.period as string | undefined;
      if (!period) return null;
      // Format YYYYMM → Mes YYYY
      const months = [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
      ];
      const y = period.slice(0, 4);
      const m = parseInt(period.slice(4, 6), 10);
      const label = m >= 1 && m <= 12 ? `${months[m - 1]} ${y}` : period;
      return (
        <span className="text-[10px] font-mono text-muted-foreground/60">
          {label}
        </span>
      );
    }
    case "apply_filter": {
      return (
        <span className="text-[10px] font-mono text-muted-foreground/60 truncate">
          {String(args.filter_name)} = {String(args.value)}
        </span>
      );
    }
    case "open_voucher_detail": {
      const vid = args.voucher_id as string | undefined;
      return vid ? (
        <span className="text-[10px] font-mono text-muted-foreground/60 truncate">
          {vid}
        </span>
      ) : null;
    }
    default:
      return null;
  }
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isAction = message.kind === "action";
  const isToolCall = message.kind === "tool_call";
  const isError =
    !isUser &&
    typeof message.content === "string" &&
    message.content.startsWith("⚠️");

  // ── Tool call — OpenCode-style row ────────────────────────────────────────
  if (isToolCall) {
    const status = message.toolStatus ?? "running";
    const label = buildToolLabel(
      message.toolName ?? "",
      message.toolArgs ?? {},
      status,
    );
    const isRunning = status === "running";

    return (
      <div className="flex w-full justify-start pl-0.5">
        <div
          className={cn(
            "flex items-center gap-2 py-0.5",
            isRunning ? "text-foreground/70" : "text-muted-foreground/50",
          )}
        >
          {/* Status icon */}
          <span className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
            {isRunning ? (
              <Loader2
                className="h-3 w-3 animate-spin text-primary/70"
                aria-hidden="true"
              />
            ) : (
              <Check
                className="h-3 w-3 text-muted-foreground/40"
                aria-hidden="true"
              />
            )}
          </span>

          {/* Tool icon */}
          <ToolIcon
            toolName={message.toolName ?? ""}
            className={
              isRunning ? "text-primary/60" : "text-muted-foreground/30"
            }
          />

          {/* Label */}
          <span
            className={cn(
              "text-xs",
              isRunning ? "text-foreground/60" : "text-muted-foreground/40",
            )}
          >
            {label}
          </span>

          {/* Args (compact) */}
          {message.toolArgs && Object.keys(message.toolArgs).length > 0 && (
            <ToolArgsSummary
              toolName={message.toolName ?? ""}
              args={message.toolArgs}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Action chip (tool-only confirmation) ──────────────────────────────────
  if (isAction) {
    return (
      <div className="flex w-full justify-start">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <Zap
            className="h-3 w-3 shrink-0 text-primary/70"
            aria-hidden="true"
          />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  // ── Assistant message with no content yet (streaming hasn't started) ────────
  // Instead of a blank bubble, show the animated typing dots inline in the
  // same bubble shape — this eliminates the flash of an empty pill and
  // smoothly transitions into text once the first token arrives.
  if (!isUser && !isAction && !isToolCall && !message.content) {
    if (message.isStreaming) {
      return (
        <div className="flex w-full gap-2 flex-row">
          <div className="group max-w-[82%] flex flex-col space-y-0.5 items-start">
            <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-3 text-sm leading-relaxed">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 1.1,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.18,
                    }}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "group max-w-[82%] flex flex-col space-y-0.5",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-secondary text-secondary-foreground"
              : isError
                ? "rounded-tl-sm bg-destructive/10 text-destructive border border-destructive/20"
                : "rounded-tl-sm bg-muted/60 text-foreground",
          )}
        >
          {isUser ? (
            // User messages: plain text (no markdown needed)
            <>{typeof message.content === "string" ? message.content : ""}</>
          ) : (
            // Assistant messages: render markdown
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={MARKDOWN_COMPONENTS}
            >
              {typeof message.content === "string" ? message.content : ""}
            </ReactMarkdown>
          )}
          {message.isStreaming && message.content.length > 0 && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[1px] animate-pulse rounded-full bg-current opacity-70"
            />
          )}
        </div>
        <span className="px-1 text-[10px] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

// ─── Typing indicator (Framer Motion) ─────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
          />
        ))}
      </div>
    </div>
  );
}

// ─── HITL Confirmation Dialog ─────────────────────────────────────────────────

interface HitlDialogProps {
  approval: ApprovalRequest;
  onConfirm: () => void;
  onCancel: () => void;
}

function HitlDialog({ approval, onConfirm, onCancel }: HitlDialogProps) {
  const metadataEntries = approval.metadata
    ? Object.entries(approval.metadata).filter(
        ([, v]) => v !== null && v !== undefined && v !== "",
      )
    : [];

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{approval.title}</AlertDialogTitle>
          {approval.description && (
            <AlertDialogDescription>
              {approval.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {metadataEntries.length > 0 && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm space-y-1">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/_/g, " ")}
                </span>
                <span className="font-medium text-right truncate max-w-[60%]">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── History view ─────────────────────────────────────────────────────────────

interface HistoryViewProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

function HistoryView({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: HistoryViewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* New chat button */}
      <div className="shrink-0 px-3 py-3 border-b">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-sm font-normal"
          onClick={onNewSession}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Nueva conversación
        </Button>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col py-2">
          {sessions.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin conversaciones aún
            </p>
          )}
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "group flex w-full items-start gap-3 px-3 py-2.5 text-left",
                "transition-colors hover:bg-muted/50",
                session.id === activeSessionId && "bg-muted/40",
              )}
            >
              <MessageSquare
                aria-hidden="true"
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 transition-colors",
                  session.id === activeSessionId
                    ? "text-primary"
                    : "text-muted-foreground/50 group-hover:text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm",
                    session.id === activeSessionId
                      ? "font-medium text-foreground"
                      : "text-foreground/80",
                  )}
                >
                  {session.title}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                  {formatRelativeDate(session.updatedAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Chat view ────────────────────────────────────────────────────────────────

interface ChatViewProps {
  session: Session;
  isLoading: boolean;
  error: string | null;
  onSend: (text: string) => void;
}

/**
 * Groups consecutive tool_call messages into a single visual block.
 * Non-tool messages are kept as-is (wrapped in single-item groups).
 */
type MessageGroup =
  | { type: "tool_block"; messages: Message[] }
  | { type: "message"; message: Message };

function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let toolBuf: Message[] = [];

  for (const msg of messages) {
    if (msg.kind === "tool_call") {
      toolBuf.push(msg);
    } else {
      if (toolBuf.length > 0) {
        groups.push({ type: "tool_block", messages: toolBuf });
        toolBuf = [];
      }
      groups.push({ type: "message", message: msg });
    }
  }

  if (toolBuf.length > 0) {
    groups.push({ type: "tool_block", messages: toolBuf });
  }

  return groups;
}

function ChatView({ session, isLoading, error, onSend }: ChatViewProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom within the ScrollArea viewport — NOT using scrollIntoView
  // because it can bubble up to the main page scroll container.
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [session.messages, isLoading]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Stop propagation so keydown events (Enter, Space, arrows) don't bubble up
    // to the main content scroll container and cause unwanted page scrolling.
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const groups = groupMessages(session.messages);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {/* role="log" for accessibility — screen readers announce new messages */}
        <div
          role="log"
          aria-label="Mensajes del asistente"
          aria-live="polite"
          className="flex flex-col gap-2 px-4 py-4"
        >
          {/* Date separator */}
          <div className="flex items-center justify-center">
            <span className="rounded-full bg-muted/50 px-2.5 py-0.5 text-[10px] text-muted-foreground/70 backdrop-blur-sm">
              {session.createdAt.toLocaleDateString("es-PE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>

          {groups.map((group, idx) => {
            if (group.type === "tool_block") {
              return (
                <div
                  key={`tool-block-${idx}-${group.messages[0].id}`}
                  className="flex flex-col gap-0.5"
                >
                  {group.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </div>
              );
            }
            return (
              <MessageBubble key={group.message.id} message={group.message} />
            );
          })}

          {/* Typing indicator — shown when loading but no streaming/tool activity yet */}
          {isLoading &&
            !session.messages.some(
              (m) =>
                (m.role === "assistant" && m.isStreaming) ||
                m.kind === "tool_call",
            ) && <TypingIndicator />}
        </div>
      </ScrollArea>

      {/* Error banner (above input) */}
      {error && <ErrorBanner message={error} />}

      {/* Input area */}
      <div className="shrink-0 border-t p-3 bg-white/30 dark:bg-[#0f0f14]/25 backdrop-blur-[16px] border-black/7 dark:border-white/8">
        <div className="rounded-xl border transition-shadow focus-within:ring-1 focus-within:ring-border/50 bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje…"
            aria-label="Mensaje"
            rows={1}
            disabled={isLoading}
            className="min-h-[36px] max-h-[120px] resize-none rounded-t-xl rounded-b-none border-0 bg-transparent px-3 pt-3 pb-1 text-sm leading-relaxed shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <p className="text-[10px] text-muted-foreground/50">
              Enter para enviar · Shift+Enter nueva línea
            </p>
            <Button
              size="icon"
              variant={input.trim() ? "default" : "ghost"}
              className={cn(
                "h-7 w-7 rounded-lg transition-all",
                !input.trim() && "text-muted-foreground",
              )}
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Enviar mensaje"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat panel (standalone, no Sheet wrapper) ────────────────────────────────

interface ChatPanelProps {
  /** Called when the user clicks the close (X) button in the header. */
  onClose?: () => void;
}

/**
 * ChatPanel — the full chat UI (header + body) as a standalone panel.
 *
 * Designed to be rendered inside ToolsSidebar's right sidebar content area.
 * All CopilotKit hooks live here — must be rendered inside <CopilotKit>.
 */
export function ChatPanel({ onClose }: ChatPanelProps = {}) {
  const {
    sessions,
    activeSession,
    view: currentView,
    isLoading,
    error,
    pendingApproval,
    setView,
    handleNewSession,
    handleSelectSession,
    handleSend,
    approveAction,
    rejectAction,
  } = useChat();

  return (
    <>
      {/* HITL Confirmation Dialog — rendered outside panel body so it stacks on top */}
      {pendingApproval && (
        <HitlDialog
          approval={pendingApproval}
          onConfirm={() => approveAction(pendingApproval.id)}
          onCancel={() => rejectAction(pendingApproval.id)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5 bg-white/25 dark:bg-[#0f0f14]/20 backdrop-blur-[16px]">
        {/* Back / history toggle */}
        {currentView === "history" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setView("chat")}
            aria-label="Volver al chat"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setView("history")}
            aria-label="Ver historial de conversaciones"
            title="Historial"
          >
            <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
          </Button>
        )}

        {/* Title */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {currentView === "chat" ? (
            <>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <AiIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none tracking-tight truncate">
                  ClearBookAI (beta)
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Copiloto de productividad
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Historial
            </p>
          )}
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-1">
          {currentView === "chat" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
              onClick={handleNewSession}
              aria-label="Nueva conversación"
              title="Nueva conversación"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label="Cerrar panel"
              title="Cerrar"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {currentView === "chat" ? (
          <ChatView
            session={activeSession}
            isLoading={isLoading}
            error={error}
            onSend={handleSend}
          />
        ) : (
          <HistoryView
            sessions={sessions}
            activeSessionId={activeSession.id}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
          />
        )}
      </div>
    </>
  );
}

// ─── Legacy ChatBubble export (kept for any remaining references) ─────────────

/**
 * @deprecated Use ToolsSidebar + ChatPanel instead.
 * Kept temporarily to avoid breaking any imports during migration.
 */
export function ChatBubble() {
  const assistantAvailable = useAssistantAvailable();

  if (
    process.env.NEXT_PUBLIC_ASSISTANT_ENABLED !== "true" ||
    !assistantAvailable
  ) {
    return null;
  }

  // ChatPanel is now rendered inside ToolsSidebar — nothing to render here.
  return null;
}
