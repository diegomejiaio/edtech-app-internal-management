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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FileText,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Loader2,
  ChevronDown,
  ArrowRight,
  MessageSquare,
  Paperclip,
  History,
  CheckCircle,
  Circle,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useVouchers,
  useVoucher,
  useAllVouchers,
  fetchVoucherDetail,
  fetchExportItems,
} from "@/hooks/use-vouchers";
import {
  generateSireTxt,
  generateSireFileName,
  downloadTxtFile,
} from "@/lib/sire-txt";
import {
  buildHeaderRows,
  buildItemRows,
  downloadAsExcel,
  headersFilename,
  itemsFilename,
  HEADER_COLUMNS,
  ITEM_COLUMNS,
} from "@/lib/vouchers-excel";
import { useUpdateVoucherValidationStatus } from "@/hooks/use-voucher-validation";
import { useBulkUpdateVoucherValidationStatus } from "@/hooks/use-voucher-bulk-validation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLiftTCObservation } from "@/hooks/use-tc-observation";
import { useLiftDetraccionObservation } from "@/hooks/use-detraccion-observation";
import { useLiftAmountObservation } from "@/hooks/use-amount-observation";
import { useVoucherAuditLog } from "@/hooks/use-voucher-audit-log";
import type { VoucherAuditEntry } from "@/hooks/use-voucher-audit-log";
import { useAuthContext } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { SearchInput, FilterSelect } from "@/components/ui/filter-bar";
import { ScrollTable } from "@/components/ui/scroll-table";
import { TableFooter } from "@/components/ui/table-footer";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading";
import type {
  Voucher,
  VoucherDetailStatus,
  VoucherDetailData,
  VoucherItem,
  VoucherValidationStatus,
  TCValidation,
  DetraccionValidation,
  AmountValidation,
} from "@/types";

const PAGE_SIZE = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Detail status badge config
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: BadgeVariant;
    icon: typeof CheckCircle2;
    className?: string;
    iconClassName: string;
  }
> = {
  pending: {
    label: "Pendiente",
    variant: "outline",
    icon: Clock,
    className: "text-amber-600 border-amber-500/50 dark:text-amber-400",
    iconClassName: "text-amber-500 dark:text-amber-400",
  },
  completed: {
    label: "Completado",
    variant: "outline",
    icon: CheckCircle2,
    className: "text-muted-foreground/60 border-border/50",
    iconClassName: "text-emerald-600/70 dark:text-emerald-400/60",
  },
  failed: {
    label: "Error",
    variant: "destructive",
    icon: AlertCircle,
    iconClassName: "text-destructive",
  },
  not_found: {
    label: "No encontrado",
    variant: "outline",
    icon: XCircle,
    iconClassName: "text-muted-foreground/60",
  },
  not_available: {
    label: "No disponible",
    variant: "outline",
    icon: XCircle,
    iconClassName: "text-muted-foreground/60",
  },
};

// Validation status badge config — uses muted tones to avoid visual noise
const VALIDATION_STATUS_CONFIG: Record<
  VoucherValidationStatus,
  {
    label: string;
    variant: BadgeVariant;
    className: string;
    textClassName: string;
    icon: typeof CheckCircle;
  }
> = {
  valido: {
    label: "Válido",
    variant: "outline",
    className:
      "text-emerald-500 border-emerald-500/30 dark:text-emerald-400 dark:border-emerald-500/20",
    textClassName: "text-emerald-500 dark:text-emerald-400",
    icon: CheckCircle,
  },
  observado: {
    label: "Observado",
    variant: "outline",
    className:
      "text-amber-500 border-amber-500/30 dark:text-amber-400 dark:border-amber-500/20",
    textClassName: "text-amber-500 dark:text-amber-400",
    icon: AlertCircle,
  },
  rechazado: {
    label: "Rechazado",
    variant: "outline",
    className:
      "text-rose-500 border-rose-500/30 dark:text-rose-400 dark:border-rose-500/20",
    textClassName: "text-rose-500 dark:text-rose-400",
    icon: XCircle,
  },
};

// Filter options - match backend VOUCHER_TYPE_LABELS (SUNAT Tabla 10)
const VOUCHER_TYPE_OPTIONS = [
  { value: "01", label: "Factura" },
  { value: "02", label: "Recibo por Honorarios" },
  { value: "03", label: "Boleta de Venta" },
  { value: "04", label: "Liquidación de Compra" },
  { value: "07", label: "Nota de Crédito" },
  { value: "08", label: "Nota de Débito" },
  { value: "14", label: "Servicios Públicos" },
  { value: "30", label: "Comprobante de Percepción" },
  { value: "42", label: "Documento Autorizado" },
  { value: "50", label: "DUA (Aduanas)" },
  { value: "52", label: "Despacho Simplificado - Importación" },
  { value: "53", label: "Declaración Simplificada - Importación" },
  { value: "54", label: "Declaración Simplificada - Exportación" },
];

const STATUS_OPTIONS = [
  { value: "pending" as const, label: "Pendiente" },
  { value: "completed" as const, label: "Completado" },
  { value: "failed" as const, label: "Error" },
  { value: "not_found" as const, label: "No encontrado" },
  { value: "not_available" as const, label: "No disponible" },
];

/** Polling interval during sync (3 seconds) */
const SYNC_POLLING_INTERVAL = 3000;

/** Search debounce delay (400ms) */
const SEARCH_DEBOUNCE_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

interface TotalRowProps {
  label: string;
  value: number;
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
  isDiscount?: boolean;
  originalValue?: number;
  originalCurrency?: string;
}

