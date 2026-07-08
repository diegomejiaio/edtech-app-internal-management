'use client';

/**
 * Reusable form sheet for entity create/edit operations.
 *
 * Drop-in replacement for FormDialog that uses Sheet instead of Dialog.
 * Better for forms with many fields due to vertical scroll.
 * Includes AnimatePresence for smooth content transitions.
 *
 * Usage:
 *   <FormSheetDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Nuevo alumno"
 *     description="Completa los datos del alumno"
 *     isLoading={mutation.isPending}
 *     onSubmit={handleSubmit}
 *   >
 *     <FormFields />
 *   </FormSheetDialog>
 */

import type { FormEvent, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FormSheet,
  FormSheetHeader,
  FormSheetContent,
  FormSheetFooter,
} from '@/components/ui/form-sheet';
import { Button } from '@/components/ui/button';
import { fadeUpVariants } from '@/components/motion/variants';

interface FormSheetDialogProps {
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

export function FormSheetDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  isLoading = false,
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
}: FormSheetDialogProps) {
  return (
    <FormSheet open={open} onOpenChange={onOpenChange}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <FormSheetHeader title={title} description={description} />
        <FormSheetContent className="space-y-4">
          <AnimatePresence mode="wait">
            {open && (
              <motion.div
                key="form-content"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeUpVariants}
                className="space-y-4"
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </FormSheetContent>
        <FormSheetFooter>
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
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
