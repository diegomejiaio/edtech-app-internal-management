'use client';

/**
 * Espacio Pro logo with icon and full variants.
 *
 * - `icon`: Compact EP initials (for collapsed sidebar)
 * - `full`: Full "Espacio Pro" text (default)
 *
 * Placeholder for M0 — replace with branded assets when available:
 * - /isotipo-light.svg, /isotipo-dark.svg for icon variant
 * - /logo-light.svg, /logo-dark.svg for full variant
 */

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Logo variant: 'icon' for compact, 'full' for complete text */
  variant?: 'icon' | 'full';
}

export function Logo({ className, variant = 'full' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm',
          'w-8 h-8',
          className
        )}
        aria-label="Espacio Pro"
      >
        EP
      </span>
    );
  }

  return (
    <span className={cn('whitespace-nowrap', className)} aria-label="Espacio Pro">
      <strong>Espacio</strong> Pro
    </span>
  );
}
