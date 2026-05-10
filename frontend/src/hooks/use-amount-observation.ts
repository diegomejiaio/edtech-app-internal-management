import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import type { Voucher, VoucherValidationStatus } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VouchersResponse {
  items: Voucher[];
  counts_by_validation_status?: {
    valido: number;
    observado: number;
    rechazado: number;
  };
}

interface LiftAmountObservationParams {
  voucherId: string;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mutation hook to lift an amount observation.
 *
 * On success, updates the vouchers list cache to set amount_validation.lifted=true.
 * When this was the last active observation, the BFF also auto-transitions the
 * voucher to "valido" and returns { success: true, validation_status: "valido" } —
 * in that case the cache is updated with the new status too.
 * Stats and audit-log are invalidated — no refetch needed for the voucher itself (frontend-first).
 */
export function useLiftAmountObservation() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ voucherId, reason }: LiftAmountObservationParams) => {
      const token = await getToken();
      return api.patch<{
        success: boolean;
        validation_status?: VoucherValidationStatus;
      }>(
        `/vouchers/${voucherId}/lift-amount-observation`,
        { reason },
        { token },
      );
    },
    onSuccess: (data, { voucherId }) => {
      const newValidationStatus = data?.validation_status;

      // Update cached vouchers list: set amount_validation.lifted=true and
      // optionally update validation_status when the BFF auto-transitioned to "valido".
      queryClient.setQueriesData<InfiniteData<VouchersResponse>>(
        { queryKey: ["vouchers"] },
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === voucherId
                ? {
                    ...item,
                    amount_validation: item.amount_validation
                      ? { ...item.amount_validation, lifted: true }
                      : item.amount_validation,
                    ...(newValidationStatus
                      ? { validation_status: newValidationStatus }
                      : {}),
                  }
                : item,
            ),
          }));
          return { ...old, pages };
        },
      );

      // Also update the individual voucher detail cache so re-opening the sheet
      // shows the correct lifted state without a re-fetch.
      queryClient.setQueryData<Voucher>(["voucher", voucherId], (old) => {
        if (!old) return old;
        return {
          ...old,
          amount_validation: old.amount_validation
            ? { ...old.amount_validation, lifted: true }
            : old.amount_validation,
          ...(newValidationStatus
            ? { validation_status: newValidationStatus }
            : {}),
        };
      });

      // Invalidate stats and audit log
      queryClient.invalidateQueries({ queryKey: ["vouchers-stats"] });
      queryClient.invalidateQueries({
        queryKey: ["voucher-audit-log", voucherId],
      });
      // Invalidate flat vouchers-all query used for exports
      queryClient.invalidateQueries({ queryKey: ["vouchers-all"] });
      // When status auto-transitioned, invalidate the full vouchers list and stats
      // so counts_by_validation_status and filtered views (e.g. "Observados" tab) stay consistent.
      if (newValidationStatus) {
        queryClient.invalidateQueries({ queryKey: ["vouchers"] });
        queryClient.invalidateQueries({
          queryKey: ["vouchers-stats-by-company"],
        });
      }
    },
  });
}
