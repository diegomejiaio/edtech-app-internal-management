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

interface UpdateValidationStatusParams {
  voucherId: string;
  validation_status: VoucherValidationStatus;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mutation hook to update the accountant validation status of a voucher.
 *
 * On success, invalidates the vouchers list query so the updated status
 * is reflected without a manual refresh.
 */
export function useUpdateVoucherValidationStatus() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      voucherId,
      validation_status,
      reason,
    }: UpdateValidationStatusParams) => {
      const token = await getToken();
      return api.patch<Voucher>(
        `/vouchers/${voucherId}/validation-status`,
        { validation_status, reason },
        { token },
      );
    },
    onMutate: async ({ voucherId, validation_status }) => {
      await queryClient.cancelQueries({ queryKey: ["vouchers"] });

      const previousQueries = queryClient.getQueriesData<
        InfiniteData<VouchersResponse>
      >({ queryKey: ["vouchers"] });

      queryClient.setQueriesData<InfiniteData<VouchersResponse>>(
        { queryKey: ["vouchers"] },
        (old) => {
          if (!old) return old;

          const pages = old.pages.map((page) => {
            let previousStatus: VoucherValidationStatus | null = null;
            const items = page.items.map((item) => {
              if (item.id !== voucherId) return item;
              previousStatus = item.validation_status ?? "valido";
              return { ...item, validation_status };
            });

            if (!previousStatus || previousStatus === validation_status) {
              return { ...page, items };
            }

            const counts = page.counts_by_validation_status;
            if (!counts) {
              return { ...page, items };
            }

            return {
              ...page,
              items,
              counts_by_validation_status: {
                ...counts,
                [previousStatus]: Math.max(0, counts[previousStatus] - 1),
                [validation_status]: counts[validation_status] + 1,
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
    onSuccess: (updatedVoucher) => {
      queryClient.setQueriesData<InfiniteData<VouchersResponse>>(
        { queryKey: ["vouchers"] },
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === updatedVoucher.id ? updatedVoucher : item,
            ),
          }));
          return { ...old, pages };
        },
      );
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate all voucher list queries so counts and statuses refresh
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      // Invalidate flat "all vouchers" query used for TXT SIRE export
      // (uses a different key prefix "vouchers-all" — must be invalidated separately)
      queryClient.invalidateQueries({ queryKey: ["vouchers-all"] });
      // Invalidate stats so IGV cards reflect the new validation status
      queryClient.invalidateQueries({ queryKey: ["vouchers-stats"] });
      // Invalidate audit log so the detail sheet shows the new entry immediately
      queryClient.invalidateQueries({
        queryKey: ["voucher-audit-log", variables.voucherId],
      });
    },
  });
}
