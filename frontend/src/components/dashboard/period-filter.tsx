'use client';

/**
 * PeriodFilter — period preset + custom range picker used on the dashboard.
 *
 * Presets: this month / last 3 months / this year / custom range.
 * Emits `DateRange` so consumers can convert with `rangeToIso` when calling APIs.
 */

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange as DayPickerRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  presetRange,
  type DateRange,
  type PeriodPreset,
} from '@/lib/dashboard-period';

const PRESET_LABELS: Record<PeriodPreset, string> = {
  last30Days: 'Últimos 30 días',
  thisMonth: 'Este mes',
  last3Months: 'Últimos 3 meses',
  thisYear: 'Este año',
  custom: 'Personalizado',
};

const DEFAULT_PRESETS: PeriodPreset[] = ['thisMonth', 'last3Months', 'thisYear', 'custom'];

interface PeriodFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  className?: string;
  /** Which presets to offer (and their order). Defaults to the dashboard set. */
  presets?: PeriodPreset[];
}

function detectPreset(value: DateRange): PeriodPreset {
  for (const preset of ['last30Days', 'thisMonth', 'last3Months', 'thisYear'] as const) {
    const range = presetRange(preset);
    if (
      range &&
      isSameDay(range.from, value.from) &&
      isSameDay(range.to, value.to)
    ) {
      return preset;
    }
  }
  return 'custom';
}

function formatRangeLabel(range: DateRange): string {
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  const fromFmt = sameYear ? 'd MMM' : 'd MMM yyyy';
  return `${format(range.from, fromFmt, { locale: es })} – ${format(range.to, 'd MMM yyyy', { locale: es })}`;
}

export function PeriodFilter({ value, onChange, className, presets = DEFAULT_PRESETS }: PeriodFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DayPickerRange | undefined>({
    from: value.from,
    to: value.to,
  });

  // Derive the active preset from `value` during render (no state-sync effect).
  // While the custom calendar is open we force the "custom" label.
  const detected = detectPreset(value);
  const preset: PeriodPreset = calendarOpen ? 'custom' : detected;

  function handlePresetChange(next: PeriodPreset) {
    if (next === 'custom') {
      setTempRange({ from: value.from, to: value.to });
      // Defer opening so the Select's closing pointer/focus events don't
      // immediately dismiss the calendar popover (Radix dismissable-layer race).
      setTimeout(() => setCalendarOpen(true), 0);
      return;
    }
    const range = presetRange(next);
    if (range) onChange(range);
  }

  function handleCalendarSelect(range: DayPickerRange | undefined) {
    setTempRange(range);
    if (range?.from && range?.to) {
      onChange({ from: range.from, to: range.to });
      setTimeout(() => setCalendarOpen(false), 200);
    }
  }

  const displayLabel = preset !== 'custom' ? PRESET_LABELS[preset] : formatRangeLabel(value);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select
        value={preset}
        onValueChange={(v) => handlePresetChange(v as PeriodPreset)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue>{displayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset} value={preset}>{PRESET_LABELS[preset]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatRangeLabel(value)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={tempRange?.from}
              selected={tempRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={es}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
