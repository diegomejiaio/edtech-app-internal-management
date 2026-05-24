/**
 * Parses the canonical `weekdays` catalog code into JS weekday indices
 * (0 = Sunday … 6 = Saturday — same as `Date.getDay()`).
 *
 * Known catalog values (see backend/tools/EspacioPro.Seed/Seeders/ScheduleSeeder.cs):
 *   L, Ma, Mi, J, V, S, D — single days
 *   LMiV                  — Lun/Mié/Vie
 *   MaJ                   — Mar/Jue
 *   SD                   — Sáb/Dom
 *   L-V                  — Lun a Vie
 *
 * Legacy M/MJ/LMV codes are still parsed for already-seeded data.
 *
 * Unknown codes return an empty array; callers should treat empty as "no recurrence".
 */

const WEEKDAY_PATTERNS: Record<string, number[]> = {
  'L-V': [1, 2, 3, 4, 5],
  LMiV: [1, 3, 5],
  MaJ: [2, 4],
  SD: [6, 0],
  L: [1],
  Ma: [2],
  Mi: [3],
  J: [4],
  V: [5],
  S: [6],
  D: [0],
  LMV: [1, 3, 5],
  MJ: [2, 4],
  M: [2],
};

export function parseWeekdays(code: string | null | undefined): number[] {
  if (!code) return [];
  const trimmed = code.trim();
  return WEEKDAY_PATTERNS[trimmed] ?? [];
}

/** Spanish short labels keyed by weekday index (0 = Sun, 6 = Sat). */
export const WEEKDAY_SHORT_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Weekday display order used by the calendar (Monday-first). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
