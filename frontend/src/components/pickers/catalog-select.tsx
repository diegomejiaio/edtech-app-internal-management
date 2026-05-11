'use client';

/**
 * Dropdown select populated from a catalog's items.
 *
 * Fetches the catalog by code and renders active items as select options.
 * Falls back to a plain text input if the catalog hasn't loaded yet.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { ApiClient } from '@/lib/api';
import { useCatalog } from '@/hooks';

interface CatalogSelectProps {
  client: ApiClient;
  /** Catalog code (e.g. `'paymentMethods'`, `'courses'`). */
  catalogCode: string;
  /** Current selected value. */
  value: string | undefined;
  /** Called when the user selects a value. */
  onChange: (value: string) => void;
  /** Placeholder text (Spanish — visible to user). */
  placeholder?: string;
  /** Name attribute for FormData extraction. */
  name?: string;
}

export function CatalogSelect({
  client,
  catalogCode,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  name,
}: CatalogSelectProps) {
  const { data: catalog, isLoading } = useCatalog(client, catalogCode);

  const activeItems = catalog?.items.filter((i) => i.active).sort((a, b) => a.order - b.order) ?? [];

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Select value={value} onValueChange={onChange} name={name}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {activeItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.value}
          </SelectItem>
        ))}
        {activeItems.length === 0 && (
          <SelectItem value="_empty" disabled>
            Sin opciones
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
