"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ShoppingCart, FileText, Wallet, Users, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpsertPeriod } from "@/hooks";
import type { PeriodInput, PeriodResponse } from "@/types";
import { formatCurrency } from "@/app/(app)/dashboard/dashboard-data";

// Form data type matching PeriodInput fields
type PeriodFormData = Omit<PeriodInput, "fecha_declaracion">;

// Map PeriodResponse to form state
function periodToFormData(p: PeriodResponse): PeriodFormData {
  return {
    ventas_gravadas: p.ventas_gravadas,
    ventas_no_gravadas: p.ventas_no_gravadas,
    ventas_exoneradas: p.ventas_exoneradas,
    exportaciones: p.exportaciones,
    compras_gravadas: p.compras_gravadas,
    compras_no_gravadas: p.compras_no_gravadas,
    compras_exoneradas: p.compras_exoneradas,
    importaciones: p.importaciones,
    itan_pagado: p.itan_pagado,
    itan_aplicado: p.itan_aplicado,
    remuneraciones_brutas: p.remuneraciones_brutas,
    essalud: p.essalud,
    onp: p.onp,
    renta_quinta: p.renta_quinta,
    afp_aporte: p.afp_aporte,
    afp_comision: p.afp_comision,
    afp_seguro: p.afp_seguro,
    gratificaciones: p.gratificaciones,
    cts: p.cts,
    vacaciones: p.vacaciones,
    trabajadores_activos: p.trabajadores_activos,
    trabajadores_pensionistas: p.trabajadores_pensionistas,
    trabajadores_formadores: p.trabajadores_formadores,
    otros_tributos: p.otros_tributos,
    pago_cuenta_renta: p.pago_cuenta_renta,
    multas: p.multas,
    fraccionamientos: p.fraccionamientos,
    costos_gastos_deducibles: p.costos_gastos_deducibles,
    depreciacion_amortizacion: p.depreciacion_amortizacion,
  };
}

const emptyFormData: PeriodFormData = {
  ventas_gravadas: 0,
  ventas_no_gravadas: 0,
  ventas_exoneradas: 0,
  exportaciones: 0,
  compras_gravadas: 0,
  compras_no_gravadas: 0,
  compras_exoneradas: 0,
  importaciones: 0,
  itan_pagado: 0,
  itan_aplicado: 0,
  remuneraciones_brutas: 0,
  essalud: 0,
  onp: 0,
  renta_quinta: 0,
  afp_aporte: 0,
  afp_comision: 0,
  afp_seguro: 0,
  gratificaciones: 0,
  cts: 0,
  vacaciones: 0,
  trabajadores_activos: 0,
  trabajadores_pensionistas: 0,
  trabajadores_formadores: 0,
  otros_tributos: 0,
  pago_cuenta_renta: 0,
  multas: 0,
  fraccionamientos: 0,
  costos_gastos_deducibles: 0,
  depreciacion_amortizacion: 0,
};

// Calculate derived values
function calculateValues(data: PeriodFormData) {
  const totalVentas =
    data.ventas_gravadas +
    data.ventas_no_gravadas +
    data.ventas_exoneradas +
    data.exportaciones;
  const igvVentas = data.ventas_gravadas * 0.18;
  const renta = data.ventas_gravadas * 0.015;

  const totalCompras =
    data.compras_gravadas +
    data.compras_no_gravadas +
    data.compras_exoneradas +
    data.importaciones;
  const igvCompras = data.compras_gravadas * 0.18;

  const totalGastos =
    data.costos_gastos_deducibles +
    data.depreciacion_amortizacion +
    data.otros_tributos +
    data.multas +
    data.fraccionamientos +
    data.pago_cuenta_renta;

  const totalPlanilla =
    data.remuneraciones_brutas +
    data.essalud +
    data.onp +
    data.renta_quinta +
    data.afp_aporte +
    data.afp_comision +
    data.afp_seguro +
    data.gratificaciones +
    data.cts +
    data.vacaciones;

  const utilidad = totalVentas - totalCompras - totalGastos - totalPlanilla;

  return {
    totalVentas,
    igvVentas,
    renta,
    totalCompras,
    igvCompras,
    totalGastos,
    totalPlanilla,
    utilidad,
  };
}

