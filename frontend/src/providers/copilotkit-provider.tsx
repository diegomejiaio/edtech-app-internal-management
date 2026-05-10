"use client";

/**
 * AssistantProvider — provides the AG-UI HttpAgent to the app.
 *
 * Integration strategy:
 * - Creates an @ag-ui/client HttpAgent pointed at the BFF proxy
 *   (/api/v1/assistant/chat), which forwards to back/ai-assistant.
 * - The HttpAgent speaks AG-UI SSE natively — no CopilotKit Runtime needed.
 * - use-chat.ts calls agent.run() directly to stream responses.
 *
 * Auth strategy:
 * - DEV_MODE: sends X-Dev-Tenant header (no JWT needed)
 * - Production: resolves Clerk JWT and injects Authorization header
 *
 * Availability strategy:
 * - On mount, performs a lightweight health check to /api/v1/assistant/health.
 * - If the endpoint is unreachable or returns non-2xx, `assistantAvailable`
 *   is set to false and the ChatBubble hides itself. No errors thrown.
 *
 * NOTE: The file is still named copilotkit-provider.tsx and exports
 * `CopilotKitProvider` / `useAssistantAvailable` to avoid touching the import
 * graph in layout.tsx and chat-bubble.tsx.
 */

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
} from "react";
import { HttpAgent } from "@ag-ui/client";
import { useAuthContext } from "@/providers/auth-provider";
import { DEV_MODE, DEV_DEFAULTS, env } from "@/lib/env";

// In production (static export on Azure), URLs are relative — the Azure Static
// Web Apps proxy rewrites /api/v1/* to the BFF.
// In local dev, Next.js is static (no rewrites), so we must use the absolute
// BFF URL from NEXT_PUBLIC_API_URL (e.g. http://localhost:8000).
const _BASE = env.apiUrl || "";
export const CHAT_ENDPOINT_URL = `${_BASE}/api/v1/assistant/chat`;
const HEALTH_CHECK_URL = `${_BASE}/api/v1/assistant/health`;

// ─── Context ─────────────────────────────────────────────────────────────────

interface AssistantContextValue {
  assistantAvailable: boolean;
  /** AG-UI HttpAgent instance. Null until auth headers are resolved. */
  agent: HttpAgent | null;
}

const AssistantContext = createContext<AssistantContextValue>({
  assistantAvailable: false,
  agent: null,
});

export function useAssistantAvailable(): boolean {
  return useContext(AssistantContext).assistantAvailable;
}

export function useAssistantAgent(): HttpAgent | null {
  return useContext(AssistantContext).agent;
}

// ─── Internal: resolves auth headers ─────────────────────────────────────────

function useCopilotHeaders(): Record<string, string> | null {
  const auth = useAuthContext();

  // In DEV_MODE the headers are static and never change — initialise directly.
  const [headers, setHeaders] = useState<Record<string, string> | null>(
    DEV_MODE ? { "X-Dev-Tenant": DEV_DEFAULTS.tenantId } : null,
  );

  useEffect(() => {
    // DEV_MODE headers are set at init time — nothing to do here.
    if (DEV_MODE) return;

    if (!auth.isLoaded || !auth.isSignedIn) return;

    auth
      .getToken()
      .then((token) => {
        setHeaders(token ? { Authorization: `Bearer ${token}` } : {});
      })
      .catch(() => {
        setHeaders({});
      });
  }, [auth.isLoaded, auth.isSignedIn]);

  return headers;
}

// ─── Internal: health check ───────────────────────────────────────────────────

type AvailabilityState = "pending" | "available" | "unavailable";

function useAssistantHealth(
  headers: Record<string, string> | null,
): AvailabilityState {
  const [state, setState] = useState<AvailabilityState>("pending");

  useEffect(() => {
    // Wait until headers are resolved before probing
    if (headers === null) return;

    let cancelled = false;

    fetch(HEALTH_CHECK_URL, {
      method: "GET",
      headers,
      // Short timeout — don't block the UI waiting for a dead service
      signal: AbortSignal.timeout(4_000),
    })
      .then(async (res) => {
        if (!cancelled) {
          if (!res.ok) {
            setState("unavailable");
            return;
          }
          const body = await res.json().catch(() => ({}));
          setState(body?.status === "healthy" ? "available" : "unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("unavailable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [headers]);

  return state;
}

// ─── Exported provider ────────────────────────────────────────────────────────

interface CopilotKitProviderProps {
  children: ReactNode;
}

export function CopilotKitProvider({ children }: CopilotKitProviderProps) {
  const headers = useCopilotHeaders();
  const health = useAssistantHealth(headers);

  // Build the AG-UI HttpAgent — recreate whenever headers change so the new
  // auth token is picked up.
  const agent = useMemo(() => {
    if (headers === null) return null;
    return new HttpAgent({
      url: CHAT_ENDPOINT_URL,
      headers,
    });
  }, [headers]);

  // Feature flag guard — if the flag is off, skip everything
  if (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED !== "true") {
    return <>{children}</>;
  }

  // Auth headers not yet resolved — agent not ready yet.
  if (headers === null || agent === null) {
    return (
      <AssistantContext.Provider
        value={{ assistantAvailable: false, agent: null }}
      >
        {children}
      </AssistantContext.Provider>
    );
  }

  // Backend confirmed unavailable — hide the bubble.
  // In dev: keep the agent available so errors are visible in console/DevTools.
  if (health === "unavailable" && !DEV_MODE) {
    return (
      <AssistantContext.Provider
        value={{ assistantAvailable: false, agent: null }}
      >
        {children}
      </AssistantContext.Provider>
    );
  }

  // Health check in-flight (pending) or confirmed available — show the bubble.
  const assistantAvailable = health !== "unavailable";

  return (
    <AssistantContext.Provider value={{ assistantAvailable, agent }}>
      {children}
    </AssistantContext.Provider>
  );
}
