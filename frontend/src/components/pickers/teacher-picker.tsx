'use client';

/**
 * Searchable teacher picker (combobox).
 */

import { useState } from 'react';
import { DOC_TYPE_LABELS, type ApiClient, type Teacher } from '@/lib/api';
import { useTeachers } from '@/hooks';
import { EntityCombobox } from './entity-combobox';

interface TeacherPickerProps {
  client: ApiClient;
  value: string | undefined;
  onChange: (teacherId: string, teacher: Teacher) => void;
  placeholder?: string;
  name?: string;
}

export function TeacherPicker({
  client,
  value,
  onChange,
  placeholder = 'Seleccionar profesor...',
  name,
}: TeacherPickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useTeachers(client, {
    search: search || undefined,
    limit: 25,
  });
  const teachers = data?.items ?? [];
  const emptyMessage = search.trim().length > 0
    ? 'Sin resultados para la búsqueda'
    : 'No hay profesores registrados';

  return (
    <EntityCombobox
      value={value}
      items={teachers}
      onChange={onChange}
      getItemId={(teacher) => teacher.id}
      getItemLabel={(teacher) => `${teacher.firstName} ${teacher.lastName}`}
      renderItem={(teacher) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{teacher.firstName} {teacher.lastName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {DOC_TYPE_LABELS[teacher.docType]} {teacher.docNumber}
            {teacher.specialty ? ` · ${teacher.specialty}` : ''}
          </p>
        </div>
      )}
      placeholder={placeholder}
      searchValue={search}
      onSearchValueChange={setSearch}
      searchPlaceholder="Buscar por nombre o documento..."
      emptyMessage={emptyMessage}
      loadingMessage="Cargando profesores..."
      isLoading={isLoading}
      name={name}
      popoverWidthClassName="w-[420px]"
    />
  );
}
