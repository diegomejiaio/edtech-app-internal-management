"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RefreshCw,
  Calendar,
  Building2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  Lock,
  LockOpen,
  Loader2,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollTable } from "@/components/ui/scroll-table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/use-auth";
import {
  useVouchersStatsByCompany,
  useVouchersStats,
} from "@/hooks/use-vouchers";
import {
  useSalesVouchersStatsByCompany,
  useSalesVouchersStats,
} from "@/hooks/use-sales-vouchers";
import { useCompany } from "@/hooks/use-companies";
import { VouchersTable } from "@/components/vouchers";
import type { ValidationCounts } from "@/components/vouchers/vouchers-table";
import { SalesVouchersTable } from "@/components/sales-vouchers/SalesVouchersTable";
import { SyncProgress } from "@/components/notifications";
import { FadeIn } from "@/components/motion";
import {
  useSyncTrigger,
  useActiveBatch,
  useBatchComplete,
} from "@/hooks/use-sync";
import { useDeclaration, useDeclare, useReopen } from "@/hooks/use-declaration";
import { usePublishChatContext } from "@/hooks/use-publish-chat-context";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { ActiveBatchResponse, JobProcess } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Utils
// ─────────────────────────────────────────────────────────────────────────────

type ResultType = "success" | "error" | "partial";

interface ResultState {
  type: ResultType;
  message: string;
}

