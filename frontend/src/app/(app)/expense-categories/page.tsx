'use client';

import { FolderOpen } from 'lucide-react';
import { CatalogCrudPage } from '@/components/catalogs/catalog-crud-page';

export default function ExpenseCategoriesPage() {
  return (
    <CatalogCrudPage
      catalogCode="expenseCategories"
      title="Categorías de gastos"
      subtitle="Clasificación de gastos operativos"
      createButtonLabel="Nueva categoría"
      columnLabel="Categoría"
      fieldLabel="Nombre de la categoría"
      fieldPlaceholder="Ej. Materiales"
      fieldRequiredMessage="Ingresa el nombre de la categoría"
      createSheetTitle="Nueva categoría"
      editSheetTitle="Editar categoría"
      createSuccessMessage={(value) => `"${value}" agregada`}
      editSuccessMessage="Categoría actualizada"
      toggleSuccessMessage={(value, wasActive) => `"${value}" ${wasActive ? 'desactivada' : 'reactivada'}`}
      emptyIcon={FolderOpen}
      emptyTitle="No hay categorías creadas aún"
      emptyDescription="Cuando crees tu primera categoría aparecerá aquí."
    />
  );
}
