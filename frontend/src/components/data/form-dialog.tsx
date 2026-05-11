'use client';

/**
 * Reusable form dialog for entity create/edit operations.
 *
 * Wraps shadcn Dialog with a title, description, form slot, and
 * submit/cancel actions. Handles loading state during mutations.
 *
 * Usage:
 *   <FormDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Nuevo alumno"
 *     description="Completa los datos del alumno"
 *     isLoading={mutation.isPending}
 *     onSubmit={handleSubmit}
 *   >
 *     <FormFields />
 *   </FormDialog>
 */

import type { FormEvent, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Called when the form is submitted. */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Disables buttons and shows loading state. */
  isLoading?: boolean;
  /** Submit button text. Default: "Guardar". */
  submitLabel?: string;
  /** Cancel button text. Default: "Cancelar". */
  cancelLabel?: string;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  isLoading = false,
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