/** Generate period options for the last N months */
function generatePeriodOptions(
  months: number = 12,
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("es-PE", {
      month: "long",
      year: "numeric",
    });
    options.push({
      value,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }

  return options;
}

/** Get previous month period in YYYYMM format (contabilidad siempre es mes anterior) */
function getPreviousMonthPeriod(): string {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prevMonth.getFullYear()}${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
}

/** Format a UTC ISO date string as a human-readable date+time in the browser's local timezone */
function formatDateTime(isoStr: string): string {
  try {
    // Ensure the string is treated as UTC — the backend returns naive datetimes
    // without a 'Z' suffix (e.g. "2026-03-01T23:01:00"), which some engines
    // parse as local time. Appending 'Z' forces correct UTC interpretation.
    const normalized =
      isoStr.endsWith("Z") || isoStr.includes("+") ? isoStr : `${isoStr}Z`;
    return new Date(normalized).toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

/** Format a by_name value — hides raw Clerk user IDs (e.g. "user_abc123") */
function formatByName(byName: string | null | undefined): string {
  if (!byName) return "usuario desconocido";
  // Clerk user IDs look like "user_37QtyOOM7DUI93USUpwhr6bUY1q"
  if (/^user_[A-Za-z0-9]+$/.test(byName)) return "un usuario del sistema";
  return byName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component (with Suspense for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────

export default function ComprobantesPage() {
  return (
    <Suspense fallback={<ComprobantesLoading />}>
      <ComprobantesContent />
    </Suspense>
  );
}

function ComprobantesLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Skeleton className="h-8 w-8 animate-pulse rounded-full" />
    </div>
  );
}

type ActiveTab = "compras" | "ventas";

function ComprobantesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get company from URL query param (for detail view)
  const selectedCompanyId = searchParams.get("company");
  const urlPeriod = searchParams.get("period");

  // Period selector (default: previous month or from URL)
  const [selectedPeriod, setSelectedPeriod] = useState(
    urlPeriod || getPreviousMonthPeriod(),
  );
  const periodOptions = useMemo(() => generatePeriodOptions(12), []);

  // Update period when URL changes
  useEffect(() => {
    if (urlPeriod && urlPeriod !== selectedPeriod) {
      setSelectedPeriod(urlPeriod);
    }
  }, [urlPeriod, selectedPeriod]);

  // Show detail view if company is selected
  if (selectedCompanyId) {
    return (
      <CompanyDetailView
        companyId={selectedCompanyId}
        period={selectedPeriod}
        periodOptions={periodOptions}
        onPeriodChange={setSelectedPeriod}
        onBack={() => router.push(`/comprobantes?period=${selectedPeriod}`)}
      />
    );
  }

  // Show companies list view
  return (
    <CompaniesListView
      period={selectedPeriod}
      periodOptions={periodOptions}
      onPeriodChange={setSelectedPeriod}
      onSelectCompany={(companyId) =>
        router.push(
          `/comprobantes?company=${companyId}&period=${selectedPeriod}`,
        )
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified company row for the merged list view table
// ─────────────────────────────────────────────────────────────────────────────

interface UnifiedCompanyRow {
  company_id: string;
  ruc: string;
  business_name: string;
  compras_count: number; // total_count from compras stats (0 if absent)
  ventas_count: number; // total from ventas stats (0 if absent)
  is_declared: boolean; // from compras stats (false if absent)
}

// ─────────────────────────────────────────────────────────────────────────────
// Companies List View
// ─────────────────────────────────────────────────────────────────────────────

interface CompaniesListViewProps {
  period: string;
  periodOptions: { value: string; label: string }[];
  onPeriodChange: (period: string) => void;
  onSelectCompany: (companyId: string) => void;
}

function CompaniesListView({
  period,
  periodOptions,
  onPeriodChange,
  onSelectCompany,
}: CompaniesListViewProps) {
  const router = useRouter();
  const { isMaster, isAdmin, tenantId } = useUserRole();
  const {
    data: comprasStatsData,
    isLoading: isLoadingComprasStats,
    refetch: refetchComprasStats,
  } = useVouchersStatsByCompany({ period });

  const {
    data: ventasStatsData,
    isLoading: isLoadingVentasStats,
    refetch: refetchVentasStats,
  } = useSalesVouchersStatsByCompany({ period });

  const isLoadingStats = isLoadingComprasStats || isLoadingVentasStats;
  const refetchStats = useCallback(() => {
    refetchComprasStats();
    refetchVentasStats();
  }, [refetchComprasStats, refetchVentasStats]);

  // Sync state - Compras headers
  const {
    mutate: triggerComprasHeaders,
    isPending: isTriggeringComprasHeaders,
  } = useSyncTrigger();
  const { data: comprasHeadersBatch, isLoading: isLoadingComprasHeadersBatch } =
    useActiveBatch("sire_compras_headers");

  // Sync state - Details (compras)
  const { mutate: triggerDetails, isPending: isTriggeringDetails } =
    useSyncTrigger();
  const { data: detailsBatch, isLoading: isLoadingDetailsBatch } =
    useActiveBatch("sire_compras_details");

  // Sync state - Details (ventas)
  const { mutate: triggerVentasDetails, isPending: isTriggeringVentasDetails } =
    useSyncTrigger();
  const { data: ventasDetailsBatch, isLoading: isLoadingVentasDetailsBatch } =
    useActiveBatch("sire_ventas_details");

  // Sync state - Ventas headers
  const { mutate: triggerVentasHeaders, isPending: isTriggeringVentasHeaders } =
    useSyncTrigger();
  const { data: ventasHeadersBatch, isLoading: isLoadingVentasHeadersBatch } =
    useActiveBatch("sire_sales_headers");

  // Sync state - Detraction validation (Admin/Master only)
  const {
    mutate: triggerDetractionValidation,
    isPending: isTriggeringDetractionValidation,
  } = useSyncTrigger();
  const {
    data: detractionValidationBatch,
    isLoading: isLoadingDetractionValidationBatch,
  } = useActiveBatch("detraction_validation");

  const [result, setResult] = useState<ResultState | null>(null);
  const [hasTenantSelected, setHasTenantSelected] = useState(true);

  // Handle period change - update both state and URL
  const handlePeriodChange = useCallback(
    (newPeriod: string) => {
      onPeriodChange(newPeriod);
      router.push(`/comprobantes?period=${newPeriod}`);
    },
    [onPeriodChange, router],
  );

  // Check tenant selection for Master users
  useEffect(() => {
    const checkTenant = () => {
      if (typeof window !== "undefined") {
        const selectedTenantId = localStorage.getItem("selectedTenantId");
        setHasTenantSelected(isMaster ? !!selectedTenantId : !!tenantId);
      }
    };

    checkTenant();
    window.addEventListener("tenantChanged", checkTenant);
    return () => window.removeEventListener("tenantChanged", checkTenant);
  }, [isMaster, tenantId]);

  // Handle batch completion
  const handleBatchComplete = useCallback(
    (
      batch: ActiveBatchResponse | null,
      type: "headers" | "details" | "ventas",
    ) => {
      refetchStats();

      if (!batch) {
        const messageMap = {
          headers: "Extracción de compras completada.",
          details: "Descarga de detalles completada.",
          ventas: "Extracción de ventas completada.",
        };
        setResult({ type: "success", message: messageMap[type] });
        return;
      }

      const hasErrors = batch.failed_jobs > 0;
      const prefixMap = {
        headers: "Sincronizar Compras",
        details: "Detalles Compras",
        ventas: "Sincronizar Ventas",
      };
      const prefix = prefixMap[type];

      if (batch.status === "failed") {
        setResult({
          type: "error",
          message: `${prefix} falló. Intenta nuevamente.`,
        });
      } else if (hasErrors) {
        setResult({
          type: "partial",
          message: `${prefix}: ${batch.successful_jobs} OK, ${batch.failed_jobs} errores.`,
        });
      } else {
        setResult({
          type: "success",
          message: `${prefix}: ${batch.total_jobs} procesados correctamente.`,
        });
      }
    },
    [refetchStats],
  );

  useBatchComplete(comprasHeadersBatch, (batch) =>
    handleBatchComplete(batch, "headers"),
  );
  useBatchComplete(detailsBatch, (batch) =>
    handleBatchComplete(batch, "details"),
  );
  useBatchComplete(ventasHeadersBatch, (batch) =>
    handleBatchComplete(batch, "ventas"),
  );
  useBatchComplete(ventasDetailsBatch, (batch) =>
    handleBatchComplete(batch, "ventas"),
  );

  // Trigger sync — Compras headers
  const handleSyncComprasHeaders = () => {
    setResult(null);
    triggerComprasHeaders(
      { process: "sire_compras_headers" as JobProcess, period },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar extracción de compras",
          });
        },
      },
    );
  };

  // Trigger sync — Details
  const handleSyncDetails = () => {
    setResult(null);
    triggerDetails(
      { process: "sire_compras_details" as JobProcess, period },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar descarga de detalles",
          });
        },
      },
    );
  };

  // Trigger sync — Ventas details
  const handleSyncVentasDetails = () => {
    setResult(null);
    triggerVentasDetails(
      { process: "sire_ventas_details" as JobProcess, period },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar descarga de detalles de ventas",
          });
        },
      },
    );
  };

  // Trigger sync — Ventas headers
  const handleSyncVentasHeaders = () => {
    setResult(null);
    triggerVentasHeaders(
      { process: "sire_sales_headers" as JobProcess, period },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar extracción de ventas",
          });
        },
      },
    );
  };

  // Trigger sync — Detraction validation
  const handleSyncDetractionValidation = () => {
    setResult(null);
    triggerDetractionValidation(
      {
        process: "detraction_validation" as JobProcess,
        period: period,
      },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar la validación de detracciones",
          });
        },
      },
    );
  };

  // Running states
  const isComprasHeadersRunning =
    comprasHeadersBatch?.status === "running" ||
    comprasHeadersBatch?.status === "pending";
  const isDetailsRunning =
    detailsBatch?.status === "running" || detailsBatch?.status === "pending";
  const isVentasDetailsRunning =
    ventasDetailsBatch?.status === "running" ||
    ventasDetailsBatch?.status === "pending";
  const isVentasHeadersRunning =
    ventasHeadersBatch?.status === "running" ||
    ventasHeadersBatch?.status === "pending";
  const isDetractionValidationRunning =
    detractionValidationBatch?.status === "running" ||
    detractionValidationBatch?.status === "pending";

  const isBusy =
    isTriggeringComprasHeaders ||
    isTriggeringDetails ||
    isTriggeringVentasDetails ||
    isTriggeringVentasHeaders ||
    isComprasHeadersRunning ||
    isDetailsRunning ||
    isVentasDetailsRunning ||
    isVentasHeadersRunning;

  // Merged unified rows — join compras and ventas by company_id
  const mergedRows = useMemo((): UnifiedCompanyRow[] => {
    const comprasItems = comprasStatsData?.items ?? [];
    const ventasItems = ventasStatsData?.items ?? [];

    const ventasMap = new Map(ventasItems.map((v) => [v.company_id, v]));
    const comprasSet = new Set(comprasItems.map((c) => c.company_id));

    const rows: UnifiedCompanyRow[] = comprasItems.map((c) => ({
      company_id: c.company_id,
      ruc: c.ruc,
      business_name: c.business_name,
      compras_count: c.total_count,
      ventas_count: ventasMap.get(c.company_id)?.total ?? 0,
      is_declared: c.is_declared,
    }));

    // Append ventas-only companies (edge case)
    for (const v of ventasItems) {
      if (!comprasSet.has(v.company_id)) {
        rows.push({
          company_id: v.company_id,
          ruc: v.ruc,
          business_name: v.business_name,
          compras_count: 0,
          ventas_count: v.total,
          is_declared: false,
        });
      }
    }

    return rows;
  }, [comprasStatsData, ventasStatsData]);

  // Period label for display
  const periodLabel = useMemo(() => {
    const option = periodOptions.find((o) => o.value === period);
    return option?.label || period;
  }, [period, periodOptions]);

  // Publish UI context so ClearBookAI knows what the user is viewing
  usePublishChatContext(
    {
      page: "comprobantes",
      period,
      periodLabel,
      stats: {
        "Empresas visibles": mergedRows.length,
        "Empresas declaradas": mergedRows.filter((r) => r.is_declared).length,
        "Empresas pendientes": mergedRows.filter((r) => !r.is_declared).length,
      },
      summary: `Vista de lista: ${mergedRows.length} empresa${mergedRows.length !== 1 ? "s" : ""} en el período ${periodLabel}.`,
    },
    [period, periodLabel, mergedRows],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Comprobantes
            </h1>
            <p className="text-muted-foreground">
              Registro de compras y ventas desde SIRE SUNAT · {periodLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FadeIn>

      {/* Sync Actions — 3 always-visible buttons */}
      <FadeIn delay={0.05}>
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-muted/30">
          <span className="text-sm font-medium text-muted-foreground">
            Sincronizar:
          </span>

          {/* Button 1: Sincronizar Compras */}
          {isComprasHeadersRunning && comprasHeadersBatch ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">Compras:</span>
              <SyncProgress batch={comprasHeadersBatch} className="min-w-48" />
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSyncComprasHeaders}
              disabled={
                isBusy || !hasTenantSelected || isLoadingComprasHeadersBatch
              }
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isTriggeringComprasHeaders && "animate-spin",
                )}
              />
              {isTriggeringComprasHeaders
                ? "Iniciando..."
                : "Sincronizar Compras"}
            </Button>
          )}

          {/* Button 2: Detalles Compras */}
          {isDetailsRunning && detailsBatch ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">Detalles:</span>
              <SyncProgress batch={detailsBatch} className="min-w-48" />
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSyncDetails}
              disabled={isBusy || !hasTenantSelected || isLoadingDetailsBatch}
            >
              <RefreshCw
                className={cn("h-4 w-4", isTriggeringDetails && "animate-spin")}
              />
              {isTriggeringDetails ? "Iniciando..." : "Detalles Compras"}
            </Button>
          )}

          {/* Button 3: Detalles Ventas */}
          {isVentasDetailsRunning && ventasDetailsBatch ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">Detalles Ventas:</span>
              <SyncProgress batch={ventasDetailsBatch} className="min-w-48" />
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSyncVentasDetails}
              disabled={
                isBusy || !hasTenantSelected || isLoadingVentasDetailsBatch
              }
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isTriggeringVentasDetails && "animate-spin",
                )}
              />
              {isTriggeringVentasDetails ? "Iniciando..." : "Detalles Ventas"}
            </Button>
          )}

          {/* Button 4: Sincronizar Ventas */}
          {isVentasHeadersRunning && ventasHeadersBatch ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">Ventas:</span>
              <SyncProgress batch={ventasHeadersBatch} className="min-w-48" />
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSyncVentasHeaders}
              disabled={
                isBusy || !hasTenantSelected || isLoadingVentasHeadersBatch
              }
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isTriggeringVentasHeaders && "animate-spin",
                )}
              />
              {isTriggeringVentasHeaders
                ? "Iniciando..."
                : "Sincronizar Ventas"}
            </Button>
          )}

          {/* Button 5: Validar detracciones (Admin/Master only) */}
          {(isAdmin || isMaster) &&
            (isDetractionValidationRunning && detractionValidationBatch ? (
              <div className="flex items-center gap-2">
                <span className="text-sm">Detracciones:</span>
                <SyncProgress
                  batch={detractionValidationBatch}
                  className="min-w-48"
                />
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSyncDetractionValidation}
                disabled={
                  isTriggeringDetractionValidation ||
                  isDetractionValidationRunning ||
                  !hasTenantSelected ||
                  isLoadingDetractionValidationBatch
                }
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    isTriggeringDetractionValidation && "animate-spin",
                  )}
                />
                {isTriggeringDetractionValidation
                  ? "Iniciando..."
                  : "Validar detracciones"}
              </Button>
            ))}
        </div>
      </FadeIn>

      {/* Tenant selection warning */}
      {!hasTenantSelected && (
        <FadeIn>
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <Building2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-700 dark:text-yellow-400">
              Selecciona un estudio
            </AlertTitle>
            <AlertDescription className="text-yellow-600 dark:text-yellow-300">
              Para sincronizar comprobantes, primero selecciona un estudio
              contable desde el menú superior.
            </AlertDescription>
          </Alert>
        </FadeIn>
      )}

      {/* Result alert */}
      {result && (
        <FadeIn>
          <Alert
            variant={result.type === "error" ? "destructive" : "default"}
            className={cn(
              "relative",
              result.type === "partial" &&
                "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
              result.type === "success" &&
                "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400",
            )}
          >
            {result.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.type === "error" && "Error de sincronización"}
              {result.type === "partial" &&
                "Sincronización completada con errores"}
              {result.type === "success" && "Sincronización completada"}
            </AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-6 w-6 p-0"
              onClick={() => setResult(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </Alert>
        </FadeIn>
      )}

      {/* Companies Table — unified 5-column table */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Empresas</CardTitle>
            <CardDescription>
              Selecciona una empresa para ver el detalle de comprobantes
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingStats ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : mergedRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">
                  No hay empresas registradas
                </h3>
                <p className="text-muted-foreground mt-1">
                  Las empresas aparecerán aquí cuando se configuren.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">RUC</TableHead>
                      <TableHead>Razón Social</TableHead>
                      <TableHead className="text-right w-36">
                        Comprobantes Compras
                      </TableHead>
                      <TableHead className="text-right w-36">
                        Comprobantes Ventas
                      </TableHead>
                      <TableHead className="w-28">Declaración</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergedRows.map((row) => (
                      <TableRow
                        key={row.company_id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onSelectCompany(row.company_id)}
                      >
                        <TableCell className="font-mono text-sm">
                          {row.ruc}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{row.business_name}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.compras_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.ventas_count.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {row.is_declared ? (
                            <Badge
                              variant="outline"
                              className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700"
                            >
                              <Lock className="h-3 w-3 mr-1" />
                              Declarado
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Footer */}
            {!isLoadingStats && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  {mergedRows.length > 0
                    ? `Mostrando ${mergedRows.length} empresa${mergedRows.length !== 1 ? "s" : ""}`
                    : "Sin empresas"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Company Detail View
// ─────────────────────────────────────────────────────────────────────────────

interface CompanyDetailViewProps {
  companyId: string;
  period: string;
  periodOptions: { value: string; label: string }[];
  onPeriodChange: (period: string) => void;
  onBack: () => void;
}

function CompanyDetailView({
  companyId,
  period,
  periodOptions,
  onPeriodChange,
  onBack,
}: CompanyDetailViewProps) {
  const router = useRouter();
  const { isMaster, tenantId, role } = useUserRole();

  // Local tab state — defaults to "compras" on mount
  const [activeTab, setActiveTab] = useState<ActiveTab>("compras");
  const isVentas = activeTab === "ventas";

  // Derive year (YYYY) and paddedMonth (MM) from period (YYYYMM)
  const year = period.slice(0, 4);
  const paddedMonth = period.slice(4, 6);

  // Fetch company details
  const {
    data: company,
    isLoading: isLoadingCompany,
    isError: isCompanyError,
    error: companyError,
  } = useCompany(companyId);

  // Fetch declaration state
  const { data: declaration, isLoading: isLoadingDeclaration } = useDeclaration(
    companyId,
    year,
    paddedMonth,
  );

  const isLocked = declaration?.status === "declared";
  const canDeclare = role === "admin" || role === "master";

  // Stats hooks for IGV card computations (server-side aggregations)
  const {
    data: purchaseStatsData,
    isLoading: isPurchaseLoading,
    isFetching: isPurchaseFetching,
  } = useVouchersStats({ company_id: companyId, period });

  const {
    data: salesStatsData,
    isLoading: isSalesLoading,
    isFetching: isSalesFetching,
  } = useSalesVouchersStats({ company_id: companyId, period });

  // IGV card values sourced from server-side aggregations (no extra client fetch)
  interface IgvCards {
    igvVentas: number;
    igvCompras: number;
    igvAPagar: number;
  }

  const igvCards = useMemo((): IgvCards => {
    const igvVentas = salesStatsData?.igv_total ?? 0;
    const igvCompras = purchaseStatsData?.igv_compras ?? 0;
    return { igvVentas, igvCompras, igvAPagar: igvVentas - igvCompras };
  }, [purchaseStatsData, salesStatsData]);

  // Declaration mutations
  const { mutate: declareperiod, isPending: isDeclaring } = useDeclare();
  const { mutate: reopenPeriod, isPending: isReopening } = useReopen();

  // Modal state
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [declareError, setDeclareError] = useState<string | null>(null);
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Validation counts — kept in sync by VouchersTable via onCountsChange (no extra fetch needed)
  const [validationCounts, setValidationCounts] = useState<ValidationCounts>({
    valido: 0,
    observado: 0,
    rechazado: 0,
  });

  // Sync state
  // NOTE: Both processes are always polled independently so that switching tabs
  // does not cause useBatchComplete to falsely fire (changing the queryKey arg
  // makes TanStack Query return undefined momentarily, which the completion
  // detector misreads as "batch finished").
  const { mutate: triggerHeaders, isPending: isTriggeringHeaders } =
    useSyncTrigger();
  const { data: comprasHeadersBatch, isLoading: isLoadingComprasHeadersBatch } =
    useActiveBatch("sire_compras_headers");
  const { data: salesHeadersBatch, isLoading: isLoadingSalesHeadersBatch } =
    useActiveBatch("sire_sales_headers");
  // Derive which batch to surface in the UI based on the active tab
  const headersBatch = isVentas ? salesHeadersBatch : comprasHeadersBatch;
  const isLoadingHeadersBatch = isVentas
    ? isLoadingSalesHeadersBatch
    : isLoadingComprasHeadersBatch;
  const { mutate: triggerDetails, isPending: isTriggeringDetails } =
    useSyncTrigger();
  const { data: detailsBatch, isLoading: isLoadingDetailsBatch } =
    useActiveBatch("sire_compras_details");

  // Sync state - Ventas details
  const { mutate: triggerVentasDetails, isPending: isTriggeringVentasDetails } =
    useSyncTrigger();
  const { data: ventasDetailsBatch, isLoading: isLoadingVentasDetailsBatch } =
    useActiveBatch("sire_ventas_details");

  const {
    mutate: triggerDetractionValidation,
    isPending: isTriggeringDetractionValidation,
  } = useSyncTrigger();
  const {
    data: detractionValidationBatch,
    isLoading: isLoadingDetractionValidationBatch,
  } = useActiveBatch("detraction_validation");
  const isDetractionValidationRunning =
    detractionValidationBatch?.status === "running" ||
    detractionValidationBatch?.status === "pending";

  const [result, setResult] = useState<ResultState | null>(null);
  const [hasTenantSelected, setHasTenantSelected] = useState(true);

  // Check tenant selection
  useEffect(() => {
    const checkTenant = () => {
      if (typeof window !== "undefined") {
        const selectedTenantId = localStorage.getItem("selectedTenantId");
        setHasTenantSelected(isMaster ? !!selectedTenantId : !!tenantId);
      }
    };
    checkTenant();
    window.addEventListener("tenantChanged", checkTenant);
    return () => window.removeEventListener("tenantChanged", checkTenant);
  }, [isMaster, tenantId]);

  // Handle batch completion
  const handleBatchComplete = useCallback(
    (batch: ActiveBatchResponse | null, type: "headers" | "details") => {
      if (!batch) {
        setResult({
          type: "success",
          message:
            type === "headers"
              ? "Extracción de comprobantes completada."
              : "Descarga de detalles completada.",
        });
        return;
      }

      const hasErrors = batch.failed_jobs > 0;
      const prefix = type === "headers" ? "Extracción" : "Descarga de detalles";

      if (batch.status === "failed") {
        setResult({
          type: "error",
          message: `${prefix} falló. Intenta nuevamente.`,
        });
      } else if (hasErrors) {
        setResult({
          type: "partial",
          message: `${prefix}: ${batch.successful_jobs} OK, ${batch.failed_jobs} errores.`,
        });
      } else {
        setResult({
          type: "success",
          message: `${prefix}: ${batch.total_jobs} procesados correctamente.`,
        });
      }
    },
    [],
  );

  // Each process gets its own completion watcher so switching tabs never
  // triggers a false-positive "batch finished" notification.
  useBatchComplete(comprasHeadersBatch, (batch) =>
    handleBatchComplete(batch, "headers"),
  );
  useBatchComplete(salesHeadersBatch, (batch) =>
    handleBatchComplete(batch, "headers"),
  );
  useBatchComplete(detailsBatch, (batch) =>
    handleBatchComplete(batch, "details"),
  );
  useBatchComplete(ventasDetailsBatch, (batch) =>
    handleBatchComplete(batch, "details"),
  );
  useBatchComplete(detractionValidationBatch, (batch) => {
    if (!batch) {
      setResult({
        type: "success",
        message: "Validación de detracciones completada.",
      });
      return;
    }
    if (batch.status === "failed") {
      setResult({
        type: "error",
        message: "Validación de detracciones falló. Intenta nuevamente.",
      });
    } else if (batch.failed_jobs > 0) {
      setResult({
        type: "partial",
        message: `Validación: ${batch.successful_jobs} OK, ${batch.failed_jobs} errores.`,
      });
    } else {
      setResult({
        type: "success",
        message: `Validación de detracciones: ${batch.total_jobs} procesados.`,
      });
    }
  });

  // Trigger sync
  const handleSyncHeaders = () => {
    setResult(null);
    triggerHeaders(
      {
        process: (isVentas
          ? "sire_sales_headers"
          : "sire_compras_headers") as JobProcess,
        period,
        company_id: companyId,
      },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar extracción",
          });
        },
      },
    );
  };

  const handleSyncDetails = () => {
    setResult(null);
    triggerDetails(
      {
        process: "sire_compras_details" as JobProcess,
        period,
        company_id: companyId,
      },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar descarga",
          });
        },
      },
    );
  };

  const handleSyncVentasDetails = () => {
    setResult(null);
    triggerVentasDetails(
      {
        process: "sire_ventas_details" as JobProcess,
        period,
        company_id: companyId,
      },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar descarga de detalles de ventas",
          });
        },
      },
    );
  };

  const handleSyncDetractionValidation = () => {
    setResult(null);
    triggerDetractionValidation(
      {
        process: "detraction_validation" as JobProcess,
        period,
        company_id: companyId,
      },
      {
        onError: (error) => {
          if (error instanceof Error && error.message.includes("409")) return;
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar la validación de detracciones",
          });
        },
      },
    );
  };

  // Handle period change - update URL
  const handlePeriodChange = (newPeriod: string) => {
    onPeriodChange(newPeriod);
    router.push(`/comprobantes?company=${companyId}&period=${newPeriod}`);
  };

  // Declare period handler
  const handleDeclare = () => {
    setDeclareError(null);
    declareperiod(
      {
        companyId,
        year,
        period: paddedMonth,
        payload: {
          summary: {
            valid_count: validationCounts.valido,
            rejected_count: validationCounts.rechazado,
            observed_count: validationCounts.observado,
          },
        },
      },
      {
        onSuccess: () => setShowDeclareModal(false),
        onError: (error) =>
          setDeclareError(
            error instanceof Error
              ? error.message
              : "Error al declarar período",
          ),
      },
    );
  };

  // Reopen period handler
  const handleReopen = () => {
    setReopenError(null);
    if (!reopenReason.trim()) {
      setReopenError("El motivo es obligatorio para reabrir el período.");
      return;
    }
    reopenPeriod(
      {
        companyId,
        year,
        period: paddedMonth,
        payload: { reason: reopenReason.trim() },
      },
      {
        onSuccess: () => {
          setShowReopenModal(false);
          setReopenReason("");
        },
        onError: (error) =>
          setReopenError(
            error instanceof Error ? error.message : "Error al reabrir período",
          ),
      },
    );
  };

  // Running states
  const isHeadersRunning =
    headersBatch?.status === "running" || headersBatch?.status === "pending";
  const isDetailsRunning =
    detailsBatch?.status === "running" || detailsBatch?.status === "pending";
  const isVentasDetailsRunning =
    ventasDetailsBatch?.status === "running" ||
    ventasDetailsBatch?.status === "pending";
  const isSyncing = isVentas
    ? isHeadersRunning || isVentasDetailsRunning
    : isHeadersRunning || isDetailsRunning;
  const isBusy =
    isTriggeringHeaders ||
    isTriggeringDetails ||
    isTriggeringVentasDetails ||
    isSyncing;

  // Period label
  const periodLabel = useMemo(() => {
    const option = periodOptions.find((o) => o.value === period);
    return option?.label || period;
  }, [period, periodOptions]);

  // Publish UI context so ClearBookAI knows what the user is viewing
  usePublishChatContext(
    {
      page: "comprobantes",
      company: company
        ? { id: companyId, name: company.business_name, ruc: company.ruc }
        : { id: companyId, name: "", ruc: undefined },
      period,
      periodLabel,
      tab: activeTab,
      declarationStatus: isLocked ? "declared" : "pending",
      stats: {
        "IGV Ventas": `S/ ${igvCards.igvVentas.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        "IGV Compras": `S/ ${igvCards.igvCompras.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        "IGV a Pagar": `S/ ${igvCards.igvAPagar.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        "Comprobantes válidos": validationCounts.valido,
        "Comprobantes observados": validationCounts.observado,
        "Comprobantes rechazados": validationCounts.rechazado,
      },
    },
    [
      companyId,
      period,
      periodLabel,
      activeTab,
      igvCards,
      validationCounts,
      isLocked,
      company,
    ],
  );

  // Error state - show friendly message instead of crashing
  if (isCompanyError) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <Button
            variant="ghost"
            size="sm"
            className="w-fit gap-2"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a empresas
          </Button>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error al cargar empresa</AlertTitle>
            <AlertDescription>
              {companyError instanceof Error
                ? companyError.message
                : "No se pudo cargar la información de la empresa. Por favor, intenta nuevamente."}
            </AlertDescription>
          </Alert>
        </FadeIn>
      </div>
    );
  }

  // Get the last declaration event for the banner
  const lastDeclaredEvent = declaration?.history
    ?.filter((h) => h.event === "declared")
    .at(-1);

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <FadeIn>
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit gap-2"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a empresas
          </Button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {isLoadingCompany ? (
                <>
                  <Skeleton className="h-8 w-64 mb-2" />
                  <Skeleton className="h-4 w-40" />
                </>
              ) : company ? (
                <>
                  <h1 className="text-2xl font-semibold tracking-tight truncate">
                    {company.business_name}
                  </h1>
                  <p className="text-muted-foreground font-mono">
                    RUC: {company.ruc} · {periodLabel}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Comprobantes
                  </h1>
                  <p className="text-muted-foreground">{periodLabel}</p>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* IGV Cards */}
      <FadeIn delay={0.02}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isPurchaseLoading ||
          isSalesLoading ||
          isPurchaseFetching ||
          isSalesFetching ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-sm font-medium">
                    IGV Ventas
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <Skeleton className="h-8 w-32" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-3 w-20" />
                </CardFooter>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-sm font-medium">
                    IGV Compras
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <Skeleton className="h-8 w-32" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-3 w-20" />
                </CardFooter>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-sm font-medium">
                    IGV a Pagar
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <Skeleton className="h-8 w-32" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-3 w-20" />
                </CardFooter>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-sm font-medium">
                    IGV Ventas
                  </CardDescription>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-2">
                  <CardTitle className="text-xl sm:text-2xl font-bold tabular-nums truncate">
                    {`S/ ${igvCards.igvVentas.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                  </CardTitle>
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">{periodLabel}</p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-sm font-medium">
                    IGV Compras
                  </CardDescription>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-2">
                  <CardTitle className="text-xl sm:text-2xl font-bold tabular-nums truncate">
                    {`S/ ${igvCards.igvCompras.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                  </CardTitle>
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">{periodLabel}</p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-sm font-medium">
                    IGV a Pagar
                  </CardDescription>
                  {igvCards.igvAPagar >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent className="pb-2">
                  <CardTitle
                    className={cn(
                      "text-xl sm:text-2xl font-bold tabular-nums truncate",
                      igvCards.igvAPagar < 0 &&
                        "text-red-600 dark:text-red-400",
                    )}
                  >
                    {`S/ ${igvCards.igvAPagar.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                  </CardTitle>
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">{periodLabel}</p>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      </FadeIn>

      {/* Declaration banner — always visible regardless of active tab */}
      {!isLoadingDeclaration && (
        <FadeIn>
          {isLocked && lastDeclaredEvent ? (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <AlertTitle className="text-green-700 dark:text-green-400">
                    Período declarado
                  </AlertTitle>
                  <AlertDescription className="text-green-600 dark:text-green-300">
                    <span>
                      Declarado el{" "}
                      <strong>{formatDateTime(lastDeclaredEvent.at)}</strong>{" "}
                      por{" "}
                      <strong>{formatByName(lastDeclaredEvent.by_name)}</strong>
                      . La validación de comprobantes está bloqueada.
                    </span>
                  </AlertDescription>
                </div>
                {canDeclare && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2 border-green-500/50 text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/30"
                    onClick={() => {
                      setReopenReason("");
                      setReopenError(null);
                      setShowReopenModal(true);
                    }}
                  >
                    <LockOpen className="h-3.5 w-3.5" />
                    Reabrir período
                  </Button>
                )}
              </div>
            </Alert>
          ) : (
            canDeclare && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <AlertTitle className="text-amber-700 dark:text-amber-400">
                      Período sin declarar
                    </AlertTitle>
                    <AlertDescription className="text-amber-600 dark:text-amber-300">
                      Este período aún no ha sido declarado. Revisa los
                      comprobantes y declara cuando estés listo.
                    </AlertDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2 border-amber-500/50 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
                    onClick={() => {
                      setDeclareError(null);
                      setShowDeclareModal(true);
                    }}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Declarar período
                  </Button>
                </div>
              </Alert>
            )
          )}
        </FadeIn>
      )}

      {/* Compras / Ventas tabs + Sync Actions in one row */}
      <FadeIn delay={0.02}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: tab selector */}
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            <Button
              variant={activeTab === "compras" ? "secondary" : "ghost"}
              size="sm"
              className="gap-2"
              onClick={() => setActiveTab("compras")}
            >
              Compras
            </Button>
            <Button
              variant={activeTab === "ventas" ? "secondary" : "ghost"}
              size="sm"
              className="gap-2"
              onClick={() => setActiveTab("ventas")}
            >
              Ventas
            </Button>
          </div>

          {/* Right: sync buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isHeadersRunning && headersBatch ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isVentas ? "Ventas:" : "Cabeceras:"}
                </span>
                <SyncProgress batch={headersBatch} className="min-w-48" />
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSyncHeaders}
                disabled={isBusy || !hasTenantSelected || isLoadingHeadersBatch}
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    isTriggeringHeaders && "animate-spin",
                  )}
                />
                {isTriggeringHeaders
                  ? "Iniciando..."
                  : isVentas
                    ? "Sincronizar Ventas"
                    : "Sincronizar Cabeceras"}
              </Button>
            )}

            {!isVentas && (
              <>
                {isDetailsRunning && detailsBatch ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Detalles:
                    </span>
                    <SyncProgress batch={detailsBatch} className="min-w-48" />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleSyncDetails}
                    disabled={
                      isBusy || !hasTenantSelected || isLoadingDetailsBatch
                    }
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4",
                        isTriggeringDetails && "animate-spin",
                      )}
                    />
                    {isTriggeringDetails
                      ? "Iniciando..."
                      : "Sincronizar Detalles"}
                  </Button>
                )}
              </>
            )}

            {isVentas && (
              <>
                {isVentasDetailsRunning && ventasDetailsBatch ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Detalles:
                    </span>
                    <SyncProgress
                      batch={ventasDetailsBatch}
                      className="min-w-48"
                    />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleSyncVentasDetails}
                    disabled={
                      isBusy ||
                      !hasTenantSelected ||
                      isLoadingVentasDetailsBatch
                    }
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4",
                        isTriggeringVentasDetails && "animate-spin",
                      )}
                    />
                    {isTriggeringVentasDetails
                      ? "Iniciando..."
                      : "Sincronizar Detalles"}
                  </Button>
                )}
              </>
            )}

            {/* Validar detracciones — solo en tab Compras (Admin/Master only) */}
            {!isVentas &&
              (isMaster || role === "admin") &&
              (isDetractionValidationRunning && detractionValidationBatch ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Detracciones:
                  </span>
                  <SyncProgress
                    batch={detractionValidationBatch}
                    className="min-w-48"
                  />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleSyncDetractionValidation}
                  disabled={
                    isTriggeringDetractionValidation ||
                    isDetractionValidationRunning ||
                    !hasTenantSelected ||
                    isLoadingDetractionValidationBatch
                  }
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      isTriggeringDetractionValidation && "animate-spin",
                    )}
                  />
                  {isTriggeringDetractionValidation
                    ? "Iniciando..."
                    : "Validar detracciones"}
                </Button>
              ))}
          </div>
        </div>
      </FadeIn>

      {/* Tenant selection warning */}
      {!hasTenantSelected && (
        <FadeIn>
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <Building2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-700 dark:text-yellow-400">
              Selecciona un estudio
            </AlertTitle>
            <AlertDescription className="text-yellow-600 dark:text-yellow-300">
              Para sincronizar comprobantes, primero selecciona un estudio
              contable desde el menú superior.
            </AlertDescription>
          </Alert>
        </FadeIn>
      )}

      {/* Result alert */}
      {result && (
        <FadeIn>
          <Alert
            variant={result.type === "error" ? "destructive" : "default"}
            className={cn(
              "relative",
              result.type === "partial" &&
                "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
              result.type === "success" &&
                "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400",
            )}
          >
            {result.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.type === "error" && "Error de sincronización"}
              {result.type === "partial" &&
                "Sincronización completada con errores"}
              {result.type === "success" && "Sincronización completada"}
            </AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-6 w-6 p-0"
              onClick={() => setResult(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </Alert>
        </FadeIn>
      )}

      {/* Vouchers Table — compras or ventas */}
      <FadeIn delay={0.1}>
        {isVentas ? (
          <SalesVouchersTable
            period={period}
            companyId={companyId}
            isSyncing={isSyncing}
          />
        ) : (
          <VouchersTable
            period={period}
            companyId={companyId}
            isSyncing={isSyncing}
            isLocked={isLocked}
            onCountsChange={setValidationCounts}
            companyRuc={company?.ruc}
            companyName={company?.business_name}
          />
        )}
      </FadeIn>

      {/* ─── Declare Period Modal ─── */}
      <Dialog open={showDeclareModal} onOpenChange={setShowDeclareModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declarar período</DialogTitle>
            <DialogDescription>
              Confirma que el período <strong>{periodLabel}</strong> está listo
              para ser declarado. Una vez declarado, la validación de
              comprobantes quedará bloqueada.
            </DialogDescription>
          </DialogHeader>

          {/* Validation counts summary */}
          <div className="grid grid-cols-3 gap-3 my-2">
            {/* Válidos */}
            <div
              className={cn(
                "flex flex-col items-center p-3 rounded-lg border",
                validationCounts.valido > 0
                  ? "bg-green-500/10 border-green-500/20"
                  : "bg-muted/30 border-border",
              )}
            >
              <span
                className={cn(
                  "text-xl font-bold tabular-nums",
                  validationCounts.valido > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground",
                )}
              >
                {validationCounts.valido}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                Válidos
              </span>
            </div>
            {/* Rechazados */}
            <div
              className={cn(
                "flex flex-col items-center p-3 rounded-lg border",
                validationCounts.rechazado > 0
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-muted/30 border-border",
              )}
            >
              <span
                className={cn(
                  "text-xl font-bold tabular-nums",
                  validationCounts.rechazado > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground",
                )}
              >
                {validationCounts.rechazado}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                Rechazados
              </span>
            </div>
            {/* Observados */}
            <div
              className={cn(
                "flex flex-col items-center p-3 rounded-lg border",
                validationCounts.observado > 0
                  ? "bg-yellow-500/10 border-yellow-500/20"
                  : "bg-muted/30 border-border",
              )}
            >
              <span
                className={cn(
                  "text-xl font-bold tabular-nums",
                  validationCounts.observado > 0
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-muted-foreground",
                )}
              >
                {validationCounts.observado}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                Observados
              </span>
            </div>
          </div>

          {/* Warning if observed vouchers exist */}
          {validationCounts.observado > 0 && (
            <Alert variant="destructive" className="mt-1">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No se puede declarar</AlertTitle>
              <AlertDescription>
                Hay {validationCounts.observado} comprobante
                {validationCounts.observado !== 1 ? "s" : ""} observado
                {validationCounts.observado !== 1 ? "s" : ""}. Debes resolver
                todos los observados antes de declarar el período.
              </AlertDescription>
            </Alert>
          )}

          {/* Error from backend */}
          {declareError && (
            <Alert variant="destructive" className="mt-1">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{declareError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeclareModal(false)}
              disabled={isDeclaring}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeclare}
              disabled={isDeclaring || validationCounts.observado > 0}
            >
              {isDeclaring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Declarando...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Confirmar declaración
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reopen Period Modal ─── */}
      <Dialog open={showReopenModal} onOpenChange={setShowReopenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir período</DialogTitle>
            <DialogDescription>
              Indica el motivo por el cual necesitas reabrir el período{" "}
              <strong>{periodLabel}</strong>. Esto permitirá modificar la
              validación de comprobantes nuevamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Motivo <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Ej: Se detectaron comprobantes mal clasificados..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={3}
              disabled={isReopening}
            />
          </div>

          {reopenError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{reopenError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReopenModal(false)}
              disabled={isReopening}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReopen}
              disabled={isReopening || !reopenReason.trim()}
            >
              {isReopening ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reabriendo...
                </>
              ) : (
                <>
                  <LockOpen className="mr-2 h-4 w-4" />
                  Reabrir período
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
