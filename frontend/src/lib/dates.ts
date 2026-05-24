/**
 * Date/time utilities for Peru timezone handling.
 *
 * All dates in the database are stored in UTC.
 * Frontend converts UTC → Peru (America/Lima) for display.
 * Frontend converts Peru → UTC for API queries.
 *
 * @see docs/features/datetime-formats.md
 */

/** Peru timezone identifier */
export const PERU_TZ = 'America/Lima';

/**
 * Format a UTC date for display in Peru timezone.
 *
 * @param utcDate - Date in UTC (from API/database)
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string in Peru time
 *
 * @example
 * formatDateForDisplay('2025-01-15T19:30:00Z')
 * // Returns: "15/01/2025 14:30" (Peru time)
 */
export function formatDateForDisplay(
  utcDate: Date | string,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

  return new Intl.DateTimeFormat('es-PE', {
    ...options,
    timeZone: PERU_TZ,
  }).format(date);
}

/**
 * Format a UTC date for display (date only, no time).
 *
 * @param utcDate - Date in UTC
 * @returns Formatted date string "DD/MM/YYYY" in Peru time
 */
export function formatDateOnly(utcDate: Date | string): string {
  return formatDateForDisplay(utcDate, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Convert a Peru local date to UTC for API queries.
 *
 * @param peruDate - Date in Peru local time
 * @returns ISO 8601 string in UTC (with Z suffix)
 *
 * @example
 * toUTCForQuery(new Date('2025-01-15T14:30:00'))
 * // Returns: "2025-01-15T19:30:00.000Z"
 */
export function toUTCForQuery(peruDate: Date): string {
  // Create a formatter that outputs ISO parts in Peru timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PERU_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(peruDate);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  // Build Peru datetime string and parse as Peru time
  const peruString = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;

  // Peru is UTC-5, so add 5 hours to get UTC
  const peruAsDate = new Date(peruString);
  const utcDate = new Date(peruAsDate.getTime() + 5 * 60 * 60 * 1000);

  return utcDate.toISOString();
}

/**
 * Get UTC range for a full day in Peru timezone.
 * Useful for filtering "all notifications from day X".
 *
 * @param date - Any date (will use the Peru day it falls on)
 * @returns Object with start and end ISO strings in UTC
 *
 * @example
 * getPeruDayRangeUTC(new Date('2025-01-15T10:00:00'))
 * // Returns: {
 * //   start: "2025-01-15T05:00:00.000Z",  // 00:00 Peru = 05:00 UTC
 * //   end: "2025-01-16T04:59:59.999Z"     // 23:59:59.999 Peru
 * // }
 */
export function getPeruDayRangeUTC(date: Date): { start: string; end: string } {
  // Get the Peru date components
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PERU_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '01';

  const year = get('year');
  const month = get('month');
  const day = get('day');

  // Start of day in Peru (00:00:00) → UTC (+5 hours)
  const startPeru = new Date(`${year}-${month}-${day}T00:00:00`);
  const startUTC = new Date(startPeru.getTime() + 5 * 60 * 60 * 1000);

  // End of day in Peru (23:59:59.999) → UTC (+5 hours)
  const endPeru = new Date(`${year}-${month}-${day}T23:59:59.999`);
  const endUTC = new Date(endPeru.getTime() + 5 * 60 * 60 * 1000);

  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
  };
}

/**
 * Get relative time description (e.g., "hace 2 horas").
 *
 * @param utcDate - Date in UTC
 * @returns Relative time string in Spanish
 */
export function getRelativeTime(utcDate: Date | string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;

  return formatDateOnly(utcDate);
}

/**
 * Format a UTC date for display in browser's local timezone.
 * Use this for system dates (jobs, logs) where user's local time matters.
 *
 * @param utcDate - Date in UTC (from API/database)
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string in browser's local time
 *
 * @example
 * // If browser is in Lima (UTC-5):
 * formatLocalDate('2025-01-15T19:30:00Z')
 * // Returns: "15/01/2025 14:30"
 *
 * // If browser is in Madrid (UTC+1):
 * formatLocalDate('2025-01-15T19:30:00Z')
 * // Returns: "15/01/2025 20:30"
 */
export function formatLocalDate(
  utcDate: Date | string | undefined | null,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
): string {
  if (!utcDate) return '—';
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

  // No timeZone specified = uses browser's local timezone
  return new Intl.DateTimeFormat('es-PE', options).format(date);
}

/**
 * Format a UTC date for display in browser's local timezone (compact format).
 * Shows day/month and time without year.
 *
 * @param utcDate - Date in UTC
 * @returns Formatted string like "15/01, 14:30"
 */
export function formatLocalDateCompact(utcDate: Date | string | undefined | null): string {
  if (!utcDate) return '—';
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Format a UTC date as date only in browser's local timezone.
 * Shows day/month/year without time.
 *
 * @param utcDate - Date in UTC
 * @returns Formatted string like "15/01/2025"
 */
export function formatLocalDateOnly(utcDate: Date | string | undefined | null): string {
  if (!utcDate) return '—';
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a date for compact table display as `dd/mm/yy`.
 *
 * - For plain `YYYY-MM-DD` strings (date-only fields like Schedule.startDate,
 *   Expense.date, Payment.date), parses components directly to avoid timezone
 *   shifts (e.g., "2026-04-11" → "11/04/26" regardless of locale).
 * - For full ISO datetimes, converts to Peru timezone first.
 * - Returns "—" for null/undefined/empty input.
 *
 * @param value - Date string (ISO or YYYY-MM-DD), Date object, or null/undefined
 * @returns Formatted string like "11/04/26" or "—"
 */
export function formatTableDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year.slice(2)}`;
    }
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: PERU_TZ,
  }).format(date);
}

/**
 * Format a UTC date as long date in browser's local timezone.
 * Shows full month name and year.
 *
 * @param utcDate - Date in UTC
 * @returns Formatted string like "15 de enero de 2025"
 */
export function formatLocalDateLong(utcDate: Date | string | undefined | null): string {
  if (!utcDate) return '—';
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a UTC date as long date with time in browser's local timezone.
 *
 * @param utcDate - Date in UTC
 * @returns Formatted string like "15 de enero de 2025, 14:30"
 */
export function formatLocalDateTimeLong(utcDate: Date | string | undefined | null): string {
  if (!utcDate) return '—';
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
