'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeleteCompany } from '@/hooks/use-companies'
import type { Company } from '@/types'

interface DeleteCompanyDialogProps {
  company: Company | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteCompanyDialog({ company, open, onOpenChange }: DeleteCompanyDialogProps) {
  const deleteCompany = useDeleteCompany()

  const handleDelete = () => {
    if (!company) return

    deleteCompany.mutate(company.id, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      deleteCompany.reset()
    }
    onOpenChange(newOpen)
  }

  if (!company) return null

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            ¿Eliminar empresa?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Estás a punto de eliminar la empresa:
              </p>
              <p className="font-medium text-foreground">
                {company.business_name}
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                RUC: {company.ruc}
              </p>
              <p className="mt-4 text-destructive">
                Esta acción no se puede deshacer. Se eliminarán todas las credenciales 
                y notificaciones asociadas a esta empresa.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteCompany.isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {deleteCompany.error instanceof Error 
                ? deleteCompany.error.message 
                : 'Error al eliminar la empresa'}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCompany.isPending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteCompany.isPending}
          >
            {deleteCompany.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Sí, eliminar'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
