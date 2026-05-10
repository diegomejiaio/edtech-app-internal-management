'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Pencil, Tag, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { EMAIL_CATEGORY_CONFIG } from '@/lib/email-constants'
import { useDeleteEmailTemplate } from '@/hooks/use-email-templates'
import type { EmailTemplate } from '@/types'

interface TemplateCardProps {
  template: EmailTemplate
  className?: string
}

export function TemplateCard({ template, className }: TemplateCardProps) {
  const categoryConfig = EMAIL_CATEGORY_CONFIG[template.category]
  const deleteMutation = useDeleteEmailTemplate()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Can delete if: belongs to tenant AND not customized from system (no base_template_id)
  const canDelete = template.tenant_id !== null && !template.base_template_id && !template.is_system

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(template.id)
    setShowDeleteDialog(false)
  }

  return (
    <Card className={cn('group relative transition-shadow hover:shadow-md', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('border-transparent text-xs', categoryConfig.className)}
                >
                  <Tag className="mr-1 h-3 w-3" />
                  {categoryConfig.label}
                </Badge>
                {template.is_customized && (
                  <Badge variant="secondary" className="text-xs">
                    Personalizado
                  </Badge>
                )}
                {template.tenant_id && !template.base_template_id && !template.is_system && (
                  <Badge variant="outline" className="text-xs">
                    Propia
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Link href={`/communications/email/templates/edit?id=${template.id}`}>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Editar plantilla</span>
              </Link>
            </Button>
            {canDelete && (
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Eliminar plantilla</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
                    <AlertDialogDescription>
                      ¿Estás seguro de eliminar la plantilla &quot;{template.name}&quot;? Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Eliminar
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2">
          {template.description}
        </CardDescription>
        <div className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Asunto:</span>{' '}
          <span className="line-clamp-1">{template.subject}</span>
        </div>
        {template.variables.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {template.variables.slice(0, 4).map((variable) => (
              <code
                key={variable.key}
                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {`{{${variable.key}}}`}
              </code>
            ))}
            {template.variables.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{template.variables.length - 4} más
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function TemplateCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <div className="h-9 w-9 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-2/3 rounded bg-muted" />
            <div className="h-4 w-1/4 rounded bg-muted" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
        <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
      </CardContent>
    </Card>
  )
}
