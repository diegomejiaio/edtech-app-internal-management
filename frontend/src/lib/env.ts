/**
 * Configuración de entorno centralizada
 * Equivalente a environment.ts de Angular
 * 
 * Uso: import { env, DEV_MODE, DEV_DEFAULTS } from '@/lib/env'
 * 
 * DEV_MODE Controls:
 * - When true: Bypasses Clerk authentication, uses mock user/tenant
 * - When false: Full Clerk authentication required
 * 
 * Note: Uses NEXT_PUBLIC_ prefix for Azure Static Web Apps compatibility
 */

/**
 * Development mode flag - bypasses Clerk authentication
 * 
 * SECURITY: Never enable in production deployments
 * Set via: NEXT_PUBLIC_DEV_MODE=true in .env.local
 */
export const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

/**
 * Default values used when DEV_MODE is enabled
 * Matches backend defaults in back/bff/config.py
 */
export const DEV_DEFAULTS = {
    tenantId: process.env.NEXT_PUBLIC_DEV_TENANT_ID || 'tnnt-estudios-fuentes',
    tenantName: process.env.NEXT_PUBLIC_DEV_TENANT_NAME || 'Estudio Fuentes (Dev)',
    userId: process.env.NEXT_PUBLIC_DEV_USER_ID || 'user_dev_001',
    userName: 'Dev User',
    userEmail: 'dev@clear-book.local',
    userRole: 'master' as const,
    userImageUrl: null as string | null,
} as const

export const env = {
    // API
    apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
    apiVersion: '/api/v1',

    // Dev Mode
    devMode: DEV_MODE,
    devDefaults: DEV_DEFAULTS,

    // Auth - enabled when NOT in dev mode and Clerk key is configured
    authEnabled: !DEV_MODE && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',

    // Feature flags
    isDev: process.env.NODE_ENV === 'development',
    isProd: process.env.NODE_ENV === 'production',

    // App info
    appName: 'Clearbook',
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
} as const

// Validación en desarrollo (solo en cliente)
if (typeof window !== 'undefined') {
    if (env.isDev && !env.apiUrl) {
        console.warn('⚠️ Missing env var: NEXT_PUBLIC_API_URL - API calls will fail')
    }
    
    if (DEV_MODE) {
        console.warn(
            '⚠️ DEV_MODE ENABLED - Authentication bypassed!',
            '\n   Tenant:', DEV_DEFAULTS.tenantId,
            '\n   User:', DEV_DEFAULTS.userId,
            '\n   Role:', DEV_DEFAULTS.userRole
        )
    }
}
