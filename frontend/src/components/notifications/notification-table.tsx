"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Bell, Download, Eye } from "lucide-react";
import { ETIQUETA_MAP, ETIQUETA_SHORT } from "@/lib/notification-constants";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { AiCriticalityBadge } from "./ai-criticality-badge";
import { AiSummarySection } from "./ai-summary-section";
import { useCompanies } from "@/hooks/use-companies";
import { formatDateForDisplay } from "@/lib/dates";
import { PdfViewer } from "@/components/pdf-viewer";
import { CompanyCombobox } from "@/components/company-combobox";
import { cn } from "@/lib/utils";
import { SearchInput, FilterSelect } from "@/components/ui/filter-bar";
import { TableFooter } from "@/components/ui/table-footer";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading";
import { ScrollTable } from "@/components/ui/scroll-table";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 400;

/** Tailwind color classes per etiqueta code — semantic coloring similar to criticality badges */
const TAG_CLASSES: Record<string, string> = {
  "10": "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900", // VALORES
  "11": "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800", // RESOLUCIONES DE COBRANZA
  "12": "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800", // RESOLUCIONES DE FRACCIONAMIENTO
  "13": "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700", // RESOLUCIONES NO CONTENCIOSAS
  "14": "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800", // RESOLUCIONES DE FISCALIZACIÓN
  "15": "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted", // NOTIFICACIONES ANTERIORES
  "16": "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800", // AVISOS
  "18": "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700", // INSPECCIÓN NO INTRUSIVA
  "00": "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted", // SIN ETIQUETA
};

// Filter options: value = code (for backend), label = description (for UI)
const LABEL_OPTIONS = Object.entries(ETIQUETA_MAP).map(
  ([code, description]) => ({
    value: code,
    label: description,
  }),
);

/** Map etiqueta code to display label */
function getEtiquetaLabel(code: string): string {
  return ETIQUETA_MAP[code] || code;
}

const READ_OPTIONS = [
  { value: "unread" as const, label: "No leídos" },
  { value: "read" as const, label: "Leídos" },
];

function getTagClasses(tag: string): string {
  return (
    TAG_CLASSES[tag] ??
    "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted"
  );
}

/** Strip leading "ASUNTO: " prefix from SUNAT subject strings */
function cleanSubject(subject: string): string {
  return subject.replace(/^ASUNTO:\s*/i, "").trim();
}

