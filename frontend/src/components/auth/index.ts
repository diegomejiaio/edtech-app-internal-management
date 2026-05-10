/**
 * Auth components index
 * 
 * Export all auth-related components and hooks for easy importing.
 * 
 * @example
 * import { RequireRole, RequirePermission, useIsAdmin } from '@/components/auth'
 */

export { RequirePermission, usePermission } from './require-permission'
export { 
    RequireRole, 
    useRole, 
    useIsMaster, 
    useIsAdmin, 
    useIsMember 
} from './require-role'
