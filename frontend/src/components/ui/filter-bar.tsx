"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { InlineSpinner } from "./loading";

// =============================================================================
// FilterBar - Container for filter controls
// =============================================================================

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Flex container for filter controls
 * @example
 * <FilterBar>
 *   <SearchInput ... />
 *   <FilterSelect ... />
 * </FilterBar>
 */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end", className)}
    >
      {children}
    </div>
  );
}

// =============================================================================
// SearchInput - Search input with icon and loading state
// =============================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isSearching?: boolean;
  label?: string;
  className?: string;
}

/**
 * Search input with icon and optional loading spinner
 * @example
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Buscar empresas..."
 *   isSearching={isFetching}
 * />
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  isSearching,
  label,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative flex-1", className)}>
      {label && (
        <label className="mb-1 block text-xs text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {isSearching && (
          <InlineSpinner className="absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// FilterSelect - Select dropdown for filtering
// =============================================================================

interface FilterSelectOption<T extends string> {
  value: T;
  label: string;
}

interface FilterSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: FilterSelectOption<T>[];
  label?: string;
  allOption?: { value: string; label: string };
  placeholder?: string;
  width?: string;
  className?: string;
}

/**
 * Filter select dropdown with optional "all" option
 * @example
 * <FilterSelect
 *   label="Estado"
 *   value={status}
 *   onChange={setStatus}
 *   options={[
 *     { value: 'active', label: 'Activo' },
 *     { value: 'inactive', label: 'Inactivo' },
 *   ]}
 *   allOption={{ value: 'all', label: 'Todos' }}
 * />
 */
export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  allOption,
  placeholder = "Seleccionar",
  width = "w-[160px]",
  className,
}: FilterSelectProps<T>) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label className="text-xs text-muted-foreground">{label}</label>
      )}
      <Select value={value} onValueChange={onChange as (v: string) => void}>
        <SelectTrigger className={width}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allOption && (
            <SelectItem value={allOption.value}>{allOption.label}</SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
