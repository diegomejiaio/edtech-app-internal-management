// Pure utility functions for chat — no React, no side effects

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export type PanelView = "chat" | "history";

/** Generate a short random id */
export function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** Format a Date as HH:MM in es-PE locale */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Return a human-readable relative date string */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "Ahora";
  if (mins < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return "Ayer";
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

/** Derive a readable title from the first user message in a session */
export function deriveTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Nueva conversación";
  return first.content.length > 48
    ? first.content.slice(0, 48) + "\u2026"
    : first.content;
}

/** Create a brand-new session with the default greeting */
export function createNewSession(): Session {
  const now = new Date();
  return {
    id: genId(),
    title: "Nueva conversación",
    messages: [
      {
        id: genId(),
        role: "assistant",
        content: "Hola 👋 Soy ClearBookAI. ¿En qué puedo ayudarte hoy?",
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
