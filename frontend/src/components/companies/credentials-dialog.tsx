'use client'

import { useState } from 'react'
import { KeyRound, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
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
import { useUpdateCredentials } from '@/hooks/use-companies'
import type { Company } from '@/types'

interface CredentialsDialogProps {
  company: Company | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CredentialsDialog({ company, open, onOpenChange }: CredentialsDialogProps) {
  const [solUser, setSolUser] = useState('')
  const [solPassword, setSolPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  const updateCredentials = useUpdateCredentials()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return

    updateCredentials.mutate(
      {
        companyId: company.id,
        data: {
          sol_user: solUser,
          sol_password: solPassword,
        },
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
    setSolUser('')
    setSolPassword('')
    setShowPassword(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  if (!company) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Credenciales SOL
          </DialogTitle>
          <DialogDescription>
            Configura las credenciales SUNAT SOL para{' '}
            <span className="font-medium">{company.business_name}</span>
            <br />
            <span className="text-xs">RUC: {company.ruc}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sol_user">Usuario SOL</Label>
            <Input
              id="sol_user"
              placeholder="Ej: MODDATOS, FACTURA01"
              value={solUser}
              onChange={(e) => setSolUser(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Usuario secundario de SUNAT (no usar el principal)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sol_password">Contraseña SOL</Label>
            <div className="relative">
              <Input
                id="sol_password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña del usuario SOL"
                value={solPassword}
                onChange={(e) => setSolPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                </span>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Las credenciales se encriptan con en Microsoft Cloud antes de almacenarse.
                Nunca se guardan en texto plano.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={updateCredentials.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateCredentials.isPending || !solUser || !solPassword}>
              {updateCredentials.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Credenciales'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
