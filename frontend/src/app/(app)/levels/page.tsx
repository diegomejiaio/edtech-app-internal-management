'use client';

import { Layers } from 'lucide-react';
import { CatalogCrudPage } from '@/components/catalogs/catalog-crud-page';

export default function LevelsPage() {
  return (
    <CatalogCrudPage
      catalogCode="levels"
      title="Niveles"
      subtitle="Catálogo de niveles de cursos"
      createButtonLabel="Nuevo nivel"
      columnLabel="Nivel"
      fieldLabel="Nombre del nivel"
      fieldPlaceholder="Ej. Básico"
      fieldRequiredMessage="Ingresa el nombre del nivel"
      createSheetTitle="Nuevo nivel"
      editSheetTitle="Editar nivel"
      createSuccessMessage={(value) => `"${value}" agregado`}
      editSuccessMessage="Nivel actualizado"
      toggleSuccessMessage={(value, wasActive) => `"${value}" ${wasActive ? 'desactivado' : 'reactivado'}`}
      emptyIcon={Layers}
      emptyTitle="No hay niveles creados aún"
      emptyDescription="Cuando crees tu primer nivel aparecerá aquí."
    />
  );
}
