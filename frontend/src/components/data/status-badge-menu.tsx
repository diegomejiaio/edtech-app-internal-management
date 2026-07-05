'use client';

/**
 * Clickable status badge that opens a menu to change an entity's status inline.
 *
 * The colored badge itself is the trigger. Selecting a status calls `onChange`;
 * transitioning into a "terminal" status (e.g. finished/cancelled) first asks for
 * confirmation to protect the team from misclicks. Generic over a status union.
 * Spanish UI strings.
 */

import { useState, type ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { cn } from '@/lib/utils';
import type { StatusOption } from './status-multi-select';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

interface StatusBadgeMenuProps<T extends string> {
  value: T;
  options: StatusOption<T>[];
  variants: Record<T, BadgeVariant>;
  /** Statuses that require a confirmation step before applying. */
  terminalStatuses?: readonly T[];
  onChange: (next: T) => void;
  disabled?: boolean;
}

export function StatusBadgeMenu<T extends string>({
  value,
  options,
  variants,
  terminalStatuses = [],
  onChange,
  disabled = false,
}: StatusBadgeMenuProps<T>) {
  const [pending, setPending] = useState<T | null>(null);

  const currentLabel = options.find((o) => o.value === value)?.label ?? value;
  const others = options.filter((o) => o.value !== value);
  const pendingLabel = pending ? options.find((o) => o.value === pending)?.label ?? pending : '';

  function select(next: T) {
    if (terminalStatuses.includes(next)) {
      setPending(next);
      return;
    }
    onChange(next);
  }

  function confirm() {
    if (pending) onChange(pending);
    setPending(null);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger disabled={disabled} className="disabled:cursor-not-allowed disabled:opacity-60">
          <Badge variant={variants[value]} className={cn('cursor-pointer gap-1', !disabled && 'hover:opacity-80')}>
            {currentLabel}
            <ChevronDown className="size-3" />
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {others.map((o) => (
            <DropdownMenuItem key={o.value} onSelect={() => select(o.value)}>
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        onConfirm={confirm}
        title={`¿Cambiar estado a "${pendingLabel}"?`}
        description={`Este cambio marca el registro como "${pendingLabel}". Podrás revertirlo luego si es necesario.`}
        confirmLabel="Confirmar"
        loadingLabel="Confirmando..."
        isLoading={false}
      />
    </>
  );
}
