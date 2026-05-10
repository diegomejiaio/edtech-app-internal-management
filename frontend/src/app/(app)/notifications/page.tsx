"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUserRole } from "@/hooks/use-auth";
import {
  StatsCards,
  NotificationTable,
  SyncProgress,
} from "@/components/notifications";
import type { NotificationFilters } from "@/components/notifications/notification-table";
import { FadeIn } from "@/components/motion";
import {
  useSyncTrigger,
  useActiveBatch,
  useBatchComplete,
} from "@/hooks/use-sync";
import { useNotificationsStats } from "@/hooks/use-notifications";
import { usePublishChatContext } from "@/hooks/use-publish-chat-context";
import { cn } from "@/lib/utils";
import type { ActiveBatchResponse } from "@/types";

type ResultType = "success" | "error" | "partial";

interface ResultState {
  type: ResultType;
  message: string;
}

export default function NotificationsPage() {
  const { mutate: trigger, isPending: isTriggering } = useSyncTrigger();
  const { data: activeBatch, isLoading: isLoadingBatch } = useActiveBatch(
    "sunat_notifications",
  );
  const { isMaster, tenantId } = useUserRole();
  const { data: stats } = useNotificationsStats();

  const [result, setResult] = useState<ResultState | null>(null);
  const [hasTenantSelected, setHasTenantSelected] = useState(true);
  const [tableFilters, setTableFilters] = useState<NotificationFilters | null>(
    null,
  );

  // Publish UI context for ClearBookAI
  usePublishChatContext(
    {
      page: "notifications",
      stats: stats
        ? {
            "Total notificaciones": stats.total,
            "Últimas 24h": stats.ultimas24h,
            "Últimos 7 días": stats.ultimos7dias,
            "Tipos de documentos": stats.tipos,
            "Clientes activos": stats.clientes,
            "Notificaciones visibles": tableFilters?.visibleCount ?? null,
          }
        : null,
      filters:
        tableFilters &&
        (tableFilters.companyFilter !== "all" ||
          tableFilters.labelFilter !== "all" ||
          tableFilters.readFilter !== "all" ||
          tableFilters.searchQuery)
          ? {
              empresa:
                tableFilters.companyFilter !== "all"
                  ? tableFilters.companyFilter
                  : null,
              etiqueta:
                tableFilters.labelFilter !== "all"
                  ? tableFilters.labelFilter
                  : null,
              estado:
                tableFilters.readFilter !== "all"
                  ? tableFilters.readFilter
                  : null,
              busqueda: tableFilters.searchQuery || null,
            }
          : null,
    },
    [stats, tableFilters],
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

    // Listen for tenant changes from TenantSwitcher
    window.addEventListener("tenantChanged", checkTenant);
    return () => window.removeEventListener("tenantChanged", checkTenant);
  }, [isMaster, tenantId]);

  // Handle batch completion
  const handleBatchComplete = useCallback(
    (batch: ActiveBatchResponse | null) => {
      // If batch is null, it means the server returned 204 (batch completed and no longer active)
      // We can only show a generic success message
      if (!batch) {
        setResult({
          type: "success",
          message: "Sincronización completada.",
        });
        return;
      }

      const hasErrors = batch.failed_jobs > 0;

      if (batch.status === "failed") {
        setResult({
          type: "error",
          message: "La sincronización falló. Intenta nuevamente.",
        });
      } else if (hasErrors) {
        setResult({
          type: "partial",
          message: `${batch.successful_jobs} empresas OK, ${batch.failed_jobs} con errores.`,
        });
      } else {
        setResult({
          type: "success",
          message: `${batch.total_jobs} empresas sincronizadas correctamente.`,
        });
      }
    },
    [],
  );

  useBatchComplete(activeBatch, handleBatchComplete);

  // Keep track of table filters to publish chat context
  const handleFiltersChange = useCallback((filters: NotificationFilters) => {
    setTableFilters(filters);
  }, []);

  // Trigger sync
  const handleSync = () => {
    setResult(null);
    trigger(
      { process: "sunat_notifications" },
      {
        onError: (error) => {
          // 409 = batch already running, show progress
          if (error instanceof Error && error.message.includes("409")) {
            return; // Active batch will be shown via useActiveBatch
          }
          setResult({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Error al iniciar sincronización",
          });
        },
      },
    );
  };

  const isRunning =
    activeBatch?.status === "running" || activeBatch?.status === "pending";
  const isBusy = isTriggering || isRunning;

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Notificaciones SUNAT
            </h1>
            <p className="text-muted-foreground">
              Buzón electrónico de todos los clientes
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Sync button or Progress */}
            {isRunning && activeBatch ? (
              <SyncProgress batch={activeBatch} className="min-w-64" />
            ) : (
              <Button
                size="sm"
                className="gap-2"
                onClick={handleSync}
                disabled={isBusy || !hasTenantSelected || isLoadingBatch}
              >
                <RefreshCw
                  className={cn("h-4 w-4", isTriggering && "animate-spin")}
                />
                {isTriggering ? "Iniciando..." : "Sincronizar"}
              </Button>
            )}
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
              Para sincronizar notificaciones, primero selecciona un estudio
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

      {/* Stats — StaggerList integrado dentro de StatsCards */}
      <StatsCards isSyncing={isBusy} />

      {/* Table */}
      <FadeIn delay={0.2}>
        <NotificationTable
          isSyncing={isBusy}
          onFiltersChange={handleFiltersChange}
        />
      </FadeIn>
    </div>
  );
}
