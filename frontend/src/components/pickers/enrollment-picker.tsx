'use client';

/**
 * Enrollment picker — searches enrollments by student or schedule.
 *
 * Used when creating student payments (need enrollmentId).
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
import type { ApiClient, Enrollment } from '@/lib/api';
import { useEnrollments } from '@/hooks';

interface EnrollmentPickerProps {
  client: ApiClient;
  value: string | undefined;
  onChange: (enrollmentId: string, enrollment: Enrollment) => void;
  placeholder?: string;
  name?: string;
  /** Pre-filter by studentId. */
  studentId?: string;
  /** Pre-filter by scheduleId. */
  scheduleId?: string;
}

export function EnrollmentPicker({
  client,
  value,
  onChange,
  placeholder = 'Seleccionar inscripción...',
  name,
  studentId,
  scheduleId,
}: EnrollmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data } = useEnrollments(client, {
    studentId,
    scheduleId,
    status: 'active',
    limit: 20,
  });

  const filtered = data?.items.filter((e) =>
    !search ||
    e.studentName.toLowerCase().includes(search.toLowerCase()) ||
    e.scheduleName.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  const selected = data?.items.find((e) => e.id === value);
  const displayLabel = selected
    ? `${selected.studentName} → ${selected.scheduleName}`
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
        <PopoverContent className="w-[450px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por alumno o horario..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Sin inscripciones activas</CommandEmpty>
              <CommandGroup>
                {filtered.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={e.id}
                    onSelect={() => { onChange(e.id, e); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 size-4', value === e.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.scheduleName} · {e.enrollmentDate}
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
