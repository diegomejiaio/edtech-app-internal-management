"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { FadeIn } from "@/components/motion";
import { useJobsAdmin } from "@/hooks/use-jobs-admin";
import { formatLocalDate } from "@/lib/dates";
import type { JobStatus, JobProcess, JobListItem } from "@/types";

// Status configuration
const DEFAULT_STATUS_CONFIG = {
  label: "Desconocido",
  variant: "outline" as const,
  icon: Clock,
  color: "text-muted-foreground",
};

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof CheckCircle2;
    color: string;
  }
> = {
  pending: {
    label: "Pendiente",
    variant: "secondary",
    icon: Clock,
    color: "text-yellow-500",
  },
  running: {
    label: "En ejecución",
    variant: "default",
    icon: Play,
    color: "text-blue-500",
  },
  completed: {
    label: "Completado",
    variant: "outline",
    icon: CheckCircle2,
    color: "text-green-500",
  },
  failed: {
    label: "Error",
    variant: "destructive",
    icon: XCircle,
    color: "text-red-500",
  },
};

const processLabels: Record<JobProcess, string> = {
  sunat_notifications: "Notificaciones SUNAT",
  sire_compras_headers: "SIRE Compras - Cabeceras",
  sire_compras_details: "SIRE Compras - Detalles",
  sire_sales_headers: "SIRE Ventas - Cabeceras",
  sire_ventas_details: "SIRE Ventas - Detalles",
  detraction_validation: "Validación de Detracciones",
};

function formatDuration(ms?: number): string {
  if (!ms) return "-";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [processFilter, setProcessFilter] = useState<JobProcess | "all">("all");

  const { data, isLoading, refetch, isFetching } = useJobsAdmin({ limit: 100 });
  const jobs = data?.items ?? [];

  // Sort: most recent first (started_at → completed_at → epoch 0 for pending)
  const sortedJobs = [...jobs].sort((a, b) => {
    const aTime = new Date(a.started_at ?? a.completed_at ?? 0).getTime();
    const bTime = new Date(b.started_at ?? b.completed_at ?? 0).getTime();
    return bTime - aTime;
  });

  // Client-side filtering
  const filteredJobs = sortedJobs.filter((job) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        job.company_name.toLowerCase().includes(searchLower) ||
        job.ruc.includes(searchLower) ||
        job.id.toLowerCase().includes(searchLower) ||
        (job.tenant_name?.toLowerCase().includes(searchLower) ?? false);
      if (!matchesSearch) return false;
    }
    // Status filter
    if (statusFilter !== "all" && job.status !== statusFilter) return false;
    // Process filter
    if (processFilter !== "all" && job.process !== processFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total: jobs.length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    running: jobs.filter((j) => j.status === "running").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Jobs de Sincronización
            </h1>
            <p className="text-muted-foreground">
              Historial de procesos de sincronización
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Actualizar
          </Button>
        </div>
      </FadeIn>

      {/* Stats */}
      <FadeIn delay={0.1}>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Errores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.failed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                En ejecución
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.running}
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Table */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle>Lista de Jobs</CardTitle>
            <CardDescription>Jobs recientes de sincronización</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <div className="relative w-full sm:flex-1 sm:min-w-50 sm:max-w-sm">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Buscar por empresa, RUC, ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as JobStatus | "all")}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Completados</SelectItem>
                  <SelectItem value="failed">Errores</SelectItem>
                  <SelectItem value="running">En ejecución</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={processFilter}
                onValueChange={(v) => setProcessFilter(v as JobProcess | "all")}
              >
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Proceso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sunat_notifications">
                    Notificaciones SUNAT
                  </SelectItem>
                  <SelectItem value="sire_compras_headers">
                    SIRE Compras - Cabeceras
                  </SelectItem>
                  <SelectItem value="sire_compras_details">
                    SIRE Compras - Detalles
                  </SelectItem>
                  <SelectItem value="sire_ventas">SIRE Ventas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {jobs.length === 0
                  ? "No hay jobs registrados"
                  : "No se encontraron resultados"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Proceso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Iniciado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => {
                    const config =
                      statusConfig[job.status] ?? DEFAULT_STATUS_CONFIG;
                    const StatusIcon = config.icon;
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-xs">
                          {job.id.slice(0, 16)}…
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{job.company_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {job.ruc}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {processLabels[job.process]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant}>
                            <StatusIcon
                              className="mr-1 h-3 w-3"
                              aria-hidden="true"
                            />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDuration(job.duration_ms)}</TableCell>
                        <TableCell>
                          {job.started_at
                            ? formatLocalDate(job.started_at)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            aria-label="Ver detalle"
                          >
                            <Link href={`/admin/jobs/detail?id=${job.id}`}>
                              <ExternalLink
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
