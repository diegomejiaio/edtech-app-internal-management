'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, type buttonVariants } from './button'
import type { VariantProps } from 'class-variance-authority'

// =============================================================================
// LoadingSpinner - Centered spinner for loading states
// =============================================================================

interface LoadingSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

const spinnerSizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

/**
 * Centered loading spinner with optional text
 * @example
 * <LoadingSpinner />
 * <LoadingSpinner size="lg" text="Cargando datos..." />
 */
export function LoadingSpinner({ className, size = 'md', text }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-8 gap-2', className)}>
      <Loader2 className={cn(spinnerSizes[size], 'animate-spin text-muted-foreground')} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  )
}

// =============================================================================
// SubmitButton - Button with loading state for form submissions
// =============================================================================

interface SubmitButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  isPending: boolean
  loadingText?: string
  asChild?: boolean
}

/**
 * Button that shows loading spinner when isPending is true
 * @example
 * <SubmitButton isPending={mutation.isPending}>Guardar</SubmitButton>
 * <SubmitButton isPending={isPending} loadingText="Enviando...">Enviar</SubmitButton>
 */
export function SubmitButton({
  isPending,
  loadingText = 'Guardando...',
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button {...props} disabled={isPending || disabled}>
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

// =============================================================================
// InlineSpinner - Small spinner for inline loading indicators
// =============================================================================

interface InlineSpinnerProps {
  className?: string
}

/**
 * Small inline spinner for input fields or buttons
 * @example
 * <Input ... />
 * {isSearching && <InlineSpinner className="absolute right-3 top-1/2 -translate-y-1/2" />}
 */
export function InlineSpinner({ className }: InlineSpinnerProps) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-muted-foreground', className)} />
}
