/**
 * Helpers for computing date ranges used by dashboard widgets.
 *
 * Keeps the YYYY-MM ↔ ISO date conversion logic in one place so widgets that
 * filter by month (payments, expenses, etc.) stay consistent.
 */

import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  subMonths,
  subDays,
} from 'date-fns';
import { currentMonthInPeru } from './dates';

/** A date range expressed as native `Date` objects (inclusive). */
export interface DateRange {
  from: Date;
  to: Date;
}

/** Available presets for the period filter. */
export type PeriodPreset = 'last30Days' | 'thisMonth' | 'last3Months' | 'thisYear' | 'custom';

/** Returns `YYYY-MM` for the current month in Peru timezone. */
export function currentMonth(): string {
  return currentMonthInPeru();
}

/** Returns the inclusive `[from, to]` ISO date range for a `YYYY-MM` value. */
export function monthRange(month: string): { from: string; to: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${yearStr}-${pad(monthNum)}-01`,
    to: `${yearStr}-${pad(monthNum)}-${pad(lastDay)}`,
  };
}

/** Formats a `Date` as `YYYY-MM-DD` in local time. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Returns the `from`/`to` Date range for a given preset, anchored at `now`. */
export function presetRange(preset: PeriodPreset, now: Date = new Date()): DateRange | undefined {
  switch (preset) {
    case 'last30Days':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last3Months':
      return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    case 'thisYear':
      return { from: startOfYear(now), to: endOfYear(now) };
    case 'custom':
      return undefined;
  }
}

/** Converts a `DateRange` to ISO `{ from, to }` strings used by list endpoints. */
export function rangeToIso(range: DateRange): { from: string; to: string } {
  return { from: toIsoDate(range.from), to: toIsoDate(range.to) };
}

/** Formats a numeric amount as Peruvian Soles. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 0,
  }).format(value);
}
