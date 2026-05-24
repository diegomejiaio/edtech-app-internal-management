'use client';

/**
 * PeriodFilter — period preset + custom range picker used on the dashboard.
 *
 * Presets: this month / last 3 months / this year / custom range.
 * Emits `DateRange` so consumers can convert with `rangeToIso` when calling APIs.
 */

import { useEffect, useMemo, useState } from 'react';
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
  thisMonth: 'Este mes',
  last3Months: 'Últimos 3 meses',
  thisYear: 'Este año',
  custom: 'Personalizado',
};

interface PeriodFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  className?: string;
}

function detectPreset(value: DateRange): PeriodPreset {
  for (const preset of ['thisMonth', 'last3Months', 'thisYear'] as const) {
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

export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  const [preset, setPreset] = useState<PeriodPreset>(() => detectPreset(value));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DayPickerRange | undefined>({
    from: value.from,
    to: value.to,
  });

  useEffect(() => {
    setPreset(detectPreset(value));
    setTempRange({ from: value.from, to: value.to });
  }, [value]);

  function handlePresetChange(next: PeriodPreset) {
    setPreset(next);
    if (next === 'custom') {
      setCalendarOpen(true);
      return;
    }
    const range = presetRange(next);
    if (range) onChange(range);
  }

  function handleCalendarSelect(range: DayPickerRange | undefined) {
    setTempRange(range);
    if (range?.from && range?.to) {
      onChange({ from: range.from, to: range.to });
      setPreset('custom');
      setTimeout(() => setCalendarOpen(false), 200);
    }
  }

  const displayLabel = useMemo(() => {
    if (preset !== 'custom') return PRESET_LABELS[preset];
    return formatRangeLabel(value);
  }, [preset, value]);

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
          <SelectItem value="thisMonth">{PRESET_LABELS.thisMonth}</SelectItem>
          <SelectItem value="last3Months">{PRESET_LABELS.last3Months}</SelectItem>
          <SelectItem value="thisYear">{PRESET_LABELS.thisYear}</SelectItem>
          <SelectItem value="custom">{PRESET_LABELS.custom}</SelectItem>
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
