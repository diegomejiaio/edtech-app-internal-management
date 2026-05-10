'use client'

import { useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateCompany } from '@/hooks/use-companies'

interface AddCompanyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddCompanyDialog({ open, onOpenChange }: AddCompanyDialogProps) {
  const [ruc, setRuc] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [rucError, setRucError] = useState('')

  const createCompany = useCreateCompany()

  const validateRuc = (value: string): boolean => {
    // RUC must be exactly 11 digits
    if (!/^\d{11}$/.test(value)) {
      setRucError('El RUC debe tener 11 dígitos')
      return false
    }
    // RUC must start with 10 (persona natural) or 20 (persona jurídica)
    if (!value.startsWith('10') && !value.startsWith('20')) {
      setRucError('El RUC debe iniciar con 10 o 20')
      return false
    }
    setRucError('')
    return true
  }

  const handleRucChange = (value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, '').slice(0, 11)
    setRuc(digitsOnly)
    if (digitsOnly.length === 11) {
      validateRuc(digitsOnly)
    } else {
      setRucError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateRuc(ruc)) return

    createCompany.mutate(
      {
        ruc,
        business_name: businessName,
        email: email || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          resetForm()
        },
      }
    )
  }

  const resetForm = () => {
    setRuc('')
    setBusinessName('')
    setEmail('')
    setRucError('')
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
      createCompany.reset()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Nueva Empresa
          </DialogTitle>
          <DialogDescription>
            Agrega una nueva empresa a tu cuenta para gestionar sus notificaciones SUNAT.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ruc">RUC *</Label>
            <div className="relative">
              <Input
                id="ruc"
                placeholder="20612736180"
                value={ruc}
                onChange={(e) => handleRucChange(e.target.value)}
                required
                autoComplete="off"
                className={`font-mono ${rucError ? 'border-destructive' : ''}`}
                maxLength={11}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {ruc.length}/11
              </div>
            </div>
            {rucError && (
              <p className="text-xs text-destructive">{rucError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_name">Razón Social *</Label>
            <Input
              id="business_name"
              placeholder="Nombre de la empresa"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="contacto@empresa.pe"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Email de contacto para notificaciones
            </p>
          </div>

          {createCompany.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                {createCompany.error instanceof Error 
                  ? createCompany.error.message 
                  : 'Error al crear la empresa'}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createCompany.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createCompany.isPending || !ruc || !businessName || !!rucError}
            >
              {createCompany.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Agregar Empresa'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
