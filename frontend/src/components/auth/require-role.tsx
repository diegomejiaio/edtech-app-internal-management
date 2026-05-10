'use client'

/**
 * Role Gate Component
 * 
 * Conditionally renders children based on user role.
 * In DEV_MODE, always renders children (master role assumed).
 * 
 * Role hierarchy: master > admin > member
 * - master: Can access everything
 * - admin: Can access admin and member content
 * - member: Can only access member content
 * 
 * @example
 * <RequireRole role="admin">
 *   <ConfigurationPanel />
 * </RequireRole>
 */

import type { ReactNode } from 'react'
import { DEV_MODE, DEV_DEFAULTS } from '@/lib/env'
import { useAuthContext } from '@/providers/auth-provider'

type Role = 'master' | 'admin' | 'member'

interface RequireRoleProps {
    /** Minimum required role */
    role: Role
    /** Content to render if role requirement is met */
    children: ReactNode
    /** Optional fallback when role requirement not met */
    fallback?: ReactNode
}

/** Role hierarchy - higher index = higher privilege */
const ROLE_HIERARCHY: Record<Role, number> = {
    member: 1,
    admin: 2,
    master: 3,
}

/**
 * Check if user has at least the required role
 */
function useHasRole(requiredRole: Role): boolean {
    const { role, isSignedIn, isLoaded } = useAuthContext()

    if (DEV_MODE) {
        // In dev mode, check against dev default role
        const devRole = DEV_DEFAULTS.userRole as Role
        return ROLE_HIERARCHY[devRole] >= ROLE_HIERARCHY[requiredRole]
    }

    if (!isLoaded || !isSignedIn || !role) {
        return false
    }

    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole]
}

export function RequireRole({
    role,
    children,
    fallback = null,
}: RequireRoleProps) {
    const hasRole = useHasRole(role)

    if (!hasRole) {
        return <>{fallback}</>
    }

    return <>{children}</>
}

/**
 * Hook version for programmatic role checks
 * 
 * @example
 * const isAdmin = useRole('admin')
 * if (isAdmin) { ... }
 */
export function useRole(role: Role): boolean {
    return useHasRole(role)
}

/**
 * Convenience hooks for common role checks
 */
export function useIsMaster(): boolean {
    return useHasRole('master')
}

export function useIsAdmin(): boolean {
    return useHasRole('admin')
}

export function useIsMember(): boolean {
    return useHasRole('member')
}
