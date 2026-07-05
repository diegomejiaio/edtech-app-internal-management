import { describe, expect, it } from 'vitest';
import { currentMonthInPeru, isScheduleActiveInMonth, monthBounds } from './dates';

describe('currentMonthInPeru', () => {
  it('uses Peru timezone at month boundaries instead of UTC month slices', () => {
    const stillFebruaryInPeru = new Date('2025-03-01T03:30:00.000Z');
    const alreadyMarchInPeru = new Date('2025-03-01T05:30:00.000Z');

    expect(currentMonthInPeru(stillFebruaryInPeru)).toBe('2025-02');
    expect(currentMonthInPeru(alreadyMarchInPeru)).toBe('2025-03');
  });
});

describe('monthBounds', () => {
  it('returns inclusive month boundaries for valid YYYY-MM values', () => {
    expect(monthBounds('2025-02')).toEqual({
      from: '2025-02-01',
      to: '2025-02-28',
    });
  });

  it('returns null for invalid month values', () => {
    expect(monthBounds('2025-13')).toBeNull();
    expect(monthBounds('2025-2')).toBeNull();
  });
});

describe('isScheduleActiveInMonth', () => {
  it('includes schedules that started before the month and are still active', () => {
    expect(isScheduleActiveInMonth('2025-01-15', '2025-03-10', '2025-02')).toBe(true);
  });

  it('excludes schedules that ended before the month starts', () => {
    expect(isScheduleActiveInMonth('2025-01-01', '2025-01-31', '2025-02')).toBe(false);
  });

  it('accepts full ISO datetime strings from API payloads', () => {
    expect(
      isScheduleActiveInMonth('2025-02-01T00:00:00.000Z', '2025-02-28T23:59:59.999Z', '2025-02'),
    ).toBe(true);
  });
});
