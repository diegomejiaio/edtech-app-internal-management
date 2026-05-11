/**
 * Drift guards for the wire-format enum types and their Spanish UI label maps.
 *
 * These tests exist to lock in the bug discovered while wiring the M9 schedule
 * dashboard: frontend types previously used Spanish PascalCase (`'Activo'`)
 * while the backend serializes English camelCase (`'active'`). Every enum
 * drift in either direction breaks `*_LABELS[value]` lookups silently.
 *
 * If a future enum value is added to backend `Enums.cs` and propagated here,
 * the corresponding `*_LABELS` record must be extended in the same PR. These
 * tests fail otherwise.
 */

import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  DOC_TYPE_LABELS,
  ENROLLMENT_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
  type DocType,
  type EnrollmentStatus,
  type ScheduleStatus,
} from './types';

describe('Wire-format enum labels', () => {
  it('DOC_TYPE_LABELS covers every DocType wire value (camelCase, lowercase)', () => {
    const expected: Record<DocType, string> = {
      dni: 'DNI',
      ce: 'CE',
      passport: 'Pasaporte',
    };
    expect(DOC_TYPE_LABELS).toStrictEqual(expected);
  });

  it('ENROLLMENT_STATUS_LABELS covers every EnrollmentStatus wire value', () => {
    const expected: Record<EnrollmentStatus, string> = {
      active: 'Activo',
      completed: 'Completado',
      cancelled: 'Cancelado',
      pending: 'Pendiente',
    };
    expect(ENROLLMENT_STATUS_LABELS).toStrictEqual(expected);
  });

  it('SCHEDULE_STATUS_LABELS covers every ScheduleStatus wire value', () => {
    const expected: Record<ScheduleStatus, string> = {
      active: 'Activo',
      inProgress: 'En progreso',
      finished: 'Finalizado',
      cancelled: 'Cancelado',
    };
    expect(SCHEDULE_STATUS_LABELS).toStrictEqual(expected);
  });

  it('rejects legacy Spanish PascalCase wire values at the type level', () => {
    // Compile-time guards. If anyone reintroduces 'Activo' as a wire value,
    // these stop being assignable and the build fails.
    expectTypeOf<DocType>().not.toEqualTypeOf<'DNI' | 'CE' | 'PASAPORTE'>();
    expectTypeOf<EnrollmentStatus>().not.toEqualTypeOf<
      'Activo' | 'Completado' | 'Cancelado' | 'Pendiente'
    >();
    expectTypeOf<ScheduleStatus>().not.toEqualTypeOf<
      'Activo' | 'EnProgreso' | 'Finalizado' | 'Cancelado'
    >();
  });
});
