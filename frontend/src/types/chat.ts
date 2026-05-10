// Types for ClearBookAI chat feature (AG-UI protocol)
// Frontend types for SSE streaming, tool definitions, and hook contracts.

// ---------------------------------------------------------------------------
// Core chat message types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
}

// ---------------------------------------------------------------------------
// Frontend Tool definitions (AG-UI protocol)
// Sent in every POST body so the LLM knows which browser-side tools exist.
// ---------------------------------------------------------------------------

export interface FrontendToolParameter {
  type: string;
  description?: string;
  enum?: string[];
}

export interface FrontendToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, FrontendToolParameter>;
    required?: string[];
  };
}

// ---------------------------------------------------------------------------
// AG-UI Event types (SSE stream events from ai-assistant)
// ---------------------------------------------------------------------------

export type AGUIEventType =
  | "TEXT_MESSAGE_START"
  | "TEXT_MESSAGE_CONTENT"
  | "TEXT_MESSAGE_END"
  | "TOOL_CALL_START"
  | "TOOL_CALL_ARGS"
  | "TOOL_CALL_END"
  | "APPROVAL_REQUEST"
  | "RUN_STARTED"
  | "RUN_FINISHED"
  | "RUN_ERROR"
  | "CUSTOM";

export interface AGUIEvent {
  type: AGUIEventType;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// HITL (Human-in-the-Loop) approval request
// ---------------------------------------------------------------------------

export interface ApprovalRequest {
  id: string;
  toolCallId?: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Context provided by the app to Frontend Tool handlers
// ---------------------------------------------------------------------------

export interface ChatAppContext {
  selectedCompanyId?: string | null;
  selectedCompanyName?: string | null;
  activePeriod?: string | null;
  activeFilters?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// useChat hook interface
// ---------------------------------------------------------------------------

export interface UseChatOptions {
  onNavigate?: (route: string) => void;
  onSelectCompany?: (companyId: string) => void;
  /** period in YYYYMM format */
  onSetPeriod?: (period: string) => void;
  onApplyFilter?: (filterName: string, value: string) => void;
  onOpenVoucher?: (voucherId: string) => void;
  getContext?: () => ChatAppContext;
}

export interface UseChatReturn {
  sessions: import("@/hooks/use-chat").Session[];
  activeSession: import("@/hooks/use-chat").Session;
  view: import("@/hooks/use-chat").PanelView;
  /** Legacy alias for isLoading (ChatBubble compatibility) */
  isTyping: boolean;
  isLoading: boolean;
  error: string | null;
  pendingApproval: ApprovalRequest | null;
  setView: (v: import("@/hooks/use-chat").PanelView) => void;
  handleNewSession: () => void;
  handleSelectSession: (id: string) => void;
  handleSend: (text: string) => Promise<void>;
  resetConversation: () => void;
  approveAction: (approvalId: string) => Promise<void>;
  rejectAction: (approvalId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// UI Action Tools — tool definitions sent in every AG-UI POST request.
// The LLM decides which to call; the hook executes them in the browser.
// ---------------------------------------------------------------------------

export const UI_ACTION_TOOLS: FrontendToolDefinition[] = [
  {
    name: "navigate_to",
    description:
      "Navega a una ruta de la aplicación Clearbook. Útil para mostrar páginas específicas al usuario.",
    parameters: {
      type: "object",
      properties: {
        route: {
          type: "string",
          description:
            "Ruta completa de la app, ej: /notifications, /comprobantes, /companies, /communications/email, /dashboard/2025",
        },
        params: {
          type: "object",
          description: "Query params opcionales",
        },
      },
      required: ["route"],
    },
  },
  {
    name: "select_company",
    description:
      "Selecciona una empresa en el contexto activo de la aplicación.",
    parameters: {
      type: "object",
      properties: {
        company_id: {
          type: "string",
          description: "ID de la empresa con prefijo comp-",
        },
        company_name: {
          type: "string",
          description:
            "Nombre de la empresa (opcional, para confirmación visual)",
        },
      },
      required: ["company_id"],
    },
  },
  {
    name: "set_period",
    description:
      "Cambia el período contable activo (mes/año). Formato YYYYMM, ej: 202401.",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Período en formato YYYYMM, ej: 202401",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "apply_filter",
    description: "Aplica un filtro en la tabla activa de la aplicación.",
    parameters: {
      type: "object",
      properties: {
        filter_name: {
          type: "string",
          enum: ["validation_status", "is_read", "company_id", "label"],
          description: "Tipo de filtro a aplicar",
        },
        value: {
          type: "string",
          description: "Valor del filtro",
        },
      },
      required: ["filter_name", "value"],
    },
  },
  {
    name: "open_voucher_detail",
    description: "Abre el panel de detalle de un comprobante.",
    parameters: {
      type: "object",
      properties: {
        voucher_id: {
          type: "string",
          description: "ID del comprobante con prefijo vchr-",
        },
      },
      required: ["voucher_id"],
    },
  },
  {
    name: "get_current_page",
    description: "Retorna la ruta actual de la aplicación.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_selected_company",
    description:
      "Retorna el ID y nombre de la empresa actualmente seleccionada.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_active_period",
    description: "Retorna el período contable activo en formato YYYYMM.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_active_filters",
    description: "Retorna los filtros activos en la tabla visible.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];
