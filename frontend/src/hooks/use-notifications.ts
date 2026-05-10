import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import { env } from "@/lib/env";

// AI summary types
export interface KeyAmount {
  concept: string;
  amount: number | null;
  currency: string;
}

export type AiSummaryStatus = "completed" | "failed" | "fallback" | "skipped";
export type CriticalityLevel =
  | "CRÍTICO"
  | "URGENTE"
  | "PREVENTIVO"
  | "IMPORTANTE"
  | "REVISAR"
  | "INFORMATIVO"
  | "HISTÓRICO";

export interface AiSummary {
  status: AiSummaryStatus;
  criticality_level: CriticalityLevel | null;
  criticality_reason: string | null;
  summary: string | null;
  key_amounts: KeyAmount[];
  deadline_hint: string | null;
  required_action: string | null;
  document_type_detected: string | null;
  source_used: string | null;
  processed_at: string | null;
  model_version: string | null;
  prompt_version: string | null;
  processing_notes: string | null;
  error: string | null;
}

// Tipo de notificación del backend
export interface Notification {
  id: string;
  tenant_id: string;
  company_id: string;
  message_id: string;
  ruc: string;
  business_name: string | null;
  subject: string;
  labels: string[];
  received_at: string;
  date_text: string | null;
  message_body: string | null; // Parsed text content (for notifications without PDF)
  document: {
    storage_path: string;
    content_type: string;
  } | null;
  has_document: boolean;
  is_read: boolean;
  ai_summary: AiSummary | null;
  created_at: string;
}

interface NotificationsResponse {
  items: Notification[];
  next_cursor: string | null;
  has_more: boolean;
}

interface UseNotificationsParams {
  company_id?: string;
  label?: string;
  is_read?: boolean;
  limit?: number;
  /** Start date filter (ISO 8601 UTC string) */
  start_date?: string;
  /** End date filter (ISO 8601 UTC string) */
  end_date?: string;
  /** Polling interval in ms - useful for live updates during sync */
  refetchInterval?: number | false;
}

export function useNotifications(params: UseNotificationsParams = {}) {
  const { getToken } = useAuthContext();
  const limit = params.limit || 20;

  return useInfiniteQuery({
    queryKey: [
      "notifications",
      params.company_id,
      params.label,
      params.is_read,
      params.limit,
      params.start_date,
      params.end_date,
    ],
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      return api.get<NotificationsResponse>("/notifications", {
        token,
        params: {
          limit,
          cursor: pageParam || undefined,
          company_id: params.company_id,
          label: params.label,
          is_read: params.is_read?.toString(),
          start_date: params.start_date,
          end_date: params.end_date,
        },
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    retry: env.isProd ? 3 : 1,
    refetchInterval: params.refetchInterval,
  });
}

interface UseNotificationsStatsParams {
  /** Polling interval in ms - useful for live updates during sync */
  refetchInterval?: number | false;
}

export function useNotificationsStats(
  params: UseNotificationsStatsParams = {},
) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["notifications-stats"],
    queryFn: async () => {
      const token = await getToken();
      return api.get<NotificationsStats>("/notifications/stats", { token });
    },
    refetchInterval: params.refetchInterval,
    retry: env.isProd ? 3 : 1,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAuthContext();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getToken();
      return api.post<{ success: boolean }>(
        `/notifications/${notificationId}/read`,
        {},
        { token },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-stats"] });
    },
  });
}

export function useNotificationDocument(notificationId: string) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["notification-document", notificationId],
    queryFn: async () => {
      const token = await getToken();
      return api.get<{ url: string }>(
        `/notifications/${notificationId}/document`,
        { token },
      );
    },
    enabled: !!notificationId,
  });
}

// Stats del dashboard
export interface NotificationsStats {
  total: number;
  ultimas24h: number;
  ultimos7dias: number;
  tipos: number;
  clientes: number;
}
