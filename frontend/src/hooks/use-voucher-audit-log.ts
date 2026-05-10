import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Discriminated union for audit log entries — only present fields per action */
export type VoucherAuditEntry =
  | {
      id: string;
      action: "status_changed";
      previous_status: string | null;
      new_status: string;
      reason?: string | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "comment_added";
      text: string;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "attachment_added";
      name: string;
      path: string;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "tc_observation_lifted";
      confirmed_tc: number;
      reason?: string | null;
      original_official_rate?: number | null;
      original_voucher_rate?: number | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "tc_validation_passed";
      details?: Record<string, unknown> | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "tc_validation_failed";
      details?: Record<string, unknown> | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "detraccion_observation_lifted";
      reason?: string | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "amount_observation_lifted";
      reason?: string | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "amount_validation_passed";
      details?: Record<string, unknown> | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "amount_validation_failed";
      details?: Record<string, unknown> | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "detraction_payment_confirmed";
      details?: Record<string, unknown> | null;
      by: string;
      by_name?: string | null;
      at: string;
    }
  | {
      id: string;
      action: "detraction_payment_not_found";
      details?: Record<string, unknown> | null;
      by: string;
      by_name?: string | null;
      at: string;
    };

interface VoucherAuditLogResponse {
  voucher_id: string;
  items: VoucherAuditEntry[];
  total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the audit log for a voucher.
 *
 * Only fetches when `voucherId` is non-null. Returns entries sorted newest-first
 * (the backend handles the sort).
 */
export function useVoucherAuditLog(voucherId: string | null) {
  const { getToken } = useAuthContext();

  return useQuery<VoucherAuditLogResponse>({
    queryKey: ["voucher-audit-log", voucherId],
    queryFn: async () => {
      const token = await getToken();
      return api.get<VoucherAuditLogResponse>(
        `/vouchers/${voucherId}/audit-log`,
        { token },
      );
    },
    enabled: !!voucherId,
    staleTime: 30_000, // 30s — audit log doesn't change that often
  });
}
