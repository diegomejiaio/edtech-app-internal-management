import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import type { Voucher, VoucherValidationStatus } from "@/types";

interface VouchersResponse {
  items: Voucher[];
  counts_by_validation_status?: {
    valido: number;
    observado: number;
    rechazado: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BulkUpdateValidationStatusParams {
  voucher_ids: string[];
  validation_status: VoucherValidationStatus;
  reason?: string;
}

interface BulkUpdateValidationStatusResponse {
  updated: number;
  requested: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mutation hook to bulk-update the validation status of multiple vouchers
 * belonging to the same company (the currently filtered company).
 *
 * On success, invalidates the vouchers list query so counts and statuses
 * refresh without manual interaction.
 */
export function useBulkUpdateVoucherValidationStatus() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      voucher_ids,
      validation_status,
      reason,
    }: BulkUpdateValidationStatusParams): Promise<BulkUpdateValidationStatusResponse> => {
      const token = await getToken();
      return api.patch<BulkUpdateValidationStatusResponse>(
        "/vouchers/bulk-validation-status",
        { voucher_ids, validation_status, reason },
        { token },
      );
    },
    onMutate: async ({ voucher_ids, validation_status }) => {
      await queryClient.cancelQueries({ queryKey: ["vouchers"] });

      const previousQueries = queryClient.getQueriesData<
        InfiniteData<VouchersResponse>
      >({ queryKey: ["vouchers"] });

      const ids = new Set(voucher_ids);

      queryClient.setQueriesData<InfiniteData<VouchersResponse>>(
        { queryKey: ["vouchers"] },
        (old) => {
          if (!old) return old;

          const pages = old.pages.map((page) => {
            const deltas: Record<VoucherValidationStatus, number> = {
              valido: 0,
              observado: 0,
              rechazado: 0,
            };

            const items = page.items.map((item) => {
              if (!ids.has(item.id)) return item;
              const previousStatus = item.validation_status ?? "valido";
              if (previousStatus !== validation_status) {
                deltas[previousStatus] -= 1;
                deltas[validation_status] += 1;
              }
              return { ...item, validation_status };
            });

            const counts = page.counts_by_validation_status;
            if (!counts) {
              return { ...page, items };
            }

            return {
              ...page,
              items,
              counts_by_validation_status: {
                valido: Math.max(0, counts.valido + deltas.valido),
                observado: Math.max(0, counts.observado + deltas.observado),
                rechazado: Math.max(0, counts.rechazado + deltas.rechazado),
              },
            };
          });

          return { ...old, pages };
        },
      );

      return { previousQueries };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousQueries) return;
      for (const [queryKey, data] of context.previousQueries) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      // Invalidate so the table refreshes with updated statuses and counts
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      // Invalidate flat "all vouchers" query used for TXT SIRE export
      // (uses a different key prefix "vouchers-all" — must be invalidated separately)
      queryClient.invalidateQueries({ queryKey: ["vouchers-all"] });
      // Invalidate stats so IGV cards reflect the new validation statuses
      queryClient.invalidateQueries({ queryKey: ["vouchers-stats"] });
    },
  });
}
