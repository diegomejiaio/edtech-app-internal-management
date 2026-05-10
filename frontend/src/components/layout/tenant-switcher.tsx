'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Building2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useUserRole } from '@/hooks/use-auth'
import { useTenants, useCurrentTenant } from '@/hooks/use-tenants'
import { DEV_MODE, DEV_DEFAULTS } from '@/lib/env'

interface TenantSwitcherProps {
  className?: string
}

/**
 * Tenant Switcher Component
 * 
 * - For Master users: Dropdown to switch between tenants
 * - For Admin/Member users: Shows current tenant name (read-only)
 */
export function TenantSwitcher({ className }: TenantSwitcherProps) {
  const { isMaster, tenantId, isLoading: roleLoading } = useUserRole()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)

  // Fetch tenants list only for master users (they can switch)
  const { data: tenantsData, isLoading: tenantsLoading } = useTenants({
    status: 'active',
    enabled: isMaster,
  })

  // Fetch current tenant for non-master users
  const { data: currentUserTenant } = useCurrentTenant()

  const tenants = tenantsData?.items ?? []

  // Initialize selected tenant from localStorage or current tenant
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTenantId = localStorage.getItem('selectedTenantId')
      if (storedTenantId) {
        setSelectedTenantId(storedTenantId)
      } else if (tenantId) {
        setSelectedTenantId(tenantId)
      }
    }
  }, [tenantId])

  // Find current tenant info
  const currentTenant = tenants.find(t => t.id === selectedTenantId)
  
  // Display name logic:
  // 1. If we have the current tenant, use its name
  // 2. In DEV_MODE, show dev tenant name as fallback
  // 3. Otherwise show "Seleccionar estudio"
  const displayName = currentTenant?.name 
    ?? (DEV_MODE ? DEV_DEFAULTS.tenantName : 'Seleccionar estudio')

  // Loading state (skip in DEV_MODE since we have immediate data)
  if (roleLoading && !DEV_MODE) {
    return (
      <div className={cn("h-9 w-40 rounded-md bg-muted animate-pulse", className)} />
    )
  }

  // Non-master users: show tenant name as badge (read-only)
  if (!isMaster) {
    const tenantName = currentUserTenant?.name 
      ?? (DEV_MODE ? DEV_DEFAULTS.tenantName : 'Cargando...')
    
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 text-sm", className)}>
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium truncate max-w-28 sm:max-w-50">
          {tenantName}
        </span>
      </div>
    )
  }

  // Master users: show dropdown to switch tenants
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between w-44 sm:min-w-50 sm:w-auto", className)}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayName}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-55 p-0">
        <Command>
          <CommandInput placeholder="Buscar estudio..." />
          <CommandList>
            <CommandEmpty>
              {tenantsLoading ? 'Cargando...' : 'No se encontraron estudios.'}
            </CommandEmpty>
            <CommandGroup>
              {tenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={tenant.name}
                  onSelect={() => {
                    setSelectedTenantId(tenant.id)
                    setOpen(false)
                    // Save selected tenant to localStorage for X-Tenant-Context header
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('selectedTenantId', tenant.id)
                      // Notify other components of tenant change
                      window.dispatchEvent(new CustomEvent('tenantChanged', { detail: tenant.id }))
                      // Invalidate all queries to refetch with new tenant context
                      queryClient.invalidateQueries()
                    }
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedTenantId === tenant.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{tenant.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
