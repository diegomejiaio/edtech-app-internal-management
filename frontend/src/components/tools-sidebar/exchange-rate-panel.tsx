"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useExchangeRateMonth } from "@/hooks/use-exchange-rate-month";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SelectedDate {
  year: number;
  month: number;
  day: number;
  compra: number | null;
  venta: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DAY_ABBR = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function fmt3(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(3);
}

/** Returns the Lima (UTC-5) current date */
function limaToday(): { year: number; month: number; day: number } {
  const now = new Date();
  const limaMs =
    now.getTime() + now.getTimezoneOffset() * 60 * 1000 - 5 * 60 * 60 * 1000;
  const lima = new Date(limaMs);
  return {
    year: lima.getFullYear(),
    month: lima.getMonth() + 1,
    day: lima.getDate(),
  };
}

function firstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month - 1, 1).getDay();
  return (d + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDateLabel(s: SelectedDate): string {
  const t = limaToday();
  if (s.year === t.year && s.month === t.month && s.day === t.day) {
    return "hoy";
  }
  return `${String(s.day).padStart(2, "0")}/${String(s.month).padStart(2, "0")}/${s.year}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar section
// ─────────────────────────────────────────────────────────────────────────────

interface CalendarSectionProps {
  year: number;
  month: number;
  selected: SelectedDate | null;
  onSelect: (d: SelectedDate) => void;
}

function CalendarSection({
  year,
  month,
  selected,
  onSelect,
}: CalendarSectionProps) {
  const { data, isLoading } = useExchangeRateMonth(year, month);
  const today = limaToday();

  const rateMap = useMemo(() => {
    const m: Record<string, { compra: number | null; venta: number | null }> =
      {};
    if (!data) return m;
    for (const r of data.rates)
      m[r.date] = { compra: r.compra, venta: r.venta };
    return m;
  }, [data]);

  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfWeek(year, month);

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {DAY_ABBR.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} />;

            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const rate = rateMap[dateStr];
            const isToday =
              today.year === year && today.month === month && today.day === day;
            const isSelected =
              selected?.year === year &&
              selected?.month === month &&
              selected?.day === day;
            const hasRate =
              rate && (rate.compra !== null || rate.venta !== null);

            return (
              <button
                key={day}
                type="button"
                disabled={!hasRate}
                onClick={() => {
                  if (!hasRate) return;
                  onSelect({
                    year,
                    month,
                    day,
                    compra: rate.compra,
                    venta: rate.venta,
                  });
                }}
                className={cn(
                  "flex flex-col items-center rounded-lg px-0.5 py-1.5 gap-0.5 w-full",
                  "border transition-colors",
                  // base
                  "border-transparent",
                  // today indicator (when not selected)
                  isToday &&
                    !isSelected &&
                    "border-primary/30 bg-primary/5 dark:bg-primary/10",
                  // selected
                  isSelected &&
                    "border-primary bg-primary/15 dark:bg-primary/20",
                  // interactive
                  hasRate && !isSelected && "hover:bg-muted/60 cursor-pointer",
                  // disabled/no rate
                  !hasRate && "opacity-30 cursor-default",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-bold leading-none",
                    isSelected
                      ? "text-primary"
                      : isToday
                        ? "text-primary/80"
                        : "text-muted-foreground",
                  )}
                >
                  {day}
                </span>
                {hasRate ? (
                  <>
                    <span className="text-[11px] tabular-nums leading-tight font-semibold text-emerald-400">
                      {fmt3(rate.compra)}
                    </span>
                    <span className="text-[11px] tabular-nums leading-tight font-semibold text-cyan-400 dark:text-cyan-300">
                      {fmt3(rate.venta)}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-muted-foreground/30 leading-none mt-0.5">
                    —
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-muted-foreground">Compra</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-cyan-400" />
          <span className="text-xs text-muted-foreground">Venta</span>
        </div>
        {selected && (
          <span className="ml-auto text-xs font-semibold text-foreground">
            {formatDateLabel(selected)} seleccionado
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Converter section
// ─────────────────────────────────────────────────────────────────────────────

type Currency = "PEN" | "USD";

interface ConverterSectionProps {
  selected: SelectedDate | null;
}

function ConverterSection({ selected }: ConverterSectionProps) {
  const [amount, setAmount] = useState<string>("");
  const [from, setFrom] = useState<Currency>("USD");

  const compra = selected?.compra ?? null;
  const venta = selected?.venta ?? null;
  const hasRate = compra !== null || venta !== null;

  const parsedAmount = parseFloat(amount.replace(",", "."));
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  // USD → PEN: × venta   |   PEN → USD: ÷ compra
  const result = useMemo(() => {
    if (!isValid) return null;
    if (from === "USD" && venta !== null) return parsedAmount * venta;
    if (from === "PEN" && compra !== null) return parsedAmount / compra;
    return null;
  }, [isValid, parsedAmount, from, venta, compra]);

  const toLabel = from === "USD" ? "PEN" : "USD";
  const activeRate = from === "USD" ? venta : compra;
  const activeRateLabel = from === "USD" ? "venta" : "compra";

  function toggle() {
    // Promote the current result into the new input so the user
    // sees the converted value ready to re-convert, instead of a blank.
    if (result !== null) {
      setAmount(result.toFixed(3));
    }
    setFrom((prev) => (prev === "USD" ? "PEN" : "USD"));
  }

  const dateLabel = selected ? formatDateLabel(selected) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Conversor</h3>
        {dateLabel && (
          <span className="text-xs font-semibold text-foreground">
            TC del {dateLabel}
          </span>
        )}
      </div>

      {/* TC reference row */}
      {selected && hasRate ? (
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">TC SUNAT</span>
          <div className="flex items-center gap-4">
            <span className="text-xs">
              <span className="text-muted-foreground mr-1">Compra</span>
              <span className="font-bold tabular-nums text-emerald-400">
                {fmt3(compra)}
              </span>
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground mr-1">Venta</span>
              <span className="font-bold tabular-nums text-cyan-400 dark:text-cyan-300">
                {fmt3(venta)}
              </span>
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
          <span className="text-xs text-muted-foreground">
            Selecciona un día en el calendario
          </span>
        </div>
      )}

      {/* From input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Monto en {from}</label>
        <div className="relative">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!hasRate}
            className="pr-14 tabular-nums font-semibold disabled:opacity-50"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
            {from}
          </span>
        </div>
      </div>

      {/* Swap */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={toggle}
          disabled={!hasRate}
          aria-label="Intercambiar moneda"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Result */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">
          Resultado en {toLabel}
        </label>
        <div className="relative">
          <div
            className={cn(
              "flex items-center rounded-md border border-input bg-muted/30 px-3 h-9",
              "text-sm font-bold tabular-nums",
              !result ? "text-muted-foreground/40" : "text-foreground",
            )}
          >
            {result !== null ? result.toFixed(3) : "—"}
          </div>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
            {toLabel}
          </span>
        </div>
      </div>

      {/* Formula hint */}
      {isValid && result !== null && activeRate !== null && (
        <p className="text-[11px] text-muted-foreground/50 text-center">
          {from === "USD"
            ? `${parsedAmount.toFixed(3)} × ${fmt3(activeRate)} (${activeRateLabel})`
            : `${parsedAmount.toFixed(3)} ÷ ${fmt3(activeRate)} (${activeRateLabel})`}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

interface ExchangeRatePanelProps {
  onClose?: () => void;
}

export function ExchangeRatePanel({ onClose }: ExchangeRatePanelProps) {
  const today = limaToday();

  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [selected, setSelected] = useState<SelectedDate | null>(null);

  // Auto-select today once the current month's data loads
  const { data: currentMonthData } = useExchangeRateMonth(
    today.year,
    today.month,
  );
  useEffect(() => {
    if (selected !== null) return; // user already picked a day
    if (!currentMonthData) return;
    const dateStr = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
    const entry = currentMonthData.rates.find((r) => r.date === dateStr);
    if (entry && (entry.compra !== null || entry.venta !== null)) {
      setSelected({
        year: today.year,
        month: today.month,
        day: today.day,
        compra: entry.compra,
        venta: entry.venta,
      });
    }
    // Run only when data arrives — not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthData]);

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (year > today.year || (year === today.year && month >= today.month))
      return;
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  // When navigating months, clear selection if it's from a different month
  function handlePrev() {
    if (selected && (selected.month !== month || selected.year !== year))
      setSelected(null);
    prevMonth();
  }

  function handleNext() {
    if (selected && (selected.month !== month || selected.year !== year))
      setSelected(null);
    nextMonth();
  }

  const isAtCurrentMonth = year === today.year && month === today.month;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-4 py-2.5 bg-white/25 dark:bg-[#0f0f14]/20 backdrop-blur-[16px] border-b border-black/7 dark:border-white/8">
        <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-semibold">Tipo de cambio</span>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-bold tabular-nums">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNext}
            disabled={isAtCurrentMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar — passes selected state down */}
        <CalendarSection
          year={year}
          month={month}
          selected={selected}
          onSelect={setSelected}
        />

        <Separator />

        {/* Converter — receives selected TC */}
        <ConverterSection selected={selected} />

        <div className="h-2" />
      </div>
    </div>
  );
}