/** Renders a single row in the totals section */
function TotalRow({
  label,
  value,
  currency,
  formatCurrency,
  isDiscount,
  originalValue,
  originalCurrency,
}: TotalRowProps) {
  if (value <= 0) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`font-mono ${isDiscount ? "text-green-600" : ""}`}>
          {isDiscount ? "-" : ""}
          {formatCurrency(value, currency)}
        </span>
        {originalValue && originalCurrency && originalValue > 0 && (
          <div className="text-xs text-muted-foreground font-mono">
            ({formatCurrency(originalValue, originalCurrency)})
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort types & helper
// ─────────────────────────────────────────────────────────────────────────────

type SortField =
  | "date"
  | "type"
  | "series"
  | "supplier"
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
// Observations — generic system for voucher-level observations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single observation entry, display-ready. Each observation type maps to one
 * of these. New types only need to add an entry to `buildObservations()`.
 *
 * `rawData` is a discriminated union keyed by `key`:
 * - `"tc"` branch carries a typed `TCValidation` with value-comparison fields.
 * - `"detraccion"` branch carries a `DetraccionValidation` with a human-readable
 *   `description` summary (no value-comparison grid — just confirm payment).
 * - Any future observation type uses the fallback branch with `unknown` rawData.
 */
type ObservationEntry =
  | {
      key: "tc";
      /** Human-readable type label, e.g. "Tipo de Cambio" */
      label: string;
      /** Current (incorrect) value shown in the voucher */
      currentValue: string;
      /** Correct value to adopt on confirmation */
      correctValue: string;
      /** Whether this observation has already been lifted */
      lifted: boolean;
      rawData: TCValidation;
    }
  | {
      key: "detraccion";
      label: string;
      /** Human-readable summary, e.g. "14.0% — S/ 280.00" */
      description: string;
      lifted: boolean;
      rawData: DetraccionValidation;
    }
  | {
      key: "amount";
      label: string;
      /** List of mismatched fields with header vs. detail values */
      mismatches: AmountValidation["mismatches"];
      lifted: boolean;
      rawData: AmountValidation;
    }
  | {
      key: string;
      label: string;
      currentValue: string;
      correctValue: string;
      lifted: boolean;
      /** For unknown observation types, rawData is intentionally `unknown`. */
      rawData: unknown;
    };

/** Build the observation list for a voucher (pure, no side effects). */
function buildObservations(voucher: Voucher): ObservationEntry[] {
  const entries: ObservationEntry[] = [];

  if (voucher.tc_validation && !voucher.tc_validation.passed) {
    const tc = voucher.tc_validation;
    entries.push({
      key: "tc",
      label: "Tipo de Cambio",
      currentValue: tc.voucher_rate.toFixed(4),
      correctValue: tc.official_rate.toFixed(4),
      lifted: tc.lifted,
      rawData: tc,
    });
  }

  if (voucher.detraccion_validation && !voucher.detraccion_validation.lifted) {
    const det = voucher.detraccion_validation;
    const data = det.detraccion_data;
    const pct = data.porDetraccion
      ? `${parseFloat(data.porDetraccion).toFixed(1)}%`
      : "";
    const monto = data.mtoDetraccion
      ? `S/ ${data.mtoDetraccion.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
      : "";
    const description =
      [pct, monto].filter(Boolean).join(" — ") || "Detracción pendiente";
    entries.push({
      key: "detraccion",
      label: "Detracción",
      description,
      lifted: det.lifted,
      rawData: det,
    });
  }

  if (
    voucher.amount_validation &&
    voucher.amount_validation.checked &&
    !voucher.amount_validation.passed &&
    !voucher.amount_validation.lifted
  ) {
    const amt = voucher.amount_validation;
    entries.push({
      key: "amount",
      label: "Montos SIRE vs. SUNAT",
      mismatches: amt.mismatches,
      lifted: amt.lifted,
      rawData: amt,
    });
  }

  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// CorrectObservationDialog
// ─────────────────────────────────────────────────────────────────────────────

interface CorrectObservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  observation: ObservationEntry | null;
  voucherId: string;
  onSuccess: (key: string) => void;
}

function CorrectObservationDialog({
  open,
  onOpenChange,
  observation,
  voucherId,
  onSuccess,
}: CorrectObservationDialogProps) {
  const [reason, setReason] = useState("");
  const liftTC = useLiftTCObservation();
  const liftDetraccion = useLiftDetraccionObservation();
  const liftAmount = useLiftAmountObservation();

  // Clear reason whenever the dialog opens/closes to avoid stale text
  // persisting across different vouchers or observations.
  useEffect(() => {
    setReason("");
  }, [open]);

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!observation) return;

    if (observation.key === "tc") {
      const tcObs = observation as Extract<ObservationEntry, { key: "tc" }>;
      liftTC.mutate(
        {
          voucherId,
          confirmed_tc: tcObs.rawData.official_rate,
          reason: reason.trim() || undefined,
        },
        {
          onSuccess: () => {
            setReason("");
            onSuccess(observation.key);
          },
        },
      );
    } else if (observation.key === "detraccion") {
      liftDetraccion.mutate(
        {
          voucherId,
          reason: reason.trim() || undefined,
        },
        {
          onSuccess: () => {
            setReason("");
            onSuccess(observation.key);
          },
        },
      );
    } else if (observation.key === "amount") {
      liftAmount.mutate(
        {
          voucherId,
          reason: reason.trim() || undefined,
        },
        {
          onSuccess: () => {
            setReason("");
            onSuccess(observation.key);
          },
        },
      );
    }
  }

  const isPending =
    liftTC.isPending || liftDetraccion.isPending || liftAmount.isPending;

  // Derive dialog title and CTA based on observation type
  const isDetraccion = observation?.key === "detraccion";
  const isAmount = observation?.key === "amount";
  const ctaLabel = isDetraccion
    ? "Confirmar pago de detracción"
    : isAmount
      ? "Levantar observación de montos"
      : "Confirmar corrección";

  // Narrowed reference for detracción branch — safe because we only use it
  // when `observation.key === "detraccion"` is true in JSX.
  const detObs =
    observation?.key === "detraccion"
      ? (observation as Extract<ObservationEntry, { key: "detraccion" }>)
      : null;

  // Narrowed reference for amount branch.
  const amtObs =
    observation?.key === "amount"
      ? (observation as Extract<ObservationEntry, { key: "amount" }>)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isDetraccion ? (
              "Confirmar pago de detracción"
            ) : (
              <>
                Confirmar observación:{" "}
                <span className="font-normal text-muted-foreground">
                  {observation?.label}
                </span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isDetraccion
              ? "Confirma que el pago de la detracción ha sido realizado. Se registrará tu aprobación en el historial del comprobante."
              : isAmount
                ? "Revisa las diferencias entre los montos del header SIRE y los valores confirmados por SUNAT. Al levantar, los montos del comprobante serán actualizados."
                : "Confirma que el valor correcto es el indicado. Se registrará tu aprobación en el historial del comprobante."}
          </DialogDescription>
        </DialogHeader>

        {observation && (
          <form id="correct-obs-form" onSubmit={handleConfirm}>
            <div className="space-y-4 py-2">
              {observation.key === "tc" && (
                /* TC: value-comparison grid */
                <div className="rounded-lg border divide-y">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      Valor actual (comprobante)
                    </span>
                    <span className="font-mono tabular-nums text-sm font-medium">
                      {observation.currentValue}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      Valor correcto (SUNAT)
                    </span>
                    <span className="font-mono tabular-nums text-sm font-medium text-green-600 dark:text-green-400">
                      {observation.correctValue}
                    </span>
                  </div>
                </div>
              )}

              {observation.key === "detraccion" && detObs && (
                /* Detracción: read-only details summary */
                <div className="rounded-lg border divide-y">
                  {detObs.rawData.detraccion_data.porDetraccion && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        Tasa de detracción
                      </span>
                      <span className="font-mono tabular-nums text-sm font-medium">
                        {parseFloat(
                          detObs.rawData.detraccion_data.porDetraccion,
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  )}
                  {detObs.rawData.detraccion_data.mtoDetraccion != null && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        Monto de detracción
                      </span>
                      <span className="font-mono tabular-nums text-sm font-medium">
                        S/{" "}
                        {detObs.rawData.detraccion_data.mtoDetraccion.toLocaleString(
                          "es-PE",
                          { minimumFractionDigits: 2 },
                        )}
                      </span>
                    </div>
                  )}
                  {detObs.rawData.detraccion_data.nroCuenta && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        Cuenta Banco de la Nación
                      </span>
                      <span className="font-mono tabular-nums text-sm font-medium">
                        {detObs.rawData.detraccion_data.nroCuenta}
                      </span>
                    </div>
                  )}
                  {detObs.rawData.detraccion_data.fechaVencimientoPago && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        Fecha vencimiento pago
                      </span>
                      <span className="font-mono tabular-nums text-sm font-medium">
                        {detObs.rawData.detraccion_data.fechaVencimientoPago}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {observation.key === "amount" && amtObs && (
                /* Amount: field-by-field mismatch table */
                <div className="rounded-lg border divide-y text-sm">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 font-medium">
                    <span>Campo</span>
                    <span className="flex gap-6">
                      <span className="w-24 text-right">Header SIRE</span>
                      <span className="w-24 text-right text-green-600 dark:text-green-400">
                        SUNAT
                      </span>
                    </span>
                  </div>
                  {amtObs.mismatches.map((m) => (
                    <div
                      key={m.field}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <span className="text-muted-foreground font-mono">
                        {m.field}
                      </span>
                      <span className="flex gap-6">
                        <span className="w-24 text-right font-mono tabular-nums">
                          {m.header_value.toFixed(2)}
                        </span>
                        <span className="w-24 text-right font-mono tabular-nums text-green-600 dark:text-green-400">
                          {m.detail_value.toFixed(2)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reason — optional for all observation types */}
              <div className="space-y-1.5">
                <Label htmlFor="obs-reason">Motivo (opcional)</Label>
                <Textarea
                  id="obs-reason"
                  placeholder="Explica brevemente por qué se acepta esta corrección..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </form>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="correct-obs-form" disabled={isPending}>
            {isPending ? "Guardando..." : ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ObservationsSection
// ─────────────────────────────────────────────────────────────────────────────

interface ObservationsSectionProps {
  voucher: Voucher;
}

export function ObservationsSection({ voucher }: ObservationsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedObs, setSelectedObs] = useState<ObservationEntry | null>(null);
  // Track locally-lifted observations so the UI updates immediately after
  // a successful correction, without waiting for the parent to re-render.
  const [liftedKeys, setLiftedKeys] = useState<Set<string>>(new Set());

  const observations = buildObservations(voucher);
  if (observations.length === 0) return null;

  function handleCorrect(obs: ObservationEntry) {
    setSelectedObs(obs);
    setDialogOpen(true);
  }

  function handleCorrectionSuccess(key: string) {
    setLiftedKeys((prev) => new Set(prev).add(key));
    setDialogOpen(false);
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Observaciones ({observations.length})
        </p>
        <div className="rounded-lg border divide-y">
          {observations.map((obs) => {
            const isLifted = obs.lifted || liftedKeys.has(obs.key);
            const isDetractionConfirmed =
              obs.key === "detraccion" &&
              voucher.detraction_payment?.validated === true;
            return (
              <div
                key={obs.key}
                className={cn(
                  "px-4 py-3",
                  isDetractionConfirmed
                    ? "space-y-2"
                    : "flex items-center gap-3",
                )}
              >
                {/* Type */}
                <span
                  className={cn(
                    "text-sm font-medium",
                    !isDetractionConfirmed && "flex-1",
                  )}
                >
                  {obs.label}
                </span>

                {/* Confirmed detraction payment */}
                {isDetractionConfirmed && voucher.detraction_payment && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Detracción confirmada
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <span className="text-muted-foreground">
                        N° constancia
                      </span>
                      <span>
                        {voucher.detraction_payment.num_constancia ?? "—"}
                      </span>
                      <span className="text-muted-foreground">N° cuenta</span>
                      <span>
                        {voucher.detraction_payment.num_cuenta ?? "—"}
                      </span>
                      <span className="text-muted-foreground">
                        Fecha de pago
                      </span>
                      <span>{voucher.detraction_payment.fec_pago ?? "—"}</span>
                      <span className="text-muted-foreground">Monto</span>
                      <span>
                        {voucher.detraction_payment.mto_detraccion != null
                          ? `S/ ${voucher.detraction_payment.mto_detraccion.toFixed(2)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Current → Correct (TC and other non-detraccion observations) */}
                {!isDetractionConfirmed && "currentValue" in obs && (
                  <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-muted-foreground">
                    <span>{obs.currentValue}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="text-foreground">{obs.correctValue}</span>
                  </div>
                )}

                {/* Description (detraccion observation — pending state) */}
                {!isDetractionConfirmed && "description" in obs && (
                  <span className="text-xs text-muted-foreground">
                    {obs.description}
                  </span>
                )}

                {/* Status badge — hidden for confirmed detraction */}
                {!isDetractionConfirmed &&
                  (isLifted ? (
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-300 gap-1 shrink-0 text-xs"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Levantada
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-yellow-600 border-yellow-400/60 gap-1 shrink-0 text-xs"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Activa
                    </Badge>
                  ))}

                {/* Action — hidden for confirmed detraction (read-only) */}
                {!isDetractionConfirmed && !isLifted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 shrink-0 text-xs"
                    onClick={() => handleCorrect(obs)}
                  >
                    Confirmar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CorrectObservationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        observation={selectedObs}
        voucherId={voucher.id}
        onSuccess={handleCorrectionSuccess}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Voucher Row Component
// ─────────────────────────────────────────────────────────────────────────────

interface VoucherRowProps {
  voucher: Voucher;
  isNew: boolean;
  isSelected: boolean;
  isLocked: boolean;
  onToggleSelect: (id: string) => void;
  formatCurrency: (amount: number, currency?: string) => string;
  formatAmount: (amount: number) => string;
  formatDate: (dateStr: string | undefined | null) => string;
  onViewDetail: (id: string) => void;
}

function VoucherRow({
  voucher,
  isNew,
  isSelected,
  isLocked,
  onToggleSelect,
  formatCurrency,
  formatAmount,
  formatDate,
  onViewDetail,
}: VoucherRowProps) {
  const statusConfig =
    STATUS_CONFIG[voucher.detail_status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const validationStatus: VoucherValidationStatus =
    voucher.validation_status ?? "valido";
  const validationConfig = VALIDATION_STATUS_CONFIG[validationStatus];

  const { mutate: updateValidation, isPending: isUpdatingValidation } =
    useUpdateVoucherValidationStatus();

  return (
    <TableRow
      className={cn(
        "transition-colors",
        isNew && "animate-pulse bg-primary/5",
        isSelected && "bg-primary/5",
      )}
    >
      {/* Checkbox column */}
      <TableCell className="w-10 pl-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(voucher.id)}
          disabled={isLocked}
          aria-label={`Seleccionar comprobante ${voucher.series}-${voucher.number}`}
        />
      </TableCell>
      {/* Fecha Emisión */}
      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDate(voucher.emission_date)}
      </TableCell>
      {/* Tipo */}
      <TableCell className="overflow-hidden">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border px-1.5 py-0.5 font-mono text-xs">
                {voucher.voucher_type_label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {voucher.voucher_type_label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      {/* Serie-Número */}
      <TableCell className="font-mono text-xs whitespace-nowrap">
        {voucher.series}-{voucher.number}
      </TableCell>
      {/* Proveedor / RUC */}
      <TableCell
        title={`${voucher.supplier_name}\nRUC: ${voucher.supplier_ruc}`}
      >
        <p className="font-medium truncate max-w-40">{voucher.supplier_name}</p>
        <p className="text-xs text-muted-foreground font-mono">
          {voucher.supplier_ruc}
        </p>
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
        {voucher.taxable_base_dg != null ? (
          formatAmount(voucher.taxable_base_dg)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {/* Mto. Inafecto */}
      <TableCell className="text-right font-mono tabular-nums">
        {voucher.non_taxed_acq_value != null ? (
          formatAmount(voucher.non_taxed_acq_value)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {/* IGV/IPM */}
      <TableCell className="text-right font-mono tabular-nums">
        {voucher.igv_ipm_dg != null ? (
          formatAmount(voucher.igv_ipm_dg)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {/* Total — always stored in PEN by SUNAT */}
      <TableCell className="text-right font-mono tabular-nums">
        {formatAmount(voucher.total)}
      </TableCell>
      {/* Descripción */}
      <TableCell className="max-w-0">
        {voucher.description_summary ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs truncate block cursor-default">
                  {voucher.description_summary.replace(/@@/g, " ")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {voucher.description_summary.replace(/@@/g, " ")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            Sin detalle
          </span>
        )}
      </TableCell>
      {/* Extracción (detail_status icon + tooltip) */}
      <TableCell className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center">
                <StatusIcon
                  className={cn("size-4 shrink-0", statusConfig.iconClassName)}
                  aria-hidden="true"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{statusConfig.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      {/* Estado (validation status inline dropdown) */}
      <TableCell>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1"
                disabled={isUpdatingValidation || isLocked}
                aria-label="Cambiar estado de validación"
              >
                {isUpdatingValidation ? (
                  <Loader2
                    className="h-3 w-3 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <>
                    <validationConfig.icon
                      className={cn(
                        "size-3.5 shrink-0",
                        validationConfig.textClassName,
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn("text-xs", validationConfig.textClassName)}
                    >
                      {validationConfig.label}
                    </span>
                    <ChevronDown
                      className="h-3 w-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(
                Object.keys(
                  VALIDATION_STATUS_CONFIG,
                ) as VoucherValidationStatus[]
              ).map((status) => {
                const cfg = VALIDATION_STATUS_CONFIG[status];
                const Icon = cfg.icon;
                return (
                  <DropdownMenuItem
                    key={status}
                    onClick={() =>
                      updateValidation({
                        voucherId: voucher.id,
                        validation_status: status,
                      })
                    }
                    className={cn(
                      "gap-2 cursor-pointer",
                      status === validationStatus && "font-semibold",
                    )}
                  >
                    <Icon
                      className={cn("size-3.5 shrink-0", cfg.textClassName)}
                      aria-hidden="true"
                    />
                    <span className={cn("text-sm", cfg.textClassName)}>
                      {cfg.label}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
      {/* Acciones (Eye button) */}
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetail(voucher.id)}
          disabled={!voucher.has_detail}
          aria-label={
            voucher.has_detail ? "Ver detalle" : "Sin detalle disponible"
          }
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Component
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable labels for each audit action type */
const ACTION_LABELS: Partial<Record<VoucherAuditEntry["action"], string>> = {
  status_changed: "Cambio de estado",
  comment_added: "Comentario",
  attachment_added: "Adjunto",
  tc_observation_lifted: "Observación TC levantada",
  tc_validation_passed: "Validación TC aprobada",
  tc_validation_failed: "Observación TC detectada",
  detraccion_observation_lifted: "Detracción confirmada",
  amount_observation_lifted: "Observación montos levantada",
  amount_validation_passed: "Validación de montos aprobada",
  amount_validation_failed: "Observación de montos detectada",
  detraction_payment_confirmed: "Pago de detracción confirmado",
  detraction_payment_not_found: "Pago de detracción no encontrado",
};

/** Icons per action type */
const ACTION_ICONS: Partial<
  Record<VoucherAuditEntry["action"], typeof ArrowRight>
> = {
  status_changed: ArrowRight,
  comment_added: MessageSquare,
  attachment_added: Paperclip,
  tc_observation_lifted: CheckCircle2,
  tc_validation_passed: CheckCircle2,
  tc_validation_failed: ArrowRight,
  detraccion_observation_lifted: CheckCircle2,
  amount_observation_lifted: CheckCircle2,
  amount_validation_passed: CheckCircle2,
  amount_validation_failed: ArrowRight,
  detraction_payment_confirmed: CheckCircle2,
  detraction_payment_not_found: ArrowRight,
};

function formatAuditDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

/** Short display name: use by_name if available, otherwise strip the clerk user ID prefix */
function formatAuditUser(entry: VoucherAuditEntry): string {
  if (entry.by_name) return entry.by_name;
  const by = entry.by;
  // Clerk user IDs look like "user_2abc..." — display just the last 6 chars
  if (by === "sistema") return "Sistema";
  if (by.startsWith("user_") && by.length > 10) {
    return `usuario_${by.slice(-6)}`;
  }
  return by;
}

interface VoucherAuditLogProps {
  voucherId: string;
}

function VoucherAuditLog({ voucherId }: VoucherAuditLogProps) {
  const { data, isLoading } = useVoucherAuditLog(voucherId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Cargando historial…
      </div>
    );
  }

  const entries = data?.items ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History
          className="h-3.5 w-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Historial ({entries.length})
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Sin cambios registrados aún.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const Icon = ACTION_ICONS[entry.action] ?? Circle;
            return (
              <div key={entry.id} className="flex items-start gap-2.5 text-xs">
                {/* Timeline dot + icon */}
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                  <Icon
                    className="h-3 w-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>

                {/* Entry content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {formatAuditDate(entry.at)}
                    </span>
                  </div>

                  {/* Action-specific detail */}
                  {entry.action === "status_changed" && (
                    <div className="mt-0.5 text-muted-foreground">
                      {entry.previous_status ? (
                        <>
                          <span className="capitalize">
                            {entry.previous_status}
                          </span>
                          {" → "}
                          <span className="capitalize font-medium text-foreground">
                            {entry.new_status}
                          </span>
                        </>
                      ) : (
                        <span className="capitalize font-medium text-foreground">
                          {entry.new_status}
                        </span>
                      )}
                      {entry.reason && (
                        <p className="mt-0.5 italic">"{entry.reason}"</p>
                      )}
                    </div>
                  )}

                  {entry.action === "comment_added" && (
                    <p className="mt-0.5 text-muted-foreground italic">
                      "{entry.text}"
                    </p>
                  )}

                  {entry.action === "attachment_added" && (
                    <p className="mt-0.5 text-muted-foreground font-mono truncate">
                      {entry.name}
                    </p>
                  )}

                  {entry.action === "tc_observation_lifted" && (
                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                      <p>
                        TC documento:{" "}
                        {entry.original_voucher_rate?.toFixed(4) ?? "—"}
                        {" → confirmado: "}
                        {entry.confirmed_tc?.toFixed(4) ?? "—"}
                      </p>
                      {entry.reason && (
                        <p className="italic">"{entry.reason}"</p>
                      )}
                    </div>
                  )}

                  {/* Author */}
                  <p className="mt-0.5 text-muted-foreground/70">
                    {formatAuditUser(entry)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Voucher Detail Sheet Component
// ─────────────────────────────────────────────────────────────────────────────

interface VoucherDetailSheetProps {
  voucherId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (amount: number, currency?: string) => string;
}

function VoucherDetailSheet({
  voucherId,
  open,
  onOpenChange,
  formatCurrency,
}: VoucherDetailSheetProps) {
  const {
    data: voucher,
    isLoading,
    error,
  } = useVoucher(open ? voucherId : null);

  // Extract data from detail_data
  const { items, totals, detraccion, hasSireData } = useMemo(() => {
    if (!voucher?.detail_data)
      return { items: [], totals: null, detraccion: null, hasSireData: false };
    const detailData = voucher.detail_data as VoucherDetailData;
    const comprobante = detailData?.comprobantes?.[0];

    // Check if we have SIRE header data (any of the specific SIRE fields)
    const hasSire =
      (voucher.taxable_base_dg ?? 0) > 0 ||
      (voucher.igv_ipm_dg ?? 0) > 0 ||
      (voucher.taxable_base_dgng ?? 0) > 0 ||
      (voucher.taxable_base_dng ?? 0) > 0 ||
      (voucher.non_taxed_acq_value ?? 0) > 0;

    return {
      items: comprobante?.informacionItems || [],
      totals: comprobante?.procedenciaMasiva || null,
      detraccion: comprobante?.informacionDetraccion?.[0] || null,
      hasSireData: hasSire,
    };
  }, [
    voucher?.detail_data,
    voucher?.taxable_base_dg,
    voucher?.igv_ipm_dg,
    voucher?.taxable_base_dgng,
    voucher?.taxable_base_dng,
    voucher?.non_taxed_acq_value,
  ]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[30vw] sm:min-w-[480px] overflow-y-auto p-6">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-lg">
            {voucher
              ? `${voucher.voucher_type_label} ${voucher.series}-${voucher.number}`
              : "Detalle del Comprobante"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detalle del comprobante de compra
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {isLoading ? (
            <LoadingSpinner className="py-12" />
          ) : error ? (
            <div className="text-center text-destructive py-8">
              Error al cargar el detalle
            </div>
          ) : voucher ? (
            <>
              {/* Supplier Info */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Proveedor
                </p>
                <p className="font-medium text-sm">{voucher.supplier_name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  RUC: {voucher.supplier_ruc}
                </p>
              </div>

              {/* Validation status */}
              {(() => {
                const vs: VoucherValidationStatus =
                  voucher.validation_status ?? "valido";
                const cfg = VALIDATION_STATUS_CONFIG[vs];
                return (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Estado de validación
                    </p>
                    <Badge
                      variant={cfg.variant}
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
                    {voucher.emission_date || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Moneda Documento
                  </p>
                  <p className="font-medium text-sm">{voucher.currency}</p>
                </div>
              </div>

              {/* Foreign Currency Info */}
              {voucher.currency !== "PEN" &&
                hasSireData &&
                voucher.exchange_rate && (
                  <p className="text-xs text-muted-foreground">
                    Moneda original: {voucher.currency} · TC:{" "}
                    {voucher.exchange_rate.toFixed(3)}
                  </p>
                )}

              <ObservationsSection voucher={voucher} />

              {/* Items List - Item amounts from CPE are in ORIGINAL document currency */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Items ({items.length})
                  </p>
                  <div className="space-y-1.5">
                    {items.map((item, idx) => {
                      // Item amounts from CPE detail are in original document currency
                      const itemTotal = item.mtoImpTotal || 0;
                      const unitPrice = item.mtoValUnitario || 0;
                      const isForeignCurrency =
                        voucher.currency !== "PEN" &&
                        voucher.exchange_rate &&
                        voucher.exchange_rate > 0;

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
                              {isForeignCurrency
                                ? formatCurrency(
                                    unitPrice * voucher.exchange_rate!,
                                    "PEN",
                                  )
                                : formatCurrency(unitPrice, "PEN")}
                            </p>
                          </div>
                          <div className="text-right">
                            {/* PEN as primary (convert from original currency if needed) */}
                            <p className="text-sm font-mono font-medium whitespace-nowrap">
                              {isForeignCurrency
                                ? formatCurrency(
                                    itemTotal * voucher.exchange_rate!,
                                    "PEN",
                                  )
                                : formatCurrency(itemTotal, "PEN")}
                            </p>
                            {/* Original currency as secondary for foreign currency docs */}
                            {isForeignCurrency && (
                              <p className="text-xs text-muted-foreground font-mono">
                                ({formatCurrency(itemTotal, voucher.currency)})
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detracción Info - amounts from CPE are in original document currency */}
              {detraccion && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-1">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                    Detracción
                  </p>
                  <p className="text-sm">{detraccion.desBienServicio}</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Tasa: {detraccion.porDetraccion}%
                    </span>
                    <div className="text-right">
                      <span className="font-mono font-medium">
                        {voucher.currency !== "PEN" &&
                        voucher.exchange_rate &&
                        voucher.exchange_rate > 0
                          ? formatCurrency(
                              (detraccion.mtoDetraccion || 0) *
                                voucher.exchange_rate,
                              "PEN",
                            )
                          : formatCurrency(
                              detraccion.mtoDetraccion || 0,
                              "PEN",
                            )}
                      </span>
                      {voucher.currency !== "PEN" &&
                        voucher.exchange_rate &&
                        voucher.exchange_rate > 0 && (
                          <div className="text-xs text-muted-foreground font-mono">
                            (
                            {formatCurrency(
                              detraccion.mtoDetraccion || 0,
                              voucher.currency,
                            )}
                            )
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Totals - Prioritize SIRE header data, fallback to CPE detail */}
              <div className="space-y-2 pt-2 border-t">
                {hasSireData ? (
                  <>
                    {/* SIRE header fields - always in PEN (SUNAT converts foreign currency) */}
                    <TotalRow
                      label="Base Imponible"
                      value={voucher.taxable_base_dg ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="IGV"
                      value={voucher.igv_ipm_dg ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="BI Gravado DGNG"
                      value={voucher.taxable_base_dgng ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="IGV / IPM DGNG"
                      value={voucher.igv_ipm_dgng ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="BI Gravado DNG"
                      value={voucher.taxable_base_dng ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="IGV / IPM DNG"
                      value={voucher.igv_ipm_dng ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="No Gravado"
                      value={voucher.non_taxed_acq_value ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="ISC"
                      value={voucher.isc ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="ICBPER"
                      value={voucher.icbper ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="Otros Trib./Cargos"
                      value={voucher.other_taxes_charges ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                  </>
                ) : (
                  <>
                    {/* CPE detail fields (fallback) - amounts are in PEN (SUNAT converts to PEN) */}
                    <TotalRow
                      label="Base Imponible"
                      value={totals?.mtoTotalValVentaGrabado ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="IGV"
                      value={totals?.mtoSumIGV ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="No Gravado"
                      value={totals?.mtoTotalValVentaInafecto ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    {/* Exonerado: only show if different from Inafecto to avoid duplicates */}
                    {totals?.mtoTotalValVentaExonerado !==
                      totals?.mtoTotalValVentaInafecto && (
                      <TotalRow
                        label="Exonerado"
                        value={totals?.mtoTotalValVentaExonerado ?? 0}
                        currency="PEN"
                        formatCurrency={formatCurrency}
                      />
                    )}
                    <TotalRow
                      label="ISC"
                      value={totals?.mtoSumISC ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="Otros Trib./Cargos"
                      value={
                        (totals?.mtoSumOtrosTributos ?? 0) +
                        (totals?.mtoSumOtrosCargos ?? 0)
                      }
                      currency="PEN"
                      formatCurrency={formatCurrency}
                    />
                    <TotalRow
                      label="Descuentos"
                      value={totals?.mtoTotalDtos ?? 0}
                      currency="PEN"
                      formatCurrency={formatCurrency}
                      isDiscount
                    />
                  </>
                )}

                {/* Total - PEN as primary (for Peruvian accounting), original currency as secondary */}
                {/* Note: voucher.total is ALWAYS stored in PEN by SUNAT, regardless of document currency */}
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="font-medium">Total</span>
                  <div className="text-right">
                    {/* Always show PEN as primary (SUNAT stores in PEN) */}
                    <span className="text-lg font-bold font-mono">
                      {formatCurrency(voucher.total, "PEN")}
                    </span>
                    {/* For foreign currency: show calculated original amount as secondary */}
                    {voucher.currency !== "PEN" &&
                      voucher.exchange_rate &&
                      voucher.exchange_rate > 0 && (
                        <div className="text-xs text-muted-foreground font-mono">
                          (
                          {formatCurrency(
                            voucher.total / voucher.exchange_rate,
                            voucher.currency,
                          )}
                          )
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Empty state for items */}
              {items.length === 0 && (
                <div className="text-center text-muted-foreground py-6">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay items disponibles</p>
                </div>
              )}

              {/* Audit log — historical record of all status changes */}
              <div className="pt-4 border-t">
                <VoucherAuditLog voucherId={voucher.id} />
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationCounts {
  valido: number;
  observado: number;
  rechazado: number;
}

interface VouchersTableProps {
  /** Period filter (YYYYMM format) */
  period?: string;
  /** Company ID - when provided, company filter is controlled externally */
  companyId?: string;
  /** When true, enables polling to show new vouchers in real-time */
  isSyncing?: boolean;
  /** When true, disables validation dropdowns and bulk selection (period is declared) */
  isLocked?: boolean;
  /** Called whenever the validation status counts change (from first page response) */
  onCountsChange?: (counts: ValidationCounts) => void;
  /** Company RUC — used for SIRE TXT export (field 01) */
  companyRuc?: string;
  /** Company business name — used for SIRE TXT export (field 02) */
  companyName?: string;
}

export function VouchersTable({
  period,
  companyId,
  isSyncing = false,
  isLocked = false,
  onCountsChange,
  companyRuc,
  companyName,
}: VouchersTableProps) {
  const { getToken } = useAuthContext();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [validationFilter, setValidationFilter] = useState<
    VoucherValidationStatus | "all"
  >("all");

  // Sort state — default: Fecha Emisión desc (newest first)
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // When sort is non-default, use full dataset
  const isSortActive = sortField !== "date" || sortDir !== "desc";

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Sheet state for voucher detail
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(
    null,
  );

  // Export state — 3 independent states, one per export option
  const [isExportingTxt, setIsExportingTxt] = useState(false);
  const [isExportingHeaders, setIsExportingHeaders] = useState(false);
  const [isExportingItems, setIsExportingItems] = useState(false);

  // Bulk selection state — scoped to the currently filtered company
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] =
    useState<VoucherValidationStatus>("observado");
  const { mutate: bulkUpdate, isPending: isBulkUpdating } =
    useBulkUpdateVoucherValidationStatus();

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Clear selection when company or period changes (avoids cross-company bulk)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [companyId, period]);

  const handleBulkApply = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkUpdate(
      { voucher_ids: ids, validation_status: bulkStatus },
      {
        onSuccess: (result) => {
          toast.success(
            `${result.updated} comprobante${result.updated !== 1 ? "s" : ""} actualizado${result.updated !== 1 ? "s" : ""}`,
          );
          setSelectedIds(new Set());
        },
        onError: () => {
          toast.error("Error al actualizar los comprobantes seleccionados");
        },
      },
    );
  }, [selectedIds, bulkStatus, bulkUpdate]);

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
      voucher_type: typeFilter === "all" ? undefined : typeFilter,
      detail_status:
        statusFilter === "all"
          ? undefined
          : (statusFilter as VoucherDetailStatus),
      validation_status:
        validationFilter === "all" ? undefined : validationFilter,
      search: debouncedSearch || undefined,
      refetchInterval: isSyncing ? SYNC_POLLING_INTERVAL : (false as const),
    }),
    [
      period,
      companyId,
      typeFilter,
      statusFilter,
      validationFilter,
      debouncedSearch,
      isSyncing,
    ],
  );

  const {
    data: infiniteData,
    isLoading: infiniteLoading,
    error: infiniteError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useVouchers({ ...apiParams, enabled: !isSortActive });

  // All-data flat query — activated when sort is non-default
  const allParams = useMemo(
    () => ({
      company_id: isSortActive ? companyId : undefined,
      period,
      voucher_type: typeFilter === "all" ? undefined : typeFilter,
      detail_status:
        statusFilter === "all"
          ? undefined
          : (statusFilter as VoucherDetailStatus),
      validation_status:
        validationFilter === "all" ? undefined : validationFilter,
      search: debouncedSearch || undefined,
    }),
    [
      isSortActive,
      companyId,
      period,
      typeFilter,
      statusFilter,
      validationFilter,
      debouncedSearch,
    ],
  );
  const {
    data: allVouchersForSort,
    isLoading: allSortLoading,
    error: allSortError,
  } = useAllVouchers(allParams);

  const data = isSortActive ? undefined : infiniteData;
  const isLoading = isSortActive ? allSortLoading : infiniteLoading;
  const error = isSortActive ? allSortError : infiniteError;

  // Flat query for TXT SIRE export — fetches only "valido" vouchers (RN-01: observado/rechazado excluded)
  // BFF handles validation_status="valido" with $or to also include docs with null/missing field
  // Uses a separate query key prefix so it doesn't interfere with the infinite query
  const { data: allVouchersData } = useAllVouchers({
    company_id: companyId,
    period,
    validation_status: "valido",
  });

  // Flat query for Excel export — lazy (disabled by default), fetched on demand when user clicks export
  // Avoids loading 9999 vouchers on page load when user may never export
  const { refetch: refetchVouchersForExcel } = useAllVouchers({
    company_id: companyId,
    period,
    enabled: false,
    // no validation_status filter — include válidos, observados and rechazados
  });

  // Track previous voucher IDs to detect new ones
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // Flatten all pages into a single array
  const allVouchers = useMemo(() => {
    return isSortActive
      ? (allVouchersForSort?.items ?? [])
      : (data?.pages.flatMap((page) => page.items) ?? []);
  }, [isSortActive, allVouchersForSort?.items, data?.pages]);

  // Detect new vouchers and trigger flash effect
  useEffect(() => {
    if (!isSyncing || allVouchers.length === 0) return;

    const currentIds = new Set(allVouchers.map((v) => v.id));
    const freshIds = new Set<string>();

    currentIds.forEach((id) => {
      if (!prevIdsRef.current.has(id)) {
        freshIds.add(id);
      }
    });

    if (freshIds.size > 0) {
      setNewIds(freshIds);
      const timer = setTimeout(() => setNewIds(new Set()), 1500);
      return () => clearTimeout(timer);
    }

    prevIdsRef.current = currentIds;
  }, [allVouchers, isSyncing]);

  // Client-side search filter (for instant feedback while debouncing)
  // Once debouncedSearch matches searchQuery, server has already filtered
  const filteredVouchers = useMemo(() => {
    // No search active - use all vouchers
    if (!searchQuery) return allVouchers;

    // Server has already filtered with this search term
    if (searchQuery === debouncedSearch) return allVouchers;

    // Waiting for debounce - filter locally for instant feedback
    const searchLower = searchQuery.toLowerCase();
    return allVouchers.filter(
      (v) =>
        v.supplier_ruc?.toLowerCase().includes(searchLower) ||
        v.supplier_name?.toLowerCase().includes(searchLower) ||
        `${v.series}-${v.number}`.toLowerCase().includes(searchLower),
    );
  }, [allVouchers, searchQuery, debouncedSearch]);

  // Client-side sort applied on top of filtered results
  const sortedVouchers = useMemo(() => {
    return [...filteredVouchers].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        // emission_date is "DD/MM/YY" — convert to comparable number YYYYMMDD
        const parseDate = (d: string) => {
          const [day, month, year] = d.split("/");
          return parseInt(`20${year}${month}${day}`, 10);
        };
        const da = a.emission_date ? parseDate(a.emission_date) : 0;
        const db = b.emission_date ? parseDate(b.emission_date) : 0;
        cmp = da - db;
      } else if (sortField === "type") {
        cmp = (a.voucher_type_label ?? "").localeCompare(
          b.voucher_type_label ?? "",
        );
      } else if (sortField === "series") {
        const sa = `${a.series}-${a.number}`;
        const sb = `${b.series}-${b.number}`;
        cmp = sa.localeCompare(sb);
      } else if (sortField === "supplier") {
        cmp = (a.supplier_name ?? "").localeCompare(b.supplier_name ?? "");
      } else if (sortField === "currency") {
        cmp = (a.currency ?? "").localeCompare(b.currency ?? "");
      } else if (sortField === "taxable_base") {
        cmp = (a.taxable_base_dg ?? 0) - (b.taxable_base_dg ?? 0);
      } else if (sortField === "exempt") {
        cmp = (a.non_taxed_acq_value ?? 0) - (b.non_taxed_acq_value ?? 0);
      } else if (sortField === "igv") {
        cmp = (a.igv_ipm_dg ?? 0) - (b.igv_ipm_dg ?? 0);
      } else if (sortField === "total") {
        cmp = (a.total ?? 0) - (b.total ?? 0);
      } else if (sortField === "status") {
        cmp = (a.validation_status ?? "").localeCompare(
          b.validation_status ?? "",
        );
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredVouchers, sortField, sortDir]);

  // Select-all handler — defined after sortedVouchers to avoid hoisting issues
  const handleSelectAll = useCallback(
    (checked: boolean | "indeterminate") => {
      if (checked) {
        setSelectedIds(new Set(sortedVouchers.map((v) => v.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [sortedVouchers],
  );

  // Format currency with symbol
  const formatCurrency = (amount: number, currency: string = "PEN") => {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency,
    }).format(amount);
  };

  // Format amount without currency symbol (for table where header has S/)
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format date (handles YYYY-MM-DD or ISO strings)
  const formatDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return "-";
    try {
      // Fast path: YYYY-MM-DD → DD/MM/YY
      const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch)
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1].slice(2)}`;
      // SIRE format: DD/MM/YYYY → DD/MM/YY (avoid new Date() which parses as MM/DD)
      const sireMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (sireMatch)
        return `${sireMatch[1]}/${sireMatch[2]}/${sireMatch[3].slice(2)}`;
      // Fallback for ISO strings with time component
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const d = String(date.getDate()).padStart(2, "0");
      const mo = String(date.getMonth() + 1).padStart(2, "0");
      const y = String(date.getFullYear()).slice(2);
      return `${d}/${mo}/${y}`;
    } catch {
      return dateStr;
    }
  };

  // Export vouchers to SIRE TXT (SUNAT RCE format) — Propuesta TXT SIRE
  const handleExportTxt = async () => {
    setIsExportingTxt(true);
    try {
      const vouchers = allVouchersData?.items ?? [];
      if (vouchers.length === 0) {
        toast.error("No hay comprobantes para descargar en este periodo.");
        return;
      }
      const ruc = companyRuc ?? "";
      const name = companyName ?? "";
      const per = period ?? "";
      const content = generateSireTxt(vouchers, ruc, name, per);
      if (!content) {
        toast.error("No hay comprobantes válidos para generar el archivo TXT");
        return;
      }
      downloadTxtFile(content, generateSireFileName(ruc, per));
    } finally {
      setIsExportingTxt(false);
    }
  };

  // Export vouchers headers to Excel (.xlsx) — Cabeceras
  // Uses allVouchersForExcel (no validation_status filter) so all vouchers are included
  // Query is lazy (disabled by default) — fetch on demand when user clicks export
  const handleExportHeaders = async () => {
    setIsExportingHeaders(true);
    try {
      if (!companyId || !period) {
        toast.error("Selecciona una empresa y período para exportar");
        return;
      }
      const result = await refetchVouchersForExcel();
      if (result.isError) {
        toast.error("Error al obtener los comprobantes para exportar");
        return;
      }
      const vouchers = result.data?.items ?? [];
      if (vouchers.length === 0) {
        toast.error("No hay comprobantes para descargar en este periodo.");
        return;
      }
      const ruc = companyRuc ?? "";
      const name = companyName ?? "";
      const per = period ?? "";
      const rows = buildHeaderRows(vouchers, ruc, name);
      await downloadAsExcel(
        rows,
        HEADER_COLUMNS,
        "Cabeceras",
        headersFilename(ruc, per),
      );
    } catch {
      toast.error(
        "Ocurrió un error al generar el archivo. Por favor intente nuevamente.",
      );
    } finally {
      setIsExportingHeaders(false);
    }
  };

  // Export voucher items to Excel (.xlsx) — one row per item line
  // Uses dedicated export-items endpoint that includes detail_data
  const handleExportItems = async () => {
    setIsExportingItems(true);
    try {
      if (!companyId || !period) {
        toast.error("Selecciona una empresa y período para exportar");
        return;
      }
      const token = await getToken();
      if (!token) {
        toast.error("Error de autenticación");
        return;
      }
      const vouchers = await fetchExportItems(companyId, period, token);
      if (vouchers.length === 0) {
        toast.error("No hay comprobantes para descargar en este periodo.");
        return;
      }
      const ruc = companyRuc ?? "";
      const name = companyName ?? "";
      const per = period ?? "";
      const rows = buildItemRows(vouchers, ruc, name);
      await downloadAsExcel(
        rows,
        ITEM_COLUMNS,
        "Items",
        itemsFilename(ruc, per),
      );
    } catch {
      toast.error(
        "Ocurrió un error al generar el archivo. Por favor intente nuevamente.",
      );
    } finally {
      setIsExportingItems(false);
    }
  };

  // Export vouchers to CSV with items expansion
  // Check if any filters are active
  const hasFilters = Boolean(
    searchQuery ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    validationFilter !== "all",
  );

  // Extract validation status counts from first page (not affected by validation filter)
  const validationCounts = (isSortActive ? allVouchersForSort : data?.pages[0])
    ?.counts_by_validation_status ?? {
    valido: 0,
    observado: 0,
    rechazado: 0,
  };

  // Notify parent when counts change (used by declare modal to avoid extra fetch)
  useEffect(() => {
    if (data?.pages[0]) {
      onCountsChange?.(validationCounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    validationCounts.valido,
    validationCounts.observado,
    validationCounts.rechazado,
  ]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Error al cargar comprobantes: {error.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Comprobantes de Compra</CardTitle>
            <CardDescription>
              Registro de compras del período {period || "actual"} desde SIRE
              SUNAT
            </CardDescription>
          </div>
          {/* Validation status tabs */}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              variant={validationFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-2"
              onClick={() => setValidationFilter("all")}
            >
              Todos
              <Badge variant="secondary" className="h-5 text-xs px-1.5">
                {validationCounts.valido +
                  validationCounts.observado +
                  validationCounts.rechazado}
              </Badge>
            </Button>
            {(
              Object.keys(VALIDATION_STATUS_CONFIG) as VoucherValidationStatus[]
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
        {/* Filter bar — search, tipo, estado, export */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por RUC, proveedor o serie…"
            className="w-full sm:max-w-xs"
          />
          <FilterSelect
            label="Tipo"
            value={typeFilter}
            onChange={setTypeFilter}
            options={VOUCHER_TYPE_OPTIONS}
            allOption={{ value: "all", label: "Todos" }}
            width="w-full sm:w-36"
          />
          <FilterSelect
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            allOption={{ value: "all", label: "Todos" }}
            width="w-full sm:w-36"
          />
          <div className="hidden sm:block flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={
                  isExportingTxt || isExportingHeaders || isExportingItems
                }
              >
                {isExportingTxt || isExportingHeaders || isExportingItems ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Exportar
                <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleExportTxt}
                disabled={isExportingTxt}
              >
                {isExportingTxt && (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                Propuesta TXT SIRE
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportHeaders}
                disabled={isExportingHeaders}
              >
                {isExportingHeaders && (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                Cabeceras (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportItems}
                disabled={isExportingItems}
              >
                {isExportingItems && (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                Items (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bulk action bar — visible when one or more rows are selected and period is not locked */}
        {selectedIds.size > 0 && !isLocked && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            {/* Status selector */}
            <div className="flex items-center gap-2">
              {(
                Object.keys(
                  VALIDATION_STATUS_CONFIG,
                ) as VoucherValidationStatus[]
              ).map((status) => {
                const cfg = VALIDATION_STATUS_CONFIG[status];
                const Icon = cfg.icon;
                const isActive = bulkStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setBulkStatus(status)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                      isActive
                        ? `${cfg.className} bg-background`
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={isActive}
                  >
                    <Icon
                      className={cn("size-3.5", cfg.textClassName)}
                      aria-hidden="true"
                    />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {/* Apply button */}
            <Button
              size="sm"
              className="h-7 px-3"
              onClick={handleBulkApply}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? (
                <Loader2
                  className="mr-1.5 h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              Aplicar
            </Button>
            {/* Clear selection */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Cancelar selección"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : filteredVouchers.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              searchQuery
                ? "No se encontraron comprobantes"
                : "No hay comprobantes"
            }
            description="Los comprobantes aparecerán aquí cuando se sincronicen."
            hasFilters={hasFilters}
          />
        ) : (
          <ScrollTable minWidth="800px">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  {/* Select-all checkbox */}
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      checked={
                        sortedVouchers.length > 0 &&
                        sortedVouchers.every((v) => selectedIds.has(v.id))
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <SortableHead
                    field="date"
                    label="Fecha Em."
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-[84px]"
                  />
                  <SortableHead
                    field="type"
                    label="Tipo"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-40"
                  />
                  <SortableHead
                    field="series"
                    label="Serie-Número"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-24"
                  />
                  <SortableHead
                    field="supplier"
                    label="Proveedor / RUC"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-32"
                  />
                  <SortableHead
                    field="currency"
                    label="Moneda"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-16 text-center"
                  />
                  <SortableHead
                    field="taxable_base"
                    label="BI Gravado"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-20 text-right"
                  />
                  <SortableHead
                    field="exempt"
                    label="Inafecto"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-20 text-right"
                  />
                  <SortableHead
                    field="igv"
                    label="IGV/IPM"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-20 text-right"
                  />
                  <SortableHead
                    field="total"
                    label="Total"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-20 text-right"
                  />
                  <TableHead className="w-24 text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
                    Descripción
                  </TableHead>
                  <TableHead className="w-20 overflow-hidden text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">
                            Extracción
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1 text-xs">
                            <p>
                              <span className="font-semibold">Completado:</span>{" "}
                              detalle descargado.
                            </p>
                            <p>
                              <span className="font-semibold">Pendiente:</span>{" "}
                              aún sin detalle.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <SortableHead
                    field="status"
                    label="Estado"
                    currentField={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="w-24"
                  />
                  <TableHead className="w-10 text-[10px] font-semibold tracking-wide uppercase text-muted-foreground text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVouchers.map((voucher) => (
                  <VoucherRow
                    key={voucher.id}
                    voucher={voucher}
                    isNew={newIds.has(voucher.id)}
                    isSelected={selectedIds.has(voucher.id)}
                    isLocked={isLocked}
                    onToggleSelect={handleToggleSelect}
                    formatCurrency={formatCurrency}
                    formatAmount={formatAmount}
                    formatDate={formatDate}
                    onViewDetail={setSelectedVoucherId}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        )}

        {/* Footer - Using TableFooter component */}
        <TableFooter
          currentCount={sortedVouchers.length}
          totalCount={
            isSortActive
              ? allVouchersForSort?.total_count
              : data?.pages[0]?.total_count
          }
          hasNextPage={!isSortActive && hasNextPage}
          isFetchingNextPage={!isSortActive && isFetchingNextPage}
          isFiltered={Boolean(searchQuery)}
          onLoadMore={() => !isSortActive && fetchNextPage()}
          entityName="comprobantes"
        />
      </CardContent>

      {/* Voucher Detail Sheet */}
      <VoucherDetailSheet
        voucherId={selectedVoucherId}
        open={!!selectedVoucherId}
        onOpenChange={(open) => !open && setSelectedVoucherId(null)}
        formatCurrency={formatCurrency}
      />
    </Card>
  );
}
