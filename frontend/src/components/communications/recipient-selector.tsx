'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Building2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useCompanies } from '@/hooks/use-companies'
import type { Company, EmailRecipient } from '@/types'

interface RecipientSelectorProps {
  value: EmailRecipient[]
  onChange: (recipients: EmailRecipient[]) => void
  className?: string
}

export function RecipientSelector({ value, onChange, className }: RecipientSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data, isLoading } = useCompanies({ is_active: true, limit: 100 })

  const companiesData = data?.items
  
  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    const companies = companiesData ?? []
    if (!search) return companies
    const searchLower = search.toLowerCase()
    return companies.filter(
      (c) =>
        c.business_name.toLowerCase().includes(searchLower) ||
        c.ruc.includes(searchLower)
    )
  }, [companiesData, search])

  const companies = companiesData ?? []

  // Selected company IDs
  const selectedIds = new Set(value.map((r) => r.company_id))
  const allSelected = companies.length > 0 && selectedIds.size === companies.length

  const toggleCompany = (company: Company) => {
    if (selectedIds.has(company.id)) {
      onChange(value.filter((r) => r.company_id !== company.id))
    } else {
      onChange([...value, { company_id: company.id, contact_ids: null }])
    }
  }

  const toggleAll = () => {
    if (allSelected) {
      onChange([])
    } else {
      onChange(companies.map((c) => ({ company_id: c.id, contact_ids: null })))
    }
  }

  const removeRecipient = (companyId: string) => {
    onChange(value.filter((r) => r.company_id !== companyId))
  }

  // Get company name by ID
  const getCompanyName = (companyId: string) => {
    return companies.find((c) => c.id === companyId)?.business_name ?? companyId
  }

  return (
    <div className={cn('space-y-3', className)}>
      <Label>Destinatarios</Label>
      
      {/* Selected recipients badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.slice(0, 5).map((recipient) => (
            <Badge
              key={recipient.company_id}
              variant="secondary"
              className="gap-1 pl-2 pr-1"
            >
              <Building2 className="h-3 w-3" />
              <span className="max-w-[150px] truncate">
                {getCompanyName(recipient.company_id)}
              </span>
              <button
                type="button"
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                onClick={() => removeRecipient(recipient.company_id)}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Quitar</span>
              </button>
            </Badge>
          ))}
          {value.length > 5 && (
            <Badge variant="outline" className="font-normal">
              +{value.length - 5} más
            </Badge>
          )}
        </div>
      )}

      {/* Company selector popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value.length === 0 ? (
              <span className="text-muted-foreground">Seleccionar empresas...</span>
            ) : (
              <span>{value.length} empresa{value.length !== 1 ? 's' : ''} seleccionada{value.length !== 1 ? 's' : ''}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          {/* Search */}
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Select all */}
          <div className="border-b p-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Seleccionar todas ({companies.length})
              </label>
            </div>
          </div>

          {/* Company list */}
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {search ? 'No se encontraron empresas.' : 'No hay empresas activas.'}
              </div>
            ) : (
              <div className="p-2">
                {filteredCompanies.map((company) => {
                  const isSelected = selectedIds.has(company.id)
                  return (
                    <div
                      key={company.id}
                      className={cn(
                        'flex items-center space-x-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors',
                        'hover:bg-muted/50',
                        isSelected && 'bg-muted'
                      )}
                      onClick={() => toggleCompany(company)}
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{company.business_name}</p>
                        <p className="text-xs text-muted-foreground">{company.ruc}</p>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        Los correos se enviarán a los contactos configurados de cada empresa.
      </p>
    </div>
  )
}