// Format number with thousand separators (comma) and period for decimal
function formatNumberInput(value: number): string {
  if (value === 0) return "";
  // Round to 2 decimals to avoid floating point noise
  const rounded = Math.round(value * 100) / 100;
  const parts = rounded.toString().split(".");
  // Add comma thousand separators
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// Parse formatted string back to number
function parseNumberInput(text: string): number {
  // Remove commas (thousand separators), keep period as decimal
  const cleaned = text.replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Formatted number input component
function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange?: (value: number) => void;
}) {
  const [displayValue, setDisplayValue] = useState(() =>
    formatNumberInput(value),
  );
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when value changes externally (e.g. reset)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatNumberInput(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number without formatting for easier editing
    setDisplayValue(value === 0 ? "" : value.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseNumberInput(displayValue);
    onChange?.(parsed);
    setDisplayValue(formatNumberInput(parsed));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, one period, and minus sign at start
    if (/^-?\d*\.?\d*$/.test(raw) || raw === "") {
      setDisplayValue(raw);
      const parsed = parseNumberInput(raw);
      onChange?.(parsed);
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className="w-32 text-right tabular-nums text-sm h-8"
      placeholder="0"
    />
  );
}

// Field Row component
function FieldRow({
  label,
  sublabel,
  value,
  onChange,
  isCalculated = false,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onChange?: (value: number) => void;
  isCalculated?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
      {isCalculated ? (
        <div className="px-3 py-1.5 bg-primary/10 rounded text-sm font-medium tabular-nums text-primary">
          {formatCurrency(value)}
        </div>
      ) : (
        <NumberInput value={value} onChange={onChange} />
      )}
    </div>
  );
}

// Total Row component
function TotalRow({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "success" | "danger" | "info";
}) {
  const colorClass =
    variant === "success"
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
      : variant === "danger"
        ? "text-red-600 dark:text-red-400 bg-red-500/10"
        : variant === "info"
          ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
          : "text-primary bg-primary/10";

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded font-medium ${colorClass}`}
    >
      <span className="text-sm">{label}</span>
      <span className="tabular-nums text-sm">{formatCurrency(value)}</span>
    </div>
  );
}

// Section Header
function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof ShoppingCart;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded mb-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

interface EditPeriodSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruc: string;
  periodo: string;
  razonSocial?: string;
  periodData?: PeriodResponse;
  companyId?: string;
}

export function EditPeriodSheet({
  open,
  onOpenChange,
  ruc,
  periodo,
  razonSocial,
  periodData,
  companyId,
}: EditPeriodSheetProps) {
  const upsertPeriod = useUpsertPeriod();

  // Initialize form data from period data prop
  const [formData, setFormData] = useState<PeriodFormData>(() => {
    return periodData ? periodToFormData(periodData) : { ...emptyFormData };
  });

  // Update form when props change (different period/company selected)
  useEffect(() => {
    setFormData(
      periodData ? periodToFormData(periodData) : { ...emptyFormData },
    );
  }, [periodData]);

  const calculated = calculateValues(formData);

  const updateField = useCallback(
    (field: keyof PeriodFormData, value: number) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSave = async () => {
    if (!companyId) return;
    const [month, year] = periodo.split("/");
    const input: PeriodInput = {
      ...formData,
      fecha_declaracion: periodData?.fecha_declaracion ?? null,
    };
    upsertPeriod.mutate(
      { companyId, year, period: month, data: input },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  // Format period for display
  const [month, year] = periodo.split("/");
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Setiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const periodLabel = `${monthNames[parseInt(month) - 1] || month} ${year}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-120 sm:max-w-lg p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0 pr-12">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-lg truncate">
              {razonSocial || ruc}
            </SheetTitle>
            <Badge variant="outline" className="shrink-0 text-xs">
              {periodLabel}
            </Badge>
          </div>
          <SheetDescription className="font-mono text-xs">
            RUC: {ruc}
          </SheetDescription>

          {/* Utility Summary */}
          <div className="mt-3 flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Utilidad del periodo
            </p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                calculated.utilidad >= 0 ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {formatCurrency(calculated.utilidad)}
            </p>
          </div>
        </SheetHeader>

        {/* Content with Tabs */}
        <Tabs
          defaultValue="ventas"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mx-6 mt-4 grid grid-cols-4 shrink-0">
            <TabsTrigger value="ventas" className="text-xs">
              Ventas
            </TabsTrigger>
            <TabsTrigger value="compras" className="text-xs">
              Compras
            </TabsTrigger>
            <TabsTrigger value="gastos" className="text-xs">
              Gastos
            </TabsTrigger>
            <TabsTrigger value="planilla" className="text-xs">
              Planilla
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6">
            {/* VENTAS Tab */}
            <TabsContent value="ventas" className="mt-4 space-y-3 pb-6">
              <SectionHeader icon={ShoppingCart} title="Ventas" />

              <FieldRow
                label="Ventas Gravadas"
                sublabel="Base imponible"
                value={formData.ventas_gravadas}
                onChange={(v) => updateField("ventas_gravadas", v)}
              />
              <FieldRow
                label="IGV Ventas (18%)"
                value={calculated.igvVentas}
                isCalculated
              />

              <FieldRow
                label="Ventas No Gravadas"
                value={formData.ventas_no_gravadas}
                onChange={(v) => updateField("ventas_no_gravadas", v)}
              />
              <FieldRow
                label="Ventas Exoneradas"
                value={formData.ventas_exoneradas}
                onChange={(v) => updateField("ventas_exoneradas", v)}
              />
              <FieldRow
                label="Exportaciones"
                value={formData.exportaciones}
                onChange={(v) => updateField("exportaciones", v)}
              />

              <TotalRow
                label="Total Ventas"
                value={calculated.totalVentas}
                variant="info"
              />
              <FieldRow
                label="Renta (1.5%)"
                value={calculated.renta}
                isCalculated
              />
            </TabsContent>

            {/* COMPRAS Tab */}
            <TabsContent value="compras" className="mt-4 space-y-3 pb-6">
              <SectionHeader icon={FileText} title="Compras" />

              <FieldRow
                label="Compras Gravadas"
                value={formData.compras_gravadas}
                onChange={(v) => updateField("compras_gravadas", v)}
              />
              <FieldRow
                label="IGV Compras (18%)"
                value={calculated.igvCompras}
                isCalculated
              />

              <FieldRow
                label="Compras No Gravadas"
                value={formData.compras_no_gravadas}
                onChange={(v) => updateField("compras_no_gravadas", v)}
              />
              <FieldRow
                label="Compras Exoneradas"
                value={formData.compras_exoneradas}
                onChange={(v) => updateField("compras_exoneradas", v)}
              />
              <FieldRow
                label="Importaciones"
                value={formData.importaciones}
                onChange={(v) => updateField("importaciones", v)}
              />

              <TotalRow
                label="Total Compras"
                value={calculated.totalCompras}
                variant="danger"
              />

              <div className="pt-4">
                <SectionHeader icon={FileText} title="ITAN" />
              </div>

              <FieldRow
                label="ITAN Pagado"
                value={formData.itan_pagado}
                onChange={(v) => updateField("itan_pagado", v)}
              />
              <FieldRow
                label="ITAN Aplicado"
                value={formData.itan_aplicado}
                onChange={(v) => updateField("itan_aplicado", v)}
              />
            </TabsContent>

            {/* GASTOS Tab */}
            <TabsContent value="gastos" className="mt-4 space-y-3 pb-6">
              <SectionHeader icon={Wallet} title="Gastos y Tributos" />

              <FieldRow
                label="Costos/Gastos Deducibles"
                value={formData.costos_gastos_deducibles}
                onChange={(v) => updateField("costos_gastos_deducibles", v)}
              />
              <FieldRow
                label="Depreciación y Amortización"
                value={formData.depreciacion_amortizacion}
                onChange={(v) => updateField("depreciacion_amortizacion", v)}
              />
              <FieldRow
                label="Otros Tributos"
                value={formData.otros_tributos}
                onChange={(v) => updateField("otros_tributos", v)}
              />
              <FieldRow
                label="Multas"
                value={formData.multas}
                onChange={(v) => updateField("multas", v)}
              />
              <FieldRow
                label="Fraccionamientos"
                value={formData.fraccionamientos}
                onChange={(v) => updateField("fraccionamientos", v)}
              />
              <FieldRow
                label="Pago a Cuenta Renta"
                value={formData.pago_cuenta_renta}
                onChange={(v) => updateField("pago_cuenta_renta", v)}
              />

              <TotalRow label="Total Gastos" value={calculated.totalGastos} />
            </TabsContent>

            {/* PLANILLA Tab */}
            <TabsContent value="planilla" className="mt-4 space-y-3 pb-6">
              <SectionHeader icon={Users} title="Remuneraciones" />

              <FieldRow
                label="Remuneraciones Brutas"
                value={formData.remuneraciones_brutas}
                onChange={(v) => updateField("remuneraciones_brutas", v)}
              />
              <FieldRow
                label="Essalud"
                value={formData.essalud}
                onChange={(v) => updateField("essalud", v)}
              />
              <FieldRow
                label="ONP"
                value={formData.onp}
                onChange={(v) => updateField("onp", v)}
              />
              <FieldRow
                label="Renta 5ta Categoría"
                value={formData.renta_quinta}
                onChange={(v) => updateField("renta_quinta", v)}
              />

              <div className="pt-4">
                <SectionHeader icon={Users} title="AFP" />
              </div>

              <FieldRow
                label="AFP Aporte"
                value={formData.afp_aporte}
                onChange={(v) => updateField("afp_aporte", v)}
              />
              <FieldRow
                label="AFP Comisión"
                value={formData.afp_comision}
                onChange={(v) => updateField("afp_comision", v)}
              />
              <FieldRow
                label="AFP Seguro"
                value={formData.afp_seguro}
                onChange={(v) => updateField("afp_seguro", v)}
              />

              <div className="pt-4">
                <SectionHeader icon={Users} title="Beneficios" />
              </div>

              <FieldRow
                label="Gratificaciones"
                value={formData.gratificaciones}
                onChange={(v) => updateField("gratificaciones", v)}
              />
              <FieldRow
                label="CTS"
                value={formData.cts}
                onChange={(v) => updateField("cts", v)}
              />
              <FieldRow
                label="Vacaciones"
                value={formData.vacaciones}
                onChange={(v) => updateField("vacaciones", v)}
              />

              <TotalRow
                label="Total Planilla"
                value={calculated.totalPlanilla}
              />

              <div className="pt-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Recursos Humanos
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted/30 rounded text-center">
                    <p className="text-xs text-muted-foreground">Activos</p>
                    <Input
                      type="number"
                      value={formData.trabajadores_activos || ""}
                      onChange={(e) =>
                        updateField(
                          "trabajadores_activos",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="mt-1 text-center h-8 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="p-3 bg-muted/30 rounded text-center">
                    <p className="text-xs text-muted-foreground">
                      Pensionistas
                    </p>
                    <Input
                      type="number"
                      value={formData.trabajadores_pensionistas || ""}
                      onChange={(e) =>
                        updateField(
                          "trabajadores_pensionistas",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="mt-1 text-center h-8 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="p-3 bg-muted/30 rounded text-center">
                    <p className="text-xs text-muted-foreground">Formadores</p>
                    <Input
                      type="number"
                      value={formData.trabajadores_formadores || ""}
                      onChange={(e) =>
                        updateField(
                          "trabajadores_formadores",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="mt-1 text-center h-8 text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t flex gap-3 shrink-0">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={upsertPeriod.isPending}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={upsertPeriod.isPending || !companyId}
          >
            {upsertPeriod.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
