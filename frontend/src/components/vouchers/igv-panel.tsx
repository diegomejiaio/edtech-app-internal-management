"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Voucher } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PanelTypeRow {
  voucher_type_label: string;
  count: number;
  base_imp: number; // sum(taxable_base_dg ?? 0)
  igv: number; // sum(igv_ipm_dg + igv_ipm_dgng + igv_ipm_dng)
}

interface PanelStatusGroup {
  status: "valido" | "observado" | "rechazado";
  label: string;
  total: number;
  rows: PanelTypeRow[];
}

export interface VoucherIGVPanelProps {
  vouchers: Voucher[];
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_ORDER: Array<"valido" | "observado" | "rechazado"> = [
  "valido",
  "observado",
  "rechazado",
];

const STATUS_LABELS: Record<"valido" | "observado" | "rechazado", string> = {
  valido: "COMPROBANTES VÁLIDOS",
  observado: "OBSERVADOS",
  rechazado: "RECHAZADOS",
};

function formatMoney(value: number): string {
  return value.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function VoucherIGVPanel({
  vouchers,
  isLoading = false,
}: VoucherIGVPanelProps) {
  const panelGroups = useMemo((): PanelStatusGroup[] => {
    return STATUS_ORDER.map((status) => {
      const group = vouchers.filter(
        (v) => (v.validation_status ?? "valido") === status,
      );

      // Sub-group by voucher_type_label
      const typeMap = new Map<string, PanelTypeRow>();
      for (const v of group) {
        const label = v.voucher_type_label || v.voucher_type;
        const existing = typeMap.get(label) ?? {
          voucher_type_label: label,
          count: 0,
          base_imp: 0,
          igv: 0,
        };
        typeMap.set(label, {
          ...existing,
          count: existing.count + 1,
          base_imp: existing.base_imp + (v.taxable_base_dg ?? 0),
          igv:
            existing.igv +
            (v.igv_ipm_dg ?? 0) +
            (v.igv_ipm_dgng ?? 0) +
            (v.igv_ipm_dng ?? 0),
        });
      }

      const rows = Array.from(typeMap.values()).sort(
        (a, b) => b.count - a.count,
      );

      return {
        status,
        label: STATUS_LABELS[status],
        total: group.length,
        rows,
      };
    });
  }, [vouchers]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {panelGroups.map((group) => (
        <PanelSection key={group.status} group={group} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────────────────────

function PanelSection({ group }: { group: PanelStatusGroup }) {
  const totalBaseImp = group.rows.reduce((sum, r) => sum + r.base_imp, 0);
  const totalIgv = group.rows.reduce((sum, r) => sum + r.igv, 0);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {group.label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {group.total.toLocaleString()}
        </span>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-16 text-right">CANT.</TableHead>
              <TableHead>TIPO</TableHead>
              <TableHead className="text-right">BASE IMP.</TableHead>
              <TableHead className="text-right">IGV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-8 text-center text-sm text-muted-foreground"
                >
                  —
                </TableCell>
              </TableRow>
            ) : (
              <>
                {group.rows.map((row) => (
                  <TableRow key={row.voucher_type_label}>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.voucher_type_label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-mono">
                      {formatMoney(row.base_imp)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-mono">
                      {formatMoney(row.igv)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="border-t font-semibold bg-muted/20">
                  <TableCell className="text-right tabular-nums text-sm">
                    {group.total.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-mono">
                    {formatMoney(totalBaseImp)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-mono">
                    {formatMoney(totalIgv)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
