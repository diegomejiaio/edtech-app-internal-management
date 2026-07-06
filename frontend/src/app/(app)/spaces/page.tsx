'use client';

import { MapPin } from 'lucide-react';
import { CatalogCrudPage } from '@/components/catalogs/catalog-crud-page';

export default function SpacesPage() {
  return (
    <CatalogCrudPage
      catalogCode="spaces"
      title="Espacios"
      subtitle="Aulas y locaciones disponibles"
      createButtonLabel="Nuevo espacio"
      columnLabel="Espacio"
      fieldLabel="Nombre del espacio"
      fieldPlaceholder="Ej. Aula 1"
      fieldRequiredMessage="Ingresa el nombre del espacio"
      createSheetTitle="Nuevo espacio"
      editSheetTitle="Editar espacio"
      createSuccessMessage={(value) => `"${value}" agregado`}
      editSuccessMessage="Espacio actualizado"
      toggleSuccessMessage={(value, wasActive) => `"${value}" ${wasActive ? 'desactivado' : 'reactivado'}`}
      emptyIcon={MapPin}
      emptyTitle="No hay espacios registrados aún"
      emptyDescription="Cuando registres tu primer aula o locación aparecerá aquí."
    />
  );
}
