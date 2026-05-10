import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import type {
  Voucher,
  VouchersStats,
  VoucherDetailStatus,
  VoucherValidationStatus,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VouchersResponse {
  items: Voucher[];
  total_count: number;
  next_cursor: string | null;
  has_more: boolean;
  counts_by_validation_status: {
    valido: number;
    observado: number;
    rechazado: number;
  };
}

interface UseVouchersParams {
  company_id?: string;
  period?: string;
  voucher_type?: string;
  detail_status?: VoucherDetailStatus;
  validation_status?: VoucherValidationStatus;
  supplier_ruc?: string;
  /** Search by supplier RUC, name, or series-number (server-side) */
  search?: string;
  limit?: number;
  /** Polling interval in ms - useful for live updates during sync */
  refetchInterval?: number | false;
  /** When false, the query is disabled (lazy). Default: true */
  enabled?: boolean;
}

interface UseVouchersStatsParams {
  period?: string;
  company_id?: string;
  /** Polling interval in ms - useful for live updates during sync */
  refetchInterval?: number | false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch paginated list of vouchers (comprobantes de compra).
 * Uses cursor-based infinite pagination.
 */
export function useVouchers(params: UseVouchersParams = {}) {
  const { getToken } = useAuthContext();
  const limit = params.limit || 50;

  return useInfiniteQuery({
    queryKey: ["vouchers", { ...params, limit }],
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      return api.get<VouchersResponse>("/vouchers", {
        token,
        params: {
          limit,
          cursor: pageParam || undefined,
          company_id: params.company_id,
          period: params.period,
          voucher_type: params.voucher_type,
          detail_status: params.detail_status,
          validation_status: params.validation_status,
          supplier_ruc: params.supplier_ruc,
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
 * Fetch vouchers statistics for the dashboard.
 * Returns totals by status, by type, and financial summaries.
 */
export function useVouchersStats(params: UseVouchersStatsParams = {}) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["vouchers-stats", params.period, params.company_id],
    queryFn: async () => {
      const token = await getToken();
      return api.get<VouchersStats>("/vouchers/stats", {
        token,
        params: {
          period: params.period,
          company_id: params.company_id,
        },
      });
    },
    refetchInterval: params.refetchInterval,
    retry: env.isProd ? 3 : 1,
    // Don't fetch if no company selected
    enabled: !!params.company_id,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats by Company
// ─────────────────────────────────────────────────────────────────────────────

interface CompanyVoucherStats {
  company_id: string;
  ruc: string;
  business_name: string;
  total_count: number;
  total_pen: number;
  igv_pen: number;
  total_usd: number;
  igv_usd: number;
  is_declared: boolean;
}

interface VouchersStatsByCompanyResponse {
  period: string | null;
  items: CompanyVoucherStats[];
}

interface UseVouchersStatsByCompanyParams {
  period?: string;
  /** Polling interval in ms */
  refetchInterval?: number | false;
}

/**
 * Fetch vouchers statistics grouped by company.
 * Returns totals in PEN and USD for each company.
 */
export function useVouchersStatsByCompany(
  params: UseVouchersStatsByCompanyParams = {},
) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["vouchers-stats-by-company", params.period],
    queryFn: async () => {
      const token = await getToken();
      return api.get<VouchersStatsByCompanyResponse>(
        "/vouchers/stats/by-company",
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

/**
 * Fetch a single voucher by ID with full details.
 */
export function useVoucher(voucherId: string | null) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["voucher", voucherId],
    queryFn: async () => {
      if (!voucherId) throw new Error("Voucher ID is required");
      const token = await getToken();
      return api.get<Voucher & { detail_data?: unknown }>(
        `/vouchers/${voucherId}`,
        { token },
      );
    },
    enabled: !!voucherId,
    retry: env.isProd ? 3 : 1,
  });
}

/**
 * Fetch all vouchers for a company/period in a single flat query (limit=9999).
 * Use this for client-side IGV computations — does NOT conflict with the
 * infinite-query variant because it uses a different queryKey prefix.
 */
export function useAllVouchers(params: UseVouchersParams = {}) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["vouchers-all", params.company_id, params.period, params.voucher_type, params.detail_status, params.validation_status, params.supplier_ruc, params.search],
    queryFn: async () => {
      const token = await getToken();
      return api.get<VouchersResponse>("/vouchers", {
        token,
        params: {
          limit: 9999,
          company_id: params.company_id,
          period: params.period,
          voucher_type: params.voucher_type,
          detail_status: params.detail_status,
          validation_status: params.validation_status,
          supplier_ruc: params.supplier_ruc,
          search: params.search || undefined,
        },
      });
    },
    enabled: !!params.company_id && (params.enabled !== false),
    retry: env.isProd ? 3 : 1,
  });
}

/**
 * Imperative function to fetch a single voucher detail.
 * Use this when you need to fetch outside of React component lifecycle.
 */
export async function fetchVoucherDetail(
  voucherId: string,
  token: string,
): Promise<Voucher> {
  return api.get<Voucher>(`/vouchers/${voucherId}`, { token });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Items (detail_data when available)
// ─────────────────────────────────────────────────────────────────────────────

interface ExportItemsResponse {
  items: Voucher[];
  total_count: number;
}

/**
 * Imperative function to fetch vouchers for Items Excel export.
 * Calls the dedicated `/vouchers/items` endpoint which may include
 * `detail.data` for vouchers where it has been extracted (it is excluded
 * from the regular list endpoint for performance, and may be absent here
 * for vouchers whose detail has not been extracted).
 */
export async function fetchExportItems(
  companyId: string,
  period: string,
  token: string,
): Promise<Voucher[]> {
  const response = await api.get<ExportItemsResponse>("/vouchers/items", {
    token,
    params: {
      company_id: companyId,
      period,
      all: "true",
    },
  });
  return response.items;
}
