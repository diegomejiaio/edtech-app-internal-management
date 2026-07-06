'use client';

import { CalendarDays } from 'lucide-react';
import { CatalogCrudPage } from '@/components/catalogs/catalog-crud-page';

export default function WeekdaysPage() {
  return (
    <CatalogCrudPage
      catalogCode="weekdays"
      title="Días"
      subtitle="Catálogo de días para horarios"
      createButtonLabel="Nuevo día"
      columnLabel="Día"
      fieldLabel="Nombre del día"
      fieldPlaceholder="Ej. LMiV"
      fieldRequiredMessage="Ingresa el valor"
      createSheetTitle="Nuevo día"
      editSheetTitle="Editar día"
      createSuccessMessage={(value) => `"${value}" agregado`}
      editSuccessMessage="Día actualizado"
      toggleSuccessMessage={(value, wasActive) => `"${value}" ${wasActive ? 'desactivado' : 'reactivado'}`}
      emptyIcon={CalendarDays}
      emptyTitle="No hay días creados aún"
      emptyDescription="Cuando crees tu primer día aparecerá aquí."
    />
  );
}
