"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToolId = "chat" | "exchange" | "calculator";

interface ToolsSidebarState {
  activeTool: ToolId | null;
  openTool: (tool: ToolId) => void;
  closeTool: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToolsSidebarContext = createContext<ToolsSidebarState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToolsSidebarProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  function openTool(tool: ToolId) {
    setActiveTool(tool);
  }

  function closeTool() {
    setActiveTool(null);
  }

  return (
    <ToolsSidebarContext.Provider value={{ activeTool, openTool, closeTool }}>
      {children}
    </ToolsSidebarContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToolsSidebar(): ToolsSidebarState {
  const ctx = useContext(ToolsSidebarContext);
  if (!ctx) {
    throw new Error(
      "useToolsSidebar must be used inside <ToolsSidebarProvider>",
    );
  }
  return ctx;
}
