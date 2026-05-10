"use client";

import { FileText, Clock, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CountUp } from "@/components/motion/count-up";
import { useVouchersStats } from "@/hooks/use-vouchers";

/** Polling interval during sync (3 seconds) */
const SYNC_POLLING_INTERVAL = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Stat {
  label: string;
  value: number | string;
  icon: typeof FileText;
  description?: string;
}

interface VoucherStatsCardsProps {
  /** Period filter (YYYYMM format) */
  period?: string;
  /** Company ID filter (required for meaningful stats) */
  companyId?: string;
  /** When true, enables polling to show updated stats in real-time */
  isSyncing?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function VoucherStatsCards({
  period,
  companyId,
  isSyncing = false,
}: VoucherStatsCardsProps) {
  const { data: stats, isLoading } = useVouchersStats({
    period,
    company_id: companyId,
    refetchInterval: isSyncing ? SYNC_POLLING_INTERVAL : (false as const),
  });

  const STATS: Stat[] = [
    {
      label: "Total Comprobantes",
      value: stats?.total ?? 0,
      icon: FileText,
      description: `Período ${period || "actual"}`,
    },
    {
      label: "Completados",
      value: stats?.by_status?.completed ?? 0,
      icon: CheckCircle2,
      description: "Detalles disponibles",
    },
    {
      label: "Pendientes",
      value: (stats?.by_status?.pending ?? 0) + (stats?.by_status?.failed ?? 0),
      icon: Clock,
      description: "Por descargar",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {STATS.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-sm font-medium">
              {stat.label}
            </CardDescription>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-2">
            <div className="flex items-baseline justify-end gap-2">
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {typeof stat.value === "number" ? (
                    <CountUp target={stat.value} />
                  ) : (
                    stat.value
                  )}
                </CardTitle>
              )}
            </div>
            {stat.description && (
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {stat.description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Card (Financial)
// ─────────────────────────────────────────────────────────────────────────────

interface VoucherSummaryCardProps {
  /** Period filter (YYYYMM format) */
  period?: string;
  /** Company ID filter (required for meaningful stats) */
  companyId?: string;
  /** When true, enables polling */
  isSyncing?: boolean;
}

export function VoucherSummaryCard({
  period,
  companyId,
  isSyncing = false,
}: VoucherSummaryCardProps) {
  const { data: stats, isLoading } = useVouchersStats({
    period,
    company_id: companyId,
    refetchInterval: isSyncing ? SYNC_POLLING_INTERVAL : (false as const),
  });

  const formatCurrency = (amount: number, currency: "PEN" | "USD" = "PEN") => {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency,
    }).format(amount);
  };

  // Check if there are amounts in each currency
  const hasPen = (stats?.total_pen ?? 0) > 0 || (stats?.igv_pen ?? 0) > 0;
  const hasUsd = (stats?.total_usd ?? 0) > 0 || (stats?.igv_usd ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Resumen Financiero</CardTitle>
        <CardDescription>
          Totales del período {period || "actual"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* PEN Section */}
            {hasPen && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    Total Compras (S/)
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatCurrency(stats?.total_pen ?? 0, "PEN")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">IGV (S/)</span>
                  <span className="text-lg font-semibold tabular-nums text-primary">
                    {formatCurrency(stats?.igv_pen ?? 0, "PEN")}
                  </span>
                </div>
              </>
            )}

            {/* USD Section */}
            {hasUsd && (
              <>
                {hasPen && <hr className="border-dashed" />}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    Total Compras (USD)
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatCurrency(stats?.total_usd ?? 0, "USD")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">IGV (USD)</span>
                  <span className="text-lg font-semibold tabular-nums text-primary">
                    {formatCurrency(stats?.igv_usd ?? 0, "USD")}
                  </span>
                </div>
              </>
            )}

            {/* No amounts */}
            {!hasPen && !hasUsd && (
              <div className="text-center text-muted-foreground py-2">
                Sin comprobantes en este período
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
