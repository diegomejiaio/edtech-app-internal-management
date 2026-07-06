'use client';

import { Banknote } from 'lucide-react';
import { CatalogCrudPage } from '@/components/catalogs/catalog-crud-page';

export default function PaymentMethodsPage() {
  return (
    <CatalogCrudPage
      catalogCode="paymentMethods"
      title="Medios de pago"
      subtitle="Catálogo de medios de pago disponibles"
      createButtonLabel="Nuevo medio"
      columnLabel="Medio de pago"
      fieldLabel="Nombre del medio"
      fieldPlaceholder="Ej. Yape"
      fieldRequiredMessage="Ingresa el nombre del medio"
      createSheetTitle="Nuevo medio de pago"
      editSheetTitle="Editar medio de pago"
      createSuccessMessage={(value) => `"${value}" agregado`}
      editSuccessMessage="Medio actualizado"
      toggleSuccessMessage={(value, wasActive) => `"${value}" ${wasActive ? 'desactivado' : 'reactivado'}`}
      emptyIcon={Banknote}
      emptyTitle="No hay medios de pago creados aún"
      emptyDescription="Cuando crees tu primer medio aparecerá aquí."
    />
  );
}
