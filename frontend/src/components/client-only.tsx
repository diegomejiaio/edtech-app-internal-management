'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

interface ClientOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Wrapper component that only renders children on the client side.
 *
 * Use this to wrap components with Radix UI primitives (Select, Popover, etc.)
 * that generate random IDs causing hydration mismatches in static export mode.
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )

  if (!mounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
