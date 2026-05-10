import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthContext } from "@/providers/auth-provider";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TodayExchangeRate {
  date: string;
  compra: number | null;
  venta: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current date in Lima time (UTC-5, no DST) as { year, month, day }
 * and milliseconds until 00:05 Lima (when SUNAT publishes the new TC).
 *
 * All callers must use the same Lima-based date so that queryKey params and
 * staleTime are always derived from the same clock reference.
 */
function limaTimeContext(): {
  year: number;
  month: number;
  day: number;
  msUntil0005: number;
} {
  const now = new Date();
  // Lima is UTC-5 (no DST)
  const limaOffsetMs = -5 * 60 * 60 * 1000;
  const limaMs =
    now.getTime() + now.getTimezoneOffset() * 60 * 1000 + limaOffsetMs;
  const lima = new Date(limaMs);

  const year = lima.getFullYear();
  const month = lima.getMonth() + 1;
  const day = lima.getDate();

  // Stale at 00:05 Lima — that's when SUNAT publishes the new rate
  const next0005 = new Date(lima);
  next0005.setHours(24, 5, 0, 0);

  return { year, month, day, msUntil0005: next0005.getTime() - lima.getTime() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches today's SUNAT exchange rate (compra + venta).
 *
 * Cache strategy:
 *   - staleTime  = time until 00:05 Lima → 1 call per calendar day (SUNAT
 *                  publishes the new TC at ~00:05 Lima each day)
 *   - gcTime     = 24h → survives tab switches without re-fetching
 *   - refetchOnWindowFocus = false → no surprise calls when switching tabs
 *   - No polling → TC is immutable once published by SUNAT
 */
export function useTodayExchangeRate() {
  const { getToken } = useAuthContext();

  // Derive date AND staleTime from the same Lima clock so queryKey params
  // and cache expiry are always consistent regardless of the user's timezone.
  const { year, month, day, msUntil0005 } = limaTimeContext();

  return useQuery<TodayExchangeRate>({
    queryKey: ["exchange-rate-today", year, month, day],
    queryFn: async () => {
      const token = await getToken();
      return api.get<TodayExchangeRate>("/exchange-rates", {
        token,
        params: { year, month, day },
      });
    },
    staleTime: msUntil0005,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
