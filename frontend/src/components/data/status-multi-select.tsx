'use client';

/**
 * Multi-select status filter for fact tables (schedules, enrollments).
 *
 * Generic over a status string union. Emits the selected statuses in the same
 * order as `options`. An empty selection means "no filter" (show every status),
 * which mirrors the backend contract (`?status=` omitted). Spanish UI strings.
 */

import { ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface StatusOption<T extends string> {
  value: T;
  label: string;
}

interface StatusMultiSelectProps<T extends string> {
  options: StatusOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  /** Trigger label (Spanish). */
  label?: string;
  className?: string;
}

export function StatusMultiSelect<T extends string>({
  options,
  value,
  onChange,
  label = 'Estado',
  className,
}: StatusMultiSelectProps<T>) {
  const selected = new Set(value);

  function toggle(v: T) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    // Preserve the canonical option order regardless of click order.
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  }

  const count = value.length;
  const triggerLabel = count === 0 ? `${label}: todos` : `${label} · ${count}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start gap-2 sm:w-48', className)}>
          <ListFilter className="size-4 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Filtrar por estado</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.has(o.value)}
            onCheckedChange={() => toggle(o.value)}
            onSelect={(e) => e.preventDefault()}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={count === 0} onSelect={() => onChange([])}>
          Limpiar filtro
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
