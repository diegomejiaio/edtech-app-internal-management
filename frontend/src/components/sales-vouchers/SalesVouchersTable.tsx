"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  MinusCircle,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  Eye,
  FileText,
} from "lucide-react";
import {
  useSalesVouchers,
  useAllSalesVouchers,
  useSalesVoucher,
} from "@/hooks/use-sales-vouchers";
import { cn } from "@/lib/utils";
import { SearchInput, FilterSelect } from "@/components/ui/filter-bar";
import { ScrollTable } from "@/components/ui/scroll-table";
import { TableFooter } from "@/components/ui/table-footer";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  SalesVoucher,
  SalesVoucherItem,
  SalesVoucherValidationStatus,
  SalesVoucherDetailStatus,
} from "@/types";

const PAGE_SIZE = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const VALIDATION_STATUS_CONFIG: Record<
  SalesVoucherValidationStatus,
  {
    label: string;
    variant: BadgeVariant;
    className: string;
    textClassName: string;
    icon: typeof CheckCircle;
  }
> = {
  activo: {
    label: "Activo",
    variant: "outline",
    className:
      "text-emerald-500 border-emerald-500/30 dark:text-emerald-400 dark:border-emerald-500/20",
    textClassName: "text-emerald-500 dark:text-emerald-400",
    icon: CheckCircle,
  },
  baja: {
    label: "Baja",
    variant: "outline",
    className:
      "text-orange-500 border-orange-500/30 dark:text-orange-400 dark:border-orange-500/20",
    textClassName: "text-orange-500 dark:text-orange-400",
    icon: MinusCircle,
  },
  revertido: {
    label: "Revertido",
    variant: "outline",
    className:
      "text-yellow-500 border-yellow-500/30 dark:text-yellow-400 dark:border-yellow-500/20",
    textClassName: "text-yellow-500 dark:text-yellow-400",
    icon: RotateCcw,
  },
  anulado: {
    label: "Anulado",
    variant: "outline",
    className:
      "text-rose-500 border-rose-500/30 dark:text-rose-400 dark:border-rose-500/20",
    textClassName: "text-rose-500 dark:text-rose-400",
    icon: XCircle,
  },
};

const DETAIL_STATUS_CONFIG: Record<
  SalesVoucherDetailStatus,
  { label: string; icon: React.ElementType; iconClassName: string }
> = {
  pending: {
    label: "Pendiente",
    icon: Clock,
    iconClassName: "text-amber-500 dark:text-amber-400",
  },
  completed: {
    label: "Extraído",
    icon: CheckCircle2,
    iconClassName: "text-emerald-600/70 dark:text-emerald-400/60",
  },
  failed: {
    label: "Error",
    icon: AlertCircle,
    iconClassName: "text-destructive",
  },
  not_found: {
    label: "No encontrado",
    icon: FileQuestion,
    iconClassName: "text-muted-foreground/60",
  },
  not_available: {
    label: "No disponible",
    icon: FileQuestion,
    iconClassName: "text-muted-foreground/60",
  },
};

// Sales doc type options (SUNAT Tabla 10 — ventas subset)
const DOC_TYPE_OPTIONS = [
  { value: "01", label: "Factura" },
  { value: "03", label: "Boleta de Venta" },
  { value: "07", label: "Nota de Crédito" },
  { value: "08", label: "Nota de Débito" },
  { value: "09", label: "Guía de Remisión Remitente" },
  { value: "12", label: "Ticket POS" },
  { value: "13", label: "Doc. Emitido por Bancos" },
  { value: "14", label: "Recibo Servicios Públicos" },
];

/** Polling interval during sync (3 seconds) */
const SYNC_POLLING_INTERVAL = 3000;

/** Search debounce delay (400ms) */
const SEARCH_DEBOUNCE_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// Sort types & helper
// ─────────────────────────────────────────────────────────────────────────────

type SortField =
  | "date"
  | "type"
  | "series"
  | "customer"
  | "currency"
  | "taxable_base"
  | "exempt"
  | "igv"
  | "total"
  | "status";
type SortDir = "asc" | "desc";

