"use client";

import { Bot, Calculator, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "@/components/chat-bubble";
import { ExchangeRatePanel } from "./exchange-rate-panel";
import { useAssistantAvailable } from "@/providers/copilotkit-provider";
import { useToolsSidebar, type ToolId } from "@/providers/tools-sidebar-store";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Width of the expanded tool panel — chat uses narrow, exchange uses wider */
const PANEL_W_CHAT = "380px";
const PANEL_W_EXCHANGE = "480px";

// ─── Tool definitions ─────────────────────────────────────────────────────────

interface Tool {
  id: ToolId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  available: boolean;
}

export const TOOLS: Tool[] = [
  { id: "chat", label: "ClearBookAI (beta)", icon: Bot, available: true },
  {
    id: "exchange",
    label: "Tipo de cambio",
    icon: DollarSign,
    available: true,
  },
  {
    id: "calculator",
    label: "Calculadora",
    icon: Calculator,
    available: false,
  },
];

// ─── Placeholder panel ────────────────────────────────────────────────────────

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs">Próximamente</p>
    </div>
  );
}

// ─── ToolsSidebar ─────────────────────────────────────────────────────────────

/**
 * Right panel that expands to PANEL_W when a tool is active, 0 when closed.
 * Triggers live in AppSidebar (footer Tools section) — not here.
 */
export function ToolsSidebar() {
  const assistantEnabled = process.env.NEXT_PUBLIC_ASSISTANT_ENABLED === "true";
  const assistantAvailable = useAssistantAvailable();
  const chatAvailable = assistantEnabled && assistantAvailable;
  const { activeTool, closeTool } = useToolsSidebar();

  const isExpanded = activeTool !== null;

  return (
    <aside
      aria-label="Panel de herramientas"
      className={cn(
        "sticky top-0 hidden md:flex flex-col h-svh",
        "border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-200 ease-linear overflow-hidden",
        "shrink-0",
        // Show border only when expanded
        isExpanded && "border-l",
      )}
      style={{
        width: isExpanded
          ? activeTool === "exchange"
            ? PANEL_W_EXCHANGE
            : PANEL_W_CHAT
          : "0px",
      }}
    >
      {isExpanded && (
        <div className="flex h-full flex-col overflow-hidden">
          {activeTool === "chat" && chatAvailable && (
            <ChatPanel onClose={closeTool} />
          )}
          {activeTool === "exchange" && (
            <ExchangeRatePanel onClose={closeTool} />
          )}
          {activeTool === "calculator" && (
            <PlaceholderPanel label="Calculadora" />
          )}
        </div>
      )}
    </aside>
  );
}
