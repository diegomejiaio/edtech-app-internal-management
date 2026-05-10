'use client'

/**
 * Permission Gate Component
 * 
 * Conditionally renders children based on user permission.
 * In DEV_MODE, always renders children (all permissions granted).
 * 
 * @example
 * <RequirePermission permission="org:empresas:create">
 *   <Button>Crear Empresa</Button>
 * </RequirePermission>
 */

import type { ReactNode } from 'react'
import { DEV_MODE } from '@/lib/env'
import { useAuthContext } from '@/providers/auth-provider'

interface RequirePermissionProps {
    /** Clerk permission string (e.g., 'org:empresas:create') */
    permission: string
    /** Content to render if permission is granted */
    children: ReactNode
    /** Optional fallback when permission denied */
    fallback?: ReactNode
}

/**
 * Check if user has a specific permission
 * 
 * In DEV_MODE, always returns true (all permissions granted for testing)
 * In production, checks against Clerk's has() function
 */
function useHasPermission(permission: string): boolean {
    const { has, role, isSignedIn, isLoaded } = useAuthContext()

    if (DEV_MODE) {
        return true
    }

    if (!isLoaded || !isSignedIn) {
        return false
    }

    // Master role has all permissions
    if (role === 'master') {
        return true
    }

    // Use Clerk's has() function to check permission
    if (has) {
        return has({ permission })
    }

    return false
}

export function RequirePermission({
    permission,
    children,
    fallback = null,
}: RequirePermissionProps) {
    const hasPermission = useHasPermission(permission)

    if (!hasPermission) {
        return <>{fallback}</>
    }

    return <>{children}</>
}

/**
 * Hook version for programmatic permission checks
 * 
 * @example
 * const canCreate = usePermission('org:empresas:create')
 * if (canCreate) { ... }
 */
export function usePermission(permission: string): boolean {
    return useHasPermission(permission)
}
