'use client';

/**
 * Searchable teacher picker (combobox).
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
import type { ApiClient, Teacher } from '@/lib/api';
import { useTeachers } from '@/hooks';

interface TeacherPickerProps {
  client: ApiClient;
  value: string | undefined;
  onChange: (teacherId: string, teacher: Teacher) => void;
  placeholder?: string;
  name?: string;
}

export function TeacherPicker({
  client,
  value,
  onChange,
  placeholder = 'Seleccionar profesor...',
  name,
}: TeacherPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data } = useTeachers(client, {
    search: search || undefined,
    limit: 10,
  });

  const selected = data?.items.find((t) => t.id === value);
  const displayLabel = selected
    ? `${selected.firstName} ${selected.lastName}`
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
        <PopoverContent className="w-[350px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nombre..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Sin resultados</CommandEmpty>
              <CommandGroup>
                {data?.items.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.id}
                    onSelect={() => { onChange(t.id, t); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 size-4', value === t.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.firstName} {t.lastName}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.specialty ?? 'Sin especialidad'}</p>
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
