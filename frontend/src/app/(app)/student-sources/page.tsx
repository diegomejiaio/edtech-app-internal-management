'use client';

import { Megaphone } from 'lucide-react';
import { CatalogCrudPage } from '@/components/catalogs/catalog-crud-page';

export default function StudentSourcesPage() {
  return (
    <CatalogCrudPage
      catalogCode="studentSources"
      title="Fuentes de alumnos"
      subtitle="Cómo nos conocieron los alumnos"
      createButtonLabel="Nueva fuente"
      columnLabel="Fuente"
      fieldLabel="Nombre de la fuente"
      fieldPlaceholder="Ej. Instagram"
      fieldRequiredMessage="Ingresa el valor"
      createSheetTitle="Nueva fuente"
      editSheetTitle="Editar fuente"
      createSuccessMessage={(value) => `"${value}" agregada`}
      editSuccessMessage="Fuente actualizada"
      toggleSuccessMessage={(value, wasActive) => `"${value}" ${wasActive ? 'desactivada' : 'reactivada'}`}
      emptyIcon={Megaphone}
      emptyTitle="No hay fuentes creadas aún"
      emptyDescription="Cuando crees tu primera fuente aparecerá aquí."
    />
  );
}
