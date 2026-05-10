"use client";

import { useTodayExchangeRate } from "@/hooks/use-today-exchange-rate";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Displays today's SUNAT USD/PEN exchange rate (compra + venta) in the header.
 *
 * Cache strategy: staleTime until midnight Lima → at most 1 API call per day.
 * Renders nothing on error (silently fails — TC is informational, not critical).
 */
export function TodayExchangeRate() {
  const { data, isLoading } = useTodayExchangeRate();

  if (isLoading) {
    return <Skeleton className="h-5 w-24 rounded" />;
  }

  // Silently hide if no data or both values are null (weekend / holiday)
  if (!data || (data.compra === null && data.venta === null)) {
    return null;
  }

  const fmt = (v: number | null) => (v !== null ? v.toFixed(3) : "—");

  return (
    <div className="flex items-center gap-1.5 cursor-default">
      <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
        TC
      </span>
      <span className="text-xs font-semibold tabular-nums">
        {fmt(data.compra)}
      </span>
      <span className="text-xs text-muted-foreground">/</span>
      <span className="text-xs font-semibold tabular-nums">
        {fmt(data.venta)}
      </span>
    </div>
  );
}
