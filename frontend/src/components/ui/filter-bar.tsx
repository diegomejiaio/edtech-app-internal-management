"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Button } from "./button";
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
  /** Show loading indicator when true. */
  loading?: boolean;
  /** Message shown when options is empty and not loading. */
  emptyText?: string;
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
  loading = false,
  emptyText = "Sin opciones",
}: FilterSelectProps<T>) {
  // Radix Select requires at least one item to open; show loading/empty state
  const showLoading = loading && options.length === 0;
  const showEmpty = !loading && options.length === 0 && !allOption;

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
          {showLoading && (
            <SelectItem value="__loading__" disabled>
              Cargando...
            </SelectItem>
          )}
          {showEmpty && (
            <SelectItem value="__empty__" disabled>
              {emptyText}
            </SelectItem>
          )}
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

// =============================================================================
// FilterBarActions - Slot for action buttons (Export, Sync, etc.)
// =============================================================================

interface FilterBarActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for action buttons in FilterBar
 * Pushes content to the right on desktop
 * @example
 * <FilterBar>
 *   <SearchInput ... />
 *   <FilterBarActions>
 *     <Button>Exportar</Button>
 *   </FilterBarActions>
 * </FilterBar>
 */
export function FilterBarActions({ children, className }: FilterBarActionsProps) {
  return (
    <div className={cn("flex items-end gap-2 sm:ml-auto", className)}>
      {children}
    </div>
  );
}

// =============================================================================
// ClearFiltersButton - Button to clear all filters
// =============================================================================

interface ClearFiltersButtonProps {
  onClear: () => void;
  hasActiveFilters: boolean;
  className?: string;
}

/**
 * Button to clear all active filters
 * Only visible when hasActiveFilters is true
 * @example
 * <ClearFiltersButton
 *   onClear={() => { setSearch(''); setStatus('all'); }}
 *   hasActiveFilters={search !== '' || status !== 'all'}
 * />
 */
export function ClearFiltersButton({
  onClear,
  hasActiveFilters,
  className,
}: ClearFiltersButtonProps) {
  if (!hasActiveFilters) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClear}
      className={cn("h-9 px-2 text-muted-foreground hover:text-foreground", className)}
    >
      <X className="mr-1 h-4 w-4" />
      Limpiar
    </Button>
  );
}
