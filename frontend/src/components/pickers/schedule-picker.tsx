'use client';

import { useState } from 'react';
import type { ApiClient, ScheduleWithCounts } from '@/lib/api';
import { formatTableDate } from '@/lib/dates';
import { useSchedules } from '@/hooks';
import { EntityCombobox } from './entity-combobox';

interface SchedulePickerProps {
  client: ApiClient;
  value: string | undefined;
  onChange: (scheduleId: string, schedule: ScheduleWithCounts) => void;
  placeholder?: string;
  name?: string;
  /** Filter to active schedules only (default: true). */
  activeOnly?: boolean;
}

function formatScheduleLabel(s: ScheduleWithCounts): string {
  return `${s.course} · ${s.level} · ${s.weekdays} ${s.startTime}`;
}

export function SchedulePicker({
  client,
  value,
  onChange,
  placeholder = 'Seleccionar horario...',
  name,
  activeOnly = true,
}: SchedulePickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useSchedules(client, {
    status: activeOnly ? ['active'] : undefined,
    limit: 50,
  });

  // Client-side filter since schedules API doesn't have a search param for course
  const filtered = data?.items.filter((s) => {
    const term = search.toLowerCase();
    return !term || [
      formatScheduleLabel(s),
      s.code,
      s.teacherName,
      s.startDate,
    ].join(' ').toLowerCase().includes(term);
  }) ?? [];

  const emptyMessage = search.trim().length > 0
    ? 'Sin resultados para la búsqueda'
    : 'No hay horarios disponibles';

  return (
    <EntityCombobox
      value={value}
      items={filtered}
      selectedItems={data?.items ?? []}
      onChange={onChange}
      getItemId={(schedule) => schedule.id}
      getItemLabel={formatScheduleLabel}
      renderItem={(schedule) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{schedule.course} · {schedule.level}</p>
          <p className="truncate text-xs text-muted-foreground">
            {schedule.weekdays} {schedule.startTime}–{schedule.endTime} · Prof. {schedule.teacherName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Inicio {formatTableDate(schedule.startDate)} · Cupos {schedule.enrolledActiveCount}/{schedule.capacity}
          </p>
        </div>
      )}
      placeholder={placeholder}
      searchValue={search}
      onSearchValueChange={setSearch}
      searchPlaceholder="Buscar por curso, nivel, profesor, código o fecha..."
      emptyMessage={emptyMessage}
      loadingMessage="Cargando horarios..."
      isLoading={isLoading}
      name={name}
      popoverWidthClassName="w-[520px]"
    />
  );
}
