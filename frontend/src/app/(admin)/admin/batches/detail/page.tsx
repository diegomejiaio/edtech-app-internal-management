"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, ChevronRight } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { FadeIn } from "@/components/motion";
import { useBatchDetail } from "@/hooks/use-batches-admin";
import { cn } from "@/lib/utils";
import { formatLocalDateCompact } from "@/lib/dates";
import type { BatchJob, BatchStatus, JobStatus } from "@/types";

const statusConfig: Record<
  BatchStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pendiente", variant: "secondary" },
  running: { label: "En ejecución", variant: "default" },
  completed: { label: "Completado", variant: "outline" },
  failed: { label: "Error", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "secondary" },
};

const jobStatusConfig: Record<
  JobStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pendiente", variant: "secondary" },
  running: { label: "En ejecución", variant: "default" },
  completed: { label: "Completado", variant: "outline" },
  failed: { label: "Error", variant: "destructive" },
};

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function BatchDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const {
    data: batch,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useBatchDetail(id || undefined);

  if (!id) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground mb-4">
          ID de batch no especificado
        </p>
        <Button variant="outline" asChild>
          <Link href="/admin/sync">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive mb-4">Error al cargar el batch</p>
        <Button variant="outline" asChild>
          <Link href="/admin/sync">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </div>
    );
  }

  const status = statusConfig[batch.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/sync">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Detalle de Batch
            </h1>
            <p className="text-muted-foreground text-sm font-mono">
              {batch.id}
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

      {/* Summary */}
      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Resumen</CardTitle>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progreso</span>
                <span>{batch.progress}%</span>
              </div>
              <Progress value={batch.progress} className="h-2" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-semibold">{batch.total_jobs}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-semibold text-green-600">
                  {batch.successful_jobs}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Errores</p>
                <p className="text-2xl font-semibold text-destructive">
                  {batch.failed_jobs}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duración</p>
                <p className="text-2xl font-semibold">
                  {formatDuration(batch.duration_ms)}
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
              <div>
                <span className="text-muted-foreground">Organización: </span>
                <span>{batch.tenant_name || batch.tenant_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Creado: </span>
                <span>{formatLocalDateCompact(batch.created_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Jobs Table */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>
              {batch.jobs?.length || 0} jobs en este batch
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!batch.jobs || batch.jobs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No hay jobs en este batch
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>RUC</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Nuevos</TableHead>
                    <TableHead className="text-right">Omitidos</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...batch.jobs]
                    .sort((a, b) => {
                      const aTime = new Date(
                        a.started_at ?? a.completed_at ?? 0,
                      ).getTime();
                      const bTime = new Date(
                        b.started_at ?? b.completed_at ?? 0,
                      ).getTime();
                      return bTime - aTime;
                    })
                    .map((job, index) => (
                      <JobRow key={job.id || index} job={job} />
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

function JobRow({ job }: { job: BatchJob }) {
  const status = jobStatusConfig[job.status];
  const firstError = job.errors?.[0];

  return (
    <TableRow className="group">
      <TableCell className="font-mono text-xs text-muted-foreground">
        {job.id ? job.id.slice(0, 12) + "..." : "—"}
      </TableCell>
      <TableCell>
        <span className="font-medium">
          {job.company_name || job.company_id}
        </span>
      </TableCell>
      <TableCell className="font-mono text-sm">{job.ruc || "—"}</TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
        {firstError && (
          <p
            className="text-xs text-destructive mt-1 max-w-xs truncate"
            title={firstError}
          >
            {firstError}
          </p>
        )}
      </TableCell>
      <TableCell className="text-right">{job.records_new}</TableCell>
      <TableCell className="text-right text-muted-foreground">
        {job.records_skipped}
      </TableCell>
      <TableCell className="text-right">
        {job.id && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Link href={`/admin/jobs/detail?id=${job.id}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
