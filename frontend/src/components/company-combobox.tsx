"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Company } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CompanyComboboxProps {
  /** List of companies to display */
  companies: Company[];
  /** Currently selected company ID */
  value: string;
  /** Callback when selection changes */
  onValueChange: (value: string) => void;
  /** Placeholder text when no selection */
  placeholder?: string;
  /** Whether to show "Todas las empresas" option */
  showAllOption?: boolean;
  /** Text for "all" option */
  allOptionText?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom width class */
  className?: string;
  /** Show building icon */
  showIcon?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CompanyCombobox({
  companies,
  value,
  onValueChange,
  placeholder = "Seleccionar empresa",
  showAllOption = false,
  allOptionText = "Todas las empresas",
  isLoading = false,
  disabled = false,
  className,
  showIcon = false,
}: CompanyComboboxProps) {
  const [open, setOpen] = useState(false);

  // Find the selected company
  const selectedCompany = companies.find((c) => c.id === value);

  // Display text for the button
  const displayText =
    value === "all"
      ? allOptionText
      : selectedCompany
        ? `${selectedCompany.ruc} - ${selectedCompany.business_name}`
        : placeholder;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && (
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className={cn(
              "w-full sm:w-96 justify-between font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {isLoading ? "Cargando empresas..." : displayText}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[calc(100vw-2rem)] sm:w-96 p-0"
          align="start"
        >
          <Command
            filter={(value, search) => {
              // Custom filter: match if search term is found anywhere in value
              // This fixes RUC search which doesn't work with cmdk's default fuzzy search
              if (value.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="Buscar por RUC o razón social..." />
            <CommandList>
              <CommandEmpty>No se encontraron empresas.</CommandEmpty>
              <CommandGroup>
                {showAllOption && (
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      onValueChange("all");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === "all" ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {allOptionText}
                  </CommandItem>
                )}
                {companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={`${company.ruc} ${company.business_name}`}
                    onSelect={() => {
                      onValueChange(company.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === company.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">
                      {company.ruc} - {company.business_name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
