'use client';

import { useState, type ReactNode } from 'react';
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

interface EntityComboboxProps<T> {
  value: string | undefined;
  items: T[];
  selectedItems?: T[];
  onChange: (itemId: string, item: T) => void;
  getItemId: (item: T) => string;
  getItemLabel: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  placeholder: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingMessage: string;
  isLoading?: boolean;
  name?: string;
  popoverWidthClassName?: string;
}

export function EntityCombobox<T>({
  value,
  items,
  selectedItems,
  onChange,
  getItemId,
  getItemLabel,
  renderItem,
  placeholder,
  searchValue,
  onSearchValueChange,
  searchPlaceholder,
  emptyMessage,
  loadingMessage,
  isLoading = false,
  name,
  popoverWidthClassName,
}: EntityComboboxProps<T>) {
  const [open, setOpen] = useState(false);

  const selected = (selectedItems ?? items).find((item) => getItemId(item) === value);
  const displayLabel = selected ? getItemLabel(selected) : undefined;

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
        <PopoverContent className={cn('p-0', popoverWidthClassName)} align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={onSearchValueChange}
            />
            <CommandList>
              <CommandEmpty>{isLoading ? loadingMessage : emptyMessage}</CommandEmpty>
              <CommandGroup>
                {items.map((item) => {
                  const itemId = getItemId(item);
                  return (
                    <CommandItem
                      key={itemId}
                      value={itemId}
                      onSelect={() => {
                        onChange(itemId, item);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 size-4', value === itemId ? 'opacity-100' : 'opacity-0')} />
                      {renderItem(item)}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
