'use client'

import { useState } from 'react'
import { Code2, Eye, EyeOff, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
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
import { useUpdateApiCredentials, useDeleteApiCredentials } from '@/hooks/use-companies'
import type { Company } from '@/types'

interface ApiCredentialsDialogProps {
  company: Company | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiCredentialsDialog({ company, open, onOpenChange }: ApiCredentialsDialogProps) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  
  const updateApiCredentials = useUpdateApiCredentials()
  const deleteApiCredentials = useDeleteApiCredentials()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return

    updateApiCredentials.mutate(
      {
        companyId: company.id,
        data: {
          client_id: clientId,
          client_secret: clientSecret,
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

  const handleDelete = () => {
    if (!company) return

    deleteApiCredentials.mutate(company.id, {
      onSuccess: () => {
        onOpenChange(false)
        resetForm()
      },
    })
  }

  const resetForm = () => {
    setClientId('')
    setClientSecret('')
    setShowSecret(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const isPending = updateApiCredentials.isPending || deleteApiCredentials.isPending

  if (!company) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            API Key SUNAT
          </DialogTitle>
          <DialogDescription>
            Configura las credenciales de API de SUNAT para{' '}
            <span className="font-medium">{company.business_name}</span>
            <br />
            <span className="text-xs">RUC: {company.ruc}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client_id">Client ID</Label>
            <Input
              id="client_id"
              placeholder="Ej: 2c4f8a1b-..."
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              ID de cliente proporcionado por SUNAT API
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_secret">Client Secret</Label>
            <div className="relative">
              <Input
                id="client_secret"
                type={showSecret ? 'text' : 'password'}
                placeholder="Secreto de cliente"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showSecret ? 'Ocultar secreto' : 'Mostrar secreto'}
                </span>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                El Client Secret se encripta en Microsoft Cloud antes de almacenarse.
                Nunca se guarda en texto plano.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <div className="flex gap-2">
              {company.has_api_credentials && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {deleteApiCredentials.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !clientId || !clientSecret}>
                {updateApiCredentials.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar API Key'
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
