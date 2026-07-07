'use client';

import { useState } from 'react';
import { DOC_TYPE_LABELS, type ApiClient, type Student } from '@/lib/api';
import { useStudents } from '@/hooks';
import { EntityCombobox } from './entity-combobox';

interface StudentPickerProps {
  client: ApiClient;
  value: string | undefined;
  onChange: (studentId: string, student: Student) => void;
  placeholder?: string;
  /** Name attribute for FormData extraction. */
  name?: string;
}

export function StudentPicker({
  client,
  value,
  onChange,
  placeholder = 'Seleccionar alumno...',
  name,
}: StudentPickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useStudents(client, {
    search: search || undefined,
    limit: 25,
  });
  const students = data?.items ?? [];
  const emptyMessage = search.trim().length > 0
    ? 'Sin resultados para la búsqueda'
    : 'No hay alumnos registrados';

  return (
    <EntityCombobox
      value={value}
      items={students}
      onChange={onChange}
      getItemId={(student) => student.id}
      getItemLabel={(student) => `${student.firstName} ${student.lastName} — ${DOC_TYPE_LABELS[student.docType]} ${student.docNumber}`}
      renderItem={(student) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{student.firstName} {student.lastName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {DOC_TYPE_LABELS[student.docType]} {student.docNumber}
            {student.phone ? ` · ${student.phone}` : ''}
          </p>
        </div>
      )}
      placeholder={placeholder}
      searchValue={search}
      onSearchValueChange={setSearch}
      searchPlaceholder="Buscar por nombre o documento..."
      emptyMessage={emptyMessage}
      loadingMessage="Cargando alumnos..."
      isLoading={isLoading}
      name={name}
      popoverWidthClassName="w-[430px]"
    />
  );
}
