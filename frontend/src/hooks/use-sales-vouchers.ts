import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import type {
  SalesVoucher,
  SalesVouchersStats,
  SalesVoucherValidationStatus,
  SalesVouchersStatsByCompanyResponse,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SalesVouchersResponse {
  items: SalesVoucher[];
  total_count: number;
  next_cursor: string | null;
  has_more: boolean;
  counts_by_validation_status: {
    activo: number;
    baja: number;
    revertido: number;
    anulado: number;
  };
}

interface UseSalesVouchersParams {
  company_id?: string;
  period?: string;
  doc_type?: string;
  validation_status?: SalesVoucherValidationStatus;
  customer_ruc?: string;
  /** Search by customer name, RUC, or series-number (server-side) */
  search?: string;
  limit?: number;
  /** Polling interval in ms - useful for live updates during sync */
  refetchInterval?: number | false;
  /** When false, the query is disabled (lazy). Default: true */
  enabled?: boolean;
}

interface UseSalesVouchersStatsParams {
  period?: string;
  company_id?: string;
  /** Polling interval in ms - useful for live updates during sync */
  refetchInterval?: number | false;
}

interface UseSalesVouchersStatsByCompanyParams {
  period?: string;
  /** Polling interval in ms */
  refetchInterval?: number | false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch paginated list of sales vouchers (comprobantes de venta - SIRE RVIE).
 * Uses cursor-based infinite pagination.
 */
export function useSalesVouchers(params: UseSalesVouchersParams = {}) {
  const { getToken } = useAuthContext();
  const limit = params.limit || 50;

  return useInfiniteQuery({
    queryKey: ["sales-vouchers", { ...params, limit }],
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      return api.get<SalesVouchersResponse>("/sales-vouchers", {
        token,
        params: {
          limit,
          cursor: pageParam || undefined,
          company_id: params.company_id,
          period: params.period,
          doc_type: params.doc_type,
          validation_status: params.validation_status,
          customer_ruc: params.customer_ruc,
          search: params.search || undefined,
        },
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    retry: env.isProd ? 3 : 1,
    refetchInterval: params.refetchInterval,
    enabled: params.enabled !== false,
  });
}

/**
 * Fetch sales vouchers statistics for the dashboard.
 */
export function useSalesVouchersStats(
  params: UseSalesVouchersStatsParams = {},
) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["sales-vouchers-stats", params.period, params.company_id],
    queryFn: async () => {
      const token = await getToken();
      return api.get<SalesVouchersStats>("/sales-vouchers/stats", {
        token,
        params: {
          period: params.period,
          company_id: params.company_id,
        },
      });
    },
    refetchInterval: params.refetchInterval,
    retry: env.isProd ? 3 : 1,
    enabled: !!params.company_id,
  });
}

/**
 * Fetch all sales vouchers for a company/period in a single flat query (limit=9999).
 * Use this for client-side IGV computations — does NOT conflict with the
 * infinite-query variant because it uses a different queryKey prefix.
 */
export function useAllSalesVouchers(params: UseSalesVouchersParams = {}) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["sales-vouchers-all", params.company_id, params.period, params],
    queryFn: async () => {
      const token = await getToken();
      return api.get<SalesVouchersResponse>("/sales-vouchers", {
        token,
        params: {
          limit: 9999,
          company_id: params.company_id,
          period: params.period,
          doc_type: params.doc_type,
          validation_status: params.validation_status,
          customer_ruc: params.customer_ruc,
          search: params.search || undefined,
        },
      });
    },
    enabled: !!params.company_id,
    retry: env.isProd ? 3 : 1,
  });
}

/**
 * Fetch a single sales voucher by ID including full detail_data.
 */
export function useSalesVoucher(voucherId: string | null) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["sales-voucher", voucherId],
    queryFn: async () => {
      const token = await getToken();
      return api.get<SalesVoucher>(`/sales-vouchers/${voucherId}`, { token });
    },
    enabled: !!voucherId,
    retry: env.isProd ? 3 : 1,
  });
}

/**
 * Fetch sales vouchers statistics grouped by company.
 * Returns totals by validation status for each company.
 */
export function useSalesVouchersStatsByCompany(
  params: UseSalesVouchersStatsByCompanyParams = {},
) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["sales-vouchers-stats-by-company", params.period],
    queryFn: async () => {
      const token = await getToken();
      return api.get<SalesVouchersStatsByCompanyResponse>(
        "/sales-vouchers/stats/by-company",
        {
          token,
          params: {
            period: params.period,
          },
        },
      );
    },
    refetchInterval: params.refetchInterval,
    retry: env.isProd ? 3 : 1,
  });
}
