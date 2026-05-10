"use client";

import Link from "next/link";
import { RefreshCw, Loader2, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FadeIn } from "@/components/motion";
import { useBatchesAdmin } from "@/hooks/use-batches-admin";
import { cn } from "@/lib/utils";
import { formatLocalDateCompact } from "@/lib/dates";
import type { Batch, BatchStatus, JobProcess } from "@/types";

const batchStatusConfig: Record<
  BatchStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: string;
  }
> = {
  pending: { label: "Pendiente", variant: "secondary", icon: "⏳" },
  running: { label: "En ejecución", variant: "default", icon: "🔄" },
  completed: { label: "Completado", variant: "outline", icon: "✅" },
  failed: { label: "Error", variant: "destructive", icon: "❌" },
  cancelled: { label: "Cancelado", variant: "secondary", icon: "🚫" },
};

const processConfig: Record<JobProcess, { label: string }> = {
  sunat_notifications: { label: "SUNAT Notificaciones" },
  sire_compras_headers: { label: "SIRE Compras (Cabeceras)" },
  sire_compras_details: { label: "SIRE Compras (Detalles)" },
  sire_sales_headers: { label: "SIRE Ventas (Cabeceras)" },
  sire_ventas_details: { label: "SIRE Ventas (Detalles)" },
  detraction_validation: { label: "Validación de Detracciones" },
};

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function SyncMonitorPage() {
  const { data, isLoading, error, refetch, isFetching } = useBatchesAdmin();
  const batches = [...(data?.items ?? [])].sort((a, b) => {
    const aTime = new Date(a.started_at ?? a.created_at).getTime();
    const bTime = new Date(b.started_at ?? b.created_at).getTime();
    return bTime - aTime;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Monitor de Sincronización
            </h1>
            <p className="text-muted-foreground">
              Historial de ejecuciones de scrapers
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
            />
            Actualizar
          </Button>
        </div>
      </FadeIn>

      {/* Batches Table */}
      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle>Batches de Sincronización</CardTitle>
            <CardDescription>
              {batches.length} batch{batches.length !== 1 ? "es" : ""}{" "}
              encontrado{batches.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="py-8 text-center text-destructive">
                Error al cargar batches: {error.message}
              </div>
            ) : isLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : batches.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No se encontraron batches
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Organización</TableHead>
                    <TableHead>Proceso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Progreso</TableHead>
                    <TableHead className="text-right">Duración</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <BatchRow key={batch.id} batch={batch} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function BatchRow({ batch }: { batch: Batch }) {
  const status = batchStatusConfig[batch.status];

  return (
    <TableRow className="group">
      <TableCell className="text-muted-foreground text-sm">
        {formatLocalDateCompact(batch.created_at)}
      </TableCell>
      <TableCell>
        <span className="text-sm">{batch.tenant_name || batch.tenant_id}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {processConfig[batch.process_type]?.label || batch.process_type}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={status.variant} className="gap-1">
          <span>{status.icon}</span>
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm">
          {batch.successful_jobs}/{batch.total_jobs}
          {batch.failed_jobs > 0 && (
            <span className="text-destructive ml-1">
              ({batch.failed_jobs} err)
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">
        {formatDuration(batch.duration_ms)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Ver detalles del batch"
        >
          <Link href={`/admin/batches/detail?id=${batch.id}`}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