interface SortableHeadProps {
  field: SortField;
  label: string;
  currentField: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}

function SortableHead({
  field,
  label,
  currentField,
  dir,
  onSort,
  className,
}: SortableHeadProps) {
  const isActive = currentField === field;
  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none text-[10px] font-semibold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors",
        className,
      )}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown
            className="h-3 w-3 shrink-0 text-muted-foreground/40"
            aria-hidden="true"
          />
        )}
      </span>
    </TableHead>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row Component
// ─────────────────────────────────────────────────────────────────────────────

interface SalesVoucherRowProps {
  voucher: SalesVoucher;
  formatAmount: (amount: number | undefined) => string;
  onViewDetail: (id: string) => void;
}

/** Format a date string to DD/MM/YY regardless of input format (YYYY-MM-DD or DD/MM/YYYY). */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  try {
    // YYYY-MM-DD → DD/MM/YY
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch)
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1].slice(2)}`;
    // SIRE format: DD/MM/YYYY → DD/MM/YY (avoid new Date() which parses as MM/DD)
    const sireMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (sireMatch)
      return `${sireMatch[1]}/${sireMatch[2]}/${sireMatch[3].slice(2)}`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

function SalesVoucherRow({
  voucher,
  formatAmount,
  onViewDetail,
}: SalesVoucherRowProps) {
  const validationStatus = voucher.validation_status ?? "activo";
  const validationConfig =
    VALIDATION_STATUS_CONFIG[validationStatus] ??
    VALIDATION_STATUS_CONFIG["activo"];

  const rawName = voucher.customer_name;
  const hasName = rawName && rawName !== "-";
  const docNum = voucher.id_doc_number;
  const hasDocNum = docNum && docNum !== "00000000";

  return (
    <TableRow>
      {/* Fecha Emisión */}
      <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDate(voucher.issue_date)}
      </TableCell>

      {/* Tipo */}
      <TableCell>
        <Badge
          variant="outline"
          className="font-mono text-xs whitespace-nowrap"
        >
          {voucher.doc_type_label}
        </Badge>
      </TableCell>

      {/* Serie-Número */}
      <TableCell className="font-mono text-xs whitespace-nowrap">
        {voucher.series}-{voucher.doc_number}
      </TableCell>

      {/* Cliente / RUC */}
      <TableCell
        title={
          hasName
            ? `${rawName}${hasDocNum ? `\n${docNum}` : ""}`
            : hasDocNum
              ? docNum
              : "Consumidor Final"
        }
      >
        {hasName ? (
          <>
            <p className="font-medium truncate max-w-44">{rawName}</p>
            {hasDocNum && (
              <p className="text-xs text-muted-foreground font-mono">
                {docNum}
              </p>
            )}
          </>
        ) : hasDocNum ? (
          <p className="font-mono text-sm">{docNum}</p>
        ) : (
          <span className="text-muted-foreground italic text-xs">
            Consumidor Final
          </span>
        )}
      </TableCell>

      {/* Moneda */}
      <TableCell className="font-mono text-xs text-center">
        <span
          className={cn(
            "font-semibold",
            voucher.currency === "PEN"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-blue-600 dark:text-blue-400",
          )}
        >
          {voucher.currency}
        </span>
      </TableCell>

      {/* BI Gravado */}
      <TableCell className="text-right font-mono tabular-nums">
        {voucher.taxable_base !== undefined
          ? formatAmount(voucher.taxable_base)
          : "-"}
      </TableCell>

      {/* Monto Inafecto */}
      <TableCell className="text-right font-mono tabular-nums">
        {voucher.unaffected_amount !== undefined
          ? formatAmount(voucher.unaffected_amount)
          : "-"}
      </TableCell>

      {/* IGV/IPM */}
      <TableCell className="text-right font-mono tabular-nums">
        {voucher.igv_ipm !== undefined ? formatAmount(voucher.igv_ipm) : "-"}
      </TableCell>

      {/* Total (S/) */}
      <TableCell className="text-right font-mono tabular-nums font-medium">
        {voucher.total_amount !== undefined
          ? formatAmount(voucher.total_amount)
          : "-"}
      </TableCell>

      {/* Estado */}
      <TableCell className="text-right">
        <Badge
          variant={validationConfig.variant}
          className={cn("gap-1 whitespace-nowrap", validationConfig.className)}
        >
          <validationConfig.icon
            className={cn("size-3 shrink-0", validationConfig.textClassName)}
            aria-hidden="true"
          />
          {validationConfig.label}
        </Badge>
      </TableCell>

      {/* Extracción CPE */}
      <TableCell className="text-center">
        {voucher.detail_status ? (
          (() => {
            const cfg = DETAIL_STATUS_CONFIG[voucher.detail_status];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center">
                      <Icon
                        className={cn("size-4 shrink-0", cfg.iconClassName)}
                        aria-hidden="true"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{cfg.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })()
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Ver detalle */}
      <TableCell className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => onViewDetail(voucher.id)}
                aria-label="Ver detalle"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Ver detalle</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface SalesVouchersTableProps {
  /** Period filter (YYYYMM format) */
  period?: string;
  /** Company ID — when provided, company filter is controlled externally */
  companyId?: string;
  /** When true, enables polling to show new vouchers in real-time */
  isSyncing?: boolean;
}

export function SalesVouchersTable({
  period,
  companyId,
  isSyncing = false,
}: SalesVouchersTableProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [validationFilter, setValidationFilter] = useState<
    SalesVoucherValidationStatus | "all"
  >("all");

  // Sheet state for voucher detail
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(
    null,
  );

  // Sort state — default: Fecha Emisión desc (newest first)
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // When any sort field other than "date" (default) is active, or non-default direction is set
  // for non-default fields, we need all data. We detect "sort active" as any non-date sort
  // or any sort that would require full data.
  const isSortActive = sortField !== "date" || sortDir !== "desc";

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Selection state — removed (checkboxes not applicable for sales vouchers)

  const [isExporting, setIsExporting] = useState(false);

  // Debounce search for server query
  useEffect(() => {
    if (!searchQuery) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(
      () => setDebouncedSearch(searchQuery),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build API params from filters
  const apiParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      period,
      company_id: companyId,
      doc_type: docTypeFilter === "all" ? undefined : docTypeFilter,
      validation_status:
        validationFilter === "all" ? undefined : validationFilter,
      search: debouncedSearch || undefined,
      refetchInterval: isSyncing ? SYNC_POLLING_INTERVAL : (false as const),
    }),
    [
      period,
      companyId,
      docTypeFilter,
      validationFilter,
      debouncedSearch,
      isSyncing,
    ],
  );

  // Infinite query (cursor pagination) — used when no sort is active
  const {
    data: infiniteData,
    isLoading: infiniteLoading,
    error: infiniteError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSalesVouchers({ ...apiParams, enabled: !isSortActive });

  // All-data flat query — used when sort is active (needs full dataset to sort correctly)
  const allParams = useMemo(
    () => ({
      period,
      company_id: companyId,
      doc_type: docTypeFilter === "all" ? undefined : docTypeFilter,
      validation_status:
        validationFilter === "all" ? undefined : validationFilter,
      search: debouncedSearch || undefined,
    }),
    [period, companyId, docTypeFilter, validationFilter, debouncedSearch],
  );
  const {
    data: allData,
    isLoading: allLoading,
    error: allSortError,
  } = useAllSalesVouchers(
    isSortActive ? allParams : { ...allParams, company_id: undefined },
  );

  const data = isSortActive ? undefined : infiniteData;
  const isLoading = isSortActive ? allLoading : infiniteLoading;
  const error = isSortActive ? allSortError : infiniteError;

  // Flatten all pages into a single array
  const allVouchers = useMemo(
    () =>
      isSortActive
        ? (allData?.items ?? [])
        : (data?.pages.flatMap((page) => page.items) ?? []),
    [isSortActive, allData?.items, data?.pages],
  );

  // Client-side search filter (instant feedback while debouncing)
  const filteredVouchers = useMemo(() => {
    if (!searchQuery) return allVouchers;
    if (searchQuery === debouncedSearch) return allVouchers;
    const searchLower = searchQuery.toLowerCase();
    return allVouchers.filter(
      (v) =>
        v.customer_name?.toLowerCase().includes(searchLower) ||
        v.id_doc_number?.toLowerCase().includes(searchLower) ||
        `${v.series}-${v.doc_number}`.toLowerCase().includes(searchLower),
    );
  }, [allVouchers, searchQuery, debouncedSearch]);

  // Client-side sort applied on top of filtered results
  const sortedVouchers = useMemo(() => {
    return [...filteredVouchers].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        // issue_date is "DD/MM/YY" — convert to comparable number YYYYMMDD
        const parseDate = (d: string) => {
          const [day, month, year] = d.split("/");
          return parseInt(`20${year}${month}${day}`, 10);
        };
        const da = a.issue_date ? parseDate(a.issue_date) : 0;
        const db = b.issue_date ? parseDate(b.issue_date) : 0;
        cmp = da - db;
      } else if (sortField === "type") {
        cmp = (a.doc_type_label ?? "").localeCompare(b.doc_type_label ?? "");
      } else if (sortField === "series") {
        const sa = `${a.series}-${a.doc_number}`;
        const sb = `${b.series}-${b.doc_number}`;
        cmp = sa.localeCompare(sb);
      } else if (sortField === "customer") {
        cmp = (a.customer_name ?? "").localeCompare(b.customer_name ?? "");
      } else if (sortField === "currency") {
        cmp = (a.currency ?? "").localeCompare(b.currency ?? "");
      } else if (sortField === "taxable_base") {
        cmp = (a.taxable_base ?? 0) - (b.taxable_base ?? 0);
      } else if (sortField === "exempt") {
        cmp = (a.unaffected_amount ?? 0) - (b.unaffected_amount ?? 0);
      } else if (sortField === "igv") {
        cmp = (a.igv_ipm ?? 0) - (b.igv_ipm ?? 0);
      } else if (sortField === "total") {
        cmp = (a.total_amount ?? 0) - (b.total_amount ?? 0);
      } else if (sortField === "status") {
        cmp = (a.validation_status ?? "").localeCompare(
          b.validation_status ?? "",
        );
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredVouchers, sortField, sortDir]);

  // Format amount
  const formatAmount = (amount: number | undefined): string => {
    if (amount === undefined) return "-";
    return new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Export to CSV
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const headers = [
        "Fecha Emisión",
        "Tipo",
        "Serie-Número",
        "Cliente",
        "RUC",
        "Moneda",
        "BI Gravado",
        "Monto Inafecto",
        "IGV/IPM",
        "Total",
        "Estado",
      ];
      const rows = sortedVouchers.map((v) => [
        v.issue_date || "",
        v.doc_type_label || "",
        `${v.series}-${v.doc_number}`,
        v.customer_name || "Consumidor Final",
        v.id_doc_number || "",
        v.currency || "",
        v.taxable_base?.toFixed(2) ?? "",
        v.unaffected_amount?.toFixed(2) ?? "",
        v.igv_ipm?.toFixed(2) ?? "",
        v.total_amount?.toFixed(2) ?? "",
        v.validation_status || "",
      ]);
      const csv = [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ventas-${period || "periodo"}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [sortedVouchers, period]);

  // Counts
  const validationCounts = (isSortActive ? allData : data?.pages[0])
    ?.counts_by_validation_status ?? {
    activo: 0,
    baja: 0,
    revertido: 0,
    anulado: 0,
  };

  const totalCount =
    (isSortActive ? allData?.total_count : data?.pages[0]?.total_count) ?? 0;

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Error al cargar comprobantes de venta: {error.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          {/* Title row: left = title+desc, right = status filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Comprobantes de Venta</CardTitle>
              <CardDescription>
                Registro de ventas del período {period || "actual"} desde SIRE
                RVIE SUNAT
              </CardDescription>
            </div>

            {/* Validation status tabs — top right */}
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              <Button
                variant={validationFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setValidationFilter("all")}
              >
                Todos
                <Badge variant="secondary" className="h-5 text-xs px-1.5">
                  {totalCount}
                </Badge>
              </Button>
              {(
                Object.keys(
                  VALIDATION_STATUS_CONFIG,
                ) as SalesVoucherValidationStatus[]
              ).map((status) => {
                const cfg = VALIDATION_STATUS_CONFIG[status];
                const Icon = cfg.icon;
                const isActive = validationFilter === status;
                return (
                  <Button
                    key={status}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setValidationFilter(status)}
                  >
                    <Icon
                      className={cn("size-3.5 shrink-0", cfg.textClassName)}
                      aria-hidden="true"
                    />
                    <span className={cn("text-sm", cfg.textClassName)}>
                      {cfg.label}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("h-5 text-xs px-1.5", cfg.className)}
                    >
                      {validationCounts[status]}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Filter + export bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar por RUC, cliente o serie…"
              className="w-full sm:max-w-xs"
            />
            <FilterSelect
              value={docTypeFilter}
              onChange={setDocTypeFilter}
              options={DOC_TYPE_OPTIONS}
              label="Tipo"
              allOption={{ value: "all", label: "Todos" }}
              placeholder="Tipo doc."
              width="w-full sm:w-36"
            />
            <div className="hidden sm:block flex-1" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={handleExport}
                    disabled={isExporting || sortedVouchers.length === 0}
                  >
                    {isExporting ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Exportar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Exportar comprobantes de venta a CSV</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Table */}
          <ScrollTable>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <SortableHead
                    field="date"
                    label="Fecha Emisión"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    field="type"
                    label="Tipo"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    field="series"
                    label="Serie-Número"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    field="customer"
                    label="Cliente / RUC"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    field="currency"
                    label="Moneda"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-center"
                  />
                  <SortableHead
                    field="taxable_base"
                    label="BI Gravado"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableHead
                    field="exempt"
                    label="Mto. Inafecto"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableHead
                    field="igv"
                    label="IGV/IPM"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableHead
                    field="total"
                    label="Total (S/)"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableHead
                    field="status"
                    label="Estado"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <TableHead className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground text-center">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      Extracción
                    </span>
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground text-center w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Cargando comprobantes…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-32 p-0">
                      <EmptyState
                        title="Sin comprobantes de venta"
                        description={
                          searchQuery
                            ? "No se encontraron resultados para tu búsqueda"
                            : "No hay comprobantes de venta para este período"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedVouchers.map((voucher) => (
                    <SalesVoucherRow
                      key={voucher.id}
                      voucher={voucher}
                      formatAmount={formatAmount}
                      onViewDetail={setSelectedVoucherId}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollTable>

          {/* Footer */}
          <TableFooter
            totalCount={totalCount}
            currentCount={sortedVouchers.length}
            hasNextPage={!isSortActive && hasNextPage && !searchQuery}
            isFetchingNextPage={!isSortActive && isFetchingNextPage}
            isFiltered={Boolean(searchQuery)}
            onLoadMore={() => !isSortActive && fetchNextPage()}
            entityName="comprobantes de venta"
          />
        </CardContent>
      </Card>

      {/* Sales Voucher Detail Sheet */}
      <SalesVoucherDetailSheet
        voucherId={selectedVoucherId}
        open={!!selectedVoucherId}
        onOpenChange={(open) => {
          if (!open) setSelectedVoucherId(null);
        }}
        formatCurrency={formatAmount}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Voucher Detail Sheet
// ─────────────────────────────────────────────────────────────────────────────

interface SalesVoucherDetailSheetProps {
  voucherId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (amount: number | undefined) => string;
}

function SalesVoucherDetailSheet({
  voucherId,
  open,
  onOpenChange,
  formatCurrency,
}: SalesVoucherDetailSheetProps) {
  const {
    data: voucher,
    isLoading,
    error,
  } = useSalesVoucher(open ? voucherId : null);

  const items: SalesVoucherItem[] = useMemo(() => {
    if (!voucher?.detail_data) return [];
    const comprobante = voucher.detail_data?.comprobantes?.[0];
    return (
      (comprobante?.informacionItems as SalesVoucherItem[] | undefined) ||
      (voucher.detail_data?.informacionItems as
        | SalesVoucherItem[]
        | undefined) ||
      []
    );
  }, [voucher?.detail_data]);

  const validationStatusConfig: Record<
    string,
    { label: string; className: string }
  > = {
    activo: {
      label: "Activo",
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    },
    baja: {
      label: "Baja",
      className: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    },
    revertido: {
      label: "Revertido",
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    },
    anulado: {
      label: "Anulado",
      className: "bg-rose-500/10 text-rose-600 border-rose-500/30",
    },
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[30vw] sm:min-w-[480px] overflow-y-auto p-6">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-lg">
            {voucher
              ? `${voucher.doc_type_label} ${voucher.series}-${voucher.doc_number}`
              : "Detalle del Comprobante"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detalle del comprobante de venta
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Cargando detalle…</span>
            </div>
          ) : error ? (
            <div className="text-center text-destructive py-8 text-sm">
              Error al cargar el detalle
            </div>
          ) : voucher ? (
            <>
              {/* Customer Info */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Cliente
                </p>
                {voucher.customer_name && voucher.customer_name !== "-" ? (
                  <p className="font-medium text-sm">{voucher.customer_name}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    Consumidor Final
                  </p>
                )}
                {voucher.id_doc_number &&
                  voucher.id_doc_number !== "00000000" && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {voucher.id_doc_type || "DOC"}: {voucher.id_doc_number}
                    </p>
                  )}
              </div>

              {/* Validation status */}
              {(() => {
                const vs = voucher.validation_status ?? "activo";
                const cfg =
                  validationStatusConfig[vs] ??
                  validationStatusConfig["activo"];
                return (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Estado
                    </p>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", cfg.className)}
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                );
              })()}

              {/* Date and Currency */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha Emisión</p>
                  <p className="font-medium text-sm">
                    {voucher.issue_date || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Moneda Documento
                  </p>
                  <p className="font-medium text-sm">{voucher.currency}</p>
                </div>
              </div>

              {/* Items */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Items ({items.length})
                  </p>
                  <div className="space-y-1.5">
                    {items.map((item, idx) => {
                      const itemTotal = item.mtoImpTotal || 0;
                      const unitPrice = item.mtoValUnitario || 0;
                      return (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-3 p-2.5 bg-muted/40 rounded-md"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {(item.desItem || `Item ${idx + 1}`).replace(
                                /@@/g,
                                " ",
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.cntItems || 1}{" "}
                              {item.desUnidadMedida?.toLowerCase() || "und"} ×{" "}
                              {formatCurrency(unitPrice)}
                            </p>
                          </div>
                          <p className="text-sm font-mono font-medium whitespace-nowrap">
                            {formatCurrency(itemTotal)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="space-y-2 pt-2 border-t">
                {voucher.taxable_base !== undefined &&
                  voucher.taxable_base > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Base Imponible
                      </span>
                      <span className="font-mono">
                        {formatCurrency(voucher.taxable_base)}
                      </span>
                    </div>
                  )}
                {voucher.igv_ipm !== undefined && voucher.igv_ipm > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">IGV / IPM</span>
                    <span className="font-mono">
                      {formatCurrency(voucher.igv_ipm)}
                    </span>
                  </div>
                )}
                {voucher.unaffected_amount !== undefined &&
                  voucher.unaffected_amount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Monto Inafecto
                      </span>
                      <span className="font-mono">
                        {formatCurrency(voucher.unaffected_amount)}
                      </span>
                    </div>
                  )}
                {voucher.exempt_amount !== undefined &&
                  voucher.exempt_amount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Monto Exonerado
                      </span>
                      <span className="font-mono">
                        {formatCurrency(voucher.exempt_amount)}
                      </span>
                    </div>
                  )}

                {/* Total */}
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="font-medium">Total</span>
                  <span className="text-lg font-bold font-mono">
                    {formatCurrency(voucher.total_amount)}
                  </span>
                </div>
              </div>

              {/* Empty items state */}
              {items.length === 0 && (
                <div className="text-center text-muted-foreground py-6">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay items disponibles</p>
                  <p className="text-xs mt-1 opacity-70">
                    Sincroniza los detalles para ver los items del comprobante
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
