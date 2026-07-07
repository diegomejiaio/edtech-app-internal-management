'use client';

/**
 * Enrollment picker — searches enrollments by student or schedule.
 *
 * Used when creating student payments (need enrollmentId).
 */

import { useState } from 'react';
import type { ApiClient, Enrollment } from '@/lib/api';
import { formatTableDate } from '@/lib/dates';
import { formatCurrency } from '@/lib/money';
import { useEnrollments } from '@/hooks';
import { EntityCombobox } from './entity-combobox';

interface EnrollmentPickerProps {
  client: ApiClient;
  value: string | undefined;
  onChange: (enrollmentId: string, enrollment: Enrollment) => void;
  placeholder?: string;
  name?: string;
  /** Pre-filter by studentId. */
  studentId?: string;
  /** Pre-filter by scheduleId. */
  scheduleId?: string;
}

export function EnrollmentPicker({
  client,
  value,
  onChange,
  placeholder = 'Seleccionar inscripción...',
  name,
  studentId,
  scheduleId,
}: EnrollmentPickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useEnrollments(client, {
    studentId,
    scheduleId,
    status: ['active'],
    limit: 100,
  });

  const term = search.trim().toLowerCase();
  const filtered = data?.items.filter((enrollment) =>
    !term ||
    [
      enrollment.studentName,
      enrollment.studentDoc,
      enrollment.scheduleName,
      enrollment.code,
    ].join(' ').toLowerCase().includes(term),
  ) ?? [];
  const emptyMessage = term.length > 0
    ? 'Sin resultados para la búsqueda'
    : 'No hay inscripciones activas';

  return (
    <EntityCombobox
      value={value}
      items={filtered}
      selectedItems={data?.items ?? []}
      onChange={onChange}
      getItemId={(enrollment) => enrollment.id}
      getItemLabel={(enrollment) => `${enrollment.studentName} → ${enrollment.scheduleName}`}
      renderItem={(enrollment) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{enrollment.studentName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {enrollment.studentDoc} · {enrollment.scheduleName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Inscrito {formatTableDate(enrollment.enrollmentDate)} · {formatCurrency(enrollment.schedulePrice)}
          </p>
        </div>
      )}
      placeholder={placeholder}
      searchValue={search}
      onSearchValueChange={setSearch}
      searchPlaceholder="Buscar por alumno, documento, horario o código..."
      emptyMessage={emptyMessage}
      loadingMessage="Cargando inscripciones..."
      isLoading={isLoading}
      name={name}
      popoverWidthClassName="w-[520px]"
    />
  );
}
