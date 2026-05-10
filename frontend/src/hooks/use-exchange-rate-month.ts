import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthContext } from "@/providers/auth-provider";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExchangeRateEntry {
  date: string; // "YYYY-MM-DD"
  compra: number | null;
  venta: number | null;
}

export interface ExchangeRateMonth {
  id: string;
  year: number;
  month: number;
  source: string;
  rates: ExchangeRateEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all daily exchange rates for a given month.
 *
 * Cache strategy:
 *   - staleTime = 1h for past months (data is immutable once the month closes)
 *   - staleTime = 5min for the current month (new days are added daily)
 *   - gcTime = 24h — survives tab switches
 *   - refetchOnWindowFocus = false
 */
export function useExchangeRateMonth(year: number, month: number) {
  const { getToken } = useAuthContext();

  // Past months are immutable; current month gets new days added daily
  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;
  const staleTime = isCurrentMonth ? 5 * 60 * 1000 : 60 * 60 * 1000;

  return useQuery<ExchangeRateMonth>({
    queryKey: ["exchange-rate-month", year, month],
    queryFn: async () => {
      const token = await getToken();
      return api.get<ExchangeRateMonth>("/exchange-rates", {
        token,
        params: { year, month },
      });
    },
    staleTime,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