/** Detail sheet for notifications — shows metadata, AI summary, and content/PDF link */
function NotificationDetailSheet({
  notification,
}: {
  notification: Notification;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Ver detalle"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:w-[28rem] sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-lg text-left pr-8">
            {cleanSubject(notification.subject) || "Notificación"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detalle de la notificación SUNAT
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Empresa Info */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Empresa
            </p>
            <p className="font-medium text-sm">
              {notification.business_name || "Sin nombre"}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              RUC: {notification.ruc}
            </p>
          </div>

          {/* Metadata Card */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Fecha</p>
              <p className="font-medium text-sm">
                {notification.date_text ||
                  formatDateForDisplay(notification.received_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Etiqueta</p>
              {notification.labels.length > 0 ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-0.5 text-xs font-medium border cursor-default",
                          getTagClasses(notification.labels[0]),
                        )}
                      >
                        {ETIQUETA_SHORT[notification.labels[0]] ??
                          getEtiquetaLabel(notification.labels[0])}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{getEtiquetaLabel(notification.labels[0])}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <p className="text-sm text-muted-foreground">Sin etiqueta</p>
              )}
            </div>
            {notification.has_document && (
              <div className="col-span-2 pt-1 border-t border-border/40">
                <PdfViewer
                  notificationId={notification.id}
                  title={cleanSubject(notification.subject)}
                />
              </div>
            )}
          </div>

          {/* AI Summary */}
          <AiSummarySection aiSummary={notification.ai_summary ?? null} />

          {/* Message Content (text-only notifications) */}
          {!notification.has_document && notification.message_body && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Contenido
              </p>
              <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {notification.message_body}
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Polling interval during sync (3 seconds) */
const SYNC_POLLING_INTERVAL = 3000;

export interface NotificationFilters {
  searchQuery: string;
  companyFilter: string;
  labelFilter: string;
  readFilter: string;
  visibleCount: number;
}

interface NotificationTableProps {
  /** When true, enables polling to show new notifications in real-time */
  isSyncing?: boolean;
  /**
   * Called whenever the active filters or visible notification count change.
   * Used by the parent page to publish context to ClearBookAI.
   */
  onFiltersChange?: (filters: NotificationFilters) => void;
}

export function NotificationTable({
  isSyncing = false,
  onFiltersChange,
}: NotificationTableProps) {
  // Filter state (managed internally now)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");

  // Load companies for filter dropdown (higher limit for combobox)
  const { data: companiesData, isLoading: isLoadingCompanies } = useCompanies({
    is_active: true,
    limit: 500,
  });
  const companies = companiesData?.items ?? [];

  // Build API params from filters
  const apiParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      company_id: companyFilter === "all" ? undefined : companyFilter,
      label: labelFilter === "all" ? undefined : labelFilter,
      is_read: readFilter === "all" ? undefined : readFilter === "read",
      refetchInterval: isSyncing ? SYNC_POLLING_INTERVAL : (false as const),
    }),
    [companyFilter, labelFilter, readFilter, isSyncing],
  );

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useNotifications(apiParams);

  // Track previous notification IDs to detect new ones
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // Flatten all pages into a single array and deduplicate by ID
  const allNotifications = useMemo(() => {
    const items = data?.pages.flatMap((page) => page.items) ?? [];
    // Deduplicate by ID to prevent key conflicts during pagination
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [data?.pages]);

  // Detect new notifications and trigger flash effect
  useEffect(() => {
    if (!isSyncing || allNotifications.length === 0) return;

    const currentIds = new Set(allNotifications.map((n) => n.id));
    const freshIds = new Set<string>();

    // Find IDs that weren't in the previous set
    currentIds.forEach((id) => {
      if (!prevIdsRef.current.has(id)) {
        freshIds.add(id);
      }
    });

    // If we found new IDs, trigger flash
    if (freshIds.size > 0) {
      setNewIds(freshIds);
      // Clear flash after animation completes
      const timer = setTimeout(() => setNewIds(new Set()), 1500);
      return () => clearTimeout(timer);
    }

    // Update ref for next comparison
    prevIdsRef.current = currentIds;
  }, [allNotifications, isSyncing]);

  // Client-side search filter (RUC, business_name, subject)
  const localFilteredNotifications = useMemo(() => {
    if (!searchQuery) return allNotifications;

    const searchLower = searchQuery.toLowerCase();
    return allNotifications.filter(
      (n) =>
        n.ruc?.toLowerCase().includes(searchLower) ||
        n.business_name?.toLowerCase().includes(searchLower) ||
        n.subject.toLowerCase().includes(searchLower),
    );
  }, [allNotifications, searchQuery]);

  // Debounce search for server (only when local results are empty)
  useEffect(() => {
    if (localFilteredNotifications.length > 0 || !searchQuery) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(
      () => setDebouncedSearch(searchQuery),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery, localFilteredNotifications.length]);

  // Determine what to show
  const isServerSearching =
    searchQuery && localFilteredNotifications.length === 0 && !debouncedSearch;
  const notifications = localFilteredNotifications;
  const isSearchLoadingState = Boolean(isServerSearching);

  // Check if any filters are active
  const hasFilters = Boolean(
    searchQuery ||
    companyFilter !== "all" ||
    labelFilter !== "all" ||
    readFilter !== "all",
  );

  // Notify parent of filter/count changes so it can publish chat context
  useEffect(() => {
    if (!onFiltersChange) return;
    onFiltersChange({
      searchQuery,
      companyFilter,
      labelFilter,
      readFilter,
      visibleCount: notifications.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    companyFilter,
    labelFilter,
    readFilter,
    notifications.length,
  ]);

  // Export visible notifications as CSV
  const downloadExcel = useCallback(() => {
    const rows: string[][] = [
      ["#", "Cliente", "RUC", "Asunto", "Etiqueta", "Fecha"],
    ];

    notifications.forEach((n, index) => {
      rows.push([
        String(index + 1),
        n.business_name || "Sin nombre",
        n.ruc || "-",
        n.subject,
        n.labels?.[0] ? getEtiquetaLabel(n.labels[0]) : "-",
        n.date_text ||
          (n.received_at
            ? new Date(n.received_at).toLocaleDateString("es-PE")
            : "-"),
      ]);
    });

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `notificaciones-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [notifications]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Error al cargar notificaciones: {error.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>
            Buzón electrónico SUNAT de todos los clientes
          </CardDescription>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadExcel}
                disabled={notifications.length === 0}
                aria-label="Exportar notificaciones visibles"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Exportar
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Descarga las {notifications.length} notificaciones visibles</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters - Using FilterBar components */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Search */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por RUC, razón social o asunto..."
            isSearching={isSearchLoadingState}
          />

          {/* Filters row */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
            {/* Company */}
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs text-muted-foreground">Empresa</label>
              <CompanyCombobox
                companies={companies}
                value={companyFilter}
                onValueChange={setCompanyFilter}
                showAllOption
                allOptionText="Todas las empresas"
                isLoading={isLoadingCompanies}
                placeholder="Seleccionar empresa"
              />
            </div>

            {/* Label */}
            <FilterSelect
              label="Etiqueta"
              value={labelFilter}
              onChange={setLabelFilter}
              options={LABEL_OPTIONS}
              allOption={{ value: "all", label: "Todas" }}
              width="w-full sm:w-52"
            />

            {/* Read status */}
            <FilterSelect
              label="Estado"
              value={readFilter}
              onChange={setReadFilter}
              options={READ_OPTIONS}
              allOption={{ value: "all", label: "Todos" }}
              width="w-full sm:w-36"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No hay notificaciones"
            description="Las notificaciones aparecerán aquí cuando se sincronicen."
            hasFilters={hasFilters}
          />
        ) : (
          <ScrollTable>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground whitespace-nowrap">
                    Fecha
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
                    Cliente
                  </TableHead>
                  <TableHead className="min-w-52 text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
                    Asunto
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground whitespace-nowrap">
                    Etiqueta
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground whitespace-nowrap">
                    Criticidad
                  </TableHead>
                  <TableHead className="w-16 text-right text-[10px] font-semibold tracking-wide uppercase text-muted-foreground"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((n) => (
                  <TableRow
                    key={n.id}
                    className={cn(
                      n.is_read && "opacity-60",
                      newIds.has(n.id) && "animate-highlight-row",
                    )}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {n.date_text || formatDateForDisplay(n.received_at)}
                    </TableCell>
                    <TableCell className="max-w-44">
                      <p className="font-medium truncate">
                        {n.business_name || "Sin nombre"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {n.ruc}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="line-clamp-2 cursor-default">
                              {cleanSubject(n.subject)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{cleanSubject(n.subject)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {n.labels.length > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "cursor-default text-xs font-medium border",
                                  getTagClasses(n.labels[0]),
                                )}
                              >
                                {ETIQUETA_SHORT[n.labels[0]] ??
                                  getEtiquetaLabel(n.labels[0])}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{getEtiquetaLabel(n.labels[0])}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <AiCriticalityBadge aiSummary={n.ai_summary ?? null} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <NotificationDetailSheet notification={n} />
                        {n.has_document && (
                          <PdfViewer
                            notificationId={n.id}
                            title={cleanSubject(n.subject)}
                            iconOnly
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        )}

        {/* Footer - Using TableFooter component */}
        <TableFooter
          currentCount={notifications.length}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isFiltered={Boolean(searchQuery)}
          onLoadMore={() => fetchNextPage()}
          entityName="notificaciones"
        />
      </CardContent>
    </Card>
  );
}
