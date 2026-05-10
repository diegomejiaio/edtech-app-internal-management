import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import type { TCValidation, VoucherValidationStatus } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LiftTCObservationParams {
  voucherId: string;
  confirmed_tc: number;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query hook to fetch TC observation details for a USD voucher.
 *
 * Only fetches when enabled=true (lazy). Returns 404 when there is no
 * active TC observation (either passed=true or tc_validation missing).
 */
export function useTCObservation(voucherId: string, enabled: boolean) {
  const { getToken } = useAuthContext();

  return useQuery<TCValidation>({
    queryKey: ["tc-observation", voucherId],
    queryFn: async () => {
      const token = await getToken();
      return api.get<TCValidation>(`/vouchers/${voucherId}/tc-observation`, {
        token,
      });
    },
    enabled: enabled && !!voucherId,
  });
}

/**
 * Mutation hook to lift a TC observation.
 *
 * The BFF recalculates all monetary fields (taxable_base_dg, igv_ipm_dg,
 * non_taxed_acq_value, total, exchange_rate, etc.) server-side.
 * When this was the last active observation, the BFF also auto-transitions the
 * voucher to "valido" and returns { success: true, validation_status: "valido" }.
 * We always invalidate all affected queries because the monetary recalculation
 * cannot be reconstructed client-side.
 */
export function useLiftTCObservation() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      voucherId,
      confirmed_tc,
      reason,
    }: LiftTCObservationParams) => {
      const token = await getToken();
      return api.patch<{
        success: boolean;
        validation_status?: VoucherValidationStatus;
      }>(
        `/vouchers/${voucherId}/lift-tc-observation`,
        { confirmed_tc, reason },
        { token },
      );
    },
    onSuccess: (_data, { voucherId }) => {
      // The BFF recalculates 10+ monetary fields (taxable_base_dg, igv_ipm_dg,
      // non_taxed_acq_value, total, exchange_rate, etc.). Since the response
      // only contains { success: true }, invalidate everything so TanStack Query
      // fetches the corrected values from DB.
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["voucher", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["vouchers-stats"] });
      queryClient.invalidateQueries({
        queryKey: ["voucher-audit-log", voucherId],
      });
      queryClient.invalidateQueries({ queryKey: ["vouchers-all"] });
      queryClient.invalidateQueries({
        queryKey: ["vouchers-stats-by-company"],
      });
    },
  });
}
