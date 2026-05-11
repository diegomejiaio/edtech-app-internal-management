'use client';

/**
 * Searchable student picker (combobox).
 *
 * Uses Popover + Command (cmdk) for a type-ahead search experience.
 * Queries the students API as the user types.
 */

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { ApiClient, Student } from '@/lib/api';
import { useStudents } from '@/hooks';

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data } = useStudents(client, {
    search: search || undefined,
    limit: 10,
  });

  const selected = data?.items.find((s) => s.id === value);
  const displayLabel = selected
    ? `${selected.firstName} ${selected.lastName} — ${selected.docType} ${selected.docNumber}`
    : undefined;

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{displayLabel ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nombre o documento..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Sin resultados</CommandEmpty>
              <CommandGroup>
                {data?.items.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      onChange(s.id, s);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('mr-2 size-4', value === s.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.firstName} {s.lastName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.docType} {s.docNumber}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
