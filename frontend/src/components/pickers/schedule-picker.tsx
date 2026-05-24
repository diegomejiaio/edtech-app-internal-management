'use client';

/**
 * Searchable schedule picker (combobox).
 *
 * Displays course · level · weekdays · time · start date for each option.
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
import type { ApiClient, ScheduleWithCounts } from '@/lib/api';
import { useSchedules } from '@/hooks';

interface SchedulePickerProps {
  client: ApiClient;
  value: string | undefined;
  onChange: (scheduleId: string, schedule: ScheduleWithCounts) => void;
  placeholder?: string;
  name?: string;
  /** Filter to active schedules only (default: true). */
  activeOnly?: boolean;
}

function formatScheduleLabel(s: ScheduleWithCounts): string {
  return `${s.course} · ${s.level} · ${s.weekdays} ${s.startTime} · ${formatDateOnly(s.startDate)}`;
}

function formatDateOnly(date: string | undefined): string {
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

export function SchedulePicker({
  client,
  value,
  onChange,
  placeholder = 'Seleccionar horario...',
  name,
  activeOnly = true,
}: SchedulePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data } = useSchedules(client, {
    status: activeOnly ? 'active' : undefined,
    limit: 50,
  });

  // Client-side filter since schedules API doesn't have a search param for course
  const filtered = data?.items.filter((s) => {
    const term = search.toLowerCase();
    return !term || [
      formatScheduleLabel(s),
      s.teacherName,
      s.startDate,
    ].join(' ').toLowerCase().includes(term);
  }) ?? [];

  const selected = data?.items.find((s) => s.id === value);
  const displayLabel = selected ? formatScheduleLabel(selected) : undefined;

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
              placeholder="Buscar por curso, nivel, profesor o fecha..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Sin resultados</CommandEmpty>
              <CommandGroup>
                {filtered.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => { onChange(s.id, s); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 size-4', value === s.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.course} · {s.level}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Inicio {formatDateOnly(s.startDate)} · {s.weekdays} {s.startTime}–{s.endTime} · Prof. {s.teacherName} · {s.enrolledActiveCount}/{s.capacity}
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
